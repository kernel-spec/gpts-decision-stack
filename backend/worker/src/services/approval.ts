import type {
  Env,
  Approval,
  SubmitApprovalRequest,
} from "../types/index.js";

function nowIso(): string {
  return new Date().toISOString();
}

function newId(): string {
  return crypto.randomUUID();
}

export async function submitApproval(
  db: Env["DECISIONS_DB"],
  session_id: string,
  req: SubmitApprovalRequest
): Promise<Approval> {
  const id = newId();
  const submitted_at = nowIso();

  await db
    .prepare(
      `INSERT INTO approvals (id, session_id, approval_type, submitted_by, decision, notes, submitted_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      id,
      session_id,
      req.approval_type,
      req.submitted_by,
      req.decision,
      req.notes ?? null,
      submitted_at
    )
    .run();

  return {
    id,
    session_id,
    approval_type: req.approval_type,
    submitted_by: req.submitted_by,
    decision: req.decision,
    notes: req.notes,
    submitted_at,
  };
}

export async function getApprovals(
  db: Env["DECISIONS_DB"],
  session_id: string
): Promise<Approval[]> {
  const rows = await db
    .prepare(
      `SELECT * FROM approvals WHERE session_id = ? ORDER BY submitted_at ASC`
    )
    .bind(session_id)
    .all<{
      id: string;
      session_id: string;
      approval_type: string;
      submitted_by: string;
      decision: string;
      notes: string | null;
      submitted_at: string;
    }>();

  return rows.results.map((r) => ({
    id: r.id,
    session_id: r.session_id,
    approval_type: r.approval_type,
    submitted_by: r.submitted_by,
    decision: r.decision as Approval["decision"],
    notes: r.notes ?? undefined,
    submitted_at: r.submitted_at,
  }));
}
