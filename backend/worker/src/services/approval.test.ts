import { describe, expect, it } from "vitest";
import type { Env, Approval } from "../types/index.js";
import { submitApproval, getApprovals } from "./approval.js";

// ---------- Mock DB ----------

type ApprovalRow = {
  id: string;
  session_id: string;
  approval_type: string;
  submitted_by: string;
  decision: string;
  notes: string | null;
  submitted_at: string;
};

function createMockDb(seed: ApprovalRow[] = []) {
  const rows: ApprovalRow[] = [...seed];

  const db = {
    prepare(sql: string) {
      return {
        bind(...params: unknown[]) {
          return {
            async run() {
              if (sql.includes("INSERT INTO approvals")) {
                const [id, session_id, approval_type, submitted_by, decision, notes, submitted_at] =
                  params as [string, string, string, string, string, string | null, string];
                rows.push({ id, session_id, approval_type, submitted_by, decision, notes, submitted_at });
              }
              return { success: true };
            },
            async all<T>() {
              if (sql.includes("FROM approvals")) {
                const session_id = params[0] as string;
                const matching = rows.filter((r) => r.session_id === session_id);
                return { results: matching as unknown as T[] };
              }
              return { results: [] as T[] };
            },
          };
        },
      };
    },
  };

  return { db: db as unknown as Env["DECISIONS_DB"], rows };
}

// ---------- submitApproval ----------

describe("submitApproval", () => {
  it("inserts an approval row and returns the created approval", async () => {
    const { db, rows } = createMockDb();

    const result = await submitApproval(db, "sess-001", {
      approval_type: "legal_review",
      submitted_by: "lawyer-001",
      decision: "approved",
      notes: "Looks good",
    });

    expect(result.session_id).toBe("sess-001");
    expect(result.approval_type).toBe("legal_review");
    expect(result.submitted_by).toBe("lawyer-001");
    expect(result.decision).toBe("approved");
    expect(result.notes).toBe("Looks good");
    expect(result.id).toBeTruthy();
    expect(result.submitted_at).toBeTruthy();

    expect(rows).toHaveLength(1);
    expect(rows[0].decision).toBe("approved");
  });

  it("generates unique ids per call", async () => {
    const { db } = createMockDb();

    const a1 = await submitApproval(db, "sess-001", {
      approval_type: "legal_review",
      submitted_by: "lawyer-001",
      decision: "approved",
    });
    const a2 = await submitApproval(db, "sess-001", {
      approval_type: "legal_review",
      submitted_by: "lawyer-001",
      decision: "rejected",
    });

    expect(a1.id).not.toBe(a2.id);
  });

  it("stores null notes when notes is not provided", async () => {
    const { db, rows } = createMockDb();

    const result = await submitApproval(db, "sess-001", {
      approval_type: "compliance_review",
      submitted_by: "compliance-001",
      decision: "conditional",
    });

    expect(result.notes).toBeUndefined();
    expect(rows[0].notes).toBeNull();
  });

  it("accepts all valid decision values", async () => {
    const { db } = createMockDb();

    for (const decision of ["approved", "rejected", "conditional"] as const) {
      const result = await submitApproval(db, "sess-001", {
        approval_type: "review",
        submitted_by: "reviewer",
        decision,
      });
      expect(result.decision).toBe(decision);
    }
  });
});

// ---------- getApprovals ----------

describe("getApprovals", () => {
  it("returns all approvals for a session ordered by submitted_at", async () => {
    const seed: ApprovalRow[] = [
      {
        id: "appr-1",
        session_id: "sess-001",
        approval_type: "legal_review",
        submitted_by: "lawyer",
        decision: "approved",
        notes: null,
        submitted_at: "2026-01-01T10:00:00.000Z",
      },
      {
        id: "appr-2",
        session_id: "sess-001",
        approval_type: "compliance_review",
        submitted_by: "compliance",
        decision: "conditional",
        notes: "minor issue",
        submitted_at: "2026-01-01T11:00:00.000Z",
      },
    ];
    const { db } = createMockDb(seed);

    const approvals = await getApprovals(db, "sess-001");

    expect(approvals).toHaveLength(2);
    expect(approvals[0].id).toBe("appr-1");
    expect(approvals[1].id).toBe("appr-2");
    expect(approvals[1].notes).toBe("minor issue");
  });

  it("returns empty array when no approvals exist", async () => {
    const { db } = createMockDb();

    const approvals = await getApprovals(db, "sess-empty");

    expect(approvals).toEqual([]);
  });

  it("maps null notes to undefined in returned records", async () => {
    const seed: ApprovalRow[] = [
      {
        id: "appr-1",
        session_id: "sess-001",
        approval_type: "review",
        submitted_by: "reviewer",
        decision: "approved",
        notes: null,
        submitted_at: "2026-01-01T10:00:00.000Z",
      },
    ];
    const { db } = createMockDb(seed);

    const [approval] = await getApprovals(db, "sess-001");

    expect(approval.notes).toBeUndefined();
  });
});
