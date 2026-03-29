import type {
  DeliveryHandoffStatus,
  DeliveryIntegrityInput,
  Env,
  HandoffFailureReason,
  ReplacementReason,
  Session,
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
    throw emitError;
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
