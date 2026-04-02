import { describe, expect, it, vi } from "vitest";
import type { Env, Session, DeliveryIntegrityInput, HandoffFailureReason } from "../types/index.js";
import { REPLACEMENT_REASONS } from "../types/index.js";
import {
  appendDeliveryIntegrityEvent,
  recordArtifactAttempt,
  recordStageEntry,
  validateDeliveryInput,
} from "./delivery-integrity.js";

// ---------- Mock DB ----------

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

type PreparedResult = {
  bind: (...params: unknown[]) => {
    first: <T>() => Promise<T | null>;
    run: () => Promise<unknown>;
  };
};

function createMockDb(seed: LineageRow[] = []) {
  const rows: LineageRow[] = [...seed];

  const db = {
    prepare(sql: string): PreparedResult {
      return {
        bind(...params: unknown[]) {
          return {
            async first<T>() {
              if (sql.includes("FROM artifact_lineage") && sql.includes("ORDER BY attempt DESC")) {
                const [run_id, stage] = params as [string, string];
                const matching = rows
                  .filter((r) => r.run_id === run_id && r.stage === stage)
                  .sort((a, b) => b.attempt - a.attempt);
                return (matching[0] ?? null) as T;
              }
              return null;
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
              if (sql.includes("DELETE FROM artifact_lineage")) {
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

// ---------- Tests ----------

describe("recordArtifactAttempt", () => {
  // AC-DI-001: first attempt in stage
  it("assigns attempt=1 for the first artifact in a stage", async () => {
    const { db, rows } = createMockDb();

    const { record, events } = await recordArtifactAttempt(db, {
      run_id: "RUN_TEST_001",
      stage: "problem_framing",
      artifact_id: "ART_001",
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
      override_flag: false,
    });

    expect(record.attempt).toBe(1);
    expect(record.supersedes_artifact_id).toBeNull();
    expect(record.is_first_attempt_in_stage).toBe(true);
    expect(record.is_repair_attempt).toBe(false);
    expect(record.replacement_reason).toBeNull();
    expect(record.replacement_reason_source).toBeNull();
    expect(record.classified_by).toBe("orchestration");
    expect(rows).toHaveLength(1);
    expect(rows[0]?.attempt).toBe(1);
    expect(rows[0]?.is_first_attempt_in_stage).toBe(1);
    expect(rows[0]?.is_repair_attempt).toBe(0);
    // Source-of-truth boundary: replacement_reason must be null in the persisted row
    expect(rows[0]?.replacement_reason).toBeNull();

    // Events: only artifact_attempt_created, no artifact_superseded
    expect(events).toHaveLength(1);
    expect(events[0]?.type).toBe("artifact_attempt_created");
    const created = events[0] as Extract<(typeof events)[number], { type: "artifact_attempt_created" }>;
    expect(created.artifact_id).toBe("ART_001");
    expect(created.run_id).toBe("RUN_TEST_001");
    expect(created.stage).toBe("problem_framing");
    expect(created.attempt).toBe(1);
  });

  // AC-DI-002: second attempt — MISSING_REQUIRED_SECTION
  it("assigns attempt=2 with MISSING_REQUIRED_SECTION when required sections absent", async () => {
    const { db, rows } = createMockDb([
      {
        lineage_id: "LIN_001",
        run_id: "RUN_TEST_002",
        artifact_id: "ART_001",
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

    const { record, events } = await recordArtifactAttempt(db, {
      run_id: "RUN_TEST_002",
      stage: "problem_framing",
      artifact_id: "ART_002",
      artifact_type: "FramingAssessment",
      created_by_role: "AE-Framing",
      parser_verdict: {
        schema_valid: true,
        required_sections_present: false,
        stage_matches_expected: true,
        reentry_ready: false,
      },
      review_verdict: { status: "NOT_REQUIRED" },
      scope_fingerprint_changed: false,
      transition_context: {},
      override_flag: false,
    });

    expect(record.attempt).toBe(2);
    expect(record.supersedes_artifact_id).toBe("ART_001");
    expect(record.is_first_attempt_in_stage).toBe(false);
    expect(record.is_repair_attempt).toBe(true);
    expect(record.replacement_reason).toBe("MISSING_REQUIRED_SECTION");
    expect(record.replacement_reason_source).toBe("orchestration");
    expect(rows).toHaveLength(2);
    // Source-of-truth boundary: persisted row must carry the orchestration-classified reason
    expect(rows[1]?.replacement_reason).toBe("MISSING_REQUIRED_SECTION");
    expect(rows[1]?.replacement_reason_source).toBe("orchestration");
    expect(rows[1]?.is_repair_attempt).toBe(1);

    // Events: artifact_attempt_created AND artifact_superseded
    expect(events).toHaveLength(2);
    expect(events[0]?.type).toBe("artifact_attempt_created");
    expect(events[1]?.type).toBe("artifact_superseded");
    const superseded = events[1] as Extract<(typeof events)[number], { type: "artifact_superseded" }>;
    expect(superseded.supersedes_artifact_id).toBe("ART_001");
    expect(superseded.replacement_reason).toBe("MISSING_REQUIRED_SECTION");
    expect(superseded.artifact_id).toBe("ART_002");
  });

  // Precedence: INVALID_SCHEMA takes priority over MISSING_REQUIRED_SECTION
  it("classifies INVALID_SCHEMA before MISSING_REQUIRED_SECTION", async () => {
    const { db } = createMockDb([
      {
        lineage_id: "LIN_010",
        run_id: "RUN_PREC_001",
        artifact_id: "ART_010",
        artifact_type: "ClaimsDecision",
        stage: "claims_validation",
        attempt: 1,
        supersedes_artifact_id: null,
        created_at: "2026-01-01T00:00:00.000Z",
        created_by_role: "AE-Claims",
        classified_by: "orchestration",
        replacement_reason: null,
        replacement_reason_source: null,
        is_repair_attempt: 0,
        is_first_attempt_in_stage: 1,
        override_flag: 0,
      },
    ]);

    const { record } = await recordArtifactAttempt(db, {
      run_id: "RUN_PREC_001",
      stage: "claims_validation",
      artifact_id: "ART_011",
      artifact_type: "ClaimsDecision",
      created_by_role: "AE-Claims",
      parser_verdict: {
        schema_valid: false,
        required_sections_present: false,
        stage_matches_expected: false,
        reentry_ready: false,
      },
      review_verdict: { status: "REJECTED", blocking: true },
      scope_fingerprint_changed: true,
      transition_context: { handoff_rejected: true },
    });

    expect(record.replacement_reason).toBe("INVALID_SCHEMA");
  });

  // Precedence: STAGE_MISMATCH when schema ok, sections ok, but stage wrong
  it("classifies STAGE_MISMATCH when schema and sections pass but stage mismatches", async () => {
    const { db } = createMockDb([
      {
        lineage_id: "LIN_020",
        run_id: "RUN_PREC_002",
        artifact_id: "ART_020",
        artifact_type: "ArchitectureSpec",
        stage: "architecture_validation",
        attempt: 1,
        supersedes_artifact_id: null,
        created_at: "2026-01-01T00:00:00.000Z",
        created_by_role: "AE-Architecture",
        classified_by: "orchestration",
        replacement_reason: null,
        replacement_reason_source: null,
        is_repair_attempt: 0,
        is_first_attempt_in_stage: 1,
        override_flag: 0,
      },
    ]);

    const { record } = await recordArtifactAttempt(db, {
      run_id: "RUN_PREC_002",
      stage: "architecture_validation",
      artifact_id: "ART_021",
      artifact_type: "ArchitectureSpec",
      created_by_role: "AE-Architecture",
      parser_verdict: {
        schema_valid: true,
        required_sections_present: true,
        stage_matches_expected: false,
        reentry_ready: false,
      },
      review_verdict: { status: "NOT_REQUIRED" },
      scope_fingerprint_changed: false,
      transition_context: {},
    });

    expect(record.replacement_reason).toBe("STAGE_MISMATCH");
  });

  // Precedence: REVIEW_BLOCK when parser passes but review rejects
  it("classifies REVIEW_BLOCK when review status is REJECTED", async () => {
    const { db } = createMockDb([
      {
        lineage_id: "LIN_030",
        run_id: "RUN_PREC_003",
        artifact_id: "ART_030",
        artifact_type: "CommercialSpec",
        stage: "commercial_packaging",
        attempt: 1,
        supersedes_artifact_id: null,
        created_at: "2026-01-01T00:00:00.000Z",
        created_by_role: "AE-Commercial",
        classified_by: "orchestration",
        replacement_reason: null,
        replacement_reason_source: null,
        is_repair_attempt: 0,
        is_first_attempt_in_stage: 1,
        override_flag: 0,
      },
    ]);

    const { record } = await recordArtifactAttempt(db, {
      run_id: "RUN_PREC_003",
      stage: "commercial_packaging",
      artifact_id: "ART_031",
      artifact_type: "CommercialSpec",
      created_by_role: "AE-Commercial",
      parser_verdict: {
        schema_valid: true,
        required_sections_present: true,
        stage_matches_expected: true,
        reentry_ready: false,
      },
      review_verdict: { status: "REJECTED" },
      scope_fingerprint_changed: false,
      transition_context: {},
    });

    expect(record.replacement_reason).toBe("REVIEW_BLOCK");
  });

  // Precedence: REVIEW_BLOCK via blocking flag
  it("classifies REVIEW_BLOCK when review.blocking is true", async () => {
    const { db } = createMockDb([
      {
        lineage_id: "LIN_040",
        run_id: "RUN_PREC_004",
        artifact_id: "ART_040",
        artifact_type: "RiskDecision",
        stage: "risk_governance_validation",
        attempt: 1,
        supersedes_artifact_id: null,
        created_at: "2026-01-01T00:00:00.000Z",
        created_by_role: "AE-RiskGov",
        classified_by: "orchestration",
        replacement_reason: null,
        replacement_reason_source: null,
        is_repair_attempt: 0,
        is_first_attempt_in_stage: 1,
        override_flag: 0,
      },
    ]);

    const { record } = await recordArtifactAttempt(db, {
      run_id: "RUN_PREC_004",
      stage: "risk_governance_validation",
      artifact_id: "ART_041",
      artifact_type: "RiskDecision",
      created_by_role: "AE-RiskGov",
      parser_verdict: {
        schema_valid: true,
        required_sections_present: true,
        stage_matches_expected: true,
        reentry_ready: false,
      },
      review_verdict: { status: "PENDING", blocking: true },
      scope_fingerprint_changed: false,
      transition_context: {},
    });

    expect(record.replacement_reason).toBe("REVIEW_BLOCK");
  });

  // Precedence: HANDOFF_REJECTED from transition_context
  it("classifies HANDOFF_REJECTED when transition_context.handoff_rejected is true", async () => {
    const { db } = createMockDb([
      {
        lineage_id: "LIN_050",
        run_id: "RUN_PREC_005",
        artifact_id: "ART_050",
        artifact_type: "OfferDecision",
        stage: "primitive_selection",
        attempt: 1,
        supersedes_artifact_id: null,
        created_at: "2026-01-01T00:00:00.000Z",
        created_by_role: "AE-Primitive",
        classified_by: "orchestration",
        replacement_reason: null,
        replacement_reason_source: null,
        is_repair_attempt: 0,
        is_first_attempt_in_stage: 1,
        override_flag: 0,
      },
    ]);

    const { record } = await recordArtifactAttempt(db, {
      run_id: "RUN_PREC_005",
      stage: "primitive_selection",
      artifact_id: "ART_051",
      artifact_type: "OfferDecision",
      created_by_role: "AE-Primitive",
      parser_verdict: {
        schema_valid: true,
        required_sections_present: true,
        stage_matches_expected: true,
        reentry_ready: false,
      },
      review_verdict: { status: "NOT_REQUIRED" },
      scope_fingerprint_changed: false,
      transition_context: { handoff_rejected: true },
    });

    expect(record.replacement_reason).toBe("HANDOFF_REJECTED");
  });

  // Precedence: SCOPE_CHANGE when scope fingerprint changed and no prior failures
  it("classifies SCOPE_CHANGE when scope_fingerprint_changed is true and parser passes", async () => {
    const { db } = createMockDb([
      {
        lineage_id: "LIN_060",
        run_id: "RUN_PREC_006",
        artifact_id: "ART_060",
        artifact_type: "ProblemBrief",
        stage: "intake",
        attempt: 1,
        supersedes_artifact_id: null,
        created_at: "2026-01-01T00:00:00.000Z",
        created_by_role: "AE-Intake",
        classified_by: "orchestration",
        replacement_reason: null,
        replacement_reason_source: null,
        is_repair_attempt: 0,
        is_first_attempt_in_stage: 1,
        override_flag: 0,
      },
    ]);

    const { record } = await recordArtifactAttempt(db, {
      run_id: "RUN_PREC_006",
      stage: "intake",
      artifact_id: "ART_061",
      artifact_type: "ProblemBrief",
      created_by_role: "AE-Intake",
      parser_verdict: {
        schema_valid: true,
        required_sections_present: true,
        stage_matches_expected: true,
        reentry_ready: true,
      },
      review_verdict: { status: "NOT_REQUIRED" },
      scope_fingerprint_changed: true,
      transition_context: {},
    });

    expect(record.replacement_reason).toBe("SCOPE_CHANGE");
  });

  // Precedence: QUALITY_ISSUE as final fallback
  it("classifies QUALITY_ISSUE when no other signal applies", async () => {
    const { db } = createMockDb([
      {
        lineage_id: "LIN_070",
        run_id: "RUN_PREC_007",
        artifact_id: "ART_070",
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

    const { record } = await recordArtifactAttempt(db, {
      run_id: "RUN_PREC_007",
      stage: "problem_framing",
      artifact_id: "ART_071",
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

    expect(record.replacement_reason).toBe("QUALITY_ISSUE");
    expect(record.replacement_reason_source).toBe("orchestration");
  });

  // Deterministic attempt numbering across multiple submissions
  it("increments attempt numbers deterministically across three submissions", async () => {
    const { db, rows } = createMockDb();
    const base = {
      run_id: "RUN_MULTI",
      stage: "problem_framing",
      artifact_type: "FramingAssessment",
      created_by_role: "AE-Framing",
      parser_verdict: {
        schema_valid: true,
        required_sections_present: true,
        stage_matches_expected: true,
        reentry_ready: true,
      },
      review_verdict: { status: "NOT_REQUIRED" as const },
      scope_fingerprint_changed: false,
      transition_context: {},
    };

    const first = await recordArtifactAttempt(db, { ...base, artifact_id: "ART_A1" });
    const second = await recordArtifactAttempt(db, { ...base, artifact_id: "ART_A2" });
    const third = await recordArtifactAttempt(db, { ...base, artifact_id: "ART_A3" });

    expect(first.record.attempt).toBe(1);
    expect(second.record.attempt).toBe(2);
    expect(third.record.attempt).toBe(3);

    expect(first.record.is_first_attempt_in_stage).toBe(true);
    expect(second.record.is_first_attempt_in_stage).toBe(false);
    expect(third.record.is_first_attempt_in_stage).toBe(false);

    expect(second.record.supersedes_artifact_id).toBe("ART_A1");
    expect(third.record.supersedes_artifact_id).toBe("ART_A2");

    expect(rows).toHaveLength(3);
  });

  // Stages are isolated — attempts in one stage do not affect another
  it("tracks attempts independently per stage", async () => {
    const { db } = createMockDb();

    const r1 = await recordArtifactAttempt(db, {
      run_id: "RUN_ISO",
      stage: "problem_framing",
      artifact_id: "ART_ISO_1",
      artifact_type: "FramingAssessment",
      created_by_role: "AE-Framing",
      parser_verdict: { schema_valid: true, required_sections_present: true, stage_matches_expected: true, reentry_ready: true },
      review_verdict: { status: "NOT_REQUIRED" },
    });

    const r2 = await recordArtifactAttempt(db, {
      run_id: "RUN_ISO",
      stage: "claims_validation",
      artifact_id: "ART_ISO_2",
      artifact_type: "ClaimsDecision",
      created_by_role: "AE-Claims",
      parser_verdict: { schema_valid: true, required_sections_present: true, stage_matches_expected: true, reentry_ready: true },
      review_verdict: { status: "NOT_REQUIRED" },
    });

    expect(r1.record.attempt).toBe(1);
    expect(r2.record.attempt).toBe(1);
    expect(r1.record.supersedes_artifact_id).toBeNull();
    expect(r2.record.supersedes_artifact_id).toBeNull();
  });

  // Runs are isolated — same stage in different runs don't share attempt numbers
  it("tracks attempts independently per run_id", async () => {
    const { db } = createMockDb([
      {
        lineage_id: "LIN_RUN_A",
        run_id: "RUN_A",
        artifact_id: "ART_RUN_A_1",
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

    const result = await recordArtifactAttempt(db, {
      run_id: "RUN_B",
      stage: "problem_framing",
      artifact_id: "ART_RUN_B_1",
      artifact_type: "FramingAssessment",
      created_by_role: "AE-Framing",
      parser_verdict: { schema_valid: true, required_sections_present: true, stage_matches_expected: true, reentry_ready: true },
      review_verdict: { status: "NOT_REQUIRED" },
    });

    expect(result.record.attempt).toBe(1);
    expect(result.record.supersedes_artifact_id).toBeNull();
  });
});

// ---------- recordStageEntry ----------

type StageEntryRow = {
  entry_id: string;
  session_id: string;
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

function createStageEntryMockDb(seedEntries: StageEntryRow[] = []) {
  const entryRows: StageEntryRow[] = [...seedEntries];
  const loopRows: LoopSignalRow[] = [];

  const db = {
    prepare(sql: string) {
      return {
        bind(...params: unknown[]) {
          return {
            async first<T>() {
              if (sql.includes("COUNT(*)") && sql.includes("FROM stage_entries")) {
                const [session_id, pipeline_state] = params as [string, string];
                const cnt = entryRows.filter(
                  (r) => r.session_id === session_id && r.pipeline_state === pipeline_state
                ).length;
                return { cnt } as T;
              }
              return null;
            },
            async run() {
              if (sql.includes("INSERT INTO stage_entries")) {
                const [entry_id, session_id, pipeline_state, entry_count, classified_by, classified_at] =
                  params as [string, string, string, number, string, string];
                entryRows.push({ entry_id, session_id, pipeline_state, entry_count, classified_by, classified_at });
              }
              if (sql.includes("INSERT INTO stage_loop_signals")) {
                const [loop_signal_id, session_id, pipeline_state, entry_count, loop_type, classified_by, classified_at] =
                  params as [string, string, string, number, string, string, string];
                loopRows.push({ loop_signal_id, session_id, pipeline_state, entry_count, loop_type, classified_by, classified_at });
              }
              if (sql.includes("DELETE FROM stage_entries")) {
                const [entry_id] = params as [string];
                const idx = entryRows.findIndex((r) => r.entry_id === entry_id);
                if (idx !== -1) entryRows.splice(idx, 1);
              }
              if (sql.includes("DELETE FROM stage_loop_signals")) {
                const [loop_signal_id] = params as [string];
                const idx = loopRows.findIndex((r) => r.loop_signal_id === loop_signal_id);
                if (idx !== -1) loopRows.splice(idx, 1);
              }
              return { success: true };
            },
          };
        },
      };
    },
  };

  return { db: db as unknown as Env["DECISIONS_DB"], entryRows, loopRows };
}

function makeSession(overrides?: Partial<Session>): Session {
  return {
    session_id: "sess-001",
    requestor_type: "founder-led",
    pipeline_state: "problem_framing",
    decision_status: "proceed",
    veto_active: false,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("recordStageEntry", () => {
  // AC-DI-005 (first half): first entry in a stage creates entry record without loop signal
  it("creates a stage entry with entry_count=1 and no loop signal on first entry", async () => {
    const { db, entryRows, loopRows } = createStageEntryMockDb();
    const session = makeSession();

    const { entry, loop_signal } = await recordStageEntry(db, session, { entered_by: "orchestration" });

    expect(entry.entry_id).toBeTruthy();
    expect(entry.session_id).toBe("sess-001");
    expect(entry.pipeline_state).toBe("problem_framing");
    expect(entry.entry_count).toBe(1);
    expect(entry.classified_by).toBe("orchestration");
    expect(entry.classified_at).toBeTruthy();

    expect(loop_signal).toBeNull();
    expect(entryRows).toHaveLength(1);
    expect(loopRows).toHaveLength(0);
  });

  // AC-DI-005: same stage entered twice emits SAME_STAGE_REPEAT loop signal
  it("emits SAME_STAGE_REPEAT loop signal on second entry to the same stage", async () => {
    const { db, entryRows, loopRows } = createStageEntryMockDb([
      {
        entry_id: "ENT_001",
        session_id: "sess-001",
        pipeline_state: "problem_framing",
        entry_count: 1,
        classified_by: "orchestration",
        classified_at: "2026-01-01T00:00:00.000Z",
      },
    ]);
    const session = makeSession();

    const { entry, loop_signal } = await recordStageEntry(db, session, { entered_by: "orchestration" });

    expect(entry.entry_count).toBe(2);
    expect(loop_signal).not.toBeNull();
    expect(loop_signal?.loop_type).toBe("SAME_STAGE_REPEAT");
    expect(loop_signal?.entry_count).toBe(2);
    expect(loop_signal?.session_id).toBe("sess-001");
    expect(loop_signal?.pipeline_state).toBe("problem_framing");
    expect(loop_signal?.classified_by).toBe("orchestration");
    expect(loop_signal?.loop_signal_id).toBeTruthy();

    expect(entryRows).toHaveLength(2);
    expect(loopRows).toHaveLength(1);
    expect(loopRows[0]?.loop_type).toBe("SAME_STAGE_REPEAT");
    expect(loopRows[0]?.entry_count).toBe(2);
  });

  // Third entry also produces a loop signal with correct entry_count
  it("increments entry_count and emits loop signal on third entry", async () => {
    const { db, loopRows } = createStageEntryMockDb([
      {
        entry_id: "ENT_001",
        session_id: "sess-001",
        pipeline_state: "problem_framing",
        entry_count: 1,
        classified_by: "orchestration",
        classified_at: "2026-01-01T00:00:00.000Z",
      },
      {
        entry_id: "ENT_002",
        session_id: "sess-001",
        pipeline_state: "problem_framing",
        entry_count: 2,
        classified_by: "orchestration",
        classified_at: "2026-01-01T00:01:00.000Z",
      },
    ]);
    const session = makeSession();

    const { entry, loop_signal } = await recordStageEntry(db, session, { entered_by: "orchestration" });

    expect(entry.entry_count).toBe(3);
    expect(loop_signal?.entry_count).toBe(3);
    expect(loopRows).toHaveLength(1);
    expect(loopRows[0]?.entry_count).toBe(3);
  });

  // Stage entries are isolated per session
  it("counts entries independently per session", async () => {
    const { db, entryRows, loopRows } = createStageEntryMockDb([
      {
        entry_id: "ENT_OTHER",
        session_id: "sess-other",
        pipeline_state: "problem_framing",
        entry_count: 1,
        classified_by: "orchestration",
        classified_at: "2026-01-01T00:00:00.000Z",
      },
    ]);
    const session = makeSession({ session_id: "sess-001" });

    const { entry, loop_signal } = await recordStageEntry(db, session, { entered_by: "orchestration" });

    expect(entry.entry_count).toBe(1);
    expect(loop_signal).toBeNull();
    expect(loopRows).toHaveLength(0);
    // Only the new entry was added for sess-001
    expect(entryRows.filter((r) => r.session_id === "sess-001")).toHaveLength(1);
  });

  // Stage entries are isolated per pipeline_state
  it("counts entries independently per pipeline_state", async () => {
    const { db, loopRows } = createStageEntryMockDb([
      {
        entry_id: "ENT_OTHER_STAGE",
        session_id: "sess-001",
        pipeline_state: "claims_validation",
        entry_count: 1,
        classified_by: "orchestration",
        classified_at: "2026-01-01T00:00:00.000Z",
      },
    ]);
    const session = makeSession({ pipeline_state: "problem_framing" });

    const { entry, loop_signal } = await recordStageEntry(db, session, { entered_by: "orchestration" });

    expect(entry.entry_count).toBe(1);
    expect(loop_signal).toBeNull();
    expect(loopRows).toHaveLength(0);
  });

  // Each call generates a unique entry_id
  it("generates unique entry_ids per call", async () => {
    const { db } = createStageEntryMockDb();
    const session = makeSession();

    const r1 = await recordStageEntry(db, session, { entered_by: "orchestration" });
    const r2 = await recordStageEntry(db, session, { entered_by: "orchestration" });

    expect(r1.entry.entry_id).not.toBe(r2.entry.entry_id);
  });

  // AC-DI-005 rollback guard: emit-failure removes both stage entry and loop signal
  it("rolls back both stage entry and loop signal when emit fails — loop truth does not persist silently (AC-DI-005 rollback guard)", async () => {
    const { db, entryRows, loopRows } = createStageEntryMockDb([
      {
        entry_id: "ENT_RB_001",
        session_id: "sess-001",
        pipeline_state: "problem_framing",
        entry_count: 1,
        classified_by: "orchestration",
        classified_at: "2026-01-01T00:00:00.000Z",
      },
    ]);
    const session = makeSession();

    const consoleSpy = vi.spyOn(console, "log").mockImplementationOnce(() => {
      throw new Error("simulated emit failure");
    });

    try {
      await expect(
        recordStageEntry(db, session, { entered_by: "orchestration" })
      ).rejects.toThrow("stage entry event emission failed after rollback");

      // Source-of-truth rollback guard: only the seeded entry remains; the loop signal was never persisted
      expect(entryRows.filter((r) => r.session_id === "sess-001")).toHaveLength(1);
      expect(loopRows).toHaveLength(0);
    } finally {
      consoleSpy.mockRestore();
    }
  });
});

// ---------- validateDeliveryInput ----------
// Anchors for AC-DI-003 (reject superseding write without reason)
// and AC-DI-006 (unknown reason threshold alert — validation boundary)

describe("validateDeliveryInput", () => {
  it("returns null for null input", () => {
    expect(validateDeliveryInput(null)).toBeNull();
  });

  it("returns null for undefined input", () => {
    expect(validateDeliveryInput(undefined)).toBeNull();
  });

  it("returns null for empty object input", () => {
    expect(validateDeliveryInput({})).toBeNull();
  });

  // AC-DI-003: orchestration owns replacement_reason — callers must be rejected
  it("rejects caller-supplied replacement_reason (AC-DI-003)", () => {
    const result = validateDeliveryInput(
      { replacement_reason: "QUALITY_ISSUE" } as unknown as DeliveryIntegrityInput
    );
    expect(result).toMatch(/replacement_reason.*orchestration/);
  });

  it("rejects non-null replacement_reason regardless of value (AC-DI-003)", () => {
    const result = validateDeliveryInput(
      { replacement_reason: "INVALID_SCHEMA" } as unknown as DeliveryIntegrityInput
    );
    expect(result).not.toBeNull();
  });

  it("rejects attempt < 1", () => {
    const result = validateDeliveryInput({ attempt: 0 });
    expect(result).toMatch(/attempt.*integer.*1/i);
  });

  it("rejects attempt > 1 without supersedes_artifact_id", () => {
    const result = validateDeliveryInput({ attempt: 2 });
    expect(result).toMatch(/supersedes_artifact_id.*required/i);
  });

  it("rejects handoff_status=failed without handoff_failure_reason", () => {
    const result = validateDeliveryInput({ handoff_status: "failed" });
    expect(result).toMatch(/handoff_failure_reason.*required/i);
  });

  // AC-DI-006: unknown/unrecognized handoff_failure_reason must be rejected at input boundary
  it("rejects unrecognized handoff_failure_reason (AC-DI-006)", () => {
    const result = validateDeliveryInput({
      handoff_status: "failed",
      handoff_failure_reason: "TOTALLY_UNKNOWN_REASON" as HandoffFailureReason,
    });
    expect(result).toBe("handoff_failure_reason is not recognized");
  });

  it("accepts valid failed handoff with recognized reason", () => {
    const result = validateDeliveryInput({
      attempt: 2,
      supersedes_artifact_id: "ART_PREV",
      handoff_status: "failed",
      handoff_failure_reason: "REENTRY_NOT_READY",
    });
    expect(result).toBeNull();
  });

  it("accepts valid first-attempt input", () => {
    const result = validateDeliveryInput({ attempt: 1, handoff_status: "pending" });
    expect(result).toBeNull();
  });

  // AC-DI-006: enum boundary — REPLACEMENT_REASONS canonical set must not contain UNKNOWN
  it("REPLACEMENT_REASONS canonical set does not include UNKNOWN (AC-DI-006 enum boundary)", () => {
    expect(REPLACEMENT_REASONS).not.toContain("UNKNOWN");
    expect(REPLACEMENT_REASONS).toHaveLength(7);
  });
});

// ---------- appendDeliveryIntegrityEvent ----------
// Code-level anchors for AC-DI-003 (replacement_reason caller rejection + rollback)
// and AC-DI-006 (unknown reason rejection + rollback)

type DeliveryIntegrityEventRow = {
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

function createDeliveryEventMockDb(
  priorSessions: Array<{ session_id: string; pipeline_state: string }> = []
) {
  const eventRows: DeliveryIntegrityEventRow[] = [];

  const db = {
    prepare(sql: string) {
      return {
        bind(...params: unknown[]) {
          return {
            async first<T>() {
              if (sql.includes("FROM delivery_integrity_events")) {
                const [session_id, pipeline_state] = params as [string, string];
                const hasPrior =
                  priorSessions.some(
                    (p) => p.session_id === session_id && p.pipeline_state === pipeline_state
                  ) ||
                  eventRows.some(
                    (r) => r.session_id === session_id && r.pipeline_state === pipeline_state
                  );
                return (hasPrior ? { has_prior: 1 } : null) as T;
              }
              return null as T;
            },
            async run() {
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
                eventRows.push({
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
              if (sql.includes("DELETE FROM delivery_integrity_events")) {
                const [event_id] = params as [string];
                const idx = eventRows.findIndex((r) => r.event_id === event_id);
                if (idx !== -1) eventRows.splice(idx, 1);
              }
              return { success: true };
            },
          };
        },
      };
    },
  };

  return { db: db as unknown as Env["DECISIONS_DB"], eventRows };
}

describe("appendDeliveryIntegrityEvent", () => {
  it("persists first-attempt event with stage_loop_detected=false", async () => {
    const { db, eventRows } = createDeliveryEventMockDb();
    const session = makeSession();

    const record = await appendDeliveryIntegrityEvent(db, session, "ART_DIE_001", {
      attempt: 1,
      handoff_status: "pending",
    });

    expect(record.event_id).toBeTruthy();
    expect(record.artifact_id).toBe("ART_DIE_001");
    expect(record.session_id).toBe("sess-001");
    expect(record.pipeline_state).toBe("problem_framing");
    expect(record.attempt).toBe(1);
    expect(record.stage_loop_detected).toBe(false);
    expect(record.classified_by).toBe("orchestration");
    // replacement_reason is always null in delivery_integrity_events (orchestration-owned in artifact_lineage)
    expect(record.replacement_reason).toBeNull();

    expect(eventRows).toHaveLength(1);
    expect(eventRows[0]?.stage_loop_detected).toBe(0);
  });

  it("sets stage_loop_detected=true on repeated entry to the same stage", async () => {
    const { db, eventRows } = createDeliveryEventMockDb([
      { session_id: "sess-001", pipeline_state: "problem_framing" },
    ]);
    const session = makeSession();

    const record = await appendDeliveryIntegrityEvent(db, session, "ART_DIE_002", {
      attempt: 2,
      supersedes_artifact_id: "ART_DIE_001",
      handoff_status: "pending",
    });

    expect(record.stage_loop_detected).toBe(true);
    expect(eventRows).toHaveLength(1);
    expect(eventRows[0]?.stage_loop_detected).toBe(1);
  });

  // AC-DI-003: caller-supplied replacement_reason must throw before persisting
  it("throws and does not persist when caller supplies replacement_reason (AC-DI-003)", async () => {
    const { db, eventRows } = createDeliveryEventMockDb();
    const session = makeSession();

    await expect(
      appendDeliveryIntegrityEvent(
        db,
        session,
        "ART_DIE_003",
        { replacement_reason: "QUALITY_ISSUE" } as unknown as DeliveryIntegrityInput
      )
    ).rejects.toThrow(/replacement_reason.*orchestration/);

    // Invariant: no row was persisted after rejection
    expect(eventRows).toHaveLength(0);
  });

  // AC-DI-006: unrecognized handoff_failure_reason must throw before persisting
  it("throws and does not persist when handoff_failure_reason is unrecognized (AC-DI-006)", async () => {
    const { db, eventRows } = createDeliveryEventMockDb();
    const session = makeSession();

    await expect(
      appendDeliveryIntegrityEvent(db, session, "ART_DIE_004", {
        handoff_status: "failed",
        handoff_failure_reason: "COMPLETELY_MADE_UP" as HandoffFailureReason,
      })
    ).rejects.toThrow("handoff_failure_reason is not recognized");

    expect(eventRows).toHaveLength(0);
  });

  it("always persists null replacement_reason (orchestration owns this field in artifact_lineage)", async () => {
    const { db, eventRows } = createDeliveryEventMockDb();
    const session = makeSession();

    await appendDeliveryIntegrityEvent(db, session, "ART_DIE_005", {
      attempt: 2,
      supersedes_artifact_id: "ART_DIE_PREV",
      handoff_status: "completed",
    });

    expect(eventRows[0]?.replacement_reason).toBeNull();
  });
});

// ---------- recordArtifactAttempt — source-of-truth invariants (AC-DI-003) ----------
// Verifies the application-layer guarantee: repair attempts can never silently persist
// without an orchestration-classified replacement_reason.

describe("recordArtifactAttempt — source-of-truth invariants (AC-DI-003)", () => {
  it("repair attempt always produces a non-null replacement_reason (AC-DI-003 invariant)", async () => {
    const { db, rows } = createMockDb([
      {
        lineage_id: "LIN_INV_001",
        run_id: "RUN_INV",
        artifact_id: "ART_INV_1",
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

    // All-OK parser verdict triggers QUALITY_ISSUE as the fallback classification
    const { record } = await recordArtifactAttempt(db, {
      run_id: "RUN_INV",
      stage: "problem_framing",
      artifact_id: "ART_INV_2",
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

    expect(record.is_repair_attempt).toBe(true);
    // Source-of-truth invariant: repair attempts MUST have a classified reason — never null
    expect(record.replacement_reason).not.toBeNull();
    expect(record.replacement_reason_source).toBe("orchestration");
    // DB-row-level guard: the persisted row must also carry the non-null reason
    expect(rows[1]?.replacement_reason).not.toBeNull();
    expect(rows[1]?.replacement_reason_source).toBe("orchestration");
    expect(rows[1]?.is_repair_attempt).toBe(1);
  });
});

// ---------- recordArtifactAttempt — rollback guard (AC-DI-003) ----------
// Verifies that a repair attempt row is deleted when event emission fails,
// preventing silent persistence without an orchestration-classified reason.

describe("recordArtifactAttempt — rollback guard (AC-DI-003)", () => {
  it("rolls back the persisted lineage row when event emission fails — repair attempt does not persist silently", async () => {
    const { db, rows } = createMockDb([
      {
        lineage_id: "LIN_RB_001",
        run_id: "RUN_RB",
        artifact_id: "ART_RB_1",
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

    const consoleSpy = vi.spyOn(console, "log").mockImplementationOnce(() => {
      throw new Error("simulated emit failure");
    });

    try {
      await expect(
        recordArtifactAttempt(db, {
          run_id: "RUN_RB",
          stage: "problem_framing",
          artifact_id: "ART_RB_2",
          artifact_type: "FramingAssessment",
          created_by_role: "AE-Framing",
          parser_verdict: {
            schema_valid: true,
            required_sections_present: false,
            stage_matches_expected: true,
            reentry_ready: false,
          },
          review_verdict: { status: "NOT_REQUIRED" },
          scope_fingerprint_changed: false,
          transition_context: {},
        })
      ).rejects.toThrow("artifact attempt event emission failed after rollback");

      // Source-of-truth rollback guard: only the seeded row must remain — the repair attempt was deleted
      expect(rows).toHaveLength(1);
      expect(rows[0]?.artifact_id).toBe("ART_RB_1");
    } finally {
      consoleSpy.mockRestore();
    }
  });
});
