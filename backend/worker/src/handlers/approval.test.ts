import { describe, expect, it } from "vitest";
import type { Env, Approval } from "../types/index.js";
import { handleGetApprovals, handleSubmitApproval } from "./approval.js";

// ---------- Helpers ----------

type SessionRow = {
  session_id: string;
  requestor_type: string;
  pipeline_state: string;
  decision_status: string;
  created_at: string;
  updated_at: string;
  veto_active: number;
};

type ApprovalRow = {
  id: string;
  session_id: string;
  approval_type: string;
  submitted_by: string;
  decision: string;
  notes: string | null;
  submitted_at: string;
};

function createMockDb(sessions: SessionRow[] = [], approvals: ApprovalRow[] = []) {
  const approvalRows: ApprovalRow[] = [...approvals];

  const db = {
    prepare(sql: string) {
      return {
        bind(...params: unknown[]) {
          return {
            async first<T>() {
              if (sql.includes("FROM sessions s") && sql.includes("WHERE s.session_id")) {
                const session_id = params[0] as string;
                const row = sessions.find((s) => s.session_id === session_id);
                if (!row) return null as T;
                return { ...row, veto_active: 0 } as T;
              }
              return null as T;
            },
            async run() {
              if (sql.includes("INSERT INTO approvals")) {
                const [id, session_id, approval_type, submitted_by, decision, notes, submitted_at] =
                  params as [string, string, string, string, string, string | null, string];
                approvalRows.push({ id, session_id, approval_type, submitted_by, decision, notes, submitted_at });
              }
              return { success: true };
            },
            async all<T>() {
              if (sql.includes("FROM approvals")) {
                const session_id = params[0] as string;
                const matching = approvalRows.filter((r) => r.session_id === session_id);
                return { results: matching as unknown as T[] };
              }
              return { results: [] as T[] };
            },
          };
        },
      };
    },
  };

  return { db: db as unknown as Env["DECISIONS_DB"], approvalRows };
}

function makeSession(overrides?: Partial<SessionRow>): SessionRow {
  return {
    session_id: "sess-001",
    requestor_type: "founder-led",
    pipeline_state: "problem_framing",
    decision_status: "unresolved",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    veto_active: 0,
    ...overrides,
  };
}

function makeEnv(sessions: SessionRow[] = [], approvals: ApprovalRow[] = []): Env {
  const { db } = createMockDb(sessions, approvals);
  return {
    DECISIONS_DB: db,
    ARTIFACTS_BUCKET: {} as Env["ARTIFACTS_BUCKET"],
    POLICY_STORE: {} as Env["POLICY_STORE"],
    API_KEY_SECRET: "test-secret",
  };
}

// ---------- handleGetApprovals ----------

describe("handleGetApprovals", () => {
  it("returns 200 with empty array when no approvals exist", async () => {
    const env = makeEnv([makeSession()]);

    const response = await handleGetApprovals("sess-001", env);
    const body = await response.json() as { ok: boolean; data: Approval[] };

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.data).toEqual([]);
  });

  it("returns 200 with approvals list when approvals exist", async () => {
    const approvals: ApprovalRow[] = [
      {
        id: "appr-1",
        session_id: "sess-001",
        approval_type: "legal_review",
        submitted_by: "lawyer",
        decision: "approved",
        notes: null,
        submitted_at: "2026-01-01T10:00:00.000Z",
      },
    ];
    const env = makeEnv([makeSession()], approvals);

    const response = await handleGetApprovals("sess-001", env);
    const body = await response.json() as { ok: boolean; data: Approval[] };

    expect(response.status).toBe(200);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].approval_type).toBe("legal_review");
    expect(body.data[0].decision).toBe("approved");
  });

  it("returns 404 when session does not exist", async () => {
    const env = makeEnv([]);

    const response = await handleGetApprovals("nonexistent", env);
    const body = await response.json() as { ok: boolean; code: string };

    expect(response.status).toBe(404);
    expect(body.code).toBe("NOT_FOUND");
  });
});

// ---------- handleSubmitApproval ----------

describe("handleSubmitApproval", () => {
  it("returns 201 with created approval on valid request", async () => {
    const env = makeEnv([makeSession()]);
    const request = new Request("https://example.com/approval/sess-001/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        approval_type: "legal_review",
        submitted_by: "lawyer-001",
        decision: "approved",
        notes: "All good",
      }),
    });

    const response = await handleSubmitApproval(request, "sess-001", env);
    const body = await response.json() as { ok: boolean; data: Approval };

    expect(response.status).toBe(201);
    expect(body.ok).toBe(true);
    expect(body.data.approval_type).toBe("legal_review");
    expect(body.data.submitted_by).toBe("lawyer-001");
    expect(body.data.decision).toBe("approved");
    expect(body.data.notes).toBe("All good");
    expect(body.data.id).toBeTruthy();
    expect(body.data.submitted_at).toBeTruthy();
  });

  it("returns 400 when approval_type is missing", async () => {
    const env = makeEnv([makeSession()]);
    const request = new Request("https://example.com/approval/sess-001/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ submitted_by: "lawyer-001", decision: "approved" }),
    });

    const response = await handleSubmitApproval(request, "sess-001", env);

    expect(response.status).toBe(400);
  });

  it("returns 400 when submitted_by is missing", async () => {
    const env = makeEnv([makeSession()]);
    const request = new Request("https://example.com/approval/sess-001/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ approval_type: "legal_review", decision: "approved" }),
    });

    const response = await handleSubmitApproval(request, "sess-001", env);

    expect(response.status).toBe(400);
  });

  it("returns 400 when decision is missing", async () => {
    const env = makeEnv([makeSession()]);
    const request = new Request("https://example.com/approval/sess-001/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ approval_type: "legal_review", submitted_by: "lawyer-001" }),
    });

    const response = await handleSubmitApproval(request, "sess-001", env);

    expect(response.status).toBe(400);
  });

  it("returns 404 when session does not exist", async () => {
    const env = makeEnv([]);
    const request = new Request("https://example.com/approval/nonexistent/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        approval_type: "legal_review",
        submitted_by: "lawyer",
        decision: "approved",
      }),
    });

    const response = await handleSubmitApproval(request, "nonexistent", env);

    expect(response.status).toBe(404);
  });

  it("accepts all valid decision values", async () => {
    for (const decision of ["approved", "rejected", "conditional"]) {
      const env = makeEnv([makeSession()]);
      const request = new Request("https://example.com/approval/sess-001/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approval_type: "review", submitted_by: "reviewer", decision }),
      });

      const response = await handleSubmitApproval(request, "sess-001", env);
      expect(response.status).toBe(201);
    }
  });
});
