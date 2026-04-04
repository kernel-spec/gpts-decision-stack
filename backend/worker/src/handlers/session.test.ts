/**
 * Minimum wiring tests for handleTriggerReentry.
 *
 * These tests prove that the previously dead recordStageEntry path is now live
 * in the reentry handler: a stage_entries row is written for the target stage
 * every time a reentry is triggered.
 */

import { describe, expect, it } from "vitest";
import type { Env, Session } from "../types/index.js";
import { handleTriggerReentry } from "./session.js";

// ---------- Helpers ----------

function makeSession(overrides?: Partial<Session>): Session {
  return {
    session_id: "sess-reentry-001",
    requestor_type: "founder-led",
    pipeline_state: "problem_framing",
    decision_status: "proceed",
    veto_active: false,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

type StageEntryRow = {
  stage_entry_id: string;
  session_id: string;
  pipeline_state: string;
  entry_count: number;
};

/**
 * Mock DB that handles all queries needed by handleTriggerReentry and
 * captures stage_entries inserts.
 */
function createReentryMockDb(session: Session) {
  const stageEntries: StageEntryRow[] = [];

  const db = {
    prepare(sql: string) {
      return {
        bind(...params: unknown[]) {
          return {
            async first<T>() {
              // getSession query (called at handler start and inside updateSessionState)
              if (sql.includes("FROM sessions s") && sql.includes("WHERE s.session_id")) {
                return {
                  session_id: session.session_id,
                  requestor_type: session.requestor_type,
                  pipeline_state: session.pipeline_state,
                  decision_status: session.decision_status,
                  created_at: session.created_at,
                  updated_at: session.updated_at,
                  veto_active: session.veto_active ? 1 : 0,
                } as T;
              }
              // stage_entries count (called by recordStageEntry)
              if (
                sql.includes("FROM stage_entries") &&
                sql.includes("ORDER BY entry_count DESC")
              ) {
                const [session_id, pipeline_state] = params as [string, string];
                const row = stageEntries
                  .filter(
                    (r) => r.session_id === session_id && r.pipeline_state === pipeline_state
                  )
                  .sort((a, b) => b.entry_count - a.entry_count)[0];
                return (row ? { entry_count: row.entry_count } : null) as T;
              }
              if (sql.includes("COUNT(*)") && sql.includes("FROM stage_entries")) {
                const [session_id, pipeline_state] = params as [string, string];
                const cnt = stageEntries.filter(
                  (r) => r.session_id === session_id && r.pipeline_state === pipeline_state
                ).length;
                return { cnt } as T;
              }
              return null as T;
            },
            async run() {
              if (sql.includes("INSERT INTO stage_entries")) {
                let stage_entry_id: string;
                let session_id: string;
                let pipeline_state: string;
                let entry_count: number;

                if (params.length === 7) {
                  // reentry lifecycle path: stage_entry_id, session_id, pipeline_state, entry_count, classified_by, created_at, lifecycle_id
                  [stage_entry_id, session_id, pipeline_state, entry_count] = params as [
                    string,
                    string,
                    string,
                    number,
                    string,
                    string,
                    string,
                  ];
                } else {
                  // legacy shape fallback
                  [stage_entry_id, session_id, pipeline_state, entry_count] = params as [
                    string,
                    string,
                    string,
                    number,
                  ];
                }
                stageEntries.push({ stage_entry_id, session_id, pipeline_state, entry_count });
              }
              if (sql.includes("UPDATE sessions SET pipeline_state")) {
                const [pipeline_state] = params as [string];
                session.pipeline_state = pipeline_state as Session["pipeline_state"];
                session.decision_status = "unresolved";
              }
              return { success: true };
            },
          };
        },
      };
    },
    async batch(stmts: Array<{ run(): Promise<unknown> }>) {
      const results = [];
      for (const s of stmts) results.push(await s.run());
      return results;
    },
  };

  return { db: db as unknown as Env["DECISIONS_DB"], stageEntries };
}

// ---------- Tests ----------

describe("handleTriggerReentry — recordStageEntry wiring", () => {
  it("writes a stage_entries row for the target stage on reentry", async () => {
    const session = makeSession();
    const { db, stageEntries } = createReentryMockDb(session);

    const env = { DECISIONS_DB: db } as unknown as Env;
    const request = new Request("https://example.com/sessions/sess-reentry-001/reentry", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        from_state: "problem_framing",
        to_state: "intake",
        reason: "restart required",
        agent_id: "operator-001",
      }),
    });

    const response = await handleTriggerReentry(request, "sess-reentry-001", env);

    expect(response.status).toBe(200);
    expect(stageEntries).toHaveLength(1);
    expect(stageEntries[0]).toMatchObject({
      session_id: "sess-reentry-001",
      pipeline_state: "intake", // the stage we are re-entering
      entry_count: 1,
    });
  });

  it("writes a loop signal entry when the same stage is re-entered a second time", async () => {
    const session = makeSession({ pipeline_state: "problem_framing" });
    const { db, stageEntries } = createReentryMockDb(session);

    const env = { DECISIONS_DB: db } as unknown as Env;

    // First reentry to intake
    await handleTriggerReentry(
      new Request("https://example.com/sessions/sess-reentry-001/reentry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          from_state: "problem_framing",
          to_state: "intake",
          reason: "first reentry",
          agent_id: "operator-001",
        }),
      }),
      "sess-reentry-001",
      env
    );

    // Second reentry to the same stage — should produce entry_count=2 (loop)
    await handleTriggerReentry(
      new Request("https://example.com/sessions/sess-reentry-001/reentry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          from_state: "intake",
          to_state: "intake",
          reason: "second reentry",
          agent_id: "operator-001",
        }),
      }),
      "sess-reentry-001",
      env
    );

    expect(stageEntries).toHaveLength(2);
    expect(stageEntries[1]).toMatchObject({
      session_id: "sess-reentry-001",
      pipeline_state: "intake",
      entry_count: 2,
    });
  });

  it("rejects reentry when session has active veto", async () => {
    const session = makeSession({ veto_active: true, decision_status: "blocked" });
    const { db } = createReentryMockDb(session);

    const env = { DECISIONS_DB: db } as unknown as Env;
    const request = new Request("https://example.com/sessions/sess-reentry-001/reentry", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        from_state: "problem_framing",
        to_state: "intake",
        reason: "restart required",
        agent_id: "operator-001",
      }),
    });

    const response = await handleTriggerReentry(request, "sess-reentry-001", env);

    expect(response.status).toBe(409);
    const body = await response.json() as { ok: boolean; code: string; error: string };
    expect(body.ok).toBe(false);
    expect(body.code).toBe("ILLEGAL_REENTRY_TRANSITION");
    expect(body.error).toContain("active veto");
  });

  it("rejects illegal forward reentry transition", async () => {
    const session = makeSession({ pipeline_state: "intake" });
    const { db } = createReentryMockDb(session);

    const env = { DECISIONS_DB: db } as unknown as Env;
    const request = new Request("https://example.com/sessions/sess-reentry-001/reentry", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        from_state: "intake",
        to_state: "problem_framing", // illegal: forward progression not allowed
        reason: "invalid forward move",
        agent_id: "operator-001",
      }),
    });

    const response = await handleTriggerReentry(request, "sess-reentry-001", env);

    expect(response.status).toBe(409);
    const body = await response.json() as { ok: boolean; code: string };
    expect(body.ok).toBe(false);
    expect(body.code).toBe("ILLEGAL_REENTRY_TRANSITION");
  });

  it("rejects reentry when from_state does not match current session state", async () => {
    const session = makeSession({ pipeline_state: "problem_framing" });
    const { db } = createReentryMockDb(session);

    const env = { DECISIONS_DB: db } as unknown as Env;
    const request = new Request("https://example.com/sessions/sess-reentry-001/reentry", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        from_state: "intake", // wrong: session is actually at problem_framing
        to_state: "intake",
        reason: "invalid from_state",
        agent_id: "operator-001",
      }),
    });

    const response = await handleTriggerReentry(request, "sess-reentry-001", env);

    expect(response.status).toBe(409);
    const body = await response.json() as { ok: boolean; code: string };
    expect(body.ok).toBe(false);
    expect(body.code).toBe("ILLEGAL_REENTRY_TRANSITION");
  });
});
