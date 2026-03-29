import { describe, expect, it } from "vitest";
import type { Env } from "../types/index.js";
import { recordArtifactAttempt } from "./delivery-integrity.js";

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
