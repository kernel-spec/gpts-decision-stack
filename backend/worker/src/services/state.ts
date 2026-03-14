import type { Env, Session, CreateSessionRequest } from "../types/index.js";

function nowIso(): string {
  return new Date().toISOString();
}

function newId(): string {
  return crypto.randomUUID();
}

export async function createSession(
  db: Env["DECISIONS_DB"],
  req: CreateSessionRequest
): Promise<Session> {
  const session_id = newId();
  const now = nowIso();

  await db
    .prepare(
      `INSERT INTO sessions (session_id, agent_id, pipeline_state, decision_status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .bind(session_id, req.agent_id, req.pipeline_state, "unresolved", now, now)
    .run();

  return {
    session_id,
    agent_id: req.agent_id,
    pipeline_state: req.pipeline_state,
    decision_status: "unresolved",
    created_at: now,
    updated_at: now,
  };
}

export async function getSession(
  db: Env["DECISIONS_DB"],
  session_id: string
): Promise<Session | null> {
  const row = await db
    .prepare(`SELECT * FROM sessions WHERE session_id = ?`)
    .bind(session_id)
    .first<Session>();
  return row ?? null;
}

export async function updateSessionState(
  db: Env["DECISIONS_DB"],
  session_id: string,
  pipeline_state: Session["pipeline_state"],
  decision_status: Session["decision_status"]
): Promise<Session | null> {
  const now = nowIso();
  await db
    .prepare(
      `UPDATE sessions SET pipeline_state = ?, decision_status = ?, updated_at = ?
       WHERE session_id = ?`
    )
    .bind(pipeline_state, decision_status, now, session_id)
    .run();
  return getSession(db, session_id);
}
