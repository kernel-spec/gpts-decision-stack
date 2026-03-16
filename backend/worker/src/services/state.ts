import type { Env, Session, CreateSessionRequest } from "../types/index.js";

function nowIso(): string {
  return new Date().toISOString();
}

function newId(): string {
  return crypto.randomUUID();
}

type SessionRow = {
  session_id: string;
  requestor_type: string;
  pipeline_state: string;
  decision_status: string;
  created_at: string;
  updated_at: string;
  veto_active: number;
};

function rowToSession(row: SessionRow): Session {
  return {
    session_id: row.session_id,
    requestor_type: row.requestor_type as Session["requestor_type"],
    pipeline_state: row.pipeline_state as Session["pipeline_state"],
    decision_status: row.decision_status as Session["decision_status"],
    veto_active: row.veto_active === 1,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export async function createSession(
  db: Env["DECISIONS_DB"],
  req: CreateSessionRequest
): Promise<Session> {
  const session_id = newId();
  const now = nowIso();

  await db
    .prepare(
      `INSERT INTO sessions (session_id, agent_id, requestor_type, external_ref, pipeline_state, decision_status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(session_id, "system", req.requestor_type, req.external_ref ?? null, "intake", "unresolved", now, now)
    .run();

  return {
    session_id,
    requestor_type: req.requestor_type,
    pipeline_state: "intake",
    decision_status: "unresolved",
    veto_active: false,
    created_at: now,
    updated_at: now,
  };
}

export async function getSession(
  db: Env["DECISIONS_DB"],
  session_id: string
): Promise<Session | null> {
  const row = await db
    .prepare(
      `SELECT s.session_id, s.requestor_type, s.pipeline_state, s.decision_status,
              s.created_at, s.updated_at,
              COALESCE(vr.is_active, 0) AS veto_active
       FROM sessions s
       LEFT JOIN veto_records vr ON s.session_id = vr.session_id
       WHERE s.session_id = ?`
    )
    .bind(session_id)
    .first<SessionRow>();
  return row ? rowToSession(row) : null;
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
