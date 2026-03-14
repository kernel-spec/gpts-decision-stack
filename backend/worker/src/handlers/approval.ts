import type { Env, SubmitApprovalRequest } from "../types/index.js";
import * as approvalService from "../services/approval.js";
import * as stateService from "../services/state.js";
import * as decisionlogService from "../services/decisionlog.js";
import { errorResponse, requireJson } from "../router.js";

export async function handleGetApprovals(
  session_id: string,
  env: Env
): Promise<Response> {
  const session = await stateService.getSession(env.DECISIONS_DB, session_id);
  if (!session) {
    return errorResponse("Session not found", "NOT_FOUND", 404);
  }
  const approvals = await approvalService.getApprovals(
    env.DECISIONS_DB,
    session_id
  );
  return Response.json({ ok: true, data: approvals });
}

export async function handleSubmitApproval(
  request: Request,
  session_id: string,
  env: Env
): Promise<Response> {
  const session = await stateService.getSession(env.DECISIONS_DB, session_id);
  if (!session) {
    return errorResponse("Session not found", "NOT_FOUND", 404);
  }

  const body = await requireJson<SubmitApprovalRequest>(request);
  if (!body.approval_type || !body.submitted_by || !body.decision) {
    return errorResponse(
      "approval_type, submitted_by and decision are required",
      "INVALID_REQUEST",
      400
    );
  }

  const approval = await approvalService.submitApproval(
    env.DECISIONS_DB,
    session_id,
    body
  );

  await decisionlogService.appendDecisionLog(env.DECISIONS_DB, session_id, {
    agent_id: body.submitted_by,
    action: "approval.submitted",
    pipeline_state: session.pipeline_state,
    decision_status: session.decision_status,
    notes: `Approval ${body.approval_type}: ${body.decision}`,
  });

  return Response.json({ ok: true, data: approval }, { status: 201 });
}
