import type {
  Env,
  PipelineState,
  ReplacementReason,
  RunDeliveryHistory,
  RunDeliverySummary,
  RunNextActionCode,
} from "../types/index.js";

// ---------- Helpers ----------

function deriveNextActionCode(opts: {
  current_attempt: number | null;
  handoff_status: string | null;
  loop_flag: boolean;
}): RunNextActionCode {
  if (opts.loop_flag) {
    return "LOOP_DETECTED";
  }
  if (
    opts.handoff_status === "FAILED" ||
    opts.handoff_status === "failed"
  ) {
    return "HANDOFF_FAILED";
  }
  if (opts.current_attempt !== null && opts.current_attempt > 1) {
    return "REPAIR_IN_PROGRESS";
  }
  if (
    opts.handoff_status === "COMPLETED" ||
    opts.handoff_status === "completed"
  ) {
    return "HANDOFF_COMPLETE";
  }
  if (opts.current_attempt !== null) {
    return "UNKNOWN";
  }
  return "AWAITING_FIRST_ARTIFACT";
}

// ---------- Read model ----------

export async function getRunDeliverySummary(
  db: Env["DECISIONS_DB"],
  session_id: string
): Promise<RunDeliverySummary | null> {
  // 1. Verify session exists and get current stage
  const sessionRow = await db
    .prepare(
      `SELECT pipeline_state FROM sessions WHERE session_id = ? LIMIT 1`
    )
    .bind(session_id)
    .first<{ pipeline_state: string } | null>();

  if (!sessionRow) {
    return null;
  }

  // 2. Latest artifact attempt for this run (run_id = session_id in the primary path)
  const latestLineage = await db
    .prepare(
      `SELECT artifact_type, attempt
         FROM artifact_lineage
        WHERE run_id = ?
        ORDER BY created_at DESC
        LIMIT 1`
    )
    .bind(session_id)
    .first<{ artifact_type: string; attempt: number } | null>();

  // 3. Most recent replacement reason from any repair attempt in this run
  const lastRepair = await db
    .prepare(
      `SELECT replacement_reason
         FROM artifact_lineage
        WHERE run_id = ? AND is_repair_attempt = 1
        ORDER BY created_at DESC
        LIMIT 1`
    )
    .bind(session_id)
    .first<{ replacement_reason: string | null } | null>();

  // 4. Latest handoff outcome from handoff_events (orchestration-classified)
  const latestHandoff = await db
    .prepare(
      `SELECT outcome
         FROM handoff_events
        WHERE session_id = ?
        ORDER BY classified_at DESC
        LIMIT 1`
    )
    .bind(session_id)
    .first<{ outcome: string } | null>();

  // 5. Fallback: handoff_status from delivery_integrity_events when no handoff_events row exists
  let handoff_status: string | null = latestHandoff?.outcome ?? null;
  if (!handoff_status) {
    const latestDie = await db
      .prepare(
        `SELECT handoff_status
           FROM delivery_integrity_events
          WHERE session_id = ?
          ORDER BY classified_at DESC
          LIMIT 1`
      )
      .bind(session_id)
      .first<{ handoff_status: string } | null>();
    handoff_status = latestDie?.handoff_status ?? null;
  }

  // 6. Loop flag: any loop signal recorded for this session
  const loopRow = await db
    .prepare(
      `SELECT 1 AS has_loop FROM stage_loop_signals WHERE session_id = ? LIMIT 1`
    )
    .bind(session_id)
    .first<{ has_loop: number } | null>();
  const loop_flag = loopRow !== null;

  return {
    session_id,
    current_stage: sessionRow.pipeline_state as PipelineState,
    current_artifact_type: latestLineage?.artifact_type ?? null,
    current_attempt: latestLineage?.attempt ?? null,
    last_replacement_reason: (lastRepair?.replacement_reason ??
      null) as ReplacementReason | null,
    handoff_status,
    loop_flag,
    next_action_code: deriveNextActionCode({
      current_attempt: latestLineage?.attempt ?? null,
      handoff_status,
      loop_flag,
    }),
  };
}

export async function getRunDeliveryHistory(
  db: Env["DECISIONS_DB"],
  session_id: string
): Promise<RunDeliveryHistory | null> {
  // Verify session exists
  const sessionRow = await db
    .prepare(`SELECT 1 FROM sessions WHERE session_id = ? LIMIT 1`)
    .bind(session_id)
    .first<{ 1: number } | null>();

  if (!sessionRow) {
    return null;
  }

  // Full artifact lineage for this run ordered chronologically
  const lineageRows = await db
    .prepare(
      `SELECT artifact_id, artifact_type, stage, attempt,
              replacement_reason, is_repair_attempt, created_at
         FROM artifact_lineage
        WHERE run_id = ?
        ORDER BY created_at ASC`
    )
    .bind(session_id)
    .all<{
      artifact_id: string;
      artifact_type: string;
      stage: string;
      attempt: number;
      replacement_reason: string | null;
      is_repair_attempt: number;
      created_at: string;
    }>();

  // All loop signals for this session ordered chronologically
  const loopRows = await db
    .prepare(
      `SELECT pipeline_state, entry_count, loop_type, classified_at
         FROM stage_loop_signals
        WHERE session_id = ?
        ORDER BY classified_at ASC`
    )
    .bind(session_id)
    .all<{
      pipeline_state: string;
      entry_count: number;
      loop_type: string;
      classified_at: string;
    }>();

  // All handoff outcomes for this session ordered chronologically
  const handoffRows = await db
    .prepare(
      `SELECT pipeline_state, outcome, failure_reason, classified_at
         FROM handoff_events
        WHERE session_id = ?
        ORDER BY classified_at ASC`
    )
    .bind(session_id)
    .all<{
      pipeline_state: string;
      outcome: string;
      failure_reason: string | null;
      classified_at: string;
    }>();

  return {
    session_id,
    lineage: lineageRows.results.map((r) => ({
      artifact_id: r.artifact_id,
      artifact_type: r.artifact_type,
      stage: r.stage,
      attempt: r.attempt,
      replacement_reason: r.replacement_reason as ReplacementReason | null,
      is_repair_attempt: r.is_repair_attempt === 1,
      created_at: r.created_at,
    })),
    loop_signals: loopRows.results,
    handoff_outcomes: handoffRows.results,
  };
}

export async function getRunNextAction(
  db: Env["DECISIONS_DB"],
  session_id: string
): Promise<{ session_id: string; next_action_code: RunNextActionCode } | null> {
  const summary = await getRunDeliverySummary(db, session_id);
  if (!summary) {
    return null;
  }
  return { session_id, next_action_code: summary.next_action_code };
}
