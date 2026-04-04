/**
 * Tests for lifecycle-transaction.ts
 *
 * Verifies:
 *   - invariant guards throw on violation (fail-fast)
 *   - executeArtifactLifecycleTransaction writes all truth tables atomically
 *   - partial failure (batch throws) leaves no rows in any truth table
 *   - handoff-only path (failed handoff) does not write stage_entries or update sessions
 *   - non-transition path writes only lineage + delivery_integrity_events
 *   - loop signal is emitted on second stage entry
 */

import { describe, expect, it } from "vitest";
import type { Env, Session } from "../types/index.js";
import {
  executeArtifactLifecycleTransaction,
  assertHasTransitionCandidate,
  assertHandoffCompletedForStateChange,
  assertStageEntryMatchesTransition,
  type TransitionCandidate,
} from "./lifecycle-transaction.js";

// ─── Mock helpers ─────────────────────────────────────────────────────────────

function makeSession(overrides: Partial<Session> = {}): Session {
  return {
    session_id: "sess-lt-001",
    requestor_type: "founder-led",
    pipeline_state: "intake",
    decision_status: "unresolved",
    veto_active: false,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

type CapturedWrites = {
  lineage: Array<Record<string, unknown>>;
  deliveryEvents: Array<Record<string, unknown>>;
  handoffEvents: Array<Record<string, unknown>>;
  stageEntries: Array<Record<string, unknown>>;
  loopSignals: Array<Record<string, unknown>>;
  sessions: Map<string, Record<string, unknown>>;
};

type MockDbOptions = {
  /** If set, batch() throws when processing a statement for this SQL fragment. */
  failOnSqlFragment?: string;
  /** Pre-existing stage entry count for (session_id, pipeline_state) queries. */
  priorStageEntryCount?: number;
  /** Pre-existing prior lineage attempt number. */
  priorAttempt?: number;
  /** Prior artifact_id for lineage supersedes chain. */
  priorArtifactId?: string;
  /** Whether there is a prior delivery event (stage_loop_detected). */
  hasPriorDelivery?: boolean;
};

function createMockDb(opts: MockDbOptions = {}): {
  db: Env["DECISIONS_DB"];
  writes: CapturedWrites;
} {
  const writes: CapturedWrites = {
    lineage: [],
    deliveryEvents: [],
    handoffEvents: [],
    stageEntries: [],
    loopSignals: [],
    sessions: new Map([
      [
        "sess-lt-001",
        {
          session_id: "sess-lt-001",
          pipeline_state: "intake",
          decision_status: "unresolved",
        },
      ],
    ]),
  };

  const db = {
    prepare(sql: string) {
      return {
        bind(...params: unknown[]) {
          return {
            async first<T>() {
              if (sql.includes("FROM artifact_lineage") && sql.includes("ORDER BY attempt DESC")) {
                if (opts.priorAttempt !== undefined) {
                  return {
                    attempt: opts.priorAttempt,
                    artifact_id: opts.priorArtifactId ?? "prev-art",
                  } as T;
                }
                return null as T;
              }
              if (sql.includes("FROM delivery_integrity_events")) {
                return (opts.hasPriorDelivery ? { has_prior: 1 } : null) as T;
              }
              if (sql.includes("FROM stage_entries") && sql.includes("ORDER BY entry_count DESC")) {
                if (opts.priorStageEntryCount !== undefined && opts.priorStageEntryCount > 0) {
                  return { entry_count: opts.priorStageEntryCount } as T;
                }
                return null as T;
              }
              return null as T;
            },
            async run() {
              if (sql.includes("INSERT INTO artifact_lineage")) {
                writes.lineage.push(Object.fromEntries(
                  ["lineage_id","run_id","artifact_id","artifact_type","stage","attempt",
                   "supersedes_artifact_id","created_at","created_by_role","classified_by",
                   "replacement_reason","replacement_reason_source","is_repair_attempt",
                   "is_first_attempt_in_stage","override_flag","lifecycle_id"]
                    .map((k, i) => [k, params[i]])
                ));
              }
              if (sql.includes("INSERT INTO delivery_integrity_events")) {
                writes.deliveryEvents.push({ sql, params });
              }
              if (sql.includes("INSERT INTO handoff_events")) {
                const [event_id, session_id, pipeline_state, outcome, failure_reason, classified_by, classified_at, lifecycle_id] = params as string[];
                writes.handoffEvents.push({ event_id, session_id, pipeline_state, outcome, failure_reason, classified_by, classified_at, lifecycle_id });
              }
              if (sql.includes("UPDATE sessions SET pipeline_state")) {
                const [pipeline_state, decision_status, updated_at, session_id] = params as string[];
                const row = writes.sessions.get(session_id);
                if (row) {
                  writes.sessions.set(session_id, { ...row, pipeline_state, decision_status, updated_at });
                }
              }
              if (sql.includes("INSERT INTO stage_entries")) {
                const [stage_entry_id, session_id, artifact_id, pipeline_state, entry_count, classified_by, created_at, lifecycle_id] = params as [string, string, string, string, number, string, string, string];
                writes.stageEntries.push({ stage_entry_id, session_id, artifact_id, pipeline_state, entry_count, classified_by, created_at, lifecycle_id });
              }
              if (sql.includes("INSERT INTO stage_loop_signals")) {
                const [loop_signal_id, session_id, pipeline_state, entry_count, loop_type, classified_by, created_at] = params as [string, string, string, number, string, string, string];
                writes.loopSignals.push({ loop_signal_id, session_id, pipeline_state, entry_count, loop_type, classified_by, created_at });
              }
              return { success: true };
            },
          };
        },
      };
    },
    async batch(stmts: Array<{ run(): Promise<unknown> }>) {
      if (opts.failOnSqlFragment) {
        // In a real D1 batch, failure rolls back all statements.
        // Simulate this: fail before executing any statement to mimic atomicity.
        for (const s of stmts) {
          // Peek: throw before all runs if any statement matches the fail fragment
          // We use a flag approach since closures capture sql
        }
        // Simpler: throw unconditionally to test rollback behavior
        throw new Error(`[test] simulated D1 batch failure (trigger: ${opts.failOnSqlFragment})`);
      }
      const results = [];
      for (const s of stmts) results.push(await s.run());
      return results;
    },
  };

  return { db: db as unknown as Env["DECISIONS_DB"], writes };
}

const intakeTransitionCandidate: TransitionCandidate = {
  pipeline_state: "problem_framing",
  decision_status: "unresolved",
  notes: "Transitioned intake → problem_framing after accepted ProblemBrief",
  legal_transition_ok: true,
};

const failingTransitionCandidate: TransitionCandidate = {
  pipeline_state: "problem_framing",
  decision_status: "unresolved",
  notes: "Transitioned intake → problem_framing after accepted ProblemBrief",
  legal_transition_ok: false,
};

// ─── Invariant Guard Tests ─────────────────────────────────────────────────────

describe("assertHasTransitionCandidate", () => {
  it("throws when candidate is null", () => {
    expect(() =>
      assertHasTransitionCandidate(null, "test-context")
    ).toThrow("[lifecycle invariant] handoff without transition candidate is forbidden");
  });

  it("does not throw when candidate is a valid object", () => {
    expect(() =>
      assertHasTransitionCandidate(intakeTransitionCandidate, "test-context")
    ).not.toThrow();
  });
});

describe("assertHandoffCompletedForStateChange", () => {
  it("throws when outcome is FAILED", () => {
    expect(() =>
      assertHandoffCompletedForStateChange("FAILED", "test-context")
    ).toThrow("[lifecycle invariant] state change without COMPLETED handoff is forbidden");
  });

  it("does not throw when outcome is COMPLETED", () => {
    expect(() =>
      assertHandoffCompletedForStateChange("COMPLETED", "test-context")
    ).not.toThrow();
  });
});

describe("assertStageEntryMatchesTransition", () => {
  it("throws when pipeline states differ", () => {
    expect(() =>
      assertStageEntryMatchesTransition("problem_framing", "primitive_selection", "test")
    ).toThrow("[lifecycle invariant] stage_entry.pipeline_state");
  });

  it("does not throw when pipeline states match", () => {
    expect(() =>
      assertStageEntryMatchesTransition("problem_framing", "problem_framing", "test")
    ).not.toThrow();
  });
});

// ─── Non-transition path ──────────────────────────────────────────────────────

describe("executeArtifactLifecycleTransaction — non-transition artifact", () => {
  it("writes only artifact_lineage and delivery_integrity_events when no transition candidate", async () => {
    const session = makeSession({ pipeline_state: "problem_framing" });
    const { db, writes } = createMockDb();

    const result = await executeArtifactLifecycleTransaction(db, {
      lifecycle_id: "lc-001",
      session,
      artifact_id: "art-001",
      artifact_type: "FramingAssessment",
      created_by_role: "agent-001",
      parser_verdict: { schema_valid: true, required_sections_present: true, stage_matches_expected: true, reentry_ready: true },
      review_verdict: { status: "NOT_REQUIRED" },
      scope_fingerprint_changed: false,
      transition_context: {},
      transition_candidate: null,
      delivery_input: null,
    });

    expect(writes.lineage).toHaveLength(1);
    expect(writes.deliveryEvents).toHaveLength(1);
    expect(writes.handoffEvents).toHaveLength(0);
    expect(writes.stageEntries).toHaveLength(0);
    expect(result.handoff).toBeNull();
    expect(result.state_updated).toBe(false);
    expect(result.stage_entry).toBeNull();
  });
});

// ─── Successful transition path ───────────────────────────────────────────────

describe("executeArtifactLifecycleTransaction — successful transition", () => {
  it("writes all 5 truth tables atomically and returns correct result", async () => {
    const session = makeSession({ pipeline_state: "intake" });
    const { db, writes } = createMockDb();

    const result = await executeArtifactLifecycleTransaction(db, {
      lifecycle_id: "lc-002",
      session,
      artifact_id: "art-002",
      artifact_type: "ProblemBrief",
      created_by_role: "agent-001",
      parser_verdict: { schema_valid: true, required_sections_present: true, stage_matches_expected: true, reentry_ready: true },
      review_verdict: { status: "NOT_REQUIRED" },
      scope_fingerprint_changed: false,
      transition_context: {},
      transition_candidate: intakeTransitionCandidate,
      delivery_input: null,
    });

    expect(writes.lineage).toHaveLength(1);
    expect(writes.lineage[0]).toMatchObject({ lifecycle_id: "lc-002", classified_by: "orchestration", attempt: 1 });

    expect(writes.deliveryEvents).toHaveLength(1);

    expect(writes.handoffEvents).toHaveLength(1);
    expect(writes.handoffEvents[0]).toMatchObject({
      outcome: "COMPLETED",
      failure_reason: null,
      lifecycle_id: "lc-002",
    });

    expect(writes.stageEntries).toHaveLength(1);
    expect(writes.stageEntries[0]).toMatchObject({
      pipeline_state: "problem_framing",
      entry_count: 1,
      lifecycle_id: "lc-002",
    });

    const sessionRow = writes.sessions.get("sess-lt-001");
    expect(sessionRow?.pipeline_state).toBe("problem_framing");

    expect(result.handoff?.outcome).toBe("COMPLETED");
    expect(result.state_updated).toBe(true);
    expect(result.stage_entry?.pipeline_state).toBe("problem_framing");
    expect(result.loop_signal).toBeNull();
    expect(result.lifecycle_id).toBe("lc-002");
  });
});

// ─── Failed transition path ───────────────────────────────────────────────────

describe("executeArtifactLifecycleTransaction — failed handoff", () => {
  it("writes handoff_events FAILED but does NOT write stage_entries or update sessions", async () => {
    const session = makeSession({ pipeline_state: "intake" });
    const { db, writes } = createMockDb();

    const result = await executeArtifactLifecycleTransaction(db, {
      lifecycle_id: "lc-003",
      session,
      artifact_id: "art-003",
      artifact_type: "ProblemBrief",
      created_by_role: "agent-001",
      parser_verdict: { schema_valid: false, required_sections_present: true, stage_matches_expected: true, reentry_ready: true },
      review_verdict: { status: "NOT_REQUIRED" },
      scope_fingerprint_changed: false,
      transition_context: {},
      transition_candidate: failingTransitionCandidate,
      delivery_input: null,
    });

    expect(writes.handoffEvents).toHaveLength(1);
    expect(writes.handoffEvents[0]).toMatchObject({ outcome: "FAILED", failure_reason: "SCHEMA_MISMATCH" });

    expect(writes.stageEntries).toHaveLength(0);
    expect(writes.sessions.get("sess-lt-001")?.pipeline_state).toBe("intake");

    expect(result.state_updated).toBe(false);
    expect(result.stage_entry).toBeNull();
  });
});

// ─── Loop signal path ─────────────────────────────────────────────────────────

describe("executeArtifactLifecycleTransaction — loop signal", () => {
  it("emits a stage_loop_signal when entering a stage for the second time", async () => {
    const session = makeSession({ pipeline_state: "intake" });
    const { db, writes } = createMockDb({ priorStageEntryCount: 1 });

    const result = await executeArtifactLifecycleTransaction(db, {
      lifecycle_id: "lc-004",
      session,
      artifact_id: "art-004",
      artifact_type: "ProblemBrief",
      created_by_role: "agent-001",
      parser_verdict: { schema_valid: true, required_sections_present: true, stage_matches_expected: true, reentry_ready: true },
      review_verdict: { status: "NOT_REQUIRED" },
      scope_fingerprint_changed: false,
      transition_context: {},
      transition_candidate: intakeTransitionCandidate,
      delivery_input: null,
    });

    expect(writes.stageEntries[0]).toMatchObject({ entry_count: 2 });
    expect(writes.loopSignals).toHaveLength(1);
    expect(writes.loopSignals[0]).toMatchObject({ loop_type: "SAME_STAGE_REPEAT", entry_count: 2 });
    expect(result.loop_signal?.loop_type).toBe("SAME_STAGE_REPEAT");
  });
});

// ─── Partial failure / rollback ───────────────────────────────────────────────

describe("executeArtifactLifecycleTransaction — batch failure atomicity", () => {
  it("throws and leaves ALL truth tables empty when the D1 batch fails", async () => {
    const session = makeSession({ pipeline_state: "intake" });
    const { db, writes } = createMockDb({ failOnSqlFragment: "artifact_lineage" });

    await expect(
      executeArtifactLifecycleTransaction(db, {
        lifecycle_id: "lc-005",
        session,
        artifact_id: "art-005",
        artifact_type: "ProblemBrief",
        created_by_role: "agent-001",
        parser_verdict: { schema_valid: true, required_sections_present: true, stage_matches_expected: true, reentry_ready: true },
        review_verdict: { status: "NOT_REQUIRED" },
        scope_fingerprint_changed: false,
        transition_context: {},
        transition_candidate: intakeTransitionCandidate,
        delivery_input: null,
      })
    ).rejects.toThrow("simulated D1 batch failure");

    // Batch failure means D1 rolled back everything — no partial writes
    expect(writes.lineage).toHaveLength(0);
    expect(writes.deliveryEvents).toHaveLength(0);
    expect(writes.handoffEvents).toHaveLength(0);
    expect(writes.stageEntries).toHaveLength(0);
    expect(writes.sessions.get("sess-lt-001")?.pipeline_state).toBe("intake");
  });
});

// ─── Repair attempt (attempt > 1) ────────────────────────────────────────────

describe("executeArtifactLifecycleTransaction — repair attempt", () => {
  it("increments attempt and sets replacement_reason when prior lineage exists", async () => {
    const session = makeSession({ pipeline_state: "problem_framing" });
    const { db, writes } = createMockDb({
      priorAttempt: 1,
      priorArtifactId: "art-prev-001",
    });

    const result = await executeArtifactLifecycleTransaction(db, {
      lifecycle_id: "lc-006",
      session,
      artifact_id: "art-006",
      artifact_type: "FramingAssessment",
      created_by_role: "agent-001",
      parser_verdict: { schema_valid: false, required_sections_present: true, stage_matches_expected: true, reentry_ready: true },
      review_verdict: { status: "NOT_REQUIRED" },
      scope_fingerprint_changed: false,
      transition_context: {},
      transition_candidate: null,
      delivery_input: null,
    });

    expect(result.lineage.attempt).toBe(2);
    expect(result.lineage.supersedes_artifact_id).toBe("art-prev-001");
    expect(result.lineage.replacement_reason).toBe("INVALID_SCHEMA");
    expect(result.lineage.is_repair_attempt).toBe(true);
    expect(result.lineage_events.some((e) => e.type === "artifact_superseded")).toBe(true);
  });
});

// ─── lifecycle_id correlation ─────────────────────────────────────────────────

describe("executeArtifactLifecycleTransaction — lifecycle_id correlation", () => {
  it("all written rows carry the same lifecycle_id", async () => {
    const session = makeSession({ pipeline_state: "intake" });
    const { db, writes } = createMockDb();

    await executeArtifactLifecycleTransaction(db, {
      lifecycle_id: "lc-007",
      session,
      artifact_id: "art-007",
      artifact_type: "ProblemBrief",
      created_by_role: "agent-001",
      parser_verdict: { schema_valid: true, required_sections_present: true, stage_matches_expected: true, reentry_ready: true },
      review_verdict: { status: "NOT_REQUIRED" },
      scope_fingerprint_changed: false,
      transition_context: {},
      transition_candidate: intakeTransitionCandidate,
      delivery_input: null,
    });

    expect(writes.lineage[0].lifecycle_id).toBe("lc-007");
    expect(writes.handoffEvents[0].lifecycle_id).toBe("lc-007");
    expect(writes.stageEntries[0].lifecycle_id).toBe("lc-007");
  });
});
