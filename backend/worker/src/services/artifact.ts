import type {
  Env,
  Artifact,
  SubmitArtifactRequest,
  Session,
  ParserVerdict,
  ReviewVerdict,
} from "../types/index.js";
import * as decisionlogService from "./decisionlog.js";
import {
  executeArtifactLifecycleTransaction,
  type TransitionCandidate as TransitionCandidateBase,
} from "./lifecycle-transaction.js";
export type { TransitionCandidate } from "./lifecycle-transaction.js";

function nowIso(): string {
  return new Date().toISOString();
}

function newId(): string {
  return crypto.randomUUID();
}

export async function submitArtifact(
  db: Env["DECISIONS_DB"],
  bucket: Env["ARTIFACTS_BUCKET"],
  session_id: string,
  req: SubmitArtifactRequest
): Promise<Artifact> {
  const id = newId();
  const submitted_at = nowIso();
  const payloadJson = JSON.stringify(req.payload);

  // Persist payload in R2 for immutable storage
  const r2Key = `${session_id}/${id}/${req.artifact_type}.json`;
  await bucket.put(r2Key, payloadJson, {
    httpMetadata: { contentType: "application/json" },
    customMetadata: {
      session_id,
      artifact_type: req.artifact_type,
      submitted_at,
    },
  });

  // Record artifact reference in D1
  await db
    .prepare(
      `INSERT INTO artifacts (id, session_id, artifact_type, r2_key, submitted_at)
       VALUES (?, ?, ?, ?, ?)`
    )
    .bind(id, session_id, req.artifact_type, r2Key, submitted_at)
    .run();

  return {
    id,
    session_id,
    artifact_type: req.artifact_type,
    payload: req.payload,
    submitted_at,
  };
}

type ArtifactTransition = {
  pipeline_state: Session["pipeline_state"];
  decision_status: Session["decision_status"];
  notes: string;
} | null;

type TransitionCandidate = TransitionCandidateBase | null;

type StateDecisionPacketPayload = {
  state_id?: string;
  outcome?: string;
};

const FOUNDER_DUAL_WRITE_CANONICAL_ARTIFACT_TYPES = new Set<
  SubmitArtifactRequest["artifact_type"]
>(["ProblemBrief", "StateDecisionPacket"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asStateDecisionPacketPayload(
  payload: unknown
): StateDecisionPacketPayload | null {
  if (!isRecord(payload)) {
    return null;
  }

  return {
    state_id: typeof payload.state_id === "string" ? payload.state_id : undefined,
    outcome: typeof payload.outcome === "string" ? payload.outcome : undefined,
  };
}

export function getFounderCanonicalArtifactType(
  artifact_type: string
): SubmitArtifactRequest["artifact_type"] | null {
  return FOUNDER_DUAL_WRITE_CANONICAL_ARTIFACT_TYPES.has(
    artifact_type as SubmitArtifactRequest["artifact_type"]
  )
    ? (artifact_type as SubmitArtifactRequest["artifact_type"])
    : null;
}

export function getArtifactTransition(
  session: Session,
  req: SubmitArtifactRequest
): ArtifactTransition {
  const candidate = getTransitionCandidate(session, req);
  return candidate?.legal_transition_ok ? candidate : null;
}

function getTransitionCandidate(
  session: Session,
  req: SubmitArtifactRequest
): TransitionCandidate {
  if (session.pipeline_state === "intake" && req.artifact_type === "ProblemBrief") {
    return {
      pipeline_state: "problem_framing",
      decision_status: session.decision_status,
      notes: "Transitioned intake → problem_framing after accepted ProblemBrief",
      legal_transition_ok: true,
    };
  }

  if (req.artifact_type !== "StateDecisionPacket") {
    return null;
  }

  const pkt = asStateDecisionPacketPayload(req.payload);
  if (!pkt?.state_id) {
    return null;
  }

  if (
    session.pipeline_state === "problem_framing" &&
    pkt.state_id === "problem_framing"
  ) {
    return {
      pipeline_state: "primitive_selection",
      decision_status: "proceed",
      notes:
        "Transitioned problem_framing → primitive_selection after accepted StateDecisionPacket (outcome=proceed)",
      legal_transition_ok: pkt.outcome === "proceed",
    };
  }

  if (
    session.pipeline_state === "primitive_selection" &&
    pkt.state_id === "primitive_selection"
  ) {
    return {
      pipeline_state: "architecture_validation",
      decision_status: "proceed",
      notes:
        "Transitioned primitive_selection → architecture_validation after accepted StateDecisionPacket (outcome=proceed)",
      legal_transition_ok: pkt.outcome === "proceed",
    };
  }

  if (
    session.pipeline_state === "architecture_validation" &&
    pkt.state_id === "architecture_validation"
  ) {
    return {
      pipeline_state: "risk_governance_validation",
      decision_status: "proceed",
      notes:
        "Transitioned architecture_validation → risk_governance_validation after accepted StateDecisionPacket (outcome=proceed)",
      legal_transition_ok: pkt.outcome === "proceed",
    };
  }

  if (
    session.pipeline_state === "risk_governance_validation" &&
    pkt.state_id === "risk_governance_validation"
  ) {
    return {
      pipeline_state: "commercial_packaging",
      decision_status: "proceed",
      notes:
        "Transitioned risk_governance_validation → commercial_packaging after accepted StateDecisionPacket (outcome=proceed)",
      legal_transition_ok: pkt.outcome === "proceed",
    };
  }

  if (
    session.pipeline_state === "commercial_packaging" &&
    pkt.state_id === "commercial_packaging"
  ) {
    return {
      pipeline_state: "claims_validation",
      decision_status: "proceed",
      notes:
        "Transitioned commercial_packaging → claims_validation after accepted StateDecisionPacket (outcome=proceed)",
      legal_transition_ok: pkt.outcome === "proceed",
    };
  }

  if (
    session.pipeline_state === "claims_validation" &&
    pkt.state_id === "claims_validation"
  ) {
    return {
      pipeline_state: "release_decision",
      decision_status: "proceed",
      notes:
        "Transitioned claims_validation → release_decision after accepted StateDecisionPacket (outcome=proceed)",
      legal_transition_ok: pkt.outcome === "proceed",
    };
  }

  return null;
}

export function getFounderCanonicalArtifactError(
  session: Session,
  req: SubmitArtifactRequest
): string | null {
  if (getFounderCanonicalArtifactType(req.artifact_type) === null) {
    return null;
  }

  return getArtifactTransition(session, req)
    ? null
    : `${req.artifact_type} cannot be submitted canonically while pipeline_state=${session.pipeline_state}`;
}

export async function submitArtifactWithLifecycle(
  db: Env["DECISIONS_DB"],
  bucket: Env["ARTIFACTS_BUCKET"],
  session: Session,
  req: SubmitArtifactRequest & { agent_id?: string }
): Promise<Artifact> {
  const artifact = await submitArtifact(db, bucket, session.session_id, req);

  const defaultParserVerdict: ParserVerdict = {
    schema_valid: true,
    required_sections_present: true,
    stage_matches_expected: true,
    reentry_ready: true,
  };
  const parserVerdict = req.parser_verdict ?? defaultParserVerdict;
  const reviewVerdict: ReviewVerdict = req.review_verdict ?? { status: "NOT_REQUIRED" };
  const transitionCandidate = getTransitionCandidate(session, req);

  // All orchestration truth writes execute as a single D1 batch (atomic).
  // If the batch fails, no truth tables are partially written.
  const lifecycle_id = newId();
  const txResult = await executeArtifactLifecycleTransaction(db, {
    lifecycle_id,
    session,
    artifact_id: artifact.id,
    artifact_type: req.artifact_type,
    created_by_role: req.agent_id ?? "unknown",
    parser_verdict: parserVerdict,
    review_verdict: reviewVerdict,
    scope_fingerprint_changed: req.scope_fingerprint_changed ?? false,
    transition_context: req.transition_context ?? {},
    transition_candidate: transitionCandidate,
    delivery_input: req.delivery,
  });

  // Event emission is best-effort: truth is already persisted via the batch.
  // Emission failures do not roll back the batch.
  try {
    for (const ev of txResult.lineage_events) {
      console.log(JSON.stringify({ ...ev }));
    }
  } catch {
    // non-critical
  }

  try {
    if (txResult.handoff) {
      if (txResult.handoff.outcome === "COMPLETED") {
        console.log(
          JSON.stringify({
            event: "handoff_completed",
            event_id: txResult.handoff.event_id,
            session_id: session.session_id,
            pipeline_state: session.pipeline_state,
            classified_at: txResult.handoff.classified_at,
          })
        );
      } else {
        console.log(
          JSON.stringify({
            event: "handoff_failed",
            event_id: txResult.handoff.event_id,
            session_id: session.session_id,
            pipeline_state: session.pipeline_state,
            failure_reason: txResult.handoff.failure_reason,
            classified_at: txResult.handoff.classified_at,
          })
        );
      }
    }
  } catch {
    // non-critical
  }

  try {
    if (txResult.stage_entry) {
      if (txResult.loop_signal) {
        console.log(
          JSON.stringify({
            event: "stage_loop_detected",
            stage_entry_id: txResult.stage_entry.stage_entry_id,
            loop_signal_id: txResult.loop_signal.loop_signal_id,
            session_id: session.session_id,
            pipeline_state: txResult.stage_entry.pipeline_state,
            loop_type: "SAME_STAGE_REPEAT",
            entry_count: txResult.stage_entry.entry_count,
            created_at: txResult.stage_entry.created_at,
          })
        );
      } else {
        console.log(
          JSON.stringify({
            event: "stage_entry_created",
            stage_entry_id: txResult.stage_entry.stage_entry_id,
            session_id: session.session_id,
            pipeline_state: txResult.stage_entry.pipeline_state,
            entry_count: txResult.stage_entry.entry_count,
            created_at: txResult.stage_entry.created_at,
          })
        );
      }
    }
  } catch {
    // non-critical
  }

  // Decision log writes are append-only audit records (non-critical, sequential).
  await decisionlogService.appendDecisionLog(db, session.session_id, {
    agent_id: req.agent_id ?? "unknown",
    action: "artifact.submitted",
    pipeline_state: session.pipeline_state,
    decision_status: session.decision_status,
    notes: `Artifact ${req.artifact_type} submitted (id=${artifact.id})`,
  });

  if (txResult.state_updated && transitionCandidate !== null) {
    await decisionlogService.appendDecisionLog(db, session.session_id, {
      agent_id: req.agent_id ?? "unknown",
      action: "pipeline.transition",
      pipeline_state: transitionCandidate.pipeline_state,
      decision_status: transitionCandidate.decision_status,
      notes: transitionCandidate.notes,
    });
  }

  return artifact;
}

export async function getArtifacts(
  db: Env["DECISIONS_DB"],
  bucket: Env["ARTIFACTS_BUCKET"],
  session_id: string
): Promise<Artifact[]> {
  const rows = await db
    .prepare(
      `SELECT id, session_id, artifact_type, r2_key, submitted_at
       FROM artifacts WHERE session_id = ? ORDER BY submitted_at ASC`
    )
    .bind(session_id)
    .all<{
      id: string;
      session_id: string;
      artifact_type: string;
      r2_key: string;
      submitted_at: string;
    }>();

  const artifacts: Artifact[] = [];
  for (const row of rows.results) {
    let payload: unknown = null;
    try {
      const obj = await bucket.get(row.r2_key);
      if (obj) {
        payload = await obj.json();
      }
    } catch {
      // artifact payload missing from R2 — return null payload
    }
    artifacts.push({
      id: row.id,
      session_id: row.session_id,
      artifact_type: row.artifact_type as Artifact["artifact_type"],
      payload,
      submitted_at: row.submitted_at,
    });
  }
  return artifacts;
}
