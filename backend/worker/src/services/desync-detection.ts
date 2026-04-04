/**
 * Desync Detection Service
 *
 * Queries the D1 truth tables to detect sessions that are in an inconsistent
 * state — specifically, partial executions where some writes completed but
 * others did not (possible with pre-lifecycle-transaction code, or if a
 * non-batch write path is introduced in the future).
 *
 * Two detection strategies are used:
 *
 *   1. lifecycle_id join (precise) — finds rows in handoff_events or
 *      artifact_lineage that have a lifecycle_id with no matching partner in
 *      stage_entries. Requires rows written by executeArtifactLifecycleTransaction.
 *
 *   2. Heuristic (broad) — finds sessions whose current pipeline_state has no
 *      corresponding stage_entries row, which is valid for any row regardless of
 *      whether lifecycle_id is populated.
 */

import type { Env } from "../types/index.js";

export type DesyncType =
  | "COMPLETED_HANDOFF_WITHOUT_STAGE_ENTRY"
  | "STATE_ADVANCED_WITHOUT_STAGE_ENTRY"
  | "TRANSITION_LINEAGE_WITHOUT_HANDOFF";

export type DesyncedSession = {
  session_id: string;
  desync_type: DesyncType;
  detail: string;
};

export type DesyncReport = {
  detected_at: string;
  total_desynced: number;
  sessions: DesyncedSession[];
};

/**
 * Scans all sessions for cross-table consistency violations.
 *
 * Returns a report of every detected inconsistency. An empty report means the
 * DB is in a consistent state for the patterns checked.
 *
 * This is a read-only operation; it never writes or repairs.
 */
export async function detectDesyncedSessions(
  db: Env["DECISIONS_DB"]
): Promise<DesyncReport> {
  const detected_at = new Date().toISOString();
  const sessions: DesyncedSession[] = [];

  // ── Pattern 1 (precise): COMPLETED handoff with no matching stage_entries ──
  // Requires both rows to carry lifecycle_id (written by lifecycle-transaction).
  const completedWithoutEntry = await db
    .prepare(
      `SELECT he.session_id, he.lifecycle_id, he.pipeline_state
         FROM handoff_events he
        WHERE he.outcome = 'COMPLETED'
          AND he.lifecycle_id IS NOT NULL
          AND NOT EXISTS (
            SELECT 1 FROM stage_entries se
             WHERE se.lifecycle_id = he.lifecycle_id
          )`
    )
    .bind()
    .all<{ session_id: string; lifecycle_id: string; pipeline_state: string }>();

  for (const row of completedWithoutEntry.results) {
    sessions.push({
      session_id: row.session_id,
      desync_type: "COMPLETED_HANDOFF_WITHOUT_STAGE_ENTRY",
      detail: `COMPLETED handoff at stage ${row.pipeline_state} (lifecycle=${row.lifecycle_id}) has no matching stage_entries row`,
    });
  }

  // ── Pattern 2 (heuristic): session state advanced but no stage_entry row ──
  // Applies to all sessions regardless of lifecycle_id presence.
  // intake is excluded because it is written during session creation and is the
  // initial state (stage entry for intake is written by handleCreateSession).
  const statesWithoutEntry = await db
    .prepare(
      `SELECT s.session_id, s.pipeline_state
         FROM sessions s
        WHERE s.pipeline_state != 'intake'
          AND NOT EXISTS (
            SELECT 1 FROM stage_entries se
             WHERE se.session_id = s.session_id
               AND se.pipeline_state = s.pipeline_state
          )`
    )
    .bind()
    .all<{ session_id: string; pipeline_state: string }>();

  for (const row of statesWithoutEntry.results) {
    sessions.push({
      session_id: row.session_id,
      desync_type: "STATE_ADVANCED_WITHOUT_STAGE_ENTRY",
      detail: `Session is at ${row.pipeline_state} but no stage_entries row exists for that state`,
    });
  }

  // ── Pattern 3 (precise): transition artifact lineage without handoff_events ──
  // ProblemBrief and StateDecisionPacket always produce a handoff_events row.
  // A lineage row with lifecycle_id but no handoff_events row for the same
  // lifecycle_id means the handoff write was lost.
  const lineageWithoutHandoff = await db
    .prepare(
      `SELECT al.run_id AS session_id, al.lifecycle_id, al.stage, al.artifact_type
         FROM artifact_lineage al
        WHERE al.lifecycle_id IS NOT NULL
          AND al.artifact_type IN ('ProblemBrief', 'StateDecisionPacket')
          AND NOT EXISTS (
            SELECT 1 FROM handoff_events he
             WHERE he.lifecycle_id = al.lifecycle_id
          )`
    )
    .bind()
    .all<{
      session_id: string;
      lifecycle_id: string;
      stage: string;
      artifact_type: string;
    }>();

  for (const row of lineageWithoutHandoff.results) {
    sessions.push({
      session_id: row.session_id,
      desync_type: "TRANSITION_LINEAGE_WITHOUT_HANDOFF",
      detail: `${row.artifact_type} at ${row.stage} (lifecycle=${row.lifecycle_id}) has no handoff_events row`,
    });
  }

  return {
    detected_at,
    total_desynced: sessions.length,
    sessions,
  };
}
