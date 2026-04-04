import type {
  Env,
  Session,
  CreateSessionRequest,
  ReentryRequest,
  StageEntryRecord,
  StageLoopSignalRecord,
  PipelineState,
} from "../types/index.js";

function nowIso(): string {
  return new Date().toISOString();
}

function newId(): string {
  return crypto.randomUUID();
}

function boolToInt(value: boolean): number {
  return value ? 1 : 0;
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

/**
 * Atomic session creation with lifecycle boundary.
 * Performs session INSERT and initial stage_entry INSERT in a single D1 batch.
 * No realistic path remains where session exists but stage entry is missing.
 */
export async function createSessionWithLifecycle(
  db: Env["DECISIONS_DB"],
  req: CreateSessionRequest
): Promise<{
  session: Session;
  stage_entry: StageEntryRecord;
  lifecycle_id: string;
}> {
  const session_id = newId();
  const now = nowIso();
  const lifecycle_id = newId();
  const stage_entry_id = newId();
  const pipeline_state: PipelineState = "intake";
  const decision_status: Session["decision_status"] = "unresolved";

  const statements: BatchableStatement[] = [
    db
      .prepare(
        `INSERT INTO sessions (session_id, agent_id, requestor_type, external_ref, pipeline_state, decision_status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        session_id,
        "system",
        req.requestor_type,
        req.external_ref ?? null,
        pipeline_state,
        decision_status,
        now,
        now
      ),
    db
      .prepare(
        `INSERT INTO stage_entries (
           stage_entry_id, session_id, pipeline_state, entry_count, classified_by, created_at, lifecycle_id
         ) VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        stage_entry_id,
        session_id,
        pipeline_state,
        1, // first entry
        "orchestration",
        now,
        lifecycle_id
      ),
  ];

  await (db as unknown as BatchableDb).batch(statements);

  const session: Session = {
    session_id,
    requestor_type: req.requestor_type,
    pipeline_state,
    decision_status,
    veto_active: false,
    created_at: now,
    updated_at: now,
  };

  const stage_entry: StageEntryRecord = {
    stage_entry_id,
    entry_id: stage_entry_id,
    session_id,
    artifact_id: null,
    pipeline_state,
    entry_count: 1,
    classified_by: "orchestration",
    created_at: now,
  };

  return { session, stage_entry, lifecycle_id };
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

const PIPELINE_ORDER: Session["pipeline_state"][] = [
  "intake",
  "problem_framing",
  "primitive_selection",
  "architecture_validation",
  "claims_validation",
  "risk_governance_validation",
  "commercial_packaging",
  "release_decision",
];

export type ReentryTransitionCandidate = {
  from_state: Session["pipeline_state"];
  to_state: Session["pipeline_state"];
  legal_transition_ok: boolean;
};

export function getReentryTransitionCandidate(
  session: Session,
  request: ReentryRequest
): ReentryTransitionCandidate | null {
  if (request.from_state !== session.pipeline_state) {
    return null;
  }

  const fromIdx = PIPELINE_ORDER.indexOf(request.from_state);
  const toIdx = PIPELINE_ORDER.indexOf(request.to_state);
  if (fromIdx < 0 || toIdx < 0) {
    return null;
  }

  // Reentry is explicit and backward/same-stage only (no forward progression path).
  if (toIdx > fromIdx) {
    return null;
  }

  return {
    from_state: request.from_state,
    to_state: request.to_state,
    legal_transition_ok: true,
  };
}

export function assertLegalReentry(
  session: Session,
  request: ReentryRequest
): ReentryTransitionCandidate {
  if (session.veto_active) {
    throw new Error(
      `illegal reentry transition: session ${session.session_id} has active veto`
    );
  }
  
  const candidate = getReentryTransitionCandidate(session, request);
  if (!candidate || !candidate.legal_transition_ok) {
    throw new Error(
      `illegal reentry transition from ${session.pipeline_state} to ${request.to_state}`
    );
  }
  return candidate;
}

type BatchableStatement = { run(): Promise<unknown> };
type BatchableDb = Env["DECISIONS_DB"] & {
  batch(statements: BatchableStatement[]): Promise<unknown[]>;
};

export async function triggerReentryWithLifecycle(
  db: Env["DECISIONS_DB"],
  session: Session,
  request: ReentryRequest
): Promise<{
  session: Session;
  stage_entry: StageEntryRecord;
  loop_signal: StageLoopSignalRecord | null;
  lifecycle_id: string;
}> {
  const candidate = assertLegalReentry(session, request);
  const now = nowIso();
  const lifecycle_id = newId();
  const stage_entry_id = newId();
  const loop_signal_id = newId();

  const priorEntry = await db
    .prepare(
      `SELECT entry_count
         FROM stage_entries
        WHERE session_id = ? AND pipeline_state = ?
        ORDER BY entry_count DESC
        LIMIT 1`
    )
    .bind(session.session_id, candidate.to_state)
    .first<{ entry_count: number } | null>();

  const entry_count = (priorEntry?.entry_count ?? 0) + 1;
  const has_loop_signal = entry_count > 1;

  const statements: BatchableStatement[] = [
    db
      .prepare(
        `UPDATE sessions SET pipeline_state = ?, decision_status = ?, updated_at = ?
         WHERE session_id = ?`
      )
      .bind(candidate.to_state, "unresolved", now, session.session_id),
    db
      .prepare(
        `INSERT INTO stage_entries (
           stage_entry_id, session_id, pipeline_state, entry_count, classified_by, created_at, lifecycle_id
         ) VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        stage_entry_id,
        session.session_id,
        candidate.to_state,
        entry_count,
        "orchestration",
        now,
        lifecycle_id
      ),
  ];

  if (has_loop_signal) {
    statements.push(
      db
        .prepare(
          `INSERT INTO stage_loop_signals (
             loop_signal_id, session_id, pipeline_state, entry_count, loop_type, classified_by, created_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          loop_signal_id,
          session.session_id,
          candidate.to_state,
          entry_count,
          "SAME_STAGE_REPEAT",
          "orchestration",
          now
        )
    );
  }

  await (db as unknown as BatchableDb).batch(statements);

  const updated = await getSession(db, session.session_id);
  if (!updated) {
    throw new Error(`session ${session.session_id} missing after reentry lifecycle`);
  }

  return {
    session: updated,
    stage_entry: {
      stage_entry_id,
      entry_id: stage_entry_id,
      session_id: session.session_id,
      artifact_id: null,
      pipeline_state: candidate.to_state,
      entry_count,
      classified_by: "orchestration",
      created_at: now,
    },
    loop_signal: has_loop_signal
      ? {
          loop_signal_id,
          session_id: session.session_id,
          pipeline_state: candidate.to_state,
          entry_count,
          loop_type: "SAME_STAGE_REPEAT",
          classified_by: "orchestration",
          created_at: now,
        }
      : null,
    lifecycle_id,
  };
}
