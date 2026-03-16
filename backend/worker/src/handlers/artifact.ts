import type { Env, SubmitArtifactRequest } from "../types/index.js";
import * as artifactService from "../services/artifact.js";
import * as stateService from "../services/state.js";
import * as decisionlogService from "../services/decisionlog.js";
import { errorResponse, requireJson } from "../router.js";

export async function handleSubmitArtifact(
  request: Request,
  session_id: string,
  env: Env
): Promise<Response> {
  const session = await stateService.getSession(env.DECISIONS_DB, session_id);
  if (!session) {
    return errorResponse("Session not found", "NOT_FOUND", 404);
  }

  const body = await requireJson<SubmitArtifactRequest & { agent_id?: string }>(request);
  if (!body.artifact_type || body.payload === undefined) {
    return errorResponse("artifact_type and payload are required", "INVALID_REQUEST", 400);
  }

  const artifact = await artifactService.submitArtifact(
    env.DECISIONS_DB,
    env.ARTIFACTS_BUCKET,
    session_id,
    { artifact_type: body.artifact_type, payload: body.payload }
  );

  await decisionlogService.appendDecisionLog(env.DECISIONS_DB, session_id, {
    agent_id: body.agent_id ?? "unknown",
    action: "artifact.submitted",
    pipeline_state: session.pipeline_state,
    decision_status: session.decision_status,
    notes: `Artifact ${body.artifact_type} submitted (id=${artifact.id})`,
  });

  if (session.pipeline_state === "intake" && body.artifact_type === "ProblemBrief") {
    await stateService.updateSessionState(
      env.DECISIONS_DB,
      session_id,
      "problem_framing",
      session.decision_status
    );
    await decisionlogService.appendDecisionLog(env.DECISIONS_DB, session_id, {
      agent_id: body.agent_id ?? "unknown",
      action: "pipeline.transition",
      pipeline_state: "problem_framing",
      decision_status: session.decision_status,
      notes: "Transitioned intake → problem_framing after accepted ProblemBrief",
    });
  }

  if (
    session.pipeline_state === "problem_framing" &&
    body.artifact_type === "StateDecisionPacket"
  ) {
    const pkt = body.payload as { state_id?: string; outcome?: string } | null;
    if (pkt?.state_id === "problem_framing" && pkt?.outcome === "proceed") {
      await stateService.updateSessionState(
        env.DECISIONS_DB,
        session_id,
        "primitive_selection",
        "proceed"
      );
      await decisionlogService.appendDecisionLog(env.DECISIONS_DB, session_id, {
        agent_id: body.agent_id ?? "unknown",
        action: "pipeline.transition",
        pipeline_state: "primitive_selection",
        decision_status: "proceed",
        notes: "Transitioned problem_framing → primitive_selection after accepted StateDecisionPacket (outcome=proceed)",
      });
    }
  }

  if (
    session.pipeline_state === "primitive_selection" &&
    body.artifact_type === "StateDecisionPacket"
  ) {
    const pkt = body.payload as { state_id?: string; outcome?: string } | null;
    if (pkt?.state_id === "primitive_selection" && pkt?.outcome === "proceed") {
      await stateService.updateSessionState(
        env.DECISIONS_DB,
        session_id,
        "architecture_validation",
        "proceed"
      );
      await decisionlogService.appendDecisionLog(env.DECISIONS_DB, session_id, {
        agent_id: body.agent_id ?? "unknown",
        action: "pipeline.transition",
        pipeline_state: "architecture_validation",
        decision_status: "proceed",
        notes: "Transitioned primitive_selection → architecture_validation after accepted StateDecisionPacket (outcome=proceed)",
      });
    }
  }

  return Response.json({ ok: true, data: artifact }, { status: 201 });
}
