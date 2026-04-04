import { describe, expect, it } from "vitest";
import type { Env } from "../types/index.js";
import {
  getRunDeliveryHistory,
  getRunDeliverySummary,
  getRunNextAction,
} from "./operator-delivery.js";

// ---------- Mock DB ----------

type SessionRow = { pipeline_state: string };
type LineageRow = {
  lineage_id?: string;
  run_id: string;
  artifact_id: string;
  artifact_type: string;
  stage: string;
  attempt: number;
  replacement_reason: string | null;
  is_repair_attempt: number;
  created_at: string;
};
type HandoffEventRow = {
  session_id: string;
  pipeline_state: string;
  outcome: string;
  failure_reason: string | null;
  classified_at: string;
};
type LoopSignalRow = {
  session_id: string;
  pipeline_state: string;
  entry_count: number;
  loop_type: string;
  created_at: string;
};
type DeliveryIntegrityRow = {
  session_id: string;
  handoff_status: string;
  classified_at: string;
};

type MockDbState = {
  sessions: SessionRow[];
  lineage: LineageRow[];
  handoffEvents: HandoffEventRow[];
  loopSignals: LoopSignalRow[];
  deliveryIntegrityEvents: DeliveryIntegrityRow[];
};

function createMockDb(state: MockDbState): Env["DECISIONS_DB"] {
  const db = {
    prepare(sql: string) {
      return {
        bind(...params: unknown[]) {
          return {
            async first<T>() {
              if (sql.includes("FROM sessions")) {
                const found = state.sessions[0] ?? null;
                if (!found) return null as T;
                return (sql.includes("SELECT pipeline_state")
                  ? { pipeline_state: found.pipeline_state }
                  : { 1: 1 }) as T;
              }
              if (sql.includes("FROM artifact_lineage")) {
                const [run_id] = params as [string];
                const matching = state.lineage
                  .filter((r) => r.run_id === run_id)
                  .sort(
                    (a, b) =>
                      new Date(b.created_at).getTime() -
                      new Date(a.created_at).getTime()
                  );
                if (sql.includes("is_repair_attempt = 1")) {
                  const repair = matching.filter((r) => r.is_repair_attempt === 1);
                  return (
                    repair.length > 0
                      ? { replacement_reason: repair[0].replacement_reason }
                      : null
                  ) as T;
                }
                return (
                  matching.length > 0
                    ? {
                        artifact_type: matching[0].artifact_type,
                        attempt: matching[0].attempt,
                      }
                    : null
                ) as T;
              }
              if (sql.includes("FROM handoff_events")) {
                const [session_id] = params as [string];
                const matching = state.handoffEvents
                  .filter((r) => r.session_id === session_id)
                  .sort(
                    (a, b) =>
                      new Date(b.classified_at).getTime() -
                      new Date(a.classified_at).getTime()
                  );
                return (
                  matching.length > 0 ? { outcome: matching[0].outcome } : null
                ) as T;
              }
              if (sql.includes("FROM delivery_integrity_events")) {
                throw new Error(
                  "Forbidden query: read model must not use delivery_integrity_events"
                );
              }
              if (sql.includes("FROM stage_loop_signals") && sql.includes("LIMIT 1")) {
                const [session_id] = params as [string];
                const found = state.loopSignals.find(
                  (r) => r.session_id === session_id
                );
                return (found ? { has_loop: 1 } : null) as T;
              }
              return null as T;
            },
            async all<T>() {
              if (sql.includes("FROM artifact_lineage")) {
                const [run_id] = params as [string];
                const rows = state.lineage
                  .filter((r) => r.run_id === run_id)
                  .sort(
                    (a, b) =>
                      new Date(a.created_at).getTime() -
                      new Date(b.created_at).getTime()
                  );
                return { results: rows as T[] };
              }
              if (sql.includes("FROM stage_loop_signals")) {
                const [session_id] = params as [string];
                const rows = state.loopSignals
                  .filter((r) => r.session_id === session_id)
                  .sort(
                    (a, b) =>
                      new Date(a.created_at).getTime() -
                      new Date(b.created_at).getTime()
                  );
                return { results: rows as T[] };
              }
              if (sql.includes("FROM handoff_events")) {
                const [session_id] = params as [string];
                const rows = state.handoffEvents
                  .filter((r) => r.session_id === session_id)
                  .sort(
                    (a, b) =>
                      new Date(a.classified_at).getTime() -
                      new Date(b.classified_at).getTime()
                  );
                return { results: rows as T[] };
              }
              return { results: [] as T[] };
            },
          };
        },
      };
    },
  } as unknown as Env["DECISIONS_DB"];
  return db;
}

function baseState(overrides?: Partial<MockDbState>): MockDbState {
  return {
    sessions: [{ pipeline_state: "problem_framing" }],
    lineage: [],
    handoffEvents: [],
    loopSignals: [],
    deliveryIntegrityEvents: [],
    ...overrides,
  };
}

// ---------- getRunDeliverySummary ----------

describe("getRunDeliverySummary", () => {
  it("returns null when session does not exist", async () => {
    const db = createMockDb({ ...baseState(), sessions: [] });
    const result = await getRunDeliverySummary(db, "sess-missing");
    expect(result).toBeNull();
  });

  it("returns null for corrupted sessions with invalid pipeline_state", async () => {
    const db = createMockDb({
      ...baseState(),
      sessions: [{ pipeline_state: "not-a-canonical-state" }],
    });
    const result = await getRunDeliverySummary(db, "sess-corrupted");
    expect(result).toBeNull();
  });

  it("returns MISSING truth completeness when lineage and handoff are both absent", async () => {
    const db = createMockDb(baseState());
    const result = await getRunDeliverySummary(db, "sess-001");
    expect(result).not.toBeNull();
    expect(result!.current_attempt).toBeNull();
    expect(result!.handoff_status).toBe("NONE");
    expect(result!.truth_completeness).toBe("MISSING");
    expect(result!.next_action_code).toBeNull();
    expect(result!.loop_flag).toBe(false);
  });

  it("returns PARTIAL truth when lineage exists but handoff is missing", async () => {
    const db = createMockDb(
      baseState({
        lineage: [
          {
            run_id: "sess-001",
            artifact_id: "art-1",
            artifact_type: "ProblemBrief",
            stage: "problem_framing",
            attempt: 1,
            replacement_reason: null,
            is_repair_attempt: 0,
            created_at: "2026-01-01T00:00:00Z",
          },
        ],
      })
    );
    const result = await getRunDeliverySummary(db, "sess-001");
    expect(result).not.toBeNull();
    expect(result!.current_attempt).toBe(1);
    expect(result!.handoff_status).toBe("NONE");
    expect(result!.truth_completeness).toBe("PARTIAL");
    expect(result!.next_action_code).toBe("NO_ACTIONABLE_NEXT_STEP");
  });

  it("returns PARTIAL truth when handoff exists but lineage is missing", async () => {
    const db = createMockDb(
      baseState({
        handoffEvents: [
          {
            session_id: "sess-001",
            pipeline_state: "problem_framing",
            outcome: "COMPLETED",
            failure_reason: null,
            classified_at: "2026-01-01T01:00:00Z",
          },
        ],
      })
    );
    const result = await getRunDeliverySummary(db, "sess-001");
    expect(result).not.toBeNull();
    expect(result!.current_attempt).toBeNull();
    expect(result!.handoff_status).toBe("COMPLETED");
    expect(result!.truth_completeness).toBe("PARTIAL");
    expect(result!.next_action_code).toBe("HANDOFF_COMPLETED");
  });

  it("returns REPAIR_REQUIRED when attempt > 1", async () => {
    const db = createMockDb(
      baseState({
        lineage: [
          {
            run_id: "sess-001",
            artifact_id: "art-1",
            artifact_type: "ProblemBrief",
            stage: "problem_framing",
            attempt: 1,
            replacement_reason: null,
            is_repair_attempt: 0,
            created_at: "2026-01-01T00:00:00Z",
          },
          {
            run_id: "sess-001",
            artifact_id: "art-2",
            artifact_type: "ProblemBrief",
            stage: "problem_framing",
            attempt: 2,
            replacement_reason: "QUALITY_ISSUE",
            is_repair_attempt: 1,
            created_at: "2026-01-01T01:00:00Z",
          },
        ],
      })
    );
    const result = await getRunDeliverySummary(db, "sess-001");
    expect(result).not.toBeNull();
    expect(result!.next_action_code).toBe("REPAIR_REQUIRED");
    expect(result!.current_attempt).toBe(2);
    expect(result!.truth_completeness).toBe("PARTIAL");
  });

  it("returns LOOP_DETECTED when loop signal exists", async () => {
    const db = createMockDb(
      baseState({
        lineage: [
          {
            run_id: "sess-001",
            artifact_id: "art-1",
            artifact_type: "ProblemBrief",
            stage: "problem_framing",
            attempt: 1,
            replacement_reason: null,
            is_repair_attempt: 0,
            created_at: "2026-01-01T00:00:00Z",
          },
        ],
        loopSignals: [
          {
            session_id: "sess-001",
            pipeline_state: "problem_framing",
            entry_count: 2,
            loop_type: "SAME_STAGE_REPEAT",
            created_at: "2026-01-01T02:00:00Z",
          },
        ],
      })
    );
    const result = await getRunDeliverySummary(db, "sess-001");
    expect(result).not.toBeNull();
    expect(result!.loop_flag).toBe(true);
    expect(result!.truth_completeness).toBe("PARTIAL");
    expect(result!.next_action_code).toBe("LOOP_DETECTED");
  });

  it("returns HANDOFF_FAILED when latest handoff outcome is FAILED", async () => {
    const db = createMockDb(
      baseState({
        lineage: [
          {
            run_id: "sess-001",
            artifact_id: "art-1",
            artifact_type: "ProblemBrief",
            stage: "problem_framing",
            attempt: 1,
            replacement_reason: null,
            is_repair_attempt: 0,
            created_at: "2026-01-01T00:00:00Z",
          },
        ],
        handoffEvents: [
          {
            session_id: "sess-001",
            pipeline_state: "problem_framing",
            outcome: "FAILED",
            failure_reason: "SCHEMA_MISMATCH",
            classified_at: "2026-01-01T01:00:00Z",
          },
        ],
      })
    );
    const result = await getRunDeliverySummary(db, "sess-001");
    expect(result).not.toBeNull();
    expect(result!.handoff_status).toBe("FAILED");
    expect(result!.truth_completeness).toBe("FULL");
    expect(result!.next_action_code).toBe("HANDOFF_FAILED");
  });

  it("returns HANDOFF_COMPLETED when latest handoff outcome is COMPLETED", async () => {
    const db = createMockDb(
      baseState({
        lineage: [
          {
            run_id: "sess-001",
            artifact_id: "art-1",
            artifact_type: "ProblemBrief",
            stage: "problem_framing",
            attempt: 1,
            replacement_reason: null,
            is_repair_attempt: 0,
            created_at: "2026-01-01T00:00:00Z",
          },
        ],
        handoffEvents: [
          {
            session_id: "sess-001",
            pipeline_state: "problem_framing",
            outcome: "COMPLETED",
            failure_reason: null,
            classified_at: "2026-01-01T01:00:00Z",
          },
        ],
      })
    );
    const result = await getRunDeliverySummary(db, "sess-001");
    expect(result).not.toBeNull();
    expect(result!.handoff_status).toBe("COMPLETED");
    expect(result!.next_action_code).toBe("HANDOFF_COMPLETED");
  });

  it("does not surface caller-supplied handoff_status when no handoff_events exist", async () => {
    const db = createMockDb(
      baseState({
        lineage: [
          {
            run_id: "sess-001",
            artifact_id: "art-1",
            artifact_type: "ProblemBrief",
            stage: "problem_framing",
            attempt: 1,
            replacement_reason: null,
            is_repair_attempt: 0,
            created_at: "2026-01-01T00:00:00Z",
          },
        ],
        deliveryIntegrityEvents: [
          {
            session_id: "sess-001",
            handoff_status: "pending",
            classified_at: "2026-01-01T00:30:00Z",
          },
        ],
      })
    );
    const result = await getRunDeliverySummary(db, "sess-001");
    expect(result).not.toBeNull();
    expect(result!.handoff_status).toBe("NONE");
    expect(result!.truth_completeness).toBe("PARTIAL");
    expect(result!.next_action_code).toBe("NO_ACTIONABLE_NEXT_STEP");
  });

  it("marks corrupted handoff outcome as UNKNOWN instead of inferring truth", async () => {
    const db = createMockDb(
      baseState({
        lineage: [
          {
            run_id: "sess-001",
            artifact_id: "art-1",
            artifact_type: "ProblemBrief",
            stage: "problem_framing",
            attempt: 1,
            replacement_reason: null,
            is_repair_attempt: 0,
            created_at: "2026-01-01T00:00:00Z",
          },
        ],
        handoffEvents: [
          {
            session_id: "sess-001",
            pipeline_state: "problem_framing",
            outcome: "CORRUPTED_VALUE",
            failure_reason: null,
            classified_at: "2026-01-01T01:00:00Z",
          },
        ],
      })
    );
    const result = await getRunDeliverySummary(db, "sess-001");
    expect(result).not.toBeNull();
    expect(result!.handoff_status).toBe("UNKNOWN");
    expect(result!.truth_completeness).toBe("PARTIAL");
    expect(result!.next_action_code).toBe("UNKNOWN");
  });

  it("exposes all required output fields", async () => {
    const db = createMockDb(baseState());
    const result = await getRunDeliverySummary(db, "sess-001");
    expect(result).not.toBeNull();
    expect(result).toHaveProperty("session_id");
    expect(result).toHaveProperty("current_stage");
    expect(result).toHaveProperty("current_attempt");
    expect(result).toHaveProperty("handoff_status");
    expect(result).toHaveProperty("loop_flag");
    expect(result).toHaveProperty("next_action_code");
    expect(result).toHaveProperty("truth_completeness");
  });
});

// ---------- getRunDeliveryHistory ----------

describe("getRunDeliveryHistory", () => {
  it("returns null when session does not exist", async () => {
    const db = createMockDb({ ...baseState(), sessions: [] });
    const result = await getRunDeliveryHistory(db, "sess-missing");
    expect(result).toBeNull();
  });

  it("returns empty arrays when no history exists", async () => {
    const db = createMockDb(baseState());
    const result = await getRunDeliveryHistory(db, "sess-001");
    expect(result).not.toBeNull();
    expect(result!.lineage).toHaveLength(0);
    expect(result!.loop_signals).toHaveLength(0);
    expect(result!.handoff_outcomes).toHaveLength(0);
  });

  it("returns full lineage including repair attempts", async () => {
    const db = createMockDb(
      baseState({
        lineage: [
          {
            run_id: "sess-001",
            artifact_id: "art-1",
            artifact_type: "ProblemBrief",
            stage: "problem_framing",
            attempt: 1,
            replacement_reason: null,
            is_repair_attempt: 0,
            created_at: "2026-01-01T00:00:00Z",
          },
          {
            run_id: "sess-001",
            artifact_id: "art-2",
            artifact_type: "ProblemBrief",
            stage: "problem_framing",
            attempt: 2,
            replacement_reason: "REVIEW_BLOCK",
            is_repair_attempt: 1,
            created_at: "2026-01-01T01:00:00Z",
          },
        ],
        loopSignals: [
          {
            session_id: "sess-001",
            pipeline_state: "problem_framing",
            entry_count: 2,
            loop_type: "SAME_STAGE_REPEAT",
            created_at: "2026-01-01T02:00:00Z",
          },
        ],
        handoffEvents: [
          {
            session_id: "sess-001",
            pipeline_state: "problem_framing",
            outcome: "FAILED",
            failure_reason: "MISSING_FIELDS",
            classified_at: "2026-01-01T03:00:00Z",
          },
        ],
      })
    );
    const result = await getRunDeliveryHistory(db, "sess-001");
    expect(result).not.toBeNull();
    expect(result!.lineage).toHaveLength(2);
    expect(result!.lineage[1].is_repair_attempt).toBe(true);
    expect(result!.lineage[1].replacement_reason).toBe("REVIEW_BLOCK");
    expect(result!.loop_signals).toHaveLength(1);
    expect(result!.loop_signals[0].loop_type).toBe("SAME_STAGE_REPEAT");
    expect(result!.handoff_outcomes).toHaveLength(1);
    expect(result!.handoff_outcomes[0].outcome).toBe("FAILED");
    expect(result!.handoff_outcomes[0].failure_reason).toBe("MISSING_FIELDS");
  });
});

// ---------- getRunNextAction ----------

describe("getRunNextAction", () => {
  it("returns null when session does not exist", async () => {
    const db = createMockDb({ ...baseState(), sessions: [] });
    const result = await getRunNextAction(db, "sess-missing");
    expect(result).toBeNull();
  });

  it("returns session_id and next_action_code", async () => {
    const db = createMockDb(baseState());
    const result = await getRunNextAction(db, "sess-001");
    expect(result).not.toBeNull();
    expect(result!.session_id).toBe("sess-001");
    expect(result!.next_action_code).toBeNull();
  });

  it("delegates next_action_code derivation to getRunDeliverySummary", async () => {
    const db = createMockDb(
      baseState({
        loopSignals: [
          {
            session_id: "sess-001",
            pipeline_state: "problem_framing",
            entry_count: 2,
            loop_type: "SAME_STAGE_REPEAT",
            created_at: "2026-01-01T00:00:00Z",
          },
        ],
      })
    );
    const result = await getRunNextAction(db, "sess-001");
    expect(result!.next_action_code).toBe("LOOP_DETECTED");
  });
});
