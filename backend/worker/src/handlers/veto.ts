import type { Env, ActivateVetoRequest, ReleaseVetoRequest } from "../types/index.js";
import * as vetoService from "../services/veto.js";
import * as stateService from "../services/state.js";
import * as decisionlogService from "../services/decisionlog.js";
import { errorResponse, requireJson } from "../router.js";

export async function handleGetVetoStatus(
  session_id: string,
  env: Env
): Promise<Response> {
  const session = await stateService.getSession(env.DECISIONS_DB, session_id);
  if (!session) {
    return errorResponse("Session not found", "NOT_FOUND", 404);
  }
  const status = await vetoService.getVetoStatus(env.DECISIONS_DB, session_id);
  return Response.json({ ok: true, data: status });
}

export async function handleActivateVeto(
  request: Request,
  session_id: string,
  env: Env
): Promise<Response> {
  const session = await stateService.getSession(env.DECISIONS_DB, session_id);
  if (!session) {
    return errorResponse("Session not found", "NOT_FOUND", 404);
  }

  const body = await requireJson<ActivateVetoRequest>(request);
  if (!body.activated_by || !body.reason) {
    return errorResponse("activated_by and reason are required", "INVALID_REQUEST", 400);
  }

  const veto = await vetoService.activateVeto(env.DECISIONS_DB, session_id, body);

  await decisionlogService.appendDecisionLog(env.DECISIONS_DB, session_id, {
    agent_id: body.activated_by,
    action: "veto.activated",
    pipeline_state: session.pipeline_state,
    decision_status: "blocked",
    notes: `Veto activated: ${body.reason}`,
  });

  await stateService.updateSessionState(
    env.DECISIONS_DB,
    session_id,
    session.pipeline_state,
    "blocked"
  );

  return Response.json({ ok: true, data: veto });
}

export async function handleReleaseVeto(
  request: Request,
  session_id: string,
  env: Env
): Promise<Response> {
  const session = await stateService.getSession(env.DECISIONS_DB, session_id);
  if (!session) {
    return errorResponse("Session not found", "NOT_FOUND", 404);
  }

  const current = await vetoService.getVetoStatus(env.DECISIONS_DB, session_id);
  if (!current.is_active) {
    return errorResponse("No active veto on this session", "INVALID_STATE", 409);
  }

  const body = await requireJson<ReleaseVetoRequest>(request);
  if (!body.released_by) {
    return errorResponse("released_by is required", "INVALID_REQUEST", 400);
  }

  const veto = await vetoService.releaseVeto(env.DECISIONS_DB, session_id, body);

  await decisionlogService.appendDecisionLog(env.DECISIONS_DB, session_id, {
    agent_id: body.released_by,
    action: "veto.released",
    pipeline_state: session.pipeline_state,
    decision_status: "unresolved",
    notes: `Veto released by ${body.released_by}`,
  });

  await stateService.updateSessionState(
    env.DECISIONS_DB,
    session_id,
    session.pipeline_state,
    "unresolved"
  );

  return Response.json({ ok: true, data: veto });
}
