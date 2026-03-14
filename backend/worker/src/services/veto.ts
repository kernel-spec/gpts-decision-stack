import type {
  Env,
  VetoRecord,
  ActivateVetoRequest,
  ReleaseVetoRequest,
} from "../types/index.js";

function nowIso(): string {
  return new Date().toISOString();
}

async function ensureVetoRecord(
  db: Env["DECISIONS_DB"],
  session_id: string
): Promise<void> {
  await db
    .prepare(
      `INSERT OR IGNORE INTO veto_records (session_id, is_active) VALUES (?, 0)`
    )
    .bind(session_id)
    .run();
}

export async function getVetoStatus(
  db: Env["DECISIONS_DB"],
  session_id: string
): Promise<VetoRecord> {
  await ensureVetoRecord(db, session_id);
  const row = await db
    .prepare(`SELECT * FROM veto_records WHERE session_id = ?`)
    .bind(session_id)
    .first<{
      session_id: string;
      is_active: number;
      activated_by: string | null;
      activated_at: string | null;
      reason: string | null;
      released_by: string | null;
      released_at: string | null;
    }>();

  if (!row) {
    return { session_id, is_active: false };
  }

  return {
    session_id: row.session_id,
    is_active: row.is_active === 1,
    activated_by: row.activated_by ?? undefined,
    activated_at: row.activated_at ?? undefined,
    reason: row.reason ?? undefined,
    released_by: row.released_by ?? undefined,
    released_at: row.released_at ?? undefined,
  };
}

export async function activateVeto(
  db: Env["DECISIONS_DB"],
  session_id: string,
  req: ActivateVetoRequest
): Promise<VetoRecord> {
  await ensureVetoRecord(db, session_id);
  const now = nowIso();

  await db
    .prepare(
      `UPDATE veto_records
       SET is_active = 1, activated_by = ?, activated_at = ?, reason = ?,
           released_by = NULL, released_at = NULL
       WHERE session_id = ?`
    )
    .bind(req.activated_by, now, req.reason, session_id)
    .run();

  return getVetoStatus(db, session_id);
}

export async function releaseVeto(
  db: Env["DECISIONS_DB"],
  session_id: string,
  req: ReleaseVetoRequest
): Promise<VetoRecord> {
  const now = nowIso();

  await db
    .prepare(
      `UPDATE veto_records
       SET is_active = 0, released_by = ?, released_at = ?
       WHERE session_id = ?`
    )
    .bind(req.released_by, now, session_id)
    .run();

  return getVetoStatus(db, session_id);
}
