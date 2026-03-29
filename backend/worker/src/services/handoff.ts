import type {
  Env,
  HandoffFailureReason,
  HandoffOutcome,
  HandoffOutcomeInput,
  HandoffOutcomeRecord,
  Session,
} from "../types/index.js";
import {
  HANDOFF_FAILURE_REASONS,
  HANDOFF_OUTCOMES,
} from "../types/index.js";

function nowIso(): string {
  return new Date().toISOString();
}

function newId(): string {
  return crypto.randomUUID();
}

const [HANDOFF_COMPLETED, HANDOFF_FAILED] = HANDOFF_OUTCOMES;
const [
  FAILURE_SCHEMA_MISMATCH,
  FAILURE_MISSING_FIELDS,
  FAILURE_AMBIGUOUS_OWNER,
  FAILURE_REVIEW_REJECTED,
  FAILURE_REENTRY_NOT_READY,
  FAILURE_INVALID_INPUT,
] = HANDOFF_FAILURE_REASONS;

/**
 * Classify handoff as COMPLETED or FAILED.
 * If FAILED, apply failure_reason using the required precedence:
 *   1. SCHEMA_MISMATCH
 *   2. MISSING_FIELDS
 *   3. AMBIGUOUS_OWNER
 *   4. REVIEW_REJECTED
 *   5. REENTRY_NOT_READY
 *   6. INVALID_INPUT
 */
export function classifyHandoffOutcome(input: HandoffOutcomeInput): {
  outcome: HandoffOutcome;
  failure_reason: HandoffFailureReason | null;
} {
  if (!input.schema_valid) {
    return { outcome: HANDOFF_FAILED, failure_reason: FAILURE_SCHEMA_MISMATCH };
  }
  if (!input.fields_present) {
    return { outcome: HANDOFF_FAILED, failure_reason: FAILURE_MISSING_FIELDS };
  }
  if (!input.owner_resolved) {
    return { outcome: HANDOFF_FAILED, failure_reason: FAILURE_AMBIGUOUS_OWNER };
  }
  if (!input.review_verdict_ok) {
    return { outcome: HANDOFF_FAILED, failure_reason: FAILURE_REVIEW_REJECTED };
  }
  if (!input.reentry_ready) {
    return { outcome: HANDOFF_FAILED, failure_reason: FAILURE_REENTRY_NOT_READY };
  }
  if (!input.parser_verdict_ok || !input.legal_transition_ok) {
    return { outcome: HANDOFF_FAILED, failure_reason: FAILURE_INVALID_INPUT };
  }
  return { outcome: HANDOFF_COMPLETED, failure_reason: null };
}

/**
 * Persist handoff outcome into handoff_events, then emit the appropriate event.
 * Orchestration is the final truth owner.
 * A failed handoff is never persisted without a failure_reason.
 */
export async function recordHandoffOutcome(
  db: Env["DECISIONS_DB"],
  session: Session,
  input: HandoffOutcomeInput
): Promise<HandoffOutcomeRecord> {
  const { outcome, failure_reason } = classifyHandoffOutcome(input);

  if (outcome === HANDOFF_FAILED && failure_reason === null) {
    throw new Error("invariant violated: FAILED handoff must have failure_reason");
  }

  const event_id = newId();
  const classified_at = nowIso();

  // Persist first
  await db
    .prepare(
      `INSERT INTO handoff_events (
         event_id,
         session_id,
         pipeline_state,
         outcome,
         failure_reason,
         classified_by,
         classified_at
       )
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      event_id,
      session.session_id,
      session.pipeline_state,
      outcome,
      failure_reason,
      "orchestration",
      classified_at
    )
    .run();

  // Emit second
  if (outcome === HANDOFF_COMPLETED) {
    console.log(
      JSON.stringify({
        event: "handoff_completed",
        event_id,
        session_id: session.session_id,
        pipeline_state: session.pipeline_state,
        classified_at,
      })
    );
  } else {
    console.log(
      JSON.stringify({
        event: "handoff_failed",
        event_id,
        session_id: session.session_id,
        pipeline_state: session.pipeline_state,
        failure_reason,
        classified_at,
      })
    );
  }

  return {
    event_id,
    session_id: session.session_id,
    pipeline_state: session.pipeline_state,
    outcome,
    failure_reason,
    classified_by: "orchestration",
    classified_at,
  };
}
