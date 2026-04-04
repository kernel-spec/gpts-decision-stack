/**
 * Production Verification Test Suite
 *
 * Verifies that the deployed decision orchestration system behaves correctly
 * at the service layer. All flows and adversarial scenarios from the production
 * verification spec are covered explicitly.
 *
 * Flows A–F: core delivery-truth paths
 * Adversarial 1–5: boundary and manipulation resistance
 */

import { describe, expect, it } from "vitest";
import type { Env, Session, SubmitArtifactRequest } from "../types/index.js";
import { submitArtifactWithLifecycle } from "./artifact.js";
import { handleTriggerReentry } from "../handlers/session.js";
import { getRunDeliverySummary } from "./operator-delivery.js";
import {
  recordArtifactAttempt,
  validateDeliveryInput,
} from "./delivery-integrity.js";
import { classifyHandoffOutcome } from "./handoff.js";

// ─────────────────────────────────────────────────────────────────────────────
// Types for captured DB rows
// ─────────────────────────────────────────────────────────────────────────────

type SessionRow = {
  session_id: string;
  requestor_type: Session["requestor_type"];
  pipeline_state: Session["pipeline_state"];
  decision_status: Session["decision_status"];
  created_at: string;
  updated_at: string;
  veto_active: number;
};

type ArtifactRow = {
  id: string;
  session_id: string;
  artifact_type: string;
  r2_key: string;
  submitted_at: string;
};

type LineageRow = {
  lineage_id: string;
  run_id: string;
  artifact_id: string;
  artifact_type: string;
  stage: string;
  attempt: number;
  supersedes_artifact_id: string | null;
  created_at: string;
  created_by_role: string;
  classified_by: string;
  replacement_reason: string | null;
  replacement_reason_source: string | null;
  is_repair_attempt: number;
  is_first_attempt_in_stage: number;
  override_flag: number;
};

type HandoffEventRow = {
  event_id: string;
  session_id: string;
  pipeline_state: string;
  outcome: string;
  failure_reason: string | null;
  classified_by: string;
  classified_at: string;
};

type StageEntryRow = {
  entry_id: string;
  session_id: string;
  artifact_id: string | null;
  pipeline_state: string;
  entry_count: number;
  classified_by: string;
  classified_at: string;
};

type LoopSignalRow = {
  loop_signal_id: string;
  session_id: string;
  pipeline_state: string;
  entry_count: number;
  loop_type: string;
  classified_by: string;
  classified_at: string;
};

type DeliveryEventRow = {
  event_id: string;
  artifact_id: string;
  session_id: string;
  pipeline_state: string;
  attempt: number;
  supersedes_artifact_id: string | null;
  replacement_reason: string | null;
  handoff_status: string;
  handoff_failure_reason: string | null;
  stage_loop_detected: number;
  classified_by: string;
  classified_at: string;
};

// ─────────────────────────────────────────────────────────────────────────────
// Comprehensive mock DB (tracks all relevant tables)
// ─────────────────────────────────────────────────────────────────────────────

function makeSession(overrides: Partial<Session> = {}): Session {
  return {
    session_id: "sess-pv-001",
    requestor_type: "founder-led",
    pipeline_state: "intake",
    decision_status: "unresolved",
    veto_active: false,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

type DbState = {
  sessions: Map<string, SessionRow>;
  artifacts: ArtifactRow[];
  lineage: LineageRow[];
  deliveryEvents: DeliveryEventRow[];
  handoffEvents: HandoffEventRow[];
  stageEntries: StageEntryRow[];
  loopSignals: LoopSignalRow[];
  decisionLog: Array<Record<string, unknown>>;
};

/**
 * Creates a comprehensive mock DB that tracks all relevant production tables.
 *
 * @param session - The session to pre-seed in the sessions table. The mock DB
 *   starts with this session row already present and handles UPDATE sessions
 *   to reflect in-memory pipeline_state/decision_status changes.
 * @returns `db` — the mock DB instance to pass to service functions; `state` —
 *   a reference to the live in-memory store so tests can inspect rows written
 *   to artifacts, artifact_lineage, delivery_integrity_events, handoff_events,
 *   stage_entries, stage_loop_signals, and decision_log.
 */
function createFullMockDb(session: Session): { db: Env["DECISIONS_DB"]; state: DbState } {
  const state: DbState = {
    sessions: new Map<string, SessionRow>([
      [
        session.session_id,
        {
          session_id: session.session_id,
          requestor_type: session.requestor_type,
          pipeline_state: session.pipeline_state,
          decision_status: session.decision_status,
          created_at: session.created_at,
          updated_at: session.updated_at,
          veto_active: session.veto_active ? 1 : 0,
        },
      ],
    ]),
    artifacts: [],
    lineage: [],
    deliveryEvents: [],
    handoffEvents: [],
    stageEntries: [],
    loopSignals: [],
    decisionLog: [],
  };

  const db = {
    prepare(sql: string) {
      return {
        bind(...params: unknown[]) {
          return {
            async first<T>() {
              // Session lookup (getSession via JOIN, and direct SELECT)
              if (sql.includes("FROM sessions s") && sql.includes("WHERE s.session_id")) {
                const session_id = params[0] as string;
                const row = state.sessions.get(session_id);
                if (!row) return null as T;
                return row as T;
              }
              if (sql.includes("SELECT pipeline_state FROM sessions WHERE session_id")) {
                const session_id = params[0] as string;
                const row = state.sessions.get(session_id);
                if (!row) return null as T;
                return { pipeline_state: row.pipeline_state } as T;
              }
              if (sql.includes("SELECT 1 FROM sessions WHERE session_id")) {
                const session_id = params[0] as string;
                return (state.sessions.has(session_id) ? { 1: 1 } : null) as T;
              }

              // artifact_lineage: prior attempt lookup
              if (sql.includes("FROM artifact_lineage") && sql.includes("ORDER BY attempt DESC")) {
                const [run_id, stage] = params as [string, string];
                const match = state.lineage
                  .filter((r) => r.run_id === run_id && r.stage === stage)
                  .sort((a, b) => b.attempt - a.attempt)[0];
                return (match ?? null) as T;
              }
              // artifact_lineage: latest by created_at (for read model)
              if (
                sql.includes("FROM artifact_lineage") &&
                sql.includes("ORDER BY created_at DESC") &&
                !sql.includes("is_repair_attempt")
              ) {
                const run_id = params[0] as string;
                const match = state.lineage
                  .filter((r) => r.run_id === run_id)
                  .sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
                if (!match) return null as T;
                return { artifact_type: match.artifact_type, attempt: match.attempt } as T;
              }
              // artifact_lineage: latest repair replacement_reason
              if (
                sql.includes("FROM artifact_lineage") &&
                sql.includes("is_repair_attempt = 1") &&
                sql.includes("ORDER BY created_at DESC")
              ) {
                const run_id = params[0] as string;
                const match = state.lineage
                  .filter((r) => r.run_id === run_id && r.is_repair_attempt === 1)
                  .sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
                if (!match) return null as T;
                return { replacement_reason: match.replacement_reason } as T;
              }

              // delivery_integrity_events: loop check
              if (sql.includes("FROM delivery_integrity_events")) {
                const [session_id, pipeline_state] = params as [string, string];
                if (sql.includes("WHERE session_id = ? AND pipeline_state = ?")) {
                  const exists = state.deliveryEvents.some(
                    (r) => r.session_id === session_id && r.pipeline_state === pipeline_state,
                  );
                  return (exists ? { has_prior: 1 } : null) as T;
                }
                // read model fallback
                const match = state.deliveryEvents
                  .filter((r) => r.session_id === session_id)
                  .sort((a, b) => b.classified_at.localeCompare(a.classified_at))[0];
                if (!match) return null as T;
                return { handoff_status: match.handoff_status } as T;
              }

              // stage_entries: highest entry_count
              if (
                sql.includes("FROM stage_entries") &&
                sql.includes("ORDER BY entry_count DESC")
              ) {
                const [session_id, pipeline_state] = params as [string, string];
                const match = state.stageEntries
                  .filter(
                    (r) => r.session_id === session_id && r.pipeline_state === pipeline_state,
                  )
                  .sort((a, b) => b.entry_count - a.entry_count)[0];
                return (match ?? null) as T;
              }
              // stage_entries: count
              if (sql.includes("COUNT(*)") && sql.includes("FROM stage_entries")) {
                const [session_id, pipeline_state] = params as [string, string];
                const cnt = state.stageEntries.filter(
                  (r) => r.session_id === session_id && r.pipeline_state === pipeline_state,
                ).length;
                return { cnt } as T;
              }

              // handoff_events: latest outcome (read model)
              if (
                sql.includes("FROM handoff_events") &&
                sql.includes("ORDER BY classified_at DESC")
              ) {
                const session_id = params[0] as string;
                const match = state.handoffEvents
                  .filter((r) => r.session_id === session_id)
                  .sort((a, b) => b.classified_at.localeCompare(a.classified_at))[0];
                if (!match) return null as T;
                return { outcome: match.outcome } as T;
              }

              // stage_loop_signals: any loop for session (read model)
              if (
                sql.includes("FROM stage_loop_signals") &&
                sql.includes("WHERE session_id = ?")
              ) {
                const session_id = params[0] as string;
                const found = state.loopSignals.find((r) => r.session_id === session_id);
                return (found ? { has_loop: 1 } : null) as T;
              }

              return null as T;
            },

            async run() {
              if (sql.includes("INSERT INTO artifacts")) {
                const [id, session_id, artifact_type, r2_key, submitted_at] = params as [
                  string,
                  string,
                  string,
                  string,
                  string,
                ];
                state.artifacts.push({ id, session_id, artifact_type, r2_key, submitted_at });
              }

              if (sql.includes("INSERT INTO artifact_lineage")) {
                const [
                  lineage_id,
                  run_id,
                  artifact_id,
                  artifact_type,
                  stage,
                  attempt,
                  supersedes_artifact_id,
                  created_at,
                  created_by_role,
                  classified_by,
                  replacement_reason,
                  replacement_reason_source,
                  is_repair_attempt,
                  is_first_attempt_in_stage,
                  override_flag,
                ] = params as [
                  string,
                  string,
                  string,
                  string,
                  string,
                  number,
                  string | null,
                  string,
                  string,
                  string,
                  string | null,
                  string | null,
                  number,
                  number,
                  number,
                ];
                state.lineage.push({
                  lineage_id,
                  run_id,
                  artifact_id,
                  artifact_type,
                  stage,
                  attempt,
                  supersedes_artifact_id,
                  created_at,
                  created_by_role,
                  classified_by,
                  replacement_reason,
                  replacement_reason_source,
                  is_repair_attempt,
                  is_first_attempt_in_stage,
                  override_flag,
                });
              }

              if (sql.includes("INSERT INTO delivery_integrity_events")) {
                const [
                  event_id,
                  artifact_id,
                  session_id,
                  pipeline_state,
                  attempt,
                  supersedes_artifact_id,
                  replacement_reason,
                  handoff_status,
                  handoff_failure_reason,
                  stage_loop_detected,
                  classified_by,
                  classified_at,
                ] = params as [
                  string,
                  string,
                  string,
                  string,
                  number,
                  string | null,
                  string | null,
                  string,
                  string | null,
                  number,
                  string,
                  string,
                ];
                state.deliveryEvents.push({
                  event_id,
                  artifact_id,
                  session_id,
                  pipeline_state,
                  attempt,
                  supersedes_artifact_id,
                  replacement_reason,
                  handoff_status,
                  handoff_failure_reason,
                  stage_loop_detected,
                  classified_by,
                  classified_at,
                });
              }

              if (sql.includes("INSERT INTO handoff_events")) {
                const [
                  event_id,
                  session_id,
                  pipeline_state,
                  outcome,
                  failure_reason,
                  classified_by,
                  classified_at,
                ] = params as [
                  string,
                  string,
                  string,
                  string,
                  string | null,
                  string,
                  string,
                ];
                state.handoffEvents.push({
                  event_id,
                  session_id,
                  pipeline_state,
                  outcome,
                  failure_reason: failure_reason ?? null,
                  classified_by,
                  classified_at,
                });
              }

              if (sql.includes("INSERT INTO stage_entries")) {
                // 7-column form: with artifact_id; 6-column form: without
                let entry_id: string;
                let session_id: string;
                let artifact_id: string | null;
                let pipeline_state: string;
                let entry_count: number;
                let classified_by: string;
                let classified_at: string;

                if (params.length >= 7) {
                  [
                    entry_id,
                    session_id,
                    artifact_id,
                    pipeline_state,
                    entry_count,
                    classified_by,
                    classified_at,
                  ] = params as [string, string, string | null, string, number, string, string];
                } else {
                  [
                    entry_id,
                    session_id,
                    pipeline_state,
                    entry_count,
                    classified_by,
                    classified_at,
                  ] = params as [string, string, string, number, string, string];
                  artifact_id = null;
                }
                state.stageEntries.push({
                  entry_id,
                  session_id,
                  artifact_id: artifact_id ?? null,
                  pipeline_state,
                  entry_count,
                  classified_by,
                  classified_at,
                });
              }

              if (sql.includes("INSERT INTO stage_loop_signals")) {
                const [
                  loop_signal_id,
                  session_id,
                  pipeline_state,
                  entry_count,
                  loop_type,
                  classified_by,
                  classified_at,
                ] = params as [string, string, string, number, string, string, string];
                state.loopSignals.push({
                  loop_signal_id,
                  session_id,
                  pipeline_state,
                  entry_count,
                  loop_type,
                  classified_by,
                  classified_at,
                });
              }

              if (sql.includes("INSERT INTO decision_log")) {
                const [
                  id,
                  session_id,
                  agent_id,
                  action,
                  pipeline_state,
                  decision_status,
                  notes,
                  logged_at,
                ] = params as [string, string, string, string, string, string, string, string];
                state.decisionLog.push({
                  id,
                  session_id,
                  agent_id,
                  action,
                  pipeline_state,
                  decision_status,
                  notes,
                  logged_at,
                });
              }

              if (
                sql.includes(
                  "UPDATE sessions SET pipeline_state = ?, decision_status = ?, updated_at = ?",
                )
              ) {
                const [pipeline_state, decision_status, updated_at, session_id] = params as [
                  Session["pipeline_state"],
                  Session["decision_status"],
                  string,
                  string,
                ];
                const row = state.sessions.get(session_id);
                if (row) {
                  state.sessions.set(session_id, {
                    ...row,
                    pipeline_state,
                    decision_status,
                    updated_at,
                  });
                }
              }

              if (sql.includes("DELETE FROM artifact_lineage WHERE lineage_id")) {
                const [lineage_id] = params as [string];
                const idx = state.lineage.findIndex((r) => r.lineage_id === lineage_id);
                if (idx !== -1) state.lineage.splice(idx, 1);
              }

              if (sql.includes("DELETE FROM stage_entries WHERE")) {
                const [entry_id] = params as [string];
                const idx = state.stageEntries.findIndex((r) => r.entry_id === entry_id);
                if (idx !== -1) state.stageEntries.splice(idx, 1);
              }

              if (sql.includes("DELETE FROM stage_loop_signals WHERE")) {
                const [loop_signal_id] = params as [string];
                const idx = state.loopSignals.findIndex((r) => r.loop_signal_id === loop_signal_id);
                if (idx !== -1) state.loopSignals.splice(idx, 1);
              }

              return { success: true };
            },
          };
        },
      };
    },
    async batch(stmts: Array<{ run(): Promise<unknown> }>) {
      const results = [];
      for (const s of stmts) results.push(await s.run());
      return results;
    },
  };

  return { db: db as unknown as Env["DECISIONS_DB"], state };
}

function createMockBucket(): Env["ARTIFACTS_BUCKET"] {
  return {
    async put(_key: string, _value: unknown, _opts?: unknown): Promise<void> {},
  } as unknown as Env["ARTIFACTS_BUCKET"];
}

// ─────────────────────────────────────────────────────────────────────────────
// FLOW A — Non-transition artifact
// ─────────────────────────────────────────────────────────────────────────────

describe("FLOW A — Non-transition artifact", () => {
  it("produces an artifact_lineage row but NO handoff_events and NO stage_entries", async () => {
    // FramingAssessment in problem_framing is an intermediate work artifact — it does NOT cross a stage
    // boundary and therefore must NOT trigger a handoff record or a stage entry.
    const session = makeSession({ pipeline_state: "problem_framing" });
    const { db, state } = createFullMockDb(session);

    const req: SubmitArtifactRequest = {
      artifact_type: "FramingAssessment",
      payload: { summary: "initial framing" },
    };

    const artifact = await submitArtifactWithLifecycle(db, createMockBucket(), session, req);

    // artifact_lineage row MUST exist — orchestration always tracks every submission
    expect(state.lineage).toHaveLength(1);
    expect(state.lineage[0]).toMatchObject({
      run_id: session.session_id,
      artifact_id: artifact.id,
      stage: "problem_framing",
      attempt: 1,
      classified_by: "orchestration",
    });

    // handoff_events MUST be empty — no stage boundary was crossed
    expect(state.handoffEvents).toHaveLength(0);

    // stage_entries MUST be empty — only transitions write stage entries here
    expect(state.stageEntries).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// FLOW B — Valid transition
// ─────────────────────────────────────────────────────────────────────────────

describe("FLOW B — Valid transition", () => {
  it("produces artifact_lineage, EXACTLY ONE COMPLETED handoff_events, stage_entries entry_count=1, and advances session", async () => {
    // ProblemBrief in intake triggers the intake → problem_framing transition.
    // All parser signals pass, so the handoff is COMPLETED.
    const session = makeSession({ pipeline_state: "intake" });
    const { db, state } = createFullMockDb(session);

    const req: SubmitArtifactRequest & { agent_id?: string } = {
      artifact_type: "ProblemBrief",
      payload: { title: "Validate demand" },
      agent_id: "operator-001",
      parser_verdict: {
        schema_valid: true,
        required_sections_present: true,
        stage_matches_expected: true,
        reentry_ready: true,
      },
      review_verdict: { status: "NOT_REQUIRED" },
    };

    const artifact = await submitArtifactWithLifecycle(db, createMockBucket(), session, req);

    // artifact_lineage row exists
    expect(state.lineage).toHaveLength(1);
    expect(state.lineage[0]).toMatchObject({
      run_id: session.session_id,
      artifact_id: artifact.id,
      stage: "intake",
      attempt: 1,
      classified_by: "orchestration",
      is_repair_attempt: 0,
    });

    // EXACTLY ONE handoff_events row
    expect(state.handoffEvents).toHaveLength(1);
    expect(state.handoffEvents[0]).toMatchObject({
      session_id: session.session_id,
      pipeline_state: "intake",
      outcome: "COMPLETED",
      failure_reason: null,
      classified_by: "orchestration",
    });

    // stage_entries row created for the stage we transitioned INTO, with entry_count=1
    expect(state.stageEntries).toHaveLength(1);
    expect(state.stageEntries[0]).toMatchObject({
      session_id: session.session_id,
      pipeline_state: "problem_framing",
      entry_count: 1,
      classified_by: "orchestration",
    });

    // Session state advanced to problem_framing
    expect(state.sessions.get(session.session_id)).toMatchObject({
      pipeline_state: "problem_framing",
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// FLOW C — Failed transition
// ─────────────────────────────────────────────────────────────────────────────

describe("FLOW C — Failed transition", () => {
  it("produces a FAILED handoff_events row with non-null failure_reason and does NOT advance session or write stage_entries", async () => {
    // schema_valid=false causes classifyHandoffOutcome to emit SCHEMA_MISMATCH.
    // A failed handoff must NOT advance the session and must NOT create a stage entry.
    const session = makeSession({ pipeline_state: "intake" });
    const { db, state } = createFullMockDb(session);

    const req: SubmitArtifactRequest = {
      artifact_type: "ProblemBrief",
      payload: { title: "Broken schema" },
      parser_verdict: {
        schema_valid: false,
        required_sections_present: true,
        stage_matches_expected: true,
        reentry_ready: true,
      },
    };

    await submitArtifactWithLifecycle(db, createMockBucket(), session, req);

    // handoff_events row MUST exist
    expect(state.handoffEvents).toHaveLength(1);

    // outcome MUST be FAILED
    expect(state.handoffEvents[0]!.outcome).toBe("FAILED");

    // failure_reason MUST NOT be null — silent failures are not permitted
    expect(state.handoffEvents[0]!.failure_reason).not.toBeNull();
    expect(state.handoffEvents[0]!.failure_reason).toBe("SCHEMA_MISMATCH");

    // no stage_entries — failed handoff does NOT enter the new stage
    expect(state.stageEntries).toHaveLength(0);

    // session stage MUST remain at intake — no silent state advance on failure
    expect(state.sessions.get(session.session_id)).toMatchObject({
      pipeline_state: "intake",
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Shared helper: lightweight lineage-only mock DB (used by Flow D and Adversarial 3)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Creates a minimal mock DB that only handles artifact_lineage queries.
 * Used for tests that call recordArtifactAttempt in isolation, without
 * needing the full multi-table mock required for submitArtifactWithLifecycle.
 *
 * @param seed - Optional initial rows to pre-populate artifact_lineage.
 *   Use this to simulate prior attempts so the next call to
 *   recordArtifactAttempt will assign attempt > 1 (repair scenario).
 * @returns `db` — the mock DB instance; `rows` — the live in-memory lineage
 *   array so tests can inspect persisted rows after each call.
 *
 * Prefer createFullMockDb when testing submitArtifactWithLifecycle or any
 * flow that touches multiple tables (handoff_events, stage_entries, etc.).
 */
function createLineageMockDb(seed: LineageRow[] = []): {
  db: Env["DECISIONS_DB"];
  rows: LineageRow[];
} {
  const rows: LineageRow[] = [...seed];

  const db = {
    prepare(sql: string) {
      return {
        bind(...params: unknown[]) {
          return {
            async first<T>() {
              if (
                sql.includes("FROM artifact_lineage") &&
                sql.includes("ORDER BY attempt DESC")
              ) {
                const [run_id, stage] = params as [string, string];
                const match = rows
                  .filter((r) => r.run_id === run_id && r.stage === stage)
                  .sort((a, b) => b.attempt - a.attempt)[0];
                return (match ?? null) as T;
              }
              return null as T;
            },
            async run() {
              if (sql.includes("INSERT INTO artifact_lineage")) {
                const [
                  lineage_id,
                  run_id,
                  artifact_id,
                  artifact_type,
                  stage,
                  attempt,
                  supersedes_artifact_id,
                  created_at,
                  created_by_role,
                  classified_by,
                  replacement_reason,
                  replacement_reason_source,
                  is_repair_attempt,
                  is_first_attempt_in_stage,
                  override_flag,
                ] = params as [
                  string,
                  string,
                  string,
                  string,
                  string,
                  number,
                  string | null,
                  string,
                  string,
                  string,
                  string | null,
                  string | null,
                  number,
                  number,
                  number,
                ];
                rows.push({
                  lineage_id,
                  run_id,
                  artifact_id,
                  artifact_type,
                  stage,
                  attempt,
                  supersedes_artifact_id,
                  created_at,
                  created_by_role,
                  classified_by,
                  replacement_reason,
                  replacement_reason_source,
                  is_repair_attempt,
                  is_first_attempt_in_stage,
                  override_flag,
                });
              }
              if (sql.includes("DELETE FROM artifact_lineage WHERE lineage_id")) {
                const [lineage_id] = params as [string];
                const idx = rows.findIndex((r) => r.lineage_id === lineage_id);
                if (idx !== -1) rows.splice(idx, 1);
              }
              return { success: true };
            },
          };
        },
      };
    },
  };

  return { db: db as unknown as Env["DECISIONS_DB"], rows };
}

// ─────────────────────────────────────────────────────────────────────────────
// FLOW D — Repair attempt
// ─────────────────────────────────────────────────────────────────────────────

describe("FLOW D — Repair attempt", () => {
  it("increments attempt, sets supersedes_artifact_id and replacement_reason, and preserves the prior row", async () => {
    const { db, rows } = createLineageMockDb();

    const base = {
      run_id: "run-pv-repair",
      stage: "problem_framing" as const,
      artifact_type: "FramingAssessment",
      created_by_role: "AE-Framing",
      review_verdict: { status: "NOT_REQUIRED" as const },
      scope_fingerprint_changed: false,
      transition_context: {},
    };

    // First attempt — clean first submission
    const first = await recordArtifactAttempt(db, {
      ...base,
      artifact_id: "ART-PV-001",
      parser_verdict: {
        schema_valid: true,
        required_sections_present: true,
        stage_matches_expected: true,
        reentry_ready: true,
      },
    });

    expect(first.record.attempt).toBe(1);
    expect(first.record.supersedes_artifact_id).toBeNull();
    expect(first.record.replacement_reason).toBeNull();
    expect(first.record.is_first_attempt_in_stage).toBe(true);
    expect(first.record.is_repair_attempt).toBe(false);

    // Repair attempt — schema validation fails
    const repair = await recordArtifactAttempt(db, {
      ...base,
      artifact_id: "ART-PV-002",
      parser_verdict: {
        schema_valid: false,
        required_sections_present: true,
        stage_matches_expected: true,
        reentry_ready: true,
      },
    });

    // attempt increments
    expect(repair.record.attempt).toBe(2);

    // supersedes_artifact_id MUST be set — no orphan repair
    expect(repair.record.supersedes_artifact_id).toBe("ART-PV-001");

    // replacement_reason MUST be present — orchestration always classifies it
    expect(repair.record.replacement_reason).not.toBeNull();
    expect(repair.record.replacement_reason).toBe("INVALID_SCHEMA");

    // replacement_reason_source MUST be orchestration
    expect(repair.record.replacement_reason_source).toBe("orchestration");

    // repair flag set
    expect(repair.record.is_repair_attempt).toBe(true);

    // BOTH rows preserved — the prior attempt was NOT overwritten
    expect(rows).toHaveLength(2);
    expect(rows[0]!.artifact_id).toBe("ART-PV-001");
    expect(rows[1]!.artifact_id).toBe("ART-PV-002");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// FLOW E — Reentry loop
// ─────────────────────────────────────────────────────────────────────────────

describe("FLOW E — Reentry loop", () => {
  it("increments stage_entries to entry_count=2 on second reentry to the same stage and emits SAME_STAGE_REPEAT loop signal", async () => {
    const session = makeSession({ pipeline_state: "problem_framing", decision_status: "proceed" });
    const { db, state } = createFullMockDb(session);

    const env = { DECISIONS_DB: db } as unknown as Env;

    // First reentry: problem_framing → intake
    const r1 = await handleTriggerReentry(
      new Request("https://example.com/sessions/sess-pv-001/reentry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          from_state: "problem_framing",
          to_state: "intake",
          reason: "first reentry",
          agent_id: "operator-pv-001",
        }),
      }),
      "sess-pv-001",
      env,
    );
    expect(r1.status).toBe(200);

    // After first reentry: stage_entries has entry_count=1, no loop signal yet
    const entriesAfterFirst = state.stageEntries.filter(
      (r) => r.session_id === "sess-pv-001" && r.pipeline_state === "intake",
    );
    expect(entriesAfterFirst).toHaveLength(1);
    expect(entriesAfterFirst[0]!.entry_count).toBe(1);
    expect(state.loopSignals).toHaveLength(0);

    // Second reentry to the same stage — triggers SAME_STAGE_REPEAT
    const r2 = await handleTriggerReentry(
      new Request("https://example.com/sessions/sess-pv-001/reentry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          from_state: "problem_framing",
          to_state: "intake",
          reason: "second reentry — loop",
          agent_id: "operator-pv-001",
        }),
      }),
      "sess-pv-001",
      env,
    );
    expect(r2.status).toBe(200);

    // stage_entries: entry_count increments to 2
    const entriesAfterSecond = state.stageEntries.filter(
      (r) => r.session_id === "sess-pv-001" && r.pipeline_state === "intake",
    );
    expect(entriesAfterSecond).toHaveLength(2);
    expect(Math.max(...entriesAfterSecond.map((r) => r.entry_count))).toBe(2);

    // stage_loop_signals: EXACTLY ONE row, loop_type=SAME_STAGE_REPEAT
    expect(state.loopSignals).toHaveLength(1);
    expect(state.loopSignals[0]).toMatchObject({
      session_id: "sess-pv-001",
      pipeline_state: "intake",
      entry_count: 2,
      loop_type: "SAME_STAGE_REPEAT",
      classified_by: "orchestration",
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// FLOW F — Read model consistency
// ─────────────────────────────────────────────────────────────────────────────

describe("FLOW F — Read model consistency", () => {
  it("reports current_stage from sessions, handoff_status from handoff_events, loop_flag from stage_loop_signals, correct next_action_code — no fabricated values", async () => {
    // Build a DB state that has a full handoff history for session sess-pv-f
    const session = makeSession({
      session_id: "sess-pv-f",
      pipeline_state: "problem_framing",
      decision_status: "proceed",
    });
    const { db, state } = createFullMockDb(session);

    // Seed DB state directly: one lineage row, one handoff COMPLETED, one loop signal
    state.lineage.push({
      lineage_id: "lin-f-001",
      run_id: "sess-pv-f",
      artifact_id: "art-f-001",
      artifact_type: "ProblemBrief",
      stage: "intake",
      attempt: 1,
      supersedes_artifact_id: null,
      created_at: "2026-01-01T01:00:00.000Z",
      created_by_role: "operator",
      classified_by: "orchestration",
      replacement_reason: null,
      replacement_reason_source: null,
      is_repair_attempt: 0,
      is_first_attempt_in_stage: 1,
      override_flag: 0,
    });
    state.handoffEvents.push({
      event_id: "evt-f-001",
      session_id: "sess-pv-f",
      pipeline_state: "intake",
      outcome: "COMPLETED",
      failure_reason: null,
      classified_by: "orchestration",
      classified_at: "2026-01-01T01:30:00.000Z",
    });
    state.loopSignals.push({
      loop_signal_id: "lp-f-001",
      session_id: "sess-pv-f",
      pipeline_state: "problem_framing",
      entry_count: 2,
      loop_type: "SAME_STAGE_REPEAT",
      classified_by: "orchestration",
      classified_at: "2026-01-01T02:00:00.000Z",
    });

    const summary = await getRunDeliverySummary(db, "sess-pv-f");

    expect(summary).not.toBeNull();

    // current_stage MUST come from the sessions table — NOT inferred from handoff_events
    expect(summary!.current_stage).toBe("problem_framing");

    // handoff_status MUST reflect the latest handoff_events outcome
    expect(summary!.handoff_status).toBe("COMPLETED");

    // loop_flag MUST reflect stage_loop_signals
    expect(summary!.loop_flag).toBe(true);

    // next_action_code is derived from DB-sourced values, NOT fabricated
    // loop_flag=true → LOOP_DETECTED takes precedence
    expect(summary!.next_action_code).toBe("LOOP_DETECTED");

    // No required field is missing — all output fields present
    expect(summary).toHaveProperty("session_id");
    expect(summary).toHaveProperty("current_stage");
    expect(summary).toHaveProperty("current_artifact_type");
    expect(summary).toHaveProperty("current_attempt");
    expect(summary).toHaveProperty("last_replacement_reason");
    expect(summary).toHaveProperty("handoff_status");
    expect(summary).toHaveProperty("loop_flag");
    expect(summary).toHaveProperty("next_action_code");
  });

  it("returns AWAITING_FIRST_ARTIFACT when no lineage exists — no fabricated next_action", async () => {
    const session = makeSession({ session_id: "sess-pv-empty", pipeline_state: "intake" });
    const { db } = createFullMockDb(session);

    const summary = await getRunDeliverySummary(db, "sess-pv-empty");
    expect(summary).not.toBeNull();
    expect(summary!.current_artifact_type).toBeNull();
    expect(summary!.current_attempt).toBeNull();
    expect(summary!.next_action_code).toBe("AWAITING_FIRST_ARTIFACT");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ADVERSARIAL 1 — Cannot suppress handoff recording via request input
// ─────────────────────────────────────────────────────────────────────────────

describe("ADVERSARIAL 1 — handoff recording cannot be suppressed via caller input", () => {
  it("records a handoff_events row even when the request contains no delivery field", async () => {
    // Proves that orchestration owns the handoff trigger — omitting the delivery
    // field does NOT suppress the write to handoff_events.
    const session = makeSession({ pipeline_state: "intake" });
    const { db, state } = createFullMockDb(session);

    // No delivery field, no parser_verdict, no review_verdict — minimal caller input
    const req: SubmitArtifactRequest = {
      artifact_type: "ProblemBrief",
      payload: { title: "attempt to suppress handoff" },
    };

    await submitArtifactWithLifecycle(db, createMockBucket(), session, req);

    // handoff_events MUST still be recorded — orchestration owns this, not the caller
    expect(state.handoffEvents).toHaveLength(1);
    expect(state.handoffEvents[0]).toMatchObject({
      session_id: session.session_id,
      pipeline_state: "intake",
      classified_by: "orchestration",
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ADVERSARIAL 2 — Cannot trigger handoff on non-transition artifact
// ─────────────────────────────────────────────────────────────────────────────

describe("ADVERSARIAL 2 — non-transition artifact cannot produce a handoff row", () => {
  it("does not create a handoff_events row when artifact does not cross a stage boundary", async () => {
    // FramingAssessment in problem_framing is not a transition trigger.
    // A caller cannot force a handoff by submitting this artifact type.
    const session = makeSession({ pipeline_state: "problem_framing" });
    const { db, state } = createFullMockDb(session);

    const req: SubmitArtifactRequest = {
      artifact_type: "FramingAssessment",
      payload: { summary: "non-transition work artifact" },
      // Intentionally providing all passing signals — should still NOT produce a handoff row
      parser_verdict: {
        schema_valid: true,
        required_sections_present: true,
        stage_matches_expected: true,
        reentry_ready: true,
      },
      review_verdict: { status: "NOT_REQUIRED" },
    };

    await submitArtifactWithLifecycle(db, createMockBucket(), session, req);

    // handoff_events MUST be empty — the artifact type determines transition eligibility
    expect(state.handoffEvents).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ADVERSARIAL 3 — Repair attempt requires orchestration-classified replacement_reason
// ─────────────────────────────────────────────────────────────────────────────

describe("ADVERSARIAL 3 — repair without replacement_reason is rejected", () => {
  it("rejects caller-supplied replacement_reason — orchestration owns this field", () => {
    // validateDeliveryInput is the service-layer boundary that prevents callers from
    // injecting or overriding the replacement_reason.
    //
    // The input type intentionally excludes replacement_reason to enforce the
    // constraint at compile time; this test uses a Record cast to simulate what a
    // caller might attempt at runtime (e.g., via JSON deserialization bypassing TS types).
    const adversarialInput: Record<string, unknown> = { replacement_reason: "QUALITY_ISSUE" };
    const result = validateDeliveryInput(adversarialInput as Parameters<typeof validateDeliveryInput>[0]);
    expect(result).not.toBeNull();
    expect(result).toMatch(/replacement_reason.*orchestration/i);
  });

  it("orchestration always classifies replacement_reason for repair attempts — never null on attempt > 1", async () => {
    // recordArtifactAttempt classifies replacement_reason via the 7-step precedence.
    // There is no code path that produces attempt > 1 with replacement_reason = null.
    const { db, rows: _rows } = createLineageMockDb([
      {
        lineage_id: "lin-adv3-001",
        run_id: "run-adv3",
        artifact_id: "ART-ADV3-001",
        artifact_type: "FramingAssessment",
        stage: "problem_framing",
        attempt: 1,
        supersedes_artifact_id: null,
        created_at: "2026-01-01T00:00:00.000Z",
        created_by_role: "AE-Framing",
        classified_by: "orchestration",
        replacement_reason: null,
        replacement_reason_source: null,
        is_repair_attempt: 0,
        is_first_attempt_in_stage: 1,
        override_flag: 0,
      },
    ]);

    const repair = await recordArtifactAttempt(db, {
      run_id: "run-adv3",
      stage: "problem_framing",
      artifact_id: "ART-ADV3-002",
      artifact_type: "FramingAssessment",
      created_by_role: "AE-Framing",
      parser_verdict: {
        schema_valid: true,
        required_sections_present: true,
        stage_matches_expected: true,
        reentry_ready: true,
      },
      review_verdict: { status: "NOT_REQUIRED" },
      scope_fingerprint_changed: false,
      transition_context: {},
    });

    // attempt > 1 — this is a repair
    expect(repair.record.attempt).toBe(2);

    // replacement_reason MUST NOT be null for any repair attempt
    expect(repair.record.replacement_reason).not.toBeNull();

    // replacement_reason_source MUST be orchestration — never caller
    expect(repair.record.replacement_reason_source).toBe("orchestration");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ADVERSARIAL 4 — Failed handoff without failure_reason is rejected
// ─────────────────────────────────────────────────────────────────────────────

describe("ADVERSARIAL 4 — failed handoff without failure_reason is rejected", () => {
  it("validateDeliveryInput rejects handoff_status=failed without handoff_failure_reason", () => {
    // The service boundary must reject any caller that attempts to record a failed handoff
    // without providing the mandatory reason — this prevents silent/opaque failures.
    const result = validateDeliveryInput({ handoff_status: "failed" });
    expect(result).not.toBeNull();
    expect(result).toMatch(/handoff_failure_reason.*required/i);
  });

  it("classifyHandoffOutcome always provides a failure_reason when outcome is FAILED — no silent failure path", () => {
    // Every possible failure mode in classifyHandoffOutcome assigns a specific reason.
    // There is no code path that produces outcome=FAILED with failure_reason=null.
    const failureInputs: Array<Parameters<typeof classifyHandoffOutcome>[0]> = [
      { parser_verdict_ok: true, review_verdict_ok: true, legal_transition_ok: true, reentry_ready: true, owner_resolved: true, schema_valid: false, fields_present: true },
      { parser_verdict_ok: true, review_verdict_ok: true, legal_transition_ok: true, reentry_ready: true, owner_resolved: true, schema_valid: true, fields_present: false },
      { parser_verdict_ok: true, review_verdict_ok: true, legal_transition_ok: true, reentry_ready: true, owner_resolved: false, schema_valid: true, fields_present: true },
      { parser_verdict_ok: true, review_verdict_ok: false, legal_transition_ok: true, reentry_ready: true, owner_resolved: true, schema_valid: true, fields_present: true },
      { parser_verdict_ok: true, review_verdict_ok: true, legal_transition_ok: true, reentry_ready: false, owner_resolved: true, schema_valid: true, fields_present: true },
      { parser_verdict_ok: false, review_verdict_ok: true, legal_transition_ok: true, reentry_ready: true, owner_resolved: true, schema_valid: true, fields_present: true },
      { parser_verdict_ok: true, review_verdict_ok: true, legal_transition_ok: false, reentry_ready: true, owner_resolved: true, schema_valid: true, fields_present: true },
    ];

    for (const input of failureInputs) {
      const result = classifyHandoffOutcome(input);
      if (result.outcome === "FAILED") {
        // failure_reason is NEVER null when outcome is FAILED
        expect(result.failure_reason).not.toBeNull();
      }
    }

    // Verify that all failure inputs actually produce FAILED outcomes (no silent pass-through)
    const outcomes = failureInputs.map((input) => classifyHandoffOutcome(input).outcome);
    expect(outcomes.every((o) => o === "FAILED")).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ADVERSARIAL 5 — Read model reports DB truth; no fabricated values
// ─────────────────────────────────────────────────────────────────────────────

describe("ADVERSARIAL 5 — read model reports DB truth without fabrication", () => {
  it("returns null for a session that does not exist — no phantom data fabricated", async () => {
    const session = makeSession({ session_id: "sess-pv-adv5" });
    const { db } = createFullMockDb(session);

    // Query a session that was never inserted
    const result = await getRunDeliverySummary(db, "sess-does-not-exist");

    // MUST return null — the read model must not fabricate a response for non-existent sessions
    expect(result).toBeNull();
  });

  it("reflects an inconsistent DB state accurately without inventing reconciliation — current_stage from sessions, handoff_status from handoff_events", async () => {
    // Scenario: sessions still says 'intake' but handoff_events records a COMPLETED
    // handoff for intake → problem_framing. This can only occur if the state transition
    // failed after the handoff was recorded (partial failure scenario).
    //
    // The read model MUST faithfully report both pieces of DB truth independently:
    // - current_stage comes from sessions (still 'intake')
    // - handoff_status comes from handoff_events (COMPLETED)
    //
    // This documents a known SILENT FAILURE RISK: the operator read model does not
    // cross-validate these layers and may show next_action_code=HANDOFF_COMPLETE while
    // current_stage is still at the originating stage.
    const session = makeSession({
      session_id: "sess-pv-mismatch",
      pipeline_state: "intake",  // sessions table still shows intake
    });
    const { db, state } = createFullMockDb(session);

    // Seed: handoff_events says COMPLETED (but session was NOT advanced)
    state.handoffEvents.push({
      event_id: "evt-mismatch-001",
      session_id: "sess-pv-mismatch",
      pipeline_state: "intake",
      outcome: "COMPLETED",
      failure_reason: null,
      classified_by: "orchestration",
      classified_at: "2026-01-01T01:00:00.000Z",
    });

    const summary = await getRunDeliverySummary(db, "sess-pv-mismatch");

    expect(summary).not.toBeNull();

    // current_stage MUST come from sessions table — not inferred from handoff_events
    expect(summary!.current_stage).toBe("intake");

    // handoff_status MUST come from handoff_events — reflects DB truth
    expect(summary!.handoff_status).toBe("COMPLETED");

    // No value is fabricated — the output accurately reflects what is in the DB
    // even when those values suggest an inconsistency between layers.
    // Note: this inconsistency in production would indicate a partial failure
    // in the submitArtifactWithLifecycle code path (handoff recorded, session not updated).
    expect(summary!.session_id).toBe("sess-pv-mismatch");
    expect(typeof summary!.current_stage).toBe("string");
    expect(typeof summary!.handoff_status).toBe("string");
  });

  it("caller cannot alter the read model output — all data sourced from DB, no caller input accepted", async () => {
    // getRunDeliverySummary accepts only a session_id string — no caller-provided
    // data shapes the output. All values come from DB queries.
    const session = makeSession({ session_id: "sess-pv-immutable", pipeline_state: "problem_framing" });
    const { db, state } = createFullMockDb(session);

    state.lineage.push({
      lineage_id: "lin-imm-001",
      run_id: "sess-pv-immutable",
      artifact_id: "art-imm-001",
      artifact_type: "FramingAssessment",
      stage: "problem_framing",
      attempt: 1,
      supersedes_artifact_id: null,
      created_at: "2026-01-01T00:00:00.000Z",
      created_by_role: "operator",
      classified_by: "orchestration",
      replacement_reason: null,
      replacement_reason_source: null,
      is_repair_attempt: 0,
      is_first_attempt_in_stage: 1,
      override_flag: 0,
    });

    const summary = await getRunDeliverySummary(db, "sess-pv-immutable");

    expect(summary).not.toBeNull();
    // artifact_type comes from artifact_lineage, not caller input
    expect(summary!.current_artifact_type).toBe("FramingAssessment");
    // attempt comes from artifact_lineage, not caller input
    expect(summary!.current_attempt).toBe(1);
    // no handoff events → handoff_status from DB is null (no fallback fabrication)
    expect(summary!.handoff_status).toBeNull();
  });

  it("caller-supplied delivery.handoff_status on a non-transition artifact does NOT appear in the read model", async () => {
    // Attack: a caller submits a non-transition artifact with delivery.handoff_status = "completed".
    // This writes to delivery_integrity_events but must NOT surface as handoff_status in the
    // operator read model. handoff_status is orchestration-owned and only comes from handoff_events.
    const session = makeSession({ pipeline_state: "problem_framing" });
    const { db, state } = createFullMockDb(session);

    await submitArtifactWithLifecycle(db, createMockBucket(), session, {
      artifact_type: "FramingAssessment",
      payload: { summary: "caller attempts to inject completed status" },
      delivery: { handoff_status: "completed" },
    });

    // delivery_integrity_events captured the caller-supplied value
    expect(state.deliveryEvents.length).toBeGreaterThan(0);
    expect(state.deliveryEvents[0]!.handoff_status).toBe("completed");

    // but no handoff_events row was written (FramingAssessment is not a transition trigger)
    expect(state.handoffEvents).toHaveLength(0);

    const summary = await getRunDeliverySummary(db, session.session_id);
    expect(summary).not.toBeNull();

    // read model MUST return null — not the caller-supplied "completed" from DIE
    expect(summary!.handoff_status).toBeNull();
  });
});
