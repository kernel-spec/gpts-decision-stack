import type {
  ArtifactAttemptInput,
  ArtifactLineageRecord,
  DeliveryEvent,
  DeliveryHandoffStatus,
  DeliveryIntegrityInput,
  Env,
  HandoffFailureReason,
  ParserVerdict,
  ReplacementReason,
  ReviewVerdict,
  Session,
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

  const attempt = input.attempt ?? DEFAULT_ATTEMPT_VALUE;
  if (attempt < 1 || !Number.isInteger(attempt)) {
    return "attempt must be an integer >= 1";
  }

  if (attempt > 1) {
    if (!input.supersedes_artifact_id) {
      return "supersedes_artifact_id is required when attempt > 1";
    }
    if (!input.replacement_reason) {
      return "replacement_reason is required when attempt > 1";
    }
  }

  if (input.replacement_reason && !REPLACEMENT_REASONS.includes(input.replacement_reason)) {
    return "replacement_reason is not recognized";
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
  const replacement_reason = input?.replacement_reason ?? null;
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

  return { record, events };
}
