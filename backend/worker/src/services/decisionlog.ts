import type {
  Env,
  DecisionLogEntry,
  AppendDecisionLogRequest,
} from "../types/index.js";

function nowIso(): string {
  return new Date().toISOString();
}

function newId(): string {
  return crypto.randomUUID();
}

export async function appendDecisionLog(
  db: Env["DECISIONS_DB"],
  session_id: string,
  req: AppendDecisionLogRequest
): Promise<DecisionLogEntry> {
  const id = newId();
  const logged_at = nowIso();

  await db
    .prepare(
      `INSERT INTO decision_log (id, session_id, agent_id, action, pipeline_state, decision_status, notes, logged_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      id,
      session_id,
      req.agent_id,
      req.action,
      req.pipeline_state,
      req.decision_status,
      req.notes ?? null,
      logged_at
    )
    .run();

  return {
    id,
    session_id,
    agent_id: req.agent_id,
    action: req.action,
    pipeline_state: req.pipeline_state,
    decision_status: req.decision_status,
    notes: req.notes,
    logged_at,
  };
}

export async function getDecisionLog(
  db: Env["DECISIONS_DB"],
  session_id: string
): Promise<DecisionLogEntry[]> {
  const rows = await db
    .prepare(
      `SELECT * FROM decision_log WHERE session_id = ? ORDER BY logged_at ASC`
    )
    .bind(session_id)
    .all<DecisionLogEntry>();

  return rows.results;
}
