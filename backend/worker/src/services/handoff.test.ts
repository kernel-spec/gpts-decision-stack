import { describe, expect, it } from "vitest";
import type { Env, HandoffOutcomeInput, Session } from "../types/index.js";
import { classifyHandoffOutcome, recordHandoffOutcome } from "./handoff.js";

// ---------- Helpers ----------

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

function allOkInput(): HandoffOutcomeInput {
  return {
    parser_verdict_ok: true,
    review_verdict_ok: true,
    legal_transition_ok: true,
    reentry_ready: true,
    owner_resolved: true,
    schema_valid: true,
    fields_present: true,
  };
}

type HandoffEventRow = {
  event_id: string;
  session_id: string;
  pipeline_state: string;
  outcome: string;
  failure_reason: string | null;
  classified_by: string;
  classified_at: string;
};

function createMockDb() {
  const handoffEvents: HandoffEventRow[] = [];

  const db = {
    prepare(sql: string) {
      return {
        bind(...params: unknown[]) {
          return {
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
                ] = params as [
                  string,
                  string,
                  string,
                  string,
                  string | null,
                  string,
                  string,
                ];
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
  };
}

// ---------- classifyHandoffOutcome ----------

describe("classifyHandoffOutcome", () => {
  it("returns COMPLETED when all inputs are ok", () => {
    const result = classifyHandoffOutcome(allOkInput());
    expect(result).toEqual({ outcome: "COMPLETED", failure_reason: null });
  });

  it("returns SCHEMA_MISMATCH (precedence 1) when schema_valid=false even if others fail too", () => {
    const result = classifyHandoffOutcome({ ...allOkInput(), schema_valid: false, fields_present: false });
    expect(result).toEqual({ outcome: "FAILED", failure_reason: "SCHEMA_MISMATCH" });
  });

  it("returns MISSING_FIELDS (precedence 2) when schema ok but fields missing", () => {
    const result = classifyHandoffOutcome({ ...allOkInput(), fields_present: false, owner_resolved: false });
    expect(result).toEqual({ outcome: "FAILED", failure_reason: "MISSING_FIELDS" });
  });

  it("returns AMBIGUOUS_OWNER (precedence 3) when owner not resolved", () => {
    const result = classifyHandoffOutcome({ ...allOkInput(), owner_resolved: false, review_verdict_ok: false });
    expect(result).toEqual({ outcome: "FAILED", failure_reason: "AMBIGUOUS_OWNER" });
  });

  it("returns REVIEW_REJECTED (precedence 4) when review verdict fails", () => {
    const result = classifyHandoffOutcome({ ...allOkInput(), review_verdict_ok: false, reentry_ready: false });
    expect(result).toEqual({ outcome: "FAILED", failure_reason: "REVIEW_REJECTED" });
  });

  it("returns REENTRY_NOT_READY (precedence 5) when reentry not ready", () => {
    const result = classifyHandoffOutcome({ ...allOkInput(), reentry_ready: false, parser_verdict_ok: false });
    expect(result).toEqual({ outcome: "FAILED", failure_reason: "REENTRY_NOT_READY" });
  });

  it("returns INVALID_INPUT (precedence 6) when parser verdict fails", () => {
    const result = classifyHandoffOutcome({ ...allOkInput(), parser_verdict_ok: false });
    expect(result).toEqual({ outcome: "FAILED", failure_reason: "INVALID_INPUT" });
  });

  it("returns INVALID_INPUT (precedence 6) when legal transition fails", () => {
    const result = classifyHandoffOutcome({ ...allOkInput(), legal_transition_ok: false });
    expect(result).toEqual({ outcome: "FAILED", failure_reason: "INVALID_INPUT" });
  });
});

// ---------- recordHandoffOutcome ----------

describe("recordHandoffOutcome", () => {
  it("persists a COMPLETED event and returns the record", async () => {
    const { db, handoffEvents } = createMockDb();
    const session = makeSession();

    const record = await recordHandoffOutcome(db, session, allOkInput());

    expect(record.outcome).toBe("COMPLETED");
    expect(record.failure_reason).toBeNull();
    expect(record.session_id).toBe("sess-001");
    expect(record.pipeline_state).toBe("problem_framing");
    expect(record.classified_by).toBe("orchestration");
    expect(record.event_id).toBeTruthy();
    expect(record.classified_at).toBeTruthy();

    expect(handoffEvents).toHaveLength(1);
    expect(handoffEvents[0]).toMatchObject({
      session_id: "sess-001",
      pipeline_state: "problem_framing",
      outcome: "COMPLETED",
      failure_reason: null,
      classified_by: "orchestration",
    });
  });

  it("persists a FAILED event with failure_reason and returns the record", async () => {
    const { db, handoffEvents } = createMockDb();
    const session = makeSession();

    const record = await recordHandoffOutcome(db, session, {
      ...allOkInput(),
      schema_valid: false,
    });

    expect(record.outcome).toBe("FAILED");
    expect(record.failure_reason).toBe("SCHEMA_MISMATCH");

    expect(handoffEvents).toHaveLength(1);
    expect(handoffEvents[0]).toMatchObject({
      outcome: "FAILED",
      failure_reason: "SCHEMA_MISMATCH",
    });
  });

  it("applies correct precedence when multiple conditions fail", async () => {
    const { db } = createMockDb();
    const session = makeSession();

    // schema_valid=false, review_verdict_ok=false, reentry_ready=false
    // SCHEMA_MISMATCH wins (precedence 1)
    const record = await recordHandoffOutcome(db, session, {
      ...allOkInput(),
      schema_valid: false,
      review_verdict_ok: false,
      reentry_ready: false,
    });

    expect(record.failure_reason).toBe("SCHEMA_MISMATCH");
  });

  it("generates unique event_ids per call", async () => {
    const { db } = createMockDb();
    const session = makeSession();

    const r1 = await recordHandoffOutcome(db, session, allOkInput());
    const r2 = await recordHandoffOutcome(db, session, allOkInput());

    expect(r1.event_id).not.toBe(r2.event_id);
  });
});
