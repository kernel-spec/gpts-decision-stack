import { describe, expect, it } from "vitest";
import type { Env, DecisionLogEntry } from "../types/index.js";
import { appendDecisionLog, getDecisionLog } from "./decisionlog.js";

// ---------- Mock DB ----------

function createMockDb(seed: DecisionLogEntry[] = []) {
  const rows: DecisionLogEntry[] = [...seed];

  const db = {
    prepare(sql: string) {
      return {
        bind(...params: unknown[]) {
          return {
            async run() {
              if (sql.includes("INSERT INTO decision_log")) {
                const [id, session_id, agent_id, action, pipeline_state, decision_status, notes, logged_at] =
                  params as [string, string, string, string, string, string, string | null, string];
                rows.push({
                  id,
                  session_id,
                  agent_id,
                  action,
                  pipeline_state: pipeline_state as DecisionLogEntry["pipeline_state"],
                  decision_status: decision_status as DecisionLogEntry["decision_status"],
                  notes: notes ?? undefined,
                  logged_at,
                });
              }
              return { success: true };
            },
            async all<T>() {
              if (sql.includes("FROM decision_log")) {
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

// ---------- appendDecisionLog ----------

describe("appendDecisionLog", () => {
  it("inserts a log entry and returns it", async () => {
    const { db, rows } = createMockDb();

    const entry = await appendDecisionLog(db, "sess-001", {
      agent_id: "system",
      action: "session.created",
      pipeline_state: "intake",
      decision_status: "unresolved",
      notes: "Session started",
    });

    expect(entry.session_id).toBe("sess-001");
    expect(entry.agent_id).toBe("system");
    expect(entry.action).toBe("session.created");
    expect(entry.pipeline_state).toBe("intake");
    expect(entry.decision_status).toBe("unresolved");
    expect(entry.notes).toBe("Session started");
    expect(entry.id).toBeTruthy();
    expect(entry.logged_at).toBeTruthy();

    expect(rows).toHaveLength(1);
  });

  it("generates unique ids per call", async () => {
    const { db } = createMockDb();

    const e1 = await appendDecisionLog(db, "sess-001", {
      agent_id: "system",
      action: "session.created",
      pipeline_state: "intake",
      decision_status: "unresolved",
    });
    const e2 = await appendDecisionLog(db, "sess-001", {
      agent_id: "operator-001",
      action: "veto.activated",
      pipeline_state: "problem_framing",
      decision_status: "blocked",
    });

    expect(e1.id).not.toBe(e2.id);
  });

  it("stores entry without notes when notes is not provided", async () => {
    const { db, rows } = createMockDb();

    const entry = await appendDecisionLog(db, "sess-001", {
      agent_id: "system",
      action: "session.reentry",
      pipeline_state: "intake",
      decision_status: "unresolved",
    });

    expect(entry.notes).toBeUndefined();
    expect(rows[0].notes).toBeUndefined();
  });
});

// ---------- getDecisionLog ----------

describe("getDecisionLog", () => {
  it("returns all log entries for a session", async () => {
    const seed: DecisionLogEntry[] = [
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
    const { db } = createMockDb(seed);

    const log = await getDecisionLog(db, "sess-001");

    expect(log).toHaveLength(2);
    expect(log[0].action).toBe("session.created");
    expect(log[1].action).toBe("veto.activated");
    expect(log[1].notes).toBe("Compliance hold");
  });

  it("returns empty array when no entries exist for session", async () => {
    const { db } = createMockDb();

    const log = await getDecisionLog(db, "sess-empty");

    expect(log).toEqual([]);
  });
});
