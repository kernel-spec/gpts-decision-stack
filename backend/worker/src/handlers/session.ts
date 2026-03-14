import type { Env, CreateSessionRequest, ReentryRequest } from "../types/index.js";
import * as stateService from "../services/state.js";
import * as decisionlogService from "../services/decisionlog.js";
import { errorResponse, requireJson } from "../router.js";

export async function handleCreateSession(
  request: Request,
  env: Env
): Promise<Response> {
  const body = await requireJson<CreateSessionRequest>(request);
  if (!body.agent_id || !body.pipeline_state) {
    return errorResponse("agent_id and pipeline_state are required", "INVALID_REQUEST", 400);
  }

  const session = await stateService.createSession(env.DECISIONS_DB, body);
  await decisionlogService.appendDecisionLog(env.DECISIONS_DB, session.session_id, {
    agent_id: body.agent_id,
    action: "session.created",
    pipeline_state: body.pipeline_state,
    decision_status: "unresolved",
    notes: "Session created",
  });

  return Response.json({ ok: true, data: session }, { status: 201 });
}

export async function handleGetSession(
  session_id: string,
  env: Env
): Promise<Response> {
  const session = await stateService.getSession(env.DECISIONS_DB, session_id);
  if (!session) {
    return errorResponse("Session not found", "NOT_FOUND", 404);
  }
  return Response.json({ ok: true, data: session });
}

export async function handleTriggerReentry(
  request: Request,
  session_id: string,
  env: Env
): Promise<Response> {
  const session = await stateService.getSession(env.DECISIONS_DB, session_id);
  if (!session) {
    return errorResponse("Session not found", "NOT_FOUND", 404);
  }

  const body = await requireJson<ReentryRequest>(request);
  if (!body.to_state || !body.reason || !body.agent_id) {
    return errorResponse("to_state, reason and agent_id are required", "INVALID_REQUEST", 400);
  }

  const updated = await stateService.updateSessionState(
    env.DECISIONS_DB,
    session_id,
    body.to_state,
    "unresolved"
  );

  await decisionlogService.appendDecisionLog(env.DECISIONS_DB, session_id, {
    agent_id: body.agent_id,
    action: "session.reentry",
    pipeline_state: body.to_state,
    decision_status: "unresolved",
    notes: `Reentry from ${body.from_state ?? session.pipeline_state} to ${body.to_state}: ${body.reason}`,
  });

  return Response.json({ ok: true, data: updated });
}
