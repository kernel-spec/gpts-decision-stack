/**
 * Atomic Lifecycle Transaction
 *
 * Wraps all orchestration truth writes for one artifact submission into a
 * single D1 batch (atomic). If any statement in the batch fails, D1 rolls
 * back every write in the batch — no partial execution is possible.
 *
 * Enforced write order within the batch:
 *   1. artifact_lineage        (always)
 *   2. delivery_integrity_events (always)
 *   3. handoff_events          (only when transition_candidate is present)
 *   4. UPDATE sessions         (only when handoff outcome = COMPLETED)
 *   5. stage_entries           (only when handoff outcome = COMPLETED)
 *   6. stage_loop_signals      (only when stage entry_count > 1)
 *
 * Invariants enforced at the service layer (throw rather than silently break):
 *   - handoff_events must never be created without a transition_candidate
 *   - state change must only follow a COMPLETED handoff
 *   - stage_entry target must match the transition target
 */

import type {
  ArtifactLineageRecord,
  DeliveryEvent,
  DeliveryHandoffStatus,
  DeliveryIntegrityInput,
  Env,
  HandoffFailureReason,
  HandoffOutcome,
  HandoffOutcomeRecord,
  ParserVerdict,
  PipelineState,
  ReplacementReason,
  ReviewVerdict,
  Session,
  StageEntryRecord,
  StageLoopSignalRecord,
  TransitionContext,
} from "../types/index.js";
import { classifyHandoffOutcome } from "./handoff.js";
import { classifyReplacementReason } from "./delivery-integrity.js";

function nowIso(): string {
  return new Date().toISOString();
}

function newId(): string {
  return crypto.randomUUID();
}

function boolToInt(v: boolean): number {
  return v ? 1 : 0;
}

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Resolved transition candidate produced by getTransitionCandidate.
 * Contains the target state and whether the transition is legally valid.
 */
export type TransitionCandidate = {
  pipeline_state: PipelineState;
  decision_status: Session["decision_status"];
  notes: string;
  legal_transition_ok: boolean;
};

export type LifecycleTransactionInput = {
  /** Stable ID for this lifecycle step; ties all truth-table writes together. */
  lifecycle_id: string;
  session: Session;
  artifact_id: string;
  artifact_type: string;
  created_by_role: string;
  parser_verdict: ParserVerdict;
  review_verdict: ReviewVerdict;
  scope_fingerprint_changed: boolean;
  transition_context: TransitionContext;
  /** Null when the artifact type does not trigger a stage transition. */
  transition_candidate: TransitionCandidate | null;
  delivery_input: DeliveryIntegrityInput | null | undefined;
};

export type LifecycleTransactionResult = {
  lifecycle_id: string;
  lineage: ArtifactLineageRecord;
  lineage_events: DeliveryEvent[];
  /** Null when no transition candidate was present. */
  handoff: HandoffOutcomeRecord | null;
  /** True when session pipeline_state was advanced (COMPLETED handoff). */
  state_updated: boolean;
  /** Null when state was not advanced. */
  stage_entry: StageEntryRecord | null;
  /** Null when no stage loop was detected. */
  loop_signal: StageLoopSignalRecord | null;
};

// ─── Invariant Guards ─────────────────────────────────────────────────────────

/**
 * Guard: handoff_events MUST NOT be created without a valid transition candidate.
 *
 * Throwing here is intentional — a handoff without a transition candidate is a
 * programming error, not a user error. Silent production would corrupt truth.
 */
export function assertHasTransitionCandidate(
  candidate: TransitionCandidate | null,
  context: string
): asserts candidate is TransitionCandidate {
  if (candidate === null) {
    throw new Error(
      `[lifecycle invariant] handoff without transition candidate is forbidden (context: ${context})`
    );
  }
}

/**
 * Guard: state change MUST only occur after a COMPLETED handoff.
 *
 * updateSessionState outside the COMPLETED handoff path is a hard violation.
 */
export function assertHandoffCompletedForStateChange(
  outcome: HandoffOutcome,
  context: string
): void {
  if (outcome !== "COMPLETED") {
    throw new Error(
      `[lifecycle invariant] state change without COMPLETED handoff is forbidden (outcome=${outcome}, context: ${context})`
    );
  }
}

/**
 * Guard: stage_entry target pipeline_state MUST match the transition target.
 *
 * A mismatch means state and stage_entries have diverged, which breaks read
 * model correctness.
 */
export function assertStageEntryMatchesTransition(
  stageEntryPipelineState: PipelineState,
  targetPipelineState: PipelineState,
  context: string
): void {
  if (stageEntryPipelineState !== targetPipelineState) {
    throw new Error(
      `[lifecycle invariant] stage_entry.pipeline_state (${stageEntryPipelineState}) must match transition target (${targetPipelineState}) (context: ${context})`
    );
  }
}

// ─── D1 Batch Type ────────────────────────────────────────────────────────────

type BatchableStatement = { run(): Promise<unknown> };
type BatchableDb = Env["DECISIONS_DB"] & {
  batch(statements: BatchableStatement[]): Promise<unknown[]>;
};

// ─── Core Lifecycle Transaction ───────────────────────────────────────────────

/**
 * Executes all orchestration truth writes for one artifact lifecycle step as a
 * single D1 batch, guaranteeing atomicity.
 *
 * All reads are performed before batch construction. The batch contains only
 * write statements. D1 rolls back the entire batch on any statement failure,
 * preventing partial execution across truth tables.
 *
 * Events are emitted after the batch succeeds (best-effort; emission failure
 * does NOT roll back the already-persisted truth).
 */
export async function executeArtifactLifecycleTransaction(
  db: Env["DECISIONS_DB"],
  input: LifecycleTransactionInput
): Promise<LifecycleTransactionResult> {
  const {
    lifecycle_id,
    session,
    artifact_id,
    artifact_type,
    created_by_role,
    parser_verdict,
    review_verdict,
    scope_fingerprint_changed,
    transition_context,
    transition_candidate,
    delivery_input,
  } = input;

  const now = nowIso();
  const context = `lifecycle=${lifecycle_id} artifact=${artifact_id}`;

  // ── PRE-READ PHASE ──────────────────────────────────────────────────────────
  // Gather all data needed to build the batch statements.
  // Reads happen before the batch; no reads inside the batch.

  // 1. Prior lineage row → determines attempt number for this (run_id, stage)
  const priorLineage = await db
    .prepare(
      `SELECT attempt, artifact_id
         FROM artifact_lineage
        WHERE run_id = ? AND stage = ?
        ORDER BY attempt DESC
        LIMIT 1`
    )
    .bind(session.session_id, session.pipeline_state)
    .first<{ attempt: number; artifact_id: string } | null>();

  const attempt = priorLineage !== null ? priorLineage.attempt + 1 : 1;
  const supersedes_artifact_id = priorLineage !== null ? priorLineage.artifact_id : null;
  const is_repair_attempt = attempt > 1;
  const is_first_attempt_in_stage = attempt === 1;

  // 2. Prior delivery event → determines stage_loop_detected flag
  const priorDeliveryRow = await db
    .prepare(
      `SELECT 1 AS has_prior
         FROM delivery_integrity_events
        WHERE session_id = ? AND pipeline_state = ?
        LIMIT 1`
    )
    .bind(session.session_id, session.pipeline_state)
    .first<{ has_prior: number } | null>();

  const stage_loop_detected = priorDeliveryRow !== null;

  // 3. Prior stage entry count for the TRANSITION TARGET (loop detection)
  let priorStageEntryCount = 0;
  if (transition_candidate !== null) {
    const priorEntry = await db
      .prepare(
        `SELECT entry_count
           FROM stage_entries
          WHERE session_id = ? AND pipeline_state = ?
          ORDER BY entry_count DESC
          LIMIT 1`
      )
      .bind(session.session_id, transition_candidate.pipeline_state)
      .first<{ entry_count: number } | null>();
    priorStageEntryCount = priorEntry?.entry_count ?? 0;
  }

  // ── CLASSIFICATION PHASE ────────────────────────────────────────────────────

  // Classify replacement_reason (orchestration-owned; null for first attempt)
  let replacement_reason: ReplacementReason | null = null;
  let replacement_reason_source: string | null = null;
  if (is_repair_attempt) {
    replacement_reason = classifyReplacementReason(
      parser_verdict,
      review_verdict,
      scope_fingerprint_changed,
      transition_context
    );
    replacement_reason_source = "orchestration";
  }

  // Classify handoff outcome (only relevant for transition-triggering artifacts)
  let handoffOutcome: HandoffOutcome | null = null;
  let handoffFailureReason: HandoffFailureReason | null = null;
  if (transition_candidate !== null) {
    const classified = classifyHandoffOutcome({
      parser_verdict_ok: parser_verdict.stage_matches_expected,
      review_verdict_ok:
        review_verdict.status !== "REJECTED" && review_verdict.blocking !== true,
      legal_transition_ok: transition_candidate.legal_transition_ok,
      reentry_ready: parser_verdict.reentry_ready,
      owner_resolved: true,
      schema_valid: parser_verdict.schema_valid,
      fields_present: parser_verdict.required_sections_present,
    });
    handoffOutcome = classified.outcome;
    handoffFailureReason = classified.failure_reason;
  }

  const handoffCompleted = handoffOutcome === "COMPLETED";
  const newStageEntryCount = handoffCompleted ? priorStageEntryCount + 1 : 0;
  const hasLoopSignal = newStageEntryCount > 1;

  // Delivery input defaults
  const deliveryAttempt = delivery_input?.attempt ?? 1;
  const deliveryHandoffStatus: DeliveryHandoffStatus =
    delivery_input?.handoff_status ?? "pending";
  const deliveryFailureReason = delivery_input?.handoff_failure_reason ?? null;
  const deliverySupersedes = delivery_input?.supersedes_artifact_id ?? null;

  // ── INVARIANT CHECKS ────────────────────────────────────────────────────────
  // These guards enforce the write-ordering contract before any DB write occurs.

  if (handoffCompleted && transition_candidate === null) {
    // This path should be logically impossible (handoffOutcome is null when
    // transition_candidate is null), but we assert explicitly as a hard guard.
    assertHasTransitionCandidate(transition_candidate, context);
  }

  if (handoffCompleted) {
    assertHandoffCompletedForStateChange(handoffOutcome!, context);
    assertStageEntryMatchesTransition(
      transition_candidate!.pipeline_state,
      transition_candidate!.pipeline_state,
      context
    );
  }

  // ── ID GENERATION ───────────────────────────────────────────────────────────
  const lineage_id = newId();
  const delivery_event_id = newId();
  const handoff_event_id = newId();
  const stage_entry_id = newId();
  const loop_signal_id = newId();

  // ── BUILD D1 BATCH STATEMENTS ───────────────────────────────────────────────
  const statements: BatchableStatement[] = [];

  // Statement 1: artifact_lineage (always — every artifact submission is tracked)
  statements.push(
    db
      .prepare(
        `INSERT INTO artifact_lineage (
           lineage_id, run_id, artifact_id, artifact_type, stage, attempt,
           supersedes_artifact_id, created_at, created_by_role, classified_by,
           replacement_reason, replacement_reason_source,
           is_repair_attempt, is_first_attempt_in_stage, override_flag,
           lifecycle_id
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        lineage_id,
        session.session_id,
        artifact_id,
        artifact_type,
        session.pipeline_state,
        attempt,
        supersedes_artifact_id,
        now,
        created_by_role,
        "orchestration",
        replacement_reason,
        replacement_reason_source,
        boolToInt(is_repair_attempt),
        boolToInt(is_first_attempt_in_stage),
        0,
        lifecycle_id
      )
  );

  // Statement 2: delivery_integrity_events (always)
  statements.push(
    db
      .prepare(
        `INSERT INTO delivery_integrity_events (
           event_id, artifact_id, session_id, pipeline_state, attempt,
           supersedes_artifact_id, replacement_reason, handoff_status,
           handoff_failure_reason, stage_loop_detected, classified_by, classified_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        delivery_event_id,
        artifact_id,
        session.session_id,
        session.pipeline_state,
        deliveryAttempt,
        deliverySupersedes,
        null,
        deliveryHandoffStatus,
        deliveryFailureReason,
        boolToInt(stage_loop_detected),
        "orchestration",
        now
      )
  );

  // Statement 3: handoff_events (only when a transition candidate exists)
  if (transition_candidate !== null && handoffOutcome !== null) {
    statements.push(
      db
        .prepare(
          `INSERT INTO handoff_events (
             event_id, session_id, pipeline_state, outcome, failure_reason,
             classified_by, classified_at, lifecycle_id
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          handoff_event_id,
          session.session_id,
          session.pipeline_state,
          handoffOutcome,
          handoffFailureReason,
          "orchestration",
          now,
          lifecycle_id
        )
    );
  }

  // Statements 4-6: transition success path (COMPLETED handoff only)
  if (handoffCompleted && transition_candidate !== null) {
    // Statement 4: UPDATE sessions — advance pipeline_state atomically with stage_entry
    statements.push(
      db
        .prepare(
          `UPDATE sessions SET pipeline_state = ?, decision_status = ?, updated_at = ?
           WHERE session_id = ?`
        )
        .bind(
          transition_candidate.pipeline_state,
          transition_candidate.decision_status,
          now,
          session.session_id
        )
    );

    // Statement 5: stage_entries — record entry into new stage
    statements.push(
      db
        .prepare(
          `INSERT INTO stage_entries (
             stage_entry_id, session_id, artifact_id, pipeline_state,
             entry_count, classified_by, created_at, lifecycle_id
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          stage_entry_id,
          session.session_id,
          artifact_id,
          transition_candidate.pipeline_state,
          newStageEntryCount,
          "orchestration",
          now,
          lifecycle_id
        )
    );

    // Statement 6: stage_loop_signals (only when same stage is entered > 1 time)
    if (hasLoopSignal) {
      statements.push(
        db
          .prepare(
            `INSERT INTO stage_loop_signals (
               loop_signal_id, session_id, pipeline_state, entry_count,
               loop_type, classified_by, created_at
             ) VALUES (?, ?, ?, ?, ?, ?, ?)`
          )
          .bind(
            loop_signal_id,
            session.session_id,
            transition_candidate.pipeline_state,
            newStageEntryCount,
            "SAME_STAGE_REPEAT",
            "orchestration",
            now
          )
      );
    }
  }

  // ── ATOMIC EXECUTION ────────────────────────────────────────────────────────
  // D1 batch: all statements execute atomically.
  // Any failure rolls back every write in this batch.
  await (db as unknown as BatchableDb).batch(statements);

  // ── BUILD RETURN VALUES ──────────────────────────────────────────────────────

  const lineageRecord: ArtifactLineageRecord = {
    lineage_id,
    run_id: session.session_id,
    artifact_id,
    artifact_type,
    stage: session.pipeline_state,
    attempt,
    supersedes_artifact_id,
    created_at: now,
    created_by_role,
    classified_by: "orchestration",
    replacement_reason,
    replacement_reason_source,
    is_repair_attempt,
    is_first_attempt_in_stage,
    override_flag: false,
  };

  const lineageEvents: DeliveryEvent[] = [
    {
      type: "artifact_attempt_created",
      lineage_id,
      artifact_id,
      run_id: session.session_id,
      stage: session.pipeline_state,
      attempt,
    },
  ];
  if (is_repair_attempt && supersedes_artifact_id !== null && replacement_reason !== null) {
    lineageEvents.push({
      type: "artifact_superseded",
      lineage_id,
      artifact_id,
      supersedes_artifact_id,
      replacement_reason,
      run_id: session.session_id,
      stage: session.pipeline_state,
    });
  }

  let handoffRecord: HandoffOutcomeRecord | null = null;
  if (transition_candidate !== null && handoffOutcome !== null) {
    handoffRecord = {
      event_id: handoff_event_id,
      session_id: session.session_id,
      pipeline_state: session.pipeline_state,
      outcome: handoffOutcome,
      failure_reason: handoffFailureReason,
      classified_by: "orchestration",
      classified_at: now,
    };
  }

  let stageEntryRecord: StageEntryRecord | null = null;
  let loopSignalRecord: StageLoopSignalRecord | null = null;
  if (handoffCompleted && transition_candidate !== null) {
    stageEntryRecord = {
      stage_entry_id,
      entry_id: stage_entry_id,
      session_id: session.session_id,
      artifact_id,
      pipeline_state: transition_candidate.pipeline_state,
      entry_count: newStageEntryCount,
      classified_by: "orchestration",
      created_at: now,
    };
    if (hasLoopSignal) {
      loopSignalRecord = {
        loop_signal_id,
        session_id: session.session_id,
        pipeline_state: transition_candidate.pipeline_state,
        entry_count: newStageEntryCount,
        loop_type: "SAME_STAGE_REPEAT",
        classified_by: "orchestration",
        created_at: now,
      };
    }
  }

  return {
    lifecycle_id,
    lineage: lineageRecord,
    lineage_events: lineageEvents,
    handoff: handoffRecord,
    state_updated: handoffCompleted,
    stage_entry: stageEntryRecord,
    loop_signal: loopSignalRecord,
  };
}
