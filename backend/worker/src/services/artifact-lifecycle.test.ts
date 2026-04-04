import { describe, expect, it } from "vitest";
import type { Env, Session } from "../types/index.js";
import { submitArtifactWithLifecycle } from "./artifact.js";

type SessionRow = {
  session_id: string;
  requestor_type: Session["requestor_type"];
  pipeline_state: Session["pipeline_state"];
  decision_status: Session["decision_status"];
  created_at: string;
  updated_at: string;
  veto_active: number;
};

function makeSession(overrides: Partial<Session> = {}): Session {
  return {
    session_id: "sess-001",
    requestor_type: "founder-led",
    pipeline_state: "intake",
    decision_status: "unresolved",
    veto_active: false,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function createMockBucket() {
  const writes: Array<{ key: string; value: string }> = [];

  const bucket = {
    async put(key: string, value: string) {
      writes.push({ key, value });
    },
  };

  return {
    bucket: bucket as unknown as Env["ARTIFACTS_BUCKET"],
    writes,
  };
}

function createMockDb(session: Session) {
  const sessions = new Map<string, SessionRow>([
    [
      session.session_id,
      {
        session_id: session.session_id,
        requestor_type: session.requestor_type,
        pipeline_state: session.pipeline_state,
        decision_status: session.decision_status,
        created_at: session.created_at,
        updated_at: session.updated_at,
        veto_active: session.veto_active ? 1 : 0,
      },
    ],
  ]);
  const artifacts: Array<Record<string, unknown>> = [];
  const lineage: Array<Record<string, unknown>> = [];
  const deliveryEvents: Array<Record<string, unknown>> = [];
  const handoffEvents: Array<Record<string, unknown>> = [];
  const stageEntries: Array<Record<string, unknown>> = [];
  const decisionLog: Array<Record<string, unknown>> = [];

  const db = {
    prepare(sql: string) {
      return {
        bind(...params: unknown[]) {
          return {
            async first<T>() {
              if (sql.includes("FROM artifact_lineage") && sql.includes("ORDER BY attempt DESC")) {
                const [run_id, stage] = params as [string, string];
                const match = lineage
                  .filter((row) => row.run_id === run_id && row.stage === stage)
                  .sort((a, b) => Number(b.attempt) - Number(a.attempt))[0];
                return (match ?? null) as T | null;
              }

              if (sql.includes("FROM delivery_integrity_events")) {
                const [session_id, pipeline_state] = params as [string, string];
                const exists = deliveryEvents.some(
                  (row) =>
                    row.session_id === session_id && row.pipeline_state === pipeline_state
                );
                return (exists ? { has_prior: 1 } : null) as T | null;
              }

              if (sql.includes("FROM stage_entries") && sql.includes("ORDER BY entry_count DESC")) {
                const [session_id, pipeline_state] = params as [string, string];
                const match = stageEntries
                  .filter(
                    (row) =>
                      row.session_id === session_id && row.pipeline_state === pipeline_state
                  )
                  .sort((a, b) => Number(b.entry_count) - Number(a.entry_count))[0];
                return (match ?? null) as T | null;
              }

              return null;
            },
            async run() {
              if (sql.includes("INSERT INTO artifacts")) {
                const [id, session_id, artifact_type, r2_key, submitted_at] = params;
                artifacts.push({ id, session_id, artifact_type, r2_key, submitted_at });
              }

              if (sql.includes("INSERT INTO artifact_lineage")) {
                const [
                  lineage_id,
                  run_id,
                  artifact_id,
                  artifact_type,
                  stage,
                  attempt,
                  supersedes_artifact_id,
                  created_at,
                  created_by_role,
                  classified_by,
                  replacement_reason,
                  replacement_reason_source,
                  is_repair_attempt,
                  is_first_attempt_in_stage,
                  override_flag,
                ] = params;
                lineage.push({
                  lineage_id,
                  run_id,
                  artifact_id,
                  artifact_type,
                  stage,
                  attempt,
                  supersedes_artifact_id,
                  created_at,
                  created_by_role,
                  classified_by,
                  replacement_reason,
                  replacement_reason_source,
                  is_repair_attempt,
                  is_first_attempt_in_stage,
                  override_flag,
                });
              }

              if (sql.includes("INSERT INTO delivery_integrity_events")) {
                const [
                  event_id,
                  artifact_id,
                  session_id,
                  pipeline_state,
                  attempt,
                  supersedes_artifact_id,
                  replacement_reason,
                  handoff_status,
                  handoff_failure_reason,
                  stage_loop_detected,
                  classified_by,
                  classified_at,
                ] = params;
                deliveryEvents.push({
                  event_id,
                  artifact_id,
                  session_id,
                  pipeline_state,
                  attempt,
                  supersedes_artifact_id,
                  replacement_reason,
                  handoff_status,
                  handoff_failure_reason,
                  stage_loop_detected,
                  classified_by,
                  classified_at,
                });
              }

              if (sql.includes("INSERT INTO handoff_events")) {
                const [
                  event_id,
                  session_id,
                  pipeline_state,
                  outcome,
                  failure_reason,
                  classified_by,
                  classified_at,
                ] = params;
                handoffEvents.push({
                  event_id,
                  session_id,
                  pipeline_state,
                  outcome,
                  failure_reason,
                  classified_by,
                  classified_at,
                });
              }

              if (sql.includes("INSERT INTO stage_entries")) {
                const [
                  stage_entry_id,
                  session_id,
                  artifact_id,
                  pipeline_state,
                  entry_count,
                  classified_by,
                  created_at,
                ] = params;
                stageEntries.push({
                  stage_entry_id,
                  session_id,
                  artifact_id,
                  pipeline_state,
                  entry_count,
                  classified_by,
                  created_at,
                });
              }

              if (sql.includes("INSERT INTO decision_log")) {
                const [id, session_id, agent_id, action, pipeline_state, decision_status] = params;
                decisionLog.push({ id, session_id, agent_id, action, pipeline_state, decision_status });
              }

              if (sql.includes("UPDATE sessions SET pipeline_state = ?, decision_status = ?, updated_at = ?")) {
                const [pipeline_state, decision_status, updated_at, session_id] = params as [
                  Session["pipeline_state"],
                  Session["decision_status"],
                  string,
                  string,
                ];
                const row = sessions.get(session_id);
                if (row) {
                  sessions.set(session_id, {
                    ...row,
                    pipeline_state,
                    decision_status,
                    updated_at,
                  });
                }
              }

              return { success: true };
            },
          };
        },
      };
    },
  };

  return {
    db: db as unknown as Env["DECISIONS_DB"],
    sessions,
    artifacts,
    lineage,
    deliveryEvents,
    handoffEvents,
    stageEntries,
    decisionLog,
  };
}

describe("submitArtifactWithLifecycle delivery wiring", () => {
  it("records completed handoff and stage entry for a successful ProblemBrief transition", async () => {
    const session = makeSession();
    const dbState = createMockDb(session);
    const bucketState = createMockBucket();

    await submitArtifactWithLifecycle(
      dbState.db,
      bucketState.bucket,
      session,
      {
        artifact_type: "ProblemBrief",
        payload: { title: "Validate demand" },
        agent_id: "operator-001",
        parser_verdict: {
          schema_valid: true,
          required_sections_present: true,
          stage_matches_expected: true,
          reentry_ready: true,
        },
      }
    );

    expect(dbState.handoffEvents).toHaveLength(1);
    expect(dbState.handoffEvents[0]).toMatchObject({
      session_id: "sess-001",
      pipeline_state: "intake",
      outcome: "COMPLETED",
      failure_reason: null,
      classified_by: "orchestration",
    });
    expect(dbState.stageEntries).toHaveLength(1);
    expect(dbState.stageEntries[0]).toMatchObject({
      session_id: "sess-001",
      pipeline_state: "problem_framing",
      entry_count: 1,
      classified_by: "orchestration",
    });
    expect(dbState.sessions.get("sess-001")).toMatchObject({
      pipeline_state: "problem_framing",
    });
  });

  it("records failed handoff and does not advance session when parser blocks transition", async () => {
    const session = makeSession();
    const dbState = createMockDb(session);
    const bucketState = createMockBucket();

    await submitArtifactWithLifecycle(
      dbState.db,
      bucketState.bucket,
      session,
      {
        artifact_type: "ProblemBrief",
        payload: { title: "Broken schema case" },
        agent_id: "operator-001",
        parser_verdict: {
          schema_valid: false,
          required_sections_present: true,
          stage_matches_expected: true,
          reentry_ready: true,
        },
      }
    );

    expect(dbState.handoffEvents).toHaveLength(1);
    expect(dbState.handoffEvents[0]).toMatchObject({
      outcome: "FAILED",
      failure_reason: "SCHEMA_MISMATCH",
    });
    expect(dbState.stageEntries).toHaveLength(0);
    expect(dbState.sessions.get("sess-001")).toMatchObject({
      pipeline_state: "intake",
    });
  });
});