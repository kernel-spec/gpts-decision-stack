import type { Env, CreateSessionRequest, ReentryRequest } from "../types/index.js";
import { VALID_REQUESTOR_TYPES } from "../types/index.js";
import * as stateService from "../services/state.js";
import * as decisionlogService from "../services/decisionlog.js";
import * as deliveryIntegrityService from "../services/delivery-integrity.js";
import { errorResponse, requireJson } from "../router.js";

export async function handleCreateSession(
  request: Request,
  env: Env
): Promise<Response> {
  const body = await requireJson<CreateSessionRequest>(request);
  const requestorType = body.requestor_type;
  if (!requestorType || !VALID_REQUESTOR_TYPES.includes(requestorType)) {
    return errorResponse(
      "requestor_type is required and must be one of: founder-led, enterprise, regulated, enablement",
      "INVALID_REQUEST",
      400
    );
  }

  // Defensive normalisation: treat missing/non-string external_ref as null
  const externalRef =
    typeof body.external_ref === "string" ? body.external_ref : null;

  const session = await stateService.createSession(env.DECISIONS_DB, {
    requestor_type: requestorType,
    external_ref: externalRef,
  });

  await deliveryIntegrityService.recordStageEntry(env.DECISIONS_DB, {
    session_id: session.session_id,
    pipeline_state: session.pipeline_state,
  });

  await decisionlogService.appendDecisionLog(env.DECISIONS_DB, session.session_id, {
    agent_id: "system",
    action: "session.created",
    pipeline_state: session.pipeline_state,
    decision_status: "unresolved",
    notes: `Session created for requestor_type: ${requestorType}`,
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

export async function handleGetDeliverySummary(
  session_id: string,
  env: Env
): Promise<Response> {
  const session = await stateService.getSession(env.DECISIONS_DB, session_id);
  if (!session) {
    return errorResponse("Session not found", "NOT_FOUND", 404);
  }

  const summary = await deliveryIntegrityService.getDeliverySummary(
    env.DECISIONS_DB,
    session
  );

  return Response.json({ ok: true, data: summary });
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

  if (updated) {
    await deliveryIntegrityService.recordStageEntry(env.DECISIONS_DB, {
      session_id,
      pipeline_state: body.to_state,
    });
  }

  await decisionlogService.appendDecisionLog(env.DECISIONS_DB, session_id, {
    agent_id: body.agent_id,
    action: "session.reentry",
    pipeline_state: body.to_state,
    decision_status: "unresolved",
    notes: `Reentry from ${body.from_state ?? session.pipeline_state} to ${body.to_state}: ${body.reason}`,
  });

  return Response.json({ ok: true, data: updated });
}
