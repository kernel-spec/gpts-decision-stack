import type { Env } from "./types/index.js";
import { handleHealth } from "./handlers/health.js";
import {
  handleCreateSession,
  handleGetDeliverySummary,
  handleGetSession,
  handleTriggerReentry,
} from "./handlers/session.js";
import { handleSubmitArtifact } from "./handlers/artifact.js";
import { handleGetDecisionLog } from "./handlers/decisionlog.js";
import {
  handleGetVetoStatus,
  handleActivateVeto,
  handleReleaseVeto,
} from "./handlers/veto.js";
import {
  handleGetApprovals,
  handleSubmitApproval,
} from "./handlers/approval.js";
import {
  handleCheckProductionClosure,
  handleCheckSellReady,
  handleGetProjectStatus,
  handleGetNextAction,
  handleRecordModelOutput,
  handleRequestFounderDecision,
  handleSaveArtifact,
} from "./handlers/founder.js";
import {
  handleGetRunDeliveryHistory,
  handleGetRunDeliverySummary,
  handleGetRunNextAction,
} from "./handlers/operator-delivery.js";

// ---------- Helpers ----------

export function errorResponse(
  message: string,
  code: string,
  status = 500
): Response {
  return Response.json({ ok: false, error: message, code }, { status });
}

export async function requireJson<T>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch {
    throw new TypeError("Invalid JSON body");
  }
}

function methodNotAllowed(): Response {
  return errorResponse("Method not allowed", "METHOD_NOT_ALLOWED", 405);
}

// ---------- Router ----------

export async function route(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method.toUpperCase();

  // GET /health
  if (path === "/health") {
    if (method !== "GET") return methodNotAllowed();
    return handleHealth();
  }

  // POST /session
  if (path === "/session") {
    if (method !== "POST") return methodNotAllowed();
    return handleCreateSession(request, env);
  }

  // /session/{session_id}
  const sessionMatch = path.match(/^\/session\/([^/]+)$/);
  if (sessionMatch) {
    const session_id = sessionMatch[1];
    if (method === "GET") return handleGetSession(session_id, env);
    return methodNotAllowed();
  }

  // /session/{session_id}/artifact
  const artifactMatch = path.match(/^\/session\/([^/]+)\/artifact$/);
  if (artifactMatch) {
    const session_id = artifactMatch[1];
    if (method === "POST") return handleSubmitArtifact(request, session_id, env);
    return methodNotAllowed();
  }

  // /session/{session_id}/delivery
  const deliveryMatch = path.match(/^\/session\/([^/]+)\/delivery$/);
  if (deliveryMatch) {
    const session_id = deliveryMatch[1];
    if (method === "GET") return handleGetDeliverySummary(session_id, env);
    return methodNotAllowed();
  }

  // /session/{session_id}/reentry
  const reentryMatch = path.match(/^\/session\/([^/]+)\/reentry$/);
  if (reentryMatch) {
    const session_id = reentryMatch[1];
    if (method === "POST") return handleTriggerReentry(request, session_id, env);
    return methodNotAllowed();
  }

  // /session/{session_id}/decision-log
  const decisionLogMatch = path.match(/^\/session\/([^/]+)\/decision-log$/);
  if (decisionLogMatch) {
    const session_id = decisionLogMatch[1];
    if (method === "GET") return handleGetDecisionLog(session_id, env);
    return methodNotAllowed();
  }

  // /veto/{session_id}/status
  const vetoStatusMatch = path.match(/^\/veto\/([^/]+)\/status$/);
  if (vetoStatusMatch) {
    const session_id = vetoStatusMatch[1];
    if (method === "GET") return handleGetVetoStatus(session_id, env);
    return methodNotAllowed();
  }

  // /veto/{session_id}/activate
  const vetoActivateMatch = path.match(/^\/veto\/([^/]+)\/activate$/);
  if (vetoActivateMatch) {
    const session_id = vetoActivateMatch[1];
    if (method === "POST") return handleActivateVeto(request, session_id, env);
    return methodNotAllowed();
  }

  // /veto/{session_id}/release
  const vetoReleaseMatch = path.match(/^\/veto\/([^/]+)\/release$/);
  if (vetoReleaseMatch) {
    const session_id = vetoReleaseMatch[1];
    if (method === "POST") return handleReleaseVeto(request, session_id, env);
    return methodNotAllowed();
  }

  // /approval/{session_id}
  const approvalMatch = path.match(/^\/approval\/([^/]+)$/);
  if (approvalMatch) {
    const session_id = approvalMatch[1];
    if (method === "GET") return handleGetApprovals(session_id, env);
    return methodNotAllowed();
  }

  // /approval/{session_id}/submit
  const approvalSubmitMatch = path.match(/^\/approval\/([^/]+)\/submit$/);
  if (approvalSubmitMatch) {
    const session_id = approvalSubmitMatch[1];
    if (method === "POST") return handleSubmitApproval(request, session_id, env);
    return methodNotAllowed();
  }

  // /founder/project/{project_id}/status
  const founderStatusMatch = path.match(/^\/founder\/project\/([^/]+)\/status$/);
  if (founderStatusMatch) {
    const project_id = founderStatusMatch[1];
    if (method === "GET") return handleGetProjectStatus(project_id, env);
    return methodNotAllowed();
  }

  // /founder/project/{project_id}/next-action
  const founderNextActionMatch = path.match(
    /^\/founder\/project\/([^/]+)\/next-action$/
  );
  if (founderNextActionMatch) {
    const project_id = founderNextActionMatch[1];
    if (method === "GET") return handleGetNextAction(project_id, env);
    return methodNotAllowed();
  }

  // /founder/project/{project_id}/artifact
  const founderArtifactMatch = path.match(/^\/founder\/project\/([^/]+)\/artifact$/);
  if (founderArtifactMatch) {
    const project_id = founderArtifactMatch[1];
    if (method === "POST") return handleSaveArtifact(request, project_id, env);
    return methodNotAllowed();
  }

  // /founder/project/{project_id}/model-output
  const founderModelOutputMatch = path.match(
    /^\/founder\/project\/([^/]+)\/model-output$/
  );
  if (founderModelOutputMatch) {
    const project_id = founderModelOutputMatch[1];
    if (method === "POST") return handleRecordModelOutput(request, project_id, env);
    return methodNotAllowed();
  }

  // /founder/project/{project_id}/sell-ready
  const founderSellReadyMatch = path.match(
    /^\/founder\/project\/([^/]+)\/sell-ready$/
  );
  if (founderSellReadyMatch) {
    const project_id = founderSellReadyMatch[1];
    if (method === "GET") return handleCheckSellReady(project_id, env);
    return methodNotAllowed();
  }

  // /founder/project/{project_id}/production-closure
  const founderProductionClosureMatch = path.match(
    /^\/founder\/project\/([^/]+)\/production-closure$/
  );
  if (founderProductionClosureMatch) {
    const project_id = founderProductionClosureMatch[1];
    if (method === "GET") return handleCheckProductionClosure(project_id, env);
    return methodNotAllowed();
  }

  // /founder/project/{project_id}/decision-request
  const founderDecisionRequestMatch = path.match(
    /^\/founder\/project\/([^/]+)\/decision-request$/
  );
  if (founderDecisionRequestMatch) {
    const project_id = founderDecisionRequestMatch[1];
    if (method === "POST") return handleRequestFounderDecision(request, project_id, env);
    return methodNotAllowed();
  }

  // /operator/session/{session_id}/delivery-summary
  const operatorDeliverySummaryMatch = path.match(
    /^\/operator\/session\/([^/]+)\/delivery-summary$/
  );
  if (operatorDeliverySummaryMatch) {
    const session_id = operatorDeliverySummaryMatch[1];
    if (method === "GET") return handleGetRunDeliverySummary(session_id, env);
    return methodNotAllowed();
  }

  // /operator/session/{session_id}/delivery-history
  const operatorDeliveryHistoryMatch = path.match(
    /^\/operator\/session\/([^/]+)\/delivery-history$/
  );
  if (operatorDeliveryHistoryMatch) {
    const session_id = operatorDeliveryHistoryMatch[1];
    if (method === "GET") return handleGetRunDeliveryHistory(session_id, env);
    return methodNotAllowed();
  }

  // /operator/session/{session_id}/next-action
  const operatorNextActionMatch = path.match(
    /^\/operator\/session\/([^/]+)\/next-action$/
  );
  if (operatorNextActionMatch) {
    const session_id = operatorNextActionMatch[1];
    if (method === "GET") return handleGetRunNextAction(session_id, env);
    return methodNotAllowed();
  }

  return errorResponse("Not found", "NOT_FOUND", 404);
}
