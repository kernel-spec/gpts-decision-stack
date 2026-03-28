import type { Env } from "../types/index.js";
import * as founderService from "../services/founder.js";
import { errorResponse } from "../router.js";

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
