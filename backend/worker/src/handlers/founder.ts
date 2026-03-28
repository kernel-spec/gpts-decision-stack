import type {
  Env,
  FounderArtifactSaveRequest,
  FounderModelOutputRecordRequest,
} from "../types/index.js";
import * as founderService from "../services/founder.js";
import * as founderWriteService from "../services/founder-write.js";
import * as decisionlogService from "../services/decisionlog.js";
import { errorResponse, requireJson } from "../router.js";

export async function handleGetProjectStatus(
  project_id: string,
  env: Env
): Promise<Response> {
  const status = await founderService.getProjectStatus(
    env.DECISIONS_DB,
    project_id
  );
  if (!status) {
    return errorResponse("Project not found", "NOT_FOUND", 404);
  }

  return Response.json({ ok: true, data: status });
}

export async function handleGetNextAction(
  project_id: string,
  env: Env
): Promise<Response> {
  const nextAction = await founderService.getNextAction(
    env.DECISIONS_DB,
    project_id
  );
  if (!nextAction) {
    return errorResponse("Project not found", "NOT_FOUND", 404);
  }

  return Response.json({ ok: true, data: nextAction });
}

export async function handleSaveArtifact(
  request: Request,
  project_id: string,
  env: Env
): Promise<Response> {
  const session = await founderService.getProjectSession(env.DECISIONS_DB, project_id);
  if (!session) {
    return errorResponse("Project not found", "NOT_FOUND", 404);
  }

  const body = await requireJson<FounderArtifactSaveRequest>(request);
  const hasMetadata =
    typeof body.metadata === "object" && body.metadata !== null && !Array.isArray(body.metadata);
  const run_id = hasMetadata ? body.metadata.run_id : undefined;

  if (
    typeof body.artifact_type !== "string" ||
    body.artifact_type.trim().length === 0 ||
    !hasMetadata ||
    typeof run_id !== "string" ||
    run_id.trim().length === 0 ||
    body.content === undefined ||
    typeof body.submitted_by !== "string" ||
    body.submitted_by.trim().length === 0
  ) {
    return errorResponse(
      "artifact_type, metadata.run_id, content, and submitted_by are required",
      "INVALID_REQUEST",
      400
    );
  }

  const result = await founderWriteService.saveArtifact(
    env.DECISIONS_DB,
    env.ARTIFACTS_BUCKET,
    project_id,
    body
  );

  await decisionlogService.appendDecisionLog(env.DECISIONS_DB, session.session_id, {
    agent_id: body.submitted_by,
    action: "founder.artifact.saved",
    pipeline_state: session.pipeline_state,
    decision_status: session.decision_status,
    notes: `Founder artifact ${body.artifact_type} saved (artifact_id=${result.artifact_id}, run_id=${body.metadata.run_id})`,
  });

  return Response.json({ ok: true, data: result });
}

export async function handleRecordModelOutput(
  request: Request,
  project_id: string,
  env: Env
): Promise<Response> {
  const session = await founderService.getProjectSession(env.DECISIONS_DB, project_id);
  if (!session) {
    return errorResponse("Project not found", "NOT_FOUND", 404);
  }

  const body = await requireJson<FounderModelOutputRecordRequest>(request);
  if (
    typeof body.run_id !== "string" ||
    body.run_id.trim().length === 0 ||
    typeof body.role_name !== "string" ||
    body.role_name.trim().length === 0 ||
    typeof body.output_type !== "string" ||
    body.output_type.trim().length === 0 ||
    body.raw_output === undefined
  ) {
    return errorResponse(
      "run_id, role_name, output_type, and raw_output are required",
      "INVALID_REQUEST",
      400
    );
  }

  const result = await founderWriteService.recordModelOutput(
    env.DECISIONS_DB,
    env.ARTIFACTS_BUCKET,
    project_id,
    body
  );

  await decisionlogService.appendDecisionLog(env.DECISIONS_DB, session.session_id, {
    agent_id: body.role_name,
    action: "founder.model_output.recorded",
    pipeline_state: session.pipeline_state,
    decision_status: session.decision_status,
    notes: `Founder model output recorded (record_id=${result.record_id}, output_type=${body.output_type}, run_id=${body.run_id})`,
  });

  return Response.json({ ok: true, data: result });
}
