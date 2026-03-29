import type {
  Env,
  Artifact,
  SubmitArtifactRequest,
  Session,
} from "../types/index.js";
import * as decisionlogService from "./decisionlog.js";
import * as stateService from "./state.js";
import { appendDeliveryIntegrityEvent } from "./delivery-integrity.js";

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
  if (session.pipeline_state === "intake" && req.artifact_type === "ProblemBrief") {
    return {
      pipeline_state: "problem_framing",
      decision_status: session.decision_status,
      notes: "Transitioned intake → problem_framing after accepted ProblemBrief",
    };
  }

  if (req.artifact_type !== "StateDecisionPacket") {
    return null;
  }

  const pkt = asStateDecisionPacketPayload(req.payload);
  if (pkt?.outcome !== "proceed") {
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

  // Persist delivery truth before emitting events
  await appendDeliveryIntegrityEvent(db, session, artifact.id, req.delivery);

  await decisionlogService.appendDecisionLog(db, session.session_id, {
    agent_id: req.agent_id ?? "unknown",
    action: "artifact.submitted",
    pipeline_state: session.pipeline_state,
    decision_status: session.decision_status,
    notes: `Artifact ${req.artifact_type} submitted (id=${artifact.id})`,
  });

  const transition = getArtifactTransition(session, req);
  if (transition) {
    await stateService.updateSessionState(
      db,
      session.session_id,
      transition.pipeline_state,
      transition.decision_status
    );
    await decisionlogService.appendDecisionLog(db, session.session_id, {
      agent_id: req.agent_id ?? "unknown",
      action: "pipeline.transition",
      pipeline_state: transition.pipeline_state,
      decision_status: transition.decision_status,
      notes: transition.notes,
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
