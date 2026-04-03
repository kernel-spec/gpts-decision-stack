import { describe, expect, it } from "vitest";
import type { Env, Session } from "../types/index.js";
import { handleSubmitArtifact } from "./artifact.js";

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

function createMockDb(sessions: SessionRow[] = []) {
  const stageEntries: unknown[] = [];

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
              if (sql.includes("FROM artifact_lineage") && sql.includes("ORDER BY attempt DESC")) {
                return null as T;
              }
              if (sql.includes("COUNT(*)") && sql.includes("FROM stage_entries")) {
                return { cnt: 0 } as T;
              }
              return null as T;
            },
            async run() {
              if (sql.includes("INSERT INTO stage_entries")) {
                stageEntries.push(params);
              }
              return { success: true };
            },
            async all<T>() { return { results: [] as T[] }; },
          };
        },
      };
    },
  };

  const bucket = {
    put: async () => undefined,
  } as unknown as Env["ARTIFACTS_BUCKET"];

  return { db: db as unknown as Env["DECISIONS_DB"], bucket };
}

function makeEnv(sessions: SessionRow[] = []): Env {
  const { db, bucket } = createMockDb(sessions);
  return {
    DECISIONS_DB: db,
    ARTIFACTS_BUCKET: bucket,
    POLICY_STORE: {} as Env["POLICY_STORE"],
    API_KEY_SECRET: "test-secret",
  };
}

// ---------- handleSubmitArtifact ----------

describe("handleSubmitArtifact", () => {
  it("returns 404 when session does not exist", async () => {
    const env = makeEnv([]);
    const request = new Request("https://example.com/session/nonexistent/artifact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ artifact_type: "ProblemBrief", payload: {} }),
    });

    const response = await handleSubmitArtifact(request, "nonexistent", env);

    expect(response.status).toBe(404);
  });

  it("returns 400 when artifact_type is missing", async () => {
    const env = makeEnv([makeSession()]);
    const request = new Request("https://example.com/session/sess-001/artifact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ payload: { title: "Test" } }),
    });

    const response = await handleSubmitArtifact(request, "sess-001", env);

    expect(response.status).toBe(400);
  });

  it("returns 400 when payload is missing", async () => {
    const env = makeEnv([makeSession()]);
    const request = new Request("https://example.com/session/sess-001/artifact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ artifact_type: "ProblemBrief" }),
    });

    const response = await handleSubmitArtifact(request, "sess-001", env);

    expect(response.status).toBe(400);
  });

  it("returns 400 when delivery classification is invalid", async () => {
    const env = makeEnv([makeSession()]);
    const request = new Request("https://example.com/session/sess-001/artifact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        artifact_type: "ProblemBrief",
        payload: { title: "Test" },
        delivery: { handoff_status: "INVALID_STATUS" },
      }),
    });

    const response = await handleSubmitArtifact(request, "sess-001", env);

    expect(response.status).toBe(400);
  });

  it("returns 201 with artifact on valid request", async () => {
    const env = makeEnv([makeSession()]);
    const request = new Request("https://example.com/session/sess-001/artifact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        artifact_type: "ProblemBrief",
        payload: { title: "My Problem" },
      }),
    });

    const response = await handleSubmitArtifact(request, "sess-001", env);

    expect(response.status).toBe(201);
    const body = await response.json() as { ok: boolean; data: unknown };
    expect(body.ok).toBe(true);
    expect(body.data).toBeTruthy();
  });
});
