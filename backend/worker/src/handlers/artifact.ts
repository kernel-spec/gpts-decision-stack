import type { Env, SubmitArtifactRequest } from "../types/index.js";
import * as artifactService from "../services/artifact.js";
import * as stateService from "../services/state.js";
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

  const artifact = await artifactService.submitArtifactWithLifecycle(
    env.DECISIONS_DB,
    env.ARTIFACTS_BUCKET,
    session,
    { artifact_type: body.artifact_type, payload: body.payload, agent_id: body.agent_id }
  );

  return Response.json({ ok: true, data: artifact }, { status: 201 });
}
