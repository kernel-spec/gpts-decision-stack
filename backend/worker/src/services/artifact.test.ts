/**
 * Minimum wiring tests for submitArtifactWithLifecycle.
 *
 * These tests prove that the delivery-truth paths match the intended semantic contract:
 *   - handoff_events is an ACTUAL HANDOFF DECISION LOG, not an evaluation log.
 *   - recordHandoffOutcome writes to handoff_events only when a real pipeline
 *     transition is evaluated (the stage-boundary crossing).
 *   - Intermediate work artifacts that do not trigger a transition produce no
 *     handoff_events row.
 *   - Caller cannot suppress a handoff row on a transition-triggering artifact
 *     by omitting the delivery field — the trigger is orchestration-owned.
 *   - recordStageEntry writes to stage_entries when a pipeline transition fires.
 */

import { describe, expect, it } from "vitest";
import type { Env, Session, SubmitArtifactRequest } from "../types/index.js";
import { submitArtifactWithLifecycle } from "./artifact.js";

// ---------- Types for captured rows ----------

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
  pipeline_state: string;
  entry_count: number;
  classified_by: string;
  classified_at: string;
};

// ---------- Mock helpers ----------

function makeSession(overrides?: Partial<Session>): Session {
  return {
    session_id: "sess-art-001",
    requestor_type: "founder-led",
    pipeline_state: "problem_framing",
    decision_status: "proceed",
    veto_active: false,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

/**
 * Comprehensive mock DB that captures handoff_events and stage_entries inserts
 * while silently handling all other queries needed by submitArtifactWithLifecycle.
 */
function createArtifactMockDb(session: Session) {
  const handoffEvents: HandoffEventRow[] = [];
  const stageEntries: StageEntryRow[] = [];

  const db = {
    prepare(sql: string) {
      return {
        bind(...params: unknown[]) {
          return {
            async first<T>() {
              // getSession (called by updateSessionState after a transition)
              if (sql.includes("FROM sessions s") && sql.includes("WHERE s.session_id")) {
                return {
                  session_id: session.session_id,
                  requestor_type: session.requestor_type,
                  pipeline_state: session.pipeline_state,
                  decision_status: session.decision_status,
                  created_at: session.created_at,
                  updated_at: session.updated_at,
                  veto_active: 0,
                } as T;
              }
              // delivery_integrity_events loop-check
              if (sql.includes("FROM delivery_integrity_events")) {
                return null as T;
              }
              // artifact_lineage prior attempt check
              if (sql.includes("FROM artifact_lineage") && sql.includes("ORDER BY attempt DESC")) {
                return null as T;
              }
              // stage_entries count
              if (sql.includes("COUNT(*)") && sql.includes("FROM stage_entries")) {
                const [session_id, pipeline_state] = params as [string, string];
                const cnt = stageEntries.filter(
                  (r) => r.session_id === session_id && r.pipeline_state === pipeline_state
                ).length;
                return { cnt } as T;
              }
              return null as T;
            },
            async run() {
              if (sql.includes("INSERT INTO handoff_events")) {
                const [
                  event_id,
                  session_id,
                  pipeline_state,
                  outcome,
                  failure_reason,
                  classified_by,
                  classified_at,
                ] = params as [string, string, string, string, string | null, string, string];
                handoffEvents.push({
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
                let entry_id: string;
                let session_id: string;
                let pipeline_state: string;
                let entry_count: number;
                let classified_by: string;
                let classified_at: string;

                if (params.length === 7) {
                  [
                    entry_id,
                    session_id,
                    ,
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
                }
                stageEntries.push({
                  entry_id,
                  session_id,
                  pipeline_state,
                  entry_count,
                  classified_by,
                  classified_at,
                });
              }
              return { success: true };
            },
          };
        },
      };
    },
  };

  return {
    db: db as unknown as Env["DECISIONS_DB"],
    handoffEvents,
    stageEntries,
  };
}

function createMockBucket(): Env["ARTIFACTS_BUCKET"] {
  return {
    async put(_key: string, _value: unknown, _opts?: unknown): Promise<void> {},
  } as unknown as Env["ARTIFACTS_BUCKET"];
}

// ---------- recordHandoffOutcome wiring tests ----------

describe("submitArtifactWithLifecycle — recordHandoffOutcome wiring", () => {
  it("writes a COMPLETED handoff_events row when a transition fires and all parser signals pass", async () => {
    // ProblemBrief in intake triggers intake → problem_framing; handoff quality signals all pass
    const session = makeSession({ pipeline_state: "intake" });
    const { db, handoffEvents } = createArtifactMockDb(session);

    const req: SubmitArtifactRequest & { agent_id?: string } = {
      artifact_type: "ProblemBrief",
      payload: { title: "my problem" },
      parser_verdict: {
        schema_valid: true,
        required_sections_present: true,
        stage_matches_expected: true,
        reentry_ready: true,
      },
      review_verdict: { status: "NOT_REQUIRED" },
    };

    await submitArtifactWithLifecycle(db, createMockBucket(), session, req);

    expect(handoffEvents).toHaveLength(1);
    expect(handoffEvents[0]).toMatchObject({
      session_id: "sess-art-001",
      pipeline_state: "intake",
      outcome: "COMPLETED",
      failure_reason: null,
      classified_by: "orchestration",
    });
  });

  it("writes a FAILED handoff_events row when a transition fires but parser signals indicate failure", async () => {
    // ProblemBrief in intake triggers transition; schema_valid=false causes SCHEMA_MISMATCH
    const session = makeSession({ pipeline_state: "intake" });
    const { db, handoffEvents } = createArtifactMockDb(session);

    const req: SubmitArtifactRequest & { agent_id?: string } = {
      artifact_type: "ProblemBrief",
      payload: { title: "my problem" },
      parser_verdict: {
        schema_valid: false, // triggers SCHEMA_MISMATCH in classifyHandoffOutcome
        required_sections_present: true,
        stage_matches_expected: true,
        reentry_ready: true,
      },
      review_verdict: { status: "NOT_REQUIRED" },
    };

    await submitArtifactWithLifecycle(db, createMockBucket(), session, req);

    expect(handoffEvents).toHaveLength(1);
    expect(handoffEvents[0]).toMatchObject({
      session_id: "sess-art-001",
      outcome: "FAILED",
      failure_reason: "SCHEMA_MISMATCH",
      classified_by: "orchestration",
    });
  });

  it("writes a handoff_events row for a transition-triggering artifact even when delivery is absent", async () => {
    // Proves orchestration owns the recording: omitting delivery does not suppress the row.
    // The transition predicate (getArtifactTransition) is orchestration-owned, not caller-owned.
    const session = makeSession({ pipeline_state: "intake" });
    const { db, handoffEvents } = createArtifactMockDb(session);

    const req: SubmitArtifactRequest & { agent_id?: string } = {
      artifact_type: "ProblemBrief",
      payload: { title: "my problem" },
      // No delivery field — caller makes no handoff claim
    };

    await submitArtifactWithLifecycle(db, createMockBucket(), session, req);

    expect(handoffEvents).toHaveLength(1);
    expect(handoffEvents[0]).toMatchObject({
      session_id: "sess-art-001",
      pipeline_state: "intake",
      classified_by: "orchestration",
    });
  });

  it("does NOT write a handoff_events row for a non-transition artifact (intermediate work artifact)", async () => {
    // FramingAssessment in problem_framing does not cross a stage boundary.
    // handoff_events is a decision log for actual handoff events, not an evaluation counter.
    const session = makeSession({ pipeline_state: "problem_framing" });
    const { db, handoffEvents } = createArtifactMockDb(session);

    const req: SubmitArtifactRequest & { agent_id?: string } = {
      artifact_type: "FramingAssessment",
      payload: { summary: "test" },
    };

    await submitArtifactWithLifecycle(db, createMockBucket(), session, req);

    expect(handoffEvents).toHaveLength(0);
  });

  it("classifies REVIEW_REJECTED for a transition-triggering artifact with review_verdict.status=REJECTED", async () => {
    // ProblemBrief in intake triggers a transition; review failure is classified from the verdict signal
    const session = makeSession({ pipeline_state: "intake" });
    const { db, handoffEvents } = createArtifactMockDb(session);

    const req: SubmitArtifactRequest & { agent_id?: string } = {
      artifact_type: "ProblemBrief",
      payload: { title: "my problem" },
      review_verdict: { status: "REJECTED" },
    };

    await submitArtifactWithLifecycle(db, createMockBucket(), session, req);

    expect(handoffEvents).toHaveLength(1);
    expect(handoffEvents[0]).toMatchObject({
      outcome: "FAILED",
      failure_reason: "REVIEW_REJECTED",
      classified_by: "orchestration",
    });
  });
});

// ---------- recordStageEntry wiring tests (transition path) ----------

describe("submitArtifactWithLifecycle — recordStageEntry wiring", () => {
  it("writes a stage_entries row for the new stage when a pipeline transition fires", async () => {
    // ProblemBrief in intake triggers intake → problem_framing transition
    const session = makeSession({ pipeline_state: "intake" });
    const { db, stageEntries } = createArtifactMockDb(session);

    const req: SubmitArtifactRequest & { agent_id?: string } = {
      artifact_type: "ProblemBrief",
      payload: { title: "my problem" },
      agent_id: "agent-001",
    };

    await submitArtifactWithLifecycle(db, createMockBucket(), session, req);

    expect(stageEntries).toHaveLength(1);
    expect(stageEntries[0]).toMatchObject({
      session_id: "sess-art-001",
      pipeline_state: "problem_framing", // the stage we transitioned INTO
      entry_count: 1,
      classified_by: "orchestration",
    });
  });

  it("does NOT write a stage_entries row when no transition fires", async () => {
    // FramingAssessment in problem_framing does not trigger a transition
    const session = makeSession({ pipeline_state: "problem_framing" });
    const { db, stageEntries } = createArtifactMockDb(session);

    const req: SubmitArtifactRequest & { agent_id?: string } = {
      artifact_type: "FramingAssessment",
      payload: { summary: "assessment" },
    };

    await submitArtifactWithLifecycle(db, createMockBucket(), session, req);

    expect(stageEntries).toHaveLength(0);
  });
});
