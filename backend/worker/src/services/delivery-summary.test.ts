import { describe, expect, it } from "vitest";
import type { Env, Session } from "../types/index.js";
import { getDeliverySummary, recordStageEntry } from "./delivery-integrity.js";

function makeSession(overrides: Partial<Session> = {}): Session {
  return {
    session_id: "sess-001",
    requestor_type: "founder-led",
    pipeline_state: "problem_framing",
    decision_status: "proceed",
    veto_active: false,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function createMockDb() {
  const stageEntries: Array<Record<string, unknown>> = [];
  const loopSignals: Array<Record<string, unknown>> = [];
  const lineage: Array<Record<string, unknown>> = [];
  const handoffEvents: Array<Record<string, unknown>> = [];

  const db = {
    prepare(sql: string) {
      return {
        bind(...params: unknown[]) {
          return {
            async first<T>() {
              if (sql.includes("FROM stage_entries") && sql.includes("ORDER BY entry_count DESC")) {
                const [session_id, pipeline_state] = params as [string, string];
                const row = stageEntries
                  .filter(
                    (entry) =>
                      entry.session_id === session_id && entry.pipeline_state === pipeline_state
                  )
                  .sort((a, b) => Number(b.entry_count) - Number(a.entry_count))[0];
                return (row ?? null) as T | null;
              }

              if (sql.includes("FROM artifact_lineage") && sql.includes("ORDER BY attempt DESC")) {
                const [run_id, stage] = params as [string, string];
                const row = lineage
                  .filter((entry) => entry.run_id === run_id && entry.stage === stage)
                  .sort((a, b) => Number(b.attempt) - Number(a.attempt))[0];
                return (row ?? null) as T | null;
              }

              if (sql.includes("FROM handoff_events")) {
                const [session_id] = params as [string];
                const row = handoffEvents
                  .filter((entry) => entry.session_id === session_id)
                  .sort((a, b) => String(b.classified_at).localeCompare(String(a.classified_at)))[0];
                return (row ?? null) as T | null;
              }

              if (sql.includes("FROM stage_loop_signals")) {
                const [session_id, pipeline_state] = params as [string, string];
                const row = loopSignals
                  .filter(
                    (entry) =>
                      entry.session_id === session_id && entry.pipeline_state === pipeline_state
                  )
                  .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))[0];
                return (row ?? null) as T | null;
              }

              return null;
            },
            async run() {
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

              if (sql.includes("INSERT INTO stage_loop_signals")) {
                const [
                  loop_signal_id,
                  session_id,
                  pipeline_state,
                  entry_count,
                  loop_type,
                  classified_by,
                  created_at,
                ] = params;
                loopSignals.push({
                  loop_signal_id,
                  session_id,
                  pipeline_state,
                  entry_count,
                  loop_type,
                  classified_by,
                  created_at,
                });
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
    stageEntries,
    loopSignals,
    lineage,
    handoffEvents,
  };
}

describe("delivery integrity stage tracking and read model", () => {
  it("emits SAME_STAGE_REPEAT on second entry into the same stage", async () => {
    const { db, stageEntries, loopSignals } = createMockDb();

    const first = await recordStageEntry(db, {
      session_id: "sess-001",
      pipeline_state: "problem_framing",
    });
    const second = await recordStageEntry(db, {
      session_id: "sess-001",
      pipeline_state: "problem_framing",
    });

    expect(first.stage_entry.entry_count).toBe(1);
    expect(first.loop_signal).toBeNull();
    expect(second.stage_entry.entry_count).toBe(2);
    expect(second.loop_signal).toMatchObject({
      loop_type: "SAME_STAGE_REPEAT",
      entry_count: 2,
    });
    expect(stageEntries).toHaveLength(2);
    expect(loopSignals).toHaveLength(1);
  });

  it("builds a delivery summary from latest lineage, handoff, and loop signal", async () => {
    const { db, lineage, handoffEvents, loopSignals } = createMockDb();
    const session = makeSession();

    lineage.push({
      run_id: "sess-001",
      stage: "problem_framing",
      artifact_type: "FramingAssessment",
      attempt: 2,
      replacement_reason: "QUALITY_ISSUE",
    });
    handoffEvents.push({
      session_id: "sess-001",
      outcome: "FAILED",
      failure_reason: "REVIEW_REJECTED",
      classified_at: "2026-01-01T00:01:00.000Z",
    });
    loopSignals.push({
      session_id: "sess-001",
      pipeline_state: "problem_framing",
      loop_type: "SAME_STAGE_REPEAT",
      entry_count: 2,
      created_at: "2026-01-01T00:02:00.000Z",
    });

    const summary = await getDeliverySummary(db, session);

    expect(summary).toEqual({
      current_stage: "problem_framing",
      current_artifact_type: "FramingAssessment",
      current_attempt: 2,
      last_replacement_reason: "QUALITY_ISSUE",
      handoff_status: "failed",
      handoff_failure_reason: "REVIEW_REJECTED",
      loop_flag: true,
      loop_type: "SAME_STAGE_REPEAT",
      next_action_code: "REPAIR_SAME_STAGE",
    });
  });
});