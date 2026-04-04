import { describe, expect, it } from "vitest";
import type { Env, Session } from "../types/index.js";
import { handleCreateSession, handleGetSession } from "./session.js";

// ---------- Helpers ----------

type SessionRow = {
  session_id: string;
  agent_id: string;
  requestor_type: string;
  external_ref: string | null;
  pipeline_state: string;
  decision_status: string;
  created_at: string;
  updated_at: string;
  veto_active: number;
};

type StageEntryRow = {
  stage_entry_id: string;
  session_id: string;
  pipeline_state: string;
  entry_count: number;
};

function createMockDb(seed: SessionRow[] = []) {
  const sessions: SessionRow[] = [...seed];
  const stageEntries: StageEntryRow[] = [];

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
              if (sql.includes("COUNT(*)") && sql.includes("FROM stage_entries")) {
                return { cnt: 0 } as T;
              }
              return null as T;
            },
            async run() {
              if (sql.includes("INSERT INTO sessions")) {
                const [session_id, agent_id, requestor_type, external_ref, pipeline_state, decision_status, created_at, updated_at] =
                  params as [string, string, string, string | null, string, string, string, string];
                sessions.push({
                  session_id,
                  agent_id,
                  requestor_type,
                  external_ref,
                  pipeline_state,
                  decision_status,
                  created_at,
                  updated_at,
                  veto_active: 0,
                });
              }
              if (sql.includes("INSERT INTO stage_entries")) {
                const [stage_entry_id, session_id, pipeline_state, entry_count] = params as [
                  string,
                  string,
                  string,
                  number,
                ];
                stageEntries.push({ stage_entry_id, session_id, pipeline_state, entry_count });
              }
              return { success: true };
            },
          };
        },
      };
    },
    async batch(statements: Array<{ run(): Promise<unknown> }>) {
      const results = [];
      for (const stmt of statements) {
        results.push(await stmt.run());
      }
      return results;
    },
  };

  return { db: db as unknown as Env["DECISIONS_DB"], sessions, stageEntries };
}

function makeEnv(seed: SessionRow[] = []): Env {
  const { db } = createMockDb(seed);
  return {
    DECISIONS_DB: db,
    ARTIFACTS_BUCKET: {} as Env["ARTIFACTS_BUCKET"],
    POLICY_STORE: {} as Env["POLICY_STORE"],
    API_KEY_SECRET: "test-secret",
  };
}

function makeSessionRow(overrides?: Partial<SessionRow>): SessionRow {
  return {
    session_id: "sess-001",
    agent_id: "system",
    requestor_type: "founder-led",
    external_ref: null,
    pipeline_state: "intake",
    decision_status: "unresolved",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    veto_active: 0,
    ...overrides,
  };
}

// ---------- handleCreateSession ----------

describe("handleCreateSession", () => {
  it("returns 201 with created session on valid request", async () => {
    const env = makeEnv();
    const request = new Request("https://example.com/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requestor_type: "founder-led" }),
    });

    const response = await handleCreateSession(request, env);
    const body = await response.json() as { ok: boolean; data: Session };

    expect(response.status).toBe(201);
    expect(body.ok).toBe(true);
    expect(body.data.requestor_type).toBe("founder-led");
    expect(body.data.pipeline_state).toBe("intake");
    expect(body.data.decision_status).toBe("unresolved");
    expect(body.data.veto_active).toBe(false);
    expect(body.data.session_id).toBeTruthy();
  });

  it("returns 400 when requestor_type is missing", async () => {
    const env = makeEnv();
    const request = new Request("https://example.com/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    const response = await handleCreateSession(request, env);
    const body = await response.json() as { ok: boolean; code: string };

    expect(response.status).toBe(400);
    expect(body.ok).toBe(false);
    expect(body.code).toBe("INVALID_REQUEST");
  });

  it("returns 400 when requestor_type is not a valid value", async () => {
    const env = makeEnv();
    const request = new Request("https://example.com/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requestor_type: "unknown-type" }),
    });

    const response = await handleCreateSession(request, env);

    expect(response.status).toBe(400);
  });

  it("accepts all valid requestor_type values", async () => {
    for (const type of ["founder-led", "enterprise", "regulated", "enablement"]) {
      const env = makeEnv();
      const request = new Request("https://example.com/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestor_type: type }),
      });

      const response = await handleCreateSession(request, env);
      expect(response.status).toBe(201);
    }
  });

  it("treats non-string external_ref as null", async () => {
    const env = makeEnv();
    const request = new Request("https://example.com/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requestor_type: "enterprise", external_ref: 12345 }),
    });

    const response = await handleCreateSession(request, env);
    expect(response.status).toBe(201);
  });

  it("accepts valid string external_ref", async () => {
    const env = makeEnv();
    const request = new Request("https://example.com/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requestor_type: "enterprise", external_ref: "ext-ref-001" }),
    });

    const response = await handleCreateSession(request, env);
    expect(response.status).toBe(201);
  });

  it("creates session and stage_entry atomically in a single batch", async () => {
    const { db, sessions, stageEntries } = createMockDb();
    const env = { DECISIONS_DB: db } as unknown as Env;
    const request = new Request("https://example.com/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requestor_type: "founder-led" }),
    });

    const response = await handleCreateSession(request, env);
    const body = await response.json() as { ok: boolean; data: Session };

    expect(response.status).toBe(201);
    expect(sessions).toHaveLength(1);
    expect(stageEntries).toHaveLength(1);
    
    // Verify session
    expect(sessions[0].session_id).toBe(body.data.session_id);
    expect(sessions[0].pipeline_state).toBe("intake");
    
    // Verify stage_entry matches session
    expect(stageEntries[0].session_id).toBe(body.data.session_id);
    expect(stageEntries[0].pipeline_state).toBe("intake");
    expect(stageEntries[0].entry_count).toBe(1);
  });
});

// ---------- handleGetSession ----------

describe("handleGetSession", () => {
  it("returns 200 with session data when session exists", async () => {
    const row = makeSessionRow({ session_id: "sess-get-001", requestor_type: "enterprise" });
    const env = makeEnv([row]);

    const response = await handleGetSession("sess-get-001", env);
    const body = await response.json() as { ok: boolean; data: Session };

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.data.session_id).toBe("sess-get-001");
    expect(body.data.requestor_type).toBe("enterprise");
  });

  it("returns 404 when session does not exist", async () => {
    const env = makeEnv();

    const response = await handleGetSession("nonexistent-id", env);
    const body = await response.json() as { ok: boolean; code: string };

    expect(response.status).toBe(404);
    expect(body.ok).toBe(false);
    expect(body.code).toBe("NOT_FOUND");
  });
});
