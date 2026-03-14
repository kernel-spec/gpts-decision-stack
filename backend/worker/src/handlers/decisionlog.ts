import type { Env } from "../types/index.js";
import * as decisionlogService from "../services/decisionlog.js";
import * as stateService from "../services/state.js";
import { errorResponse } from "../router.js";

export async function handleGetDecisionLog(
  session_id: string,
  env: Env
): Promise<Response> {
  const session = await stateService.getSession(env.DECISIONS_DB, session_id);
  if (!session) {
    return errorResponse("Session not found", "NOT_FOUND", 404);
  }

  const log = await decisionlogService.getDecisionLog(
    env.DECISIONS_DB,
    session_id
  );
  return Response.json({ ok: true, data: log });
}
