import { describe, expect, it } from "vitest";
import type { Env, Session } from "../types/index.js";
import { createSession, getSession, updateSessionState } from "./state.js";

// ---------- Mock DB ----------

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

function createMockDb(seed: SessionRow[] = []) {
  const sessions: SessionRow[] = [...seed];

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
                return {
                  ...row,
                  veto_active: 0,
                } as T;
              }
              return null as T;
            },
            async run() {
              if (sql.includes("INSERT INTO sessions")) {
                const [session_id, agent_id, requestor_type, external_ref, pipeline_state, decision_status, created_at, updated_at] =
                  params as [string, string, string, string | null, string, string, string, string];
                sessions.push({ session_id, agent_id, requestor_type, external_ref, pipeline_state, decision_status, created_at, updated_at, veto_active: 0 });
              }
              if (sql.includes("UPDATE sessions SET pipeline_state")) {
                const [pipeline_state, decision_status, updated_at, session_id] = params as [string, string, string, string];
                const row = sessions.find((s) => s.session_id === session_id);
                if (row) {
                  row.pipeline_state = pipeline_state;
                  row.decision_status = decision_status;
                  row.updated_at = updated_at;
                }
              }
              return { success: true };
            },
          };
        },
      };
    },
  };

  return { db: db as unknown as Env["DECISIONS_DB"], sessions };
}

// ---------- createSession ----------

describe("createSession", () => {
  it("inserts a session row and returns the created session", async () => {
    const { db, sessions } = createMockDb();

    const result = await createSession(db, { requestor_type: "founder-led" });

    expect(result.requestor_type).toBe("founder-led");
    expect(result.pipeline_state).toBe("intake");
    expect(result.decision_status).toBe("unresolved");
    expect(result.veto_active).toBe(false);
    expect(result.session_id).toBeTruthy();
    expect(result.created_at).toBeTruthy();
    expect(result.updated_at).toBeTruthy();

    expect(sessions).toHaveLength(1);
    expect(sessions[0].requestor_type).toBe("founder-led");
    expect(sessions[0].pipeline_state).toBe("intake");
  });

  it("generates unique session_ids per call", async () => {
    const { db } = createMockDb();

    const s1 = await createSession(db, { requestor_type: "founder-led" });
    const s2 = await createSession(db, { requestor_type: "founder-led" });

    expect(s1.session_id).not.toBe(s2.session_id);
  });

  it("accepts all valid requestor_types", async () => {
    const { db } = createMockDb();

    for (const type of ["founder-led", "enterprise", "regulated", "enablement"] as const) {
      const result = await createSession(db, { requestor_type: type });
      expect(result.requestor_type).toBe(type);
    }
  });

  it("stores external_ref when provided", async () => {
    const { db, sessions } = createMockDb();

    await createSession(db, { requestor_type: "enterprise", external_ref: "ext-123" });

    expect(sessions[0].external_ref).toBe("ext-123");
  });

  it("stores null external_ref when not provided", async () => {
    const { db, sessions } = createMockDb();

    await createSession(db, { requestor_type: "enterprise" });

    expect(sessions[0].external_ref).toBeNull();
  });
});

// ---------- getSession ----------

describe("getSession", () => {
  it("returns the session when found", async () => {
    const seed: SessionRow[] = [
      {
        session_id: "sess-abc",
        agent_id: "system",
        requestor_type: "founder-led",
        external_ref: null,
        pipeline_state: "problem_framing",
        decision_status: "unresolved",
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
        veto_active: 0,
      },
    ];
    const { db } = createMockDb(seed);

    const session = await getSession(db, "sess-abc");

    expect(session).not.toBeNull();
    expect(session!.session_id).toBe("sess-abc");
    expect(session!.requestor_type).toBe("founder-led");
    expect(session!.pipeline_state).toBe("problem_framing");
    expect(session!.decision_status).toBe("unresolved");
    expect(session!.veto_active).toBe(false);
  });

  it("returns null when session does not exist", async () => {
    const { db } = createMockDb();

    const session = await getSession(db, "nonexistent");

    expect(session).toBeNull();
  });

  it("maps veto_active=1 to true", async () => {
    const seed: SessionRow[] = [
      {
        session_id: "sess-vetoed",
        agent_id: "system",
        requestor_type: "enterprise",
        external_ref: null,
        pipeline_state: "intake",
        decision_status: "blocked",
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
        veto_active: 1,
      },
    ];
    // Need custom db that returns veto_active=1
    const sessions = [...seed];
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
                  return { ...row, veto_active: 1 } as T;
                }
                return null as T;
              },
              async run() { return { success: true }; },
            };
          },
        };
      },
    } as unknown as Env["DECISIONS_DB"];

    const session = await getSession(db, "sess-vetoed");

    expect(session!.veto_active).toBe(true);
  });
});

// ---------- updateSessionState ----------

describe("updateSessionState", () => {
  it("updates pipeline_state and decision_status, then returns updated session", async () => {
    const seed: SessionRow[] = [
      {
        session_id: "sess-update",
        agent_id: "system",
        requestor_type: "founder-led",
        external_ref: null,
        pipeline_state: "intake",
        decision_status: "unresolved",
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
        veto_active: 0,
      },
    ];
    const { db } = createMockDb(seed);

    const updated = await updateSessionState(db, "sess-update", "problem_framing", "proceed");

    expect(updated).not.toBeNull();
    expect(updated!.pipeline_state).toBe("problem_framing");
    expect(updated!.decision_status).toBe("proceed");
    expect(updated!.session_id).toBe("sess-update");
  });

  it("returns null when session does not exist", async () => {
    const { db } = createMockDb();

    const result = await updateSessionState(db, "ghost-session", "intake", "unresolved");

    expect(result).toBeNull();
  });
});
