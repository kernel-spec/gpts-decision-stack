import { describe, expect, it } from "vitest";
import type { Env } from "../types/index.js";
import { recordStageEntry } from "./delivery-integrity.js";

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
                let stage_entry_id: unknown;
                let session_id: unknown;
                let artifact_id: unknown;
                let pipeline_state: unknown;
                let entry_count: unknown;
                let classified_by: unknown;
                let created_at: unknown;

                if (params.length === 7) {
                  [
                    stage_entry_id,
                    session_id,
                    artifact_id,
                    pipeline_state,
                    entry_count,
                    classified_by,
                    created_at,
                  ] = params;
                } else {
                  [
                    stage_entry_id,
                    session_id,
                    pipeline_state,
                    entry_count,
                    classified_by,
                    created_at,
                  ] = params;
                  artifact_id = null;
                }
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

describe("delivery integrity stage tracking", () => {
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

});
