import { describe, expect, it } from "vitest";
import type { Env, VetoRecord } from "../types/index.js";
import { handleGetVetoStatus, handleActivateVeto, handleReleaseVeto } from "./veto.js";

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

type VetoRow = {
  session_id: string;
  is_active: number;
  activated_by: string | null;
  activated_at: string | null;
  reason: string | null;
  released_by: string | null;
  released_at: string | null;
};

function createMockDb(sessions: SessionRow[] = [], vetoSeed?: VetoRow) {
  let vetoRow: VetoRow | null = vetoSeed ?? null;

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
                return { ...row, veto_active: vetoRow?.is_active ?? 0 } as T;
              }
              if (sql.includes("SELECT * FROM veto_records")) {
                return (vetoRow as T) ?? (null as T);
              }
              return null as T;
            },
            async run() {
              if (sql.includes("INSERT OR IGNORE INTO veto_records")) {
                const [session_id] = params as [string];
                if (!vetoRow) {
                  vetoRow = { session_id, is_active: 0, activated_by: null, activated_at: null, reason: null, released_by: null, released_at: null };
                }
              }
              if (sql.includes("SET is_active = 1")) {
                const [activated_by, activated_at, reason] = params as [string, string, string];
                if (vetoRow) {
                  vetoRow = { ...vetoRow, is_active: 1, activated_by, activated_at, reason, released_by: null, released_at: null };
                }
              }
              if (sql.includes("SET is_active = 0")) {
                const [released_by, released_at] = params as [string, string];
                if (vetoRow) {
                  vetoRow = { ...vetoRow, is_active: 0, released_by, released_at };
                }
              }
              if (sql.includes("UPDATE sessions SET pipeline_state")) {
                const [pipeline_state, decision_status, , session_id] = params as [string, string, string, string];
                const row = sessions.find((s) => s.session_id === session_id);
                if (row) {
                  row.pipeline_state = pipeline_state;
                  row.decision_status = decision_status;
                }
              }
              return { success: true };
            },
          };
        },
      };
    },
  };

  return { db: db as unknown as Env["DECISIONS_DB"], getVetoRow: () => vetoRow };
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

function makeEnv(sessions: SessionRow[] = [], vetoSeed?: VetoRow): Env {
  const { db } = createMockDb(sessions, vetoSeed);
  return {
    DECISIONS_DB: db,
    ARTIFACTS_BUCKET: {} as Env["ARTIFACTS_BUCKET"],
    POLICY_STORE: {} as Env["POLICY_STORE"],
    API_KEY_SECRET: "test-secret",
  };
}

// ---------- handleGetVetoStatus ----------

describe("handleGetVetoStatus", () => {
  it("returns 200 with inactive veto for a session with no veto record", async () => {
    const env = makeEnv([makeSession()]);

    const response = await handleGetVetoStatus("sess-001", env);
    const body = await response.json() as { ok: boolean; data: VetoRecord };

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.data.is_active).toBe(false);
    expect(body.data.session_id).toBe("sess-001");
  });

  it("returns 200 with active veto when veto is activated", async () => {
    const vetoSeed: VetoRow = {
      session_id: "sess-001",
      is_active: 1,
      activated_by: "operator-001",
      activated_at: "2026-01-01T12:00:00.000Z",
      reason: "Compliance hold",
      released_by: null,
      released_at: null,
    };
    const env = makeEnv([makeSession()], vetoSeed);

    const response = await handleGetVetoStatus("sess-001", env);
    const body = await response.json() as { ok: boolean; data: VetoRecord };

    expect(response.status).toBe(200);
    expect(body.data.is_active).toBe(true);
    expect(body.data.activated_by).toBe("operator-001");
    expect(body.data.reason).toBe("Compliance hold");
  });

  it("returns 404 when session does not exist", async () => {
    const env = makeEnv([]);

    const response = await handleGetVetoStatus("nonexistent", env);
    const body = await response.json() as { ok: boolean; code: string };

    expect(response.status).toBe(404);
    expect(body.code).toBe("NOT_FOUND");
  });
});

// ---------- handleActivateVeto ----------

describe("handleActivateVeto", () => {
  it("returns 200 with active veto on valid request", async () => {
    const env = makeEnv([makeSession()]);
    const request = new Request("https://example.com/veto/sess-001/activate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activated_by: "operator-001", reason: "Legal hold" }),
    });

    const response = await handleActivateVeto(request, "sess-001", env);
    const body = await response.json() as { ok: boolean; data: VetoRecord };

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.data.is_active).toBe(true);
    expect(body.data.activated_by).toBe("operator-001");
    expect(body.data.reason).toBe("Legal hold");
  });

  it("returns 400 when activated_by is missing", async () => {
    const env = makeEnv([makeSession()]);
    const request = new Request("https://example.com/veto/sess-001/activate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: "Legal hold" }),
    });

    const response = await handleActivateVeto(request, "sess-001", env);

    expect(response.status).toBe(400);
  });

  it("returns 400 when reason is missing", async () => {
    const env = makeEnv([makeSession()]);
    const request = new Request("https://example.com/veto/sess-001/activate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activated_by: "operator-001" }),
    });

    const response = await handleActivateVeto(request, "sess-001", env);

    expect(response.status).toBe(400);
  });

  it("returns 404 when session does not exist", async () => {
    const env = makeEnv([]);
    const request = new Request("https://example.com/veto/nonexistent/activate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activated_by: "operator-001", reason: "Hold" }),
    });

    const response = await handleActivateVeto(request, "nonexistent", env);

    expect(response.status).toBe(404);
  });
});

// ---------- handleReleaseVeto ----------

describe("handleReleaseVeto", () => {
  it("returns 200 with released veto on valid request", async () => {
    const vetoSeed: VetoRow = {
      session_id: "sess-001",
      is_active: 1,
      activated_by: "operator-001",
      activated_at: "2026-01-01T12:00:00.000Z",
      reason: "Legal hold",
      released_by: null,
      released_at: null,
    };
    const env = makeEnv([makeSession()], vetoSeed);
    const request = new Request("https://example.com/veto/sess-001/release", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ released_by: "operator-002", release_reason: "Cleared" }),
    });

    const response = await handleReleaseVeto(request, "sess-001", env);
    const body = await response.json() as { ok: boolean; data: VetoRecord };

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.data.is_active).toBe(false);
    expect(body.data.released_by).toBe("operator-002");
  });

  it("returns 409 when no active veto exists", async () => {
    const vetoSeed: VetoRow = {
      session_id: "sess-001",
      is_active: 0,
      activated_by: null,
      activated_at: null,
      reason: null,
      released_by: null,
      released_at: null,
    };
    const env = makeEnv([makeSession()], vetoSeed);
    const request = new Request("https://example.com/veto/sess-001/release", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ released_by: "operator-002", release_reason: "Cleared" }),
    });

    const response = await handleReleaseVeto(request, "sess-001", env);
    const body = await response.json() as { code: string };

    expect(response.status).toBe(409);
    expect(body.code).toBe("INVALID_STATE");
  });

  it("returns 400 when released_by is missing", async () => {
    const vetoSeed: VetoRow = {
      session_id: "sess-001",
      is_active: 1,
      activated_by: "operator-001",
      activated_at: "2026-01-01T12:00:00.000Z",
      reason: "hold",
      released_by: null,
      released_at: null,
    };
    const env = makeEnv([makeSession()], vetoSeed);
    const request = new Request("https://example.com/veto/sess-001/release", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ release_reason: "Cleared" }),
    });

    const response = await handleReleaseVeto(request, "sess-001", env);

    expect(response.status).toBe(400);
  });

  it("returns 404 when session does not exist", async () => {
    const env = makeEnv([]);
    const request = new Request("https://example.com/veto/nonexistent/release", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ released_by: "operator-001", release_reason: "Cleared" }),
    });

    const response = await handleReleaseVeto(request, "nonexistent", env);

    expect(response.status).toBe(404);
  });
});
