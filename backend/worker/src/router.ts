import type { Env } from "./types/index.js";
import { handleHealth } from "./handlers/health.js";
import {
  handleCreateSession,
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

  return errorResponse("Not found", "NOT_FOUND", 404);
}
