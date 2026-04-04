import type {
  ArtifactAttemptInput,
  ArtifactLineageRecord,
  DeliverySummary,
  DeliveryEvent,
  DeliveryHandoffStatus,
  DeliveryIntegrityInput,
  Env,
  HandoffFailureReason,
  NextActionCode,
  ParserVerdict,
  ReplacementReason,
  ReviewVerdict,
  Session,
  StageEntryRecord,
  StageLoopSignalRecord,
  TransitionContext,
} from "../types/index.js";
import {
  DELIVERY_HANDOFF_STATUSES,
  HANDOFF_FAILURE_REASONS,
  REPLACEMENT_REASONS,
} from "../types/index.js";

function nowIso(): string {
  return new Date().toISOString();
}

function newId(): string {
  return crypto.randomUUID();
}

function boolToInt(value: boolean): number {
  return value ? 1 : 0;
}

const DEFAULT_ATTEMPT_VALUE = 1;
const DEFAULT_HANDOFF_STATUS_VALUE: DeliveryHandoffStatus = "pending";

export type DeliveryIntegrityRecord = {
  event_id: string;
  artifact_id: string;
  session_id: string;
  pipeline_state: Session["pipeline_state"];
  attempt: number;
  supersedes_artifact_id: string | null;
  replacement_reason: ReplacementReason | null;
  handoff_status: DeliveryHandoffStatus;
  handoff_failure_reason: HandoffFailureReason | null;
  stage_loop_detected: boolean;
  classified_by: string;
  classified_at: string;
};

export function validateDeliveryInput(input: DeliveryIntegrityInput | null | undefined): string | null {
  if (!input) {
    return null;
  }

  // replacement_reason is orchestration-owned; callers must not supply it
  const raw = input as Record<string, unknown>;
  if (raw.replacement_reason !== undefined && raw.replacement_reason !== null) {
    return "replacement_reason is classified by orchestration and must not be provided by callers";
  }

  const attempt = input.attempt ?? DEFAULT_ATTEMPT_VALUE;
  if (attempt < 1 || !Number.isInteger(attempt)) {
    return "attempt must be an integer >= 1";
  }

  if (attempt > 1) {
    if (!input.supersedes_artifact_id) {
      return "supersedes_artifact_id is required when attempt > 1";
    }
  }

  const handoffStatus = input.handoff_status ?? DEFAULT_HANDOFF_STATUS_VALUE;
  if (!DELIVERY_HANDOFF_STATUSES.includes(handoffStatus)) {
    return "handoff_status must be one of: pending, completed, failed";
  }

  if (handoffStatus === "failed") {
    if (!input.handoff_failure_reason) {
      return "handoff_failure_reason is required when handoff_status=failed";
    }
    if (!HANDOFF_FAILURE_REASONS.includes(input.handoff_failure_reason)) {
      return "handoff_failure_reason is not recognized";
    }
  }

  return null;
}

export async function appendDeliveryIntegrityEvent(
  db: Env["DECISIONS_DB"],
  session: Session,
  artifact_id: string,
  input: DeliveryIntegrityInput | null | undefined
): Promise<DeliveryIntegrityRecord> {
  const validationError = validateDeliveryInput(input);
  if (validationError) {
    throw new TypeError(validationError);
  }

  const attempt = input?.attempt ?? DEFAULT_ATTEMPT_VALUE;
  const supersedes_artifact_id = input?.supersedes_artifact_id ?? null;
  // replacement_reason is always null here — it is orchestration-classified in artifact_lineage,
  // not stored from caller input in delivery_integrity_events.
  const replacement_reason = null;
  const handoff_status = input?.handoff_status ?? DEFAULT_HANDOFF_STATUS_VALUE;
  const handoff_failure_reason = input?.handoff_failure_reason ?? null;

  // Lightweight existence check; run per submission to keep orchestration-owned truth authoritative
  const priorLoopRow = await db
    .prepare(
      `SELECT 1 AS has_prior
         FROM delivery_integrity_events
        WHERE session_id = ? AND pipeline_state = ?
        LIMIT 1`
    )
    .bind(session.session_id, session.pipeline_state)
    .first<{ has_prior: number } | null>();

  const stage_loop_detected = priorLoopRow !== null;

  const event_id = newId();
  const classified_at = nowIso();

  await db
    .prepare(
      `INSERT INTO delivery_integrity_events (
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
         classified_at
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      event_id,
      artifact_id,
      session.session_id,
      session.pipeline_state,
      attempt,
      supersedes_artifact_id,
      replacement_reason,
      handoff_status,
      handoff_failure_reason,
      boolToInt(stage_loop_detected),
      "orchestration",
      classified_at
    )
    .run();

  try {
    console.log(
      JSON.stringify({
        event: attempt > 1 ? "delivery_repair_attempt_classified" : "delivery_integrity_classified",
        event_id,
        artifact_id,
        session_id: session.session_id,
        pipeline_state: session.pipeline_state,
        attempt,
        supersedes_artifact_id,
        replacement_reason,
        handoff_status,
        handoff_failure_reason,
        stage_loop_detected,
        classified_at,
      })
    );
  } catch (emitError) {
    await db
      .prepare(`DELETE FROM delivery_integrity_events WHERE event_id = ?`)
      .bind(event_id)
      .run();
    const reason =
      emitError instanceof Error ? emitError.message : String(emitError);
    throw new Error(
      `delivery integrity event emission failed after rollback: ${reason}`
    );
  }

  return {
    event_id,
    artifact_id,
    session_id: session.session_id,
    pipeline_state: session.pipeline_state,
    attempt,
    supersedes_artifact_id,
    replacement_reason,
    handoff_status,
    handoff_failure_reason,
    stage_loop_detected,
    classified_by: "orchestration",
    classified_at,
  };
}

// ---------- Artifact Attempt (PR-2) ----------

// Classification precedence is applied exactly as specified:
// 1. INVALID_SCHEMA
// 2. MISSING_REQUIRED_SECTION
// 3. STAGE_MISMATCH
// 4. REVIEW_BLOCK
// 5. HANDOFF_REJECTED
// 6. SCOPE_CHANGE
// 7. QUALITY_ISSUE
function classifyReplacementReason(
  parser: ParserVerdict,
  review: ReviewVerdict,
  scopeChanged: boolean,
  transitionCtx: TransitionContext
): ReplacementReason {
  if (!parser.schema_valid) {
    return "INVALID_SCHEMA";
  }
  if (!parser.required_sections_present) {
    return "MISSING_REQUIRED_SECTION";
  }
  if (!parser.stage_matches_expected) {
    return "STAGE_MISMATCH";
  }
  if (review.status === "REJECTED" || review.blocking === true) {
    return "REVIEW_BLOCK";
  }
  if (transitionCtx.handoff_rejected === true) {
    return "HANDOFF_REJECTED";
  }
  if (scopeChanged) {
    return "SCOPE_CHANGE";
  }
  return "QUALITY_ISSUE";
}

export async function recordArtifactAttempt(
  db: Env["DECISIONS_DB"],
  input: ArtifactAttemptInput
): Promise<{ record: ArtifactLineageRecord; events: DeliveryEvent[] }> {
  // 1. Determine attempt number from existing lineage for (run_id, stage)
  const priorRow = await db
    .prepare(
      `SELECT attempt, artifact_id
         FROM artifact_lineage
        WHERE run_id = ? AND stage = ?
        ORDER BY attempt DESC
        LIMIT 1`
    )
    .bind(input.run_id, input.stage)
    .first<{ attempt: number; artifact_id: string } | null>();

  const attempt = priorRow !== null ? priorRow.attempt + 1 : 1;
  const supersedes_artifact_id = priorRow !== null ? priorRow.artifact_id : null;
  const is_first_attempt_in_stage = attempt === 1;
  const is_repair_attempt = attempt > 1;

  // 2. Orchestration classifies replacement_reason — no worker input accepted
  let replacement_reason: ReplacementReason | null = null;
  let replacement_reason_source: string | null = null;

  if (is_repair_attempt) {
    replacement_reason = classifyReplacementReason(
      input.parser_verdict,
      input.review_verdict,
      input.scope_fingerprint_changed ?? false,
      input.transition_context ?? {}
    );
    replacement_reason_source = "orchestration";
  }

  // 3. Persist first
  const lineage_id = newId();
  const created_at = nowIso();

  await db
    .prepare(
      `INSERT INTO artifact_lineage (
         lineage_id, run_id, artifact_id, artifact_type, stage, attempt,
         supersedes_artifact_id, created_at, created_by_role, classified_by,
         replacement_reason, replacement_reason_source,
         is_repair_attempt, is_first_attempt_in_stage, override_flag
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      lineage_id,
      input.run_id,
      input.artifact_id,
      input.artifact_type,
      input.stage,
      attempt,
      supersedes_artifact_id,
      created_at,
      input.created_by_role,
      "orchestration",
      replacement_reason,
      replacement_reason_source,
      boolToInt(is_repair_attempt),
      boolToInt(is_first_attempt_in_stage),
      boolToInt(input.override_flag ?? false)
    )
    .run();

  const record: ArtifactLineageRecord = {
    lineage_id,
    run_id: input.run_id,
    artifact_id: input.artifact_id,
    artifact_type: input.artifact_type,
    stage: input.stage,
    attempt,
    supersedes_artifact_id,
    created_at,
    created_by_role: input.created_by_role,
    classified_by: "orchestration",
    replacement_reason,
    replacement_reason_source,
    is_repair_attempt,
    is_first_attempt_in_stage,
    override_flag: input.override_flag ?? false,
  };

  // 4. Emit events — persist first, emit second
  const events: DeliveryEvent[] = [
    {
      type: "artifact_attempt_created",
      lineage_id,
      artifact_id: input.artifact_id,
      run_id: input.run_id,
      stage: input.stage,
      attempt,
    },
  ];

  if (is_repair_attempt && supersedes_artifact_id !== null && replacement_reason !== null) {
    events.push({
      type: "artifact_superseded",
      lineage_id,
      artifact_id: input.artifact_id,
      supersedes_artifact_id,
      replacement_reason,
      run_id: input.run_id,
      stage: input.stage,
    });
  }

  try {
    for (const ev of events) {
      console.log(JSON.stringify({ ...ev }));
    }
  } catch (emitError) {
    await db
      .prepare(`DELETE FROM artifact_lineage WHERE lineage_id = ?`)
      .bind(lineage_id)
      .run();
    const reason = emitError instanceof Error ? emitError.message : String(emitError);
    throw new Error(`artifact attempt event emission failed after rollback: ${reason}`);
  }

  return { record, events };
}

function classifyNextActionCode(input: {
  handoff_status: DeliveryHandoffStatus;
  handoff_failure_reason: HandoffFailureReason | null;
  loop_flag: boolean;
  current_attempt: number;
}): NextActionCode {
  if (input.loop_flag) {
    return "REPAIR_SAME_STAGE";
  }

  if (input.handoff_status === "completed") {
    return "READY_FOR_NEXT_STAGE";
  }

  if (input.handoff_status === "failed") {
    if (input.handoff_failure_reason === "REVIEW_REJECTED") {
      return "REVIEW_REQUIRED";
    }
    if (input.handoff_failure_reason === "AMBIGUOUS_OWNER") {
      return "MANUAL_OVERRIDE_REQUIRED";
    }
    if (input.handoff_failure_reason === "REENTRY_NOT_READY") {
      return "RETURN_TO_PREVIOUS_STAGE";
    }
    return "REPAIR_SAME_STAGE";
  }

  if (input.current_attempt > 1) {
    return "REPAIR_SAME_STAGE";
  }

  return "REPAIR_SAME_STAGE";
}

export async function recordStageEntry(
  db: Env["DECISIONS_DB"],
  inputOrSession:
    | {
        session_id: string;
        pipeline_state: Session["pipeline_state"];
        artifact_id?: string | null;
      }
    | Session,
  _legacyInput?: { entered_by?: string }
): Promise<{
  stage_entry: StageEntryRecord;
  entry: StageEntryRecord;
  loop_signal: StageLoopSignalRecord | null;
}> {
  const legacyMode = "requestor_type" in inputOrSession;
  const input =
    legacyMode
      ? {
          session_id: inputOrSession.session_id,
          pipeline_state: inputOrSession.pipeline_state,
          artifact_id: null,
        }
      : {
          session_id: inputOrSession.session_id,
          pipeline_state: inputOrSession.pipeline_state,
          artifact_id: inputOrSession.artifact_id ?? null,
        };
  const priorByMax = await db
    .prepare(
      `SELECT entry_count
         FROM stage_entries
        WHERE session_id = ? AND pipeline_state = ?
        ORDER BY entry_count DESC
        LIMIT 1`
    )
    .bind(input.session_id, input.pipeline_state)
    .first<{ entry_count: number } | null>();

  const priorByCount =
    priorByMax === null
      ? await db
          .prepare(
            `SELECT COUNT(*) as cnt
               FROM stage_entries
              WHERE session_id = ? AND pipeline_state = ?`
          )
          .bind(input.session_id, input.pipeline_state)
          .first<{ cnt: number } | null>()
      : null;

  const priorCount = priorByMax?.entry_count ?? priorByCount?.cnt ?? 0;
  const entry_count = priorCount + 1;
  const stage_entry_id = newId();
  const created_at = nowIso();

  if (legacyMode) {
    await db
      .prepare(
        `INSERT INTO stage_entries (
           entry_id,
           session_id,
           pipeline_state,
           entry_count,
           classified_by,
           classified_at
         )
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .bind(
        stage_entry_id,
        input.session_id,
        input.pipeline_state,
        entry_count,
        "orchestration",
        created_at
      )
      .run();
  } else if (input.artifact_id === null) {
    await db
      .prepare(
        `INSERT INTO stage_entries (
           stage_entry_id,
           session_id,
           pipeline_state,
           entry_count,
           classified_by,
           created_at
         )
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .bind(
        stage_entry_id,
        input.session_id,
        input.pipeline_state,
        entry_count,
        "orchestration",
        created_at
      )
      .run();
  } else {
    await db
      .prepare(
        `INSERT INTO stage_entries (
           stage_entry_id,
           session_id,
           artifact_id,
           pipeline_state,
           entry_count,
           classified_by,
           created_at
         )
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        stage_entry_id,
        input.session_id,
        input.artifact_id,
        input.pipeline_state,
        entry_count,
        "orchestration",
        created_at
      )
      .run();
  }

  const stage_entry: StageEntryRecord = {
    stage_entry_id,
    entry_id: stage_entry_id,
    session_id: input.session_id,
    artifact_id: input.artifact_id ?? null,
    pipeline_state: input.pipeline_state,
    entry_count,
    classified_by: "orchestration",
    created_at,
    classified_at: created_at,
  };

  let loop_signal: StageLoopSignalRecord | null = null;
  if (entry_count > 1) {
    const loop_signal_id = newId();
    if (legacyMode) {
      await db
        .prepare(
          `INSERT INTO stage_loop_signals (
             loop_signal_id,
             session_id,
             pipeline_state,
             entry_count,
             loop_type,
             classified_by,
             classified_at
           )
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          loop_signal_id,
          input.session_id,
          input.pipeline_state,
          entry_count,
          "SAME_STAGE_REPEAT",
          "orchestration",
          created_at
        )
        .run();
    } else {
      await db
        .prepare(
          `INSERT INTO stage_loop_signals (
             loop_signal_id,
             session_id,
             pipeline_state,
             entry_count,
             loop_type,
             classified_by,
             created_at
           )
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          loop_signal_id,
          input.session_id,
          input.pipeline_state,
          entry_count,
          "SAME_STAGE_REPEAT",
          "orchestration",
          created_at
        )
        .run();
    }

    loop_signal = {
      loop_signal_id,
      session_id: input.session_id,
      pipeline_state: input.pipeline_state,
      entry_count,
      loop_type: "SAME_STAGE_REPEAT",
      classified_by: "orchestration",
      created_at,
    };
  }

  try {
    if (loop_signal) {
      console.log(
        JSON.stringify({
          event: "stage_loop_detected",
          stage_entry_id,
          loop_signal_id: loop_signal.loop_signal_id,
          session_id: input.session_id,
          pipeline_state: input.pipeline_state,
          loop_type: "SAME_STAGE_REPEAT",
          entry_count,
          created_at,
        })
      );
    } else {
      console.log(
        JSON.stringify({
          event: "stage_entry_created",
          stage_entry_id,
          session_id: input.session_id,
          pipeline_state: input.pipeline_state,
          entry_count,
          created_at,
        })
      );
    }
  } catch (emitError) {
    if (loop_signal) {
      await db
        .prepare(`DELETE FROM stage_loop_signals WHERE loop_signal_id = ?`)
        .bind(loop_signal.loop_signal_id)
        .run();
    }
    if (legacyMode) {
      await db
        .prepare(`DELETE FROM stage_entries WHERE entry_id = ?`)
        .bind(stage_entry_id)
        .run();
    } else {
      await db
        .prepare(`DELETE FROM stage_entries WHERE stage_entry_id = ?`)
        .bind(stage_entry_id)
        .run();
    }
    const reason = emitError instanceof Error ? emitError.message : String(emitError);
    throw new Error(`stage entry event emission failed after rollback: ${reason}`);
  }

  return { stage_entry, entry: stage_entry, loop_signal };
}

export async function getDeliverySummary(
  db: Env["DECISIONS_DB"],
  session: Session
): Promise<DeliverySummary> {
  const latestLineage = await db
    .prepare(
      `SELECT artifact_type, attempt, replacement_reason
         FROM artifact_lineage
        WHERE run_id = ? AND stage = ?
        ORDER BY attempt DESC
        LIMIT 1`
    )
    .bind(session.session_id, session.pipeline_state)
    .first<{
      artifact_type: string;
      attempt: number;
      replacement_reason: ReplacementReason | null;
    } | null>();

  const latestHandoff = await db
    .prepare(
      `SELECT outcome, failure_reason
         FROM handoff_events
        WHERE session_id = ?
        ORDER BY classified_at DESC
        LIMIT 1`
    )
    .bind(session.session_id)
    .first<{
      outcome: "COMPLETED" | "FAILED";
      failure_reason: HandoffFailureReason | null;
    } | null>();

  const latestLoop = await db
    .prepare(
      `SELECT loop_type, entry_count
         FROM stage_loop_signals
        WHERE session_id = ? AND pipeline_state = ?
        ORDER BY created_at DESC
        LIMIT 1`
    )
    .bind(session.session_id, session.pipeline_state)
    .first<{
      loop_type: StageLoopSignalRecord["loop_type"];
      entry_count: number;
    } | null>();

  const handoff_status: DeliveryHandoffStatus = latestHandoff
    ? latestHandoff.outcome === "COMPLETED"
      ? "completed"
      : "failed"
    : "pending";

  const handoff_failure_reason = latestHandoff?.failure_reason ?? null;
  const loop_flag = latestLoop !== null;
  const current_attempt = latestLineage?.attempt ?? 0;

  return {
    current_stage: session.pipeline_state,
    current_artifact_type: latestLineage?.artifact_type ?? null,
    current_attempt,
    last_replacement_reason: latestLineage?.replacement_reason ?? null,
    handoff_status,
    handoff_failure_reason,
    loop_flag,
    loop_type: latestLoop?.loop_type ?? null,
    next_action_code: classifyNextActionCode({
      handoff_status,
      handoff_failure_reason,
      loop_flag,
      current_attempt,
    }),
  };
}
