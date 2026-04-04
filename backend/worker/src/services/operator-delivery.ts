import type {
  Env,
  PipelineState,
  ReplacementReason,
  RunDeliveryHistory,
  RunHandoffStatus,
  RunDeliverySummary,
  RunNextActionCode,
  TruthCompleteness,
} from "../types/index.js";

// ---------- Helpers ----------

const VALID_PIPELINE_STATES: readonly PipelineState[] = [
  "intake",
  "problem_framing",
  "primitive_selection",
  "architecture_validation",
  "claims_validation",
  "risk_governance_validation",
  "commercial_packaging",
  "release_decision",
];

function isPipelineState(value: string): value is PipelineState {
  return VALID_PIPELINE_STATES.includes(value as PipelineState);
}

function normalizeHandoffStatus(outcome: string | null): RunHandoffStatus {
  if (outcome === null) return "NONE";
  if (outcome === "COMPLETED" || outcome === "FAILED") return outcome;
  return "UNKNOWN";
}

function deriveNextActionCode(opts: {
  current_attempt: number | null;
  handoff_status: RunHandoffStatus;
  loop_flag: boolean;
  truth_completeness: TruthCompleteness;
}): RunNextActionCode | null {
  if (opts.truth_completeness === "MISSING") {
    return null;
  }
  if (opts.loop_flag) {
    return "LOOP_DETECTED";
  }
  if (opts.handoff_status === "FAILED") {
    return "HANDOFF_FAILED";
  }
  if (opts.current_attempt !== null && opts.current_attempt > 1) {
    return "REPAIR_REQUIRED";
  }
  if (opts.handoff_status === "COMPLETED") {
    return "HANDOFF_COMPLETED";
  }
  if (opts.handoff_status === "UNKNOWN") {
    return "UNKNOWN";
  }
  if (opts.current_attempt === null && opts.handoff_status === "NONE") {
    return "AWAITING_TRUTH";
  }
  return "NO_ACTIONABLE_NEXT_STEP";
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
  if (!isPipelineState(sessionRow.pipeline_state)) {
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

  // 3. Latest handoff outcome from handoff_events (orchestration-classified)
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

  // 4. Strict truth-only mapping; forbidden: delivery_integrity_events fallback / caller fields
  const handoff_status = normalizeHandoffStatus(latestHandoff?.outcome ?? null);

  // 5. Loop flag: any loop signal recorded for this session
  const loopRow = await db
    .prepare(
      `SELECT 1 AS has_loop FROM stage_loop_signals WHERE session_id = ? LIMIT 1`
    )
    .bind(session_id)
    .first<{ has_loop: number } | null>();
  const loop_flag = loopRow !== null;
  const hasLineage = latestLineage !== null;
  const hasKnownHandoff = handoff_status !== "NONE" && handoff_status !== "UNKNOWN";
  const hasLoopTruth = loop_flag;
  const truth_completeness: TruthCompleteness = hasLineage && hasKnownHandoff
    ? "FULL"
    : hasLineage || hasKnownHandoff || hasLoopTruth
      ? "PARTIAL"
      : "MISSING";
  const next_action_code = deriveNextActionCode({
    current_attempt: latestLineage?.attempt ?? null,
    handoff_status,
    loop_flag,
    truth_completeness,
  });

  return {
    session_id,
    current_stage: sessionRow.pipeline_state,
    current_attempt: latestLineage?.attempt ?? null,
    handoff_status,
    loop_flag,
    next_action_code,
    truth_completeness,
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
      `SELECT pipeline_state, entry_count, loop_type, created_at
         FROM stage_loop_signals
        WHERE session_id = ?
        ORDER BY created_at ASC`
    )
    .bind(session_id)
    .all<{
      pipeline_state: string;
      entry_count: number;
      loop_type: string;
      created_at: string;
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
    loop_signals: loopRows.results.map((r) => ({
      pipeline_state: r.pipeline_state,
      entry_count: r.entry_count,
      loop_type: r.loop_type,
      created_at: r.created_at,
    })),
    handoff_outcomes: handoffRows.results,
  };
}

export async function getRunNextAction(
  db: Env["DECISIONS_DB"],
  session_id: string
): Promise<{ session_id: string; next_action_code: RunNextActionCode | null } | null> {
  const summary = await getRunDeliverySummary(db, session_id);
  if (!summary) {
    return null;
  }
  return { session_id, next_action_code: summary.next_action_code };
}
