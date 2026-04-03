import { describe, expect, it } from "vitest";
import type { Env, DecisionLogEntry } from "../types/index.js";
import { handleGetDecisionLog } from "./decisionlog.js";

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

function createMockDb(sessions: SessionRow[] = [], logEntries: DecisionLogEntry[] = []) {
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
            async run() { return { success: true }; },
            async all<T>() {
              if (sql.includes("FROM decision_log")) {
                const session_id = params[0] as string;
                const matching = logEntries.filter((r) => r.session_id === session_id);
                return { results: matching as unknown as T[] };
              }
              return { results: [] as T[] };
            },
          };
        },
      };
    },
  };

  return { db: db as unknown as Env["DECISIONS_DB"] };
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

function makeEnv(sessions: SessionRow[] = [], logEntries: DecisionLogEntry[] = []): Env {
  const { db } = createMockDb(sessions, logEntries);
  return {
    DECISIONS_DB: db,
    ARTIFACTS_BUCKET: {} as Env["ARTIFACTS_BUCKET"],
    POLICY_STORE: {} as Env["POLICY_STORE"],
    API_KEY_SECRET: "test-secret",
  };
}

// ---------- handleGetDecisionLog ----------

describe("handleGetDecisionLog", () => {
  it("returns 200 with empty array when no log entries exist", async () => {
    const env = makeEnv([makeSession()]);

    const response = await handleGetDecisionLog("sess-001", env);
    const body = await response.json() as { ok: boolean; data: DecisionLogEntry[] };

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.data).toEqual([]);
  });

  it("returns 200 with log entries when they exist", async () => {
    const logEntries: DecisionLogEntry[] = [
      {
        id: "log-1",
        session_id: "sess-001",
        agent_id: "system",
        action: "session.created",
        pipeline_state: "intake",
        decision_status: "unresolved",
        logged_at: "2026-01-01T10:00:00.000Z",
      },
      {
        id: "log-2",
        session_id: "sess-001",
        agent_id: "operator-001",
        action: "veto.activated",
        pipeline_state: "problem_framing",
        decision_status: "blocked",
        notes: "Compliance hold",
        logged_at: "2026-01-01T11:00:00.000Z",
      },
    ];
    const env = makeEnv([makeSession()], logEntries);

    const response = await handleGetDecisionLog("sess-001", env);
    const body = await response.json() as { ok: boolean; data: DecisionLogEntry[] };

    expect(response.status).toBe(200);
    expect(body.data).toHaveLength(2);
    expect(body.data[0].action).toBe("session.created");
    expect(body.data[1].action).toBe("veto.activated");
  });

  it("returns 404 when session does not exist", async () => {
    const env = makeEnv([]);

    const response = await handleGetDecisionLog("nonexistent", env);
    const body = await response.json() as { ok: boolean; code: string };

    expect(response.status).toBe(404);
    expect(body.ok).toBe(false);
    expect(body.code).toBe("NOT_FOUND");
  });
});
