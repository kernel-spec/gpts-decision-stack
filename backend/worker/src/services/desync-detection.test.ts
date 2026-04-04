/**
 * Tests for desync-detection.ts
 *
 * Verifies that detectDesyncedSessions correctly identifies the three
 * inconsistency patterns:
 *   1. COMPLETED_HANDOFF_WITHOUT_STAGE_ENTRY
 *   2. STATE_ADVANCED_WITHOUT_STAGE_ENTRY
 *   3. TRANSITION_LINEAGE_WITHOUT_HANDOFF
 *
 * Also verifies that healthy sessions are NOT flagged.
 */

import { describe, expect, it } from "vitest";
import type { Env } from "../types/index.js";
import { detectDesyncedSessions } from "./desync-detection.js";

// ─── Mock DB builder ──────────────────────────────────────────────────────────

type HandoffEventRow = {
  session_id: string;
  lifecycle_id: string | null;
  pipeline_state: string;
  outcome: string;
};

type StageEntryRow = {
  session_id: string;
  lifecycle_id: string | null;
  pipeline_state: string;
};

type SessionRow = {
  session_id: string;
  pipeline_state: string;
};

type LineageRow = {
  run_id: string;
  lifecycle_id: string | null;
  stage: string;
  artifact_type: string;
};

type MockDbState = {
  sessions: SessionRow[];
  handoffEvents: HandoffEventRow[];
  stageEntries: StageEntryRow[];
  lineage: LineageRow[];
};

function createMockDb(state: MockDbState): Env["DECISIONS_DB"] {
  const db = {
    prepare(sql: string) {
      const allHandler = async function allFn<T>() {
        // Pattern 1: COMPLETED handoffs with lifecycle_id that have no matching stage_entry
        if (
          sql.includes("FROM handoff_events") &&
          sql.includes("he.outcome = 'COMPLETED'") &&
          sql.includes("he.lifecycle_id IS NOT NULL")
        ) {
          const rows = state.handoffEvents
            .filter((he) => he.outcome === "COMPLETED" && he.lifecycle_id !== null)
            .filter(
              (he) =>
                !state.stageEntries.some((se) => se.lifecycle_id === he.lifecycle_id)
            )
            .map((he) => ({
              session_id: he.session_id,
              lifecycle_id: he.lifecycle_id,
              pipeline_state: he.pipeline_state,
            }));
          return { results: rows as T[] };
        }

        // Pattern 2: Sessions in non-intake stage with no matching stage_entry
        if (
          sql.includes("FROM sessions s") &&
          sql.includes("s.pipeline_state != 'intake'")
        ) {
          const rows = state.sessions
            .filter((s) => s.pipeline_state !== "intake")
            .filter(
              (s) =>
                !state.stageEntries.some(
                  (se) =>
                    se.session_id === s.session_id &&
                    se.pipeline_state === s.pipeline_state
                )
            )
            .map((s) => ({
              session_id: s.session_id,
              pipeline_state: s.pipeline_state,
            }));
          return { results: rows as T[] };
        }

        // Pattern 3: Transition lineage with lifecycle_id but no handoff_events
        if (
          sql.includes("FROM artifact_lineage al") &&
          sql.includes("al.lifecycle_id IS NOT NULL")
        ) {
          const rows = state.lineage
            .filter(
              (al) =>
                al.lifecycle_id !== null &&
                (al.artifact_type === "ProblemBrief" ||
                  al.artifact_type === "StateDecisionPacket")
            )
            .filter(
              (al) =>
                !state.handoffEvents.some((he) => he.lifecycle_id === al.lifecycle_id)
            )
            .map((al) => ({
              session_id: al.run_id,
              lifecycle_id: al.lifecycle_id,
              stage: al.stage,
              artifact_type: al.artifact_type,
            }));
          return { results: rows as T[] };
        }

        return { results: [] as T[] };
      };

      return {
        // Support .all() called directly on the prepared statement (no-param queries)
        all: allHandler,
        // Support .bind().all() for compatibility
        bind() {
          return { all: allHandler };
        },
      };
    },
  } as unknown as Env["DECISIONS_DB"];

  return db;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("detectDesyncedSessions — empty database", () => {
  it("returns an empty report when no sessions exist", async () => {
    const db = createMockDb({ sessions: [], handoffEvents: [], stageEntries: [], lineage: [] });
    const report = await detectDesyncedSessions(db);
    expect(report.total_desynced).toBe(0);
    expect(report.sessions).toHaveLength(0);
  });
});

describe("detectDesyncedSessions — healthy session", () => {
  it("does not flag a session where all three tables are consistent", async () => {
    const db = createMockDb({
      sessions: [{ session_id: "sess-ok", pipeline_state: "problem_framing" }],
      handoffEvents: [
        { session_id: "sess-ok", lifecycle_id: "lc-ok", pipeline_state: "intake", outcome: "COMPLETED" },
      ],
      stageEntries: [
        { session_id: "sess-ok", lifecycle_id: "lc-ok", pipeline_state: "problem_framing" },
      ],
      lineage: [
        { run_id: "sess-ok", lifecycle_id: "lc-ok", stage: "intake", artifact_type: "ProblemBrief" },
      ],
    });

    const report = await detectDesyncedSessions(db);
    expect(report.total_desynced).toBe(0);
    expect(report.sessions).toHaveLength(0);
  });
});

describe("detectDesyncedSessions — COMPLETED_HANDOFF_WITHOUT_STAGE_ENTRY", () => {
  it("detects a COMPLETED handoff_events row with no matching stage_entries row", async () => {
    const db = createMockDb({
      sessions: [{ session_id: "sess-broken", pipeline_state: "problem_framing" }],
      handoffEvents: [
        {
          session_id: "sess-broken",
          lifecycle_id: "lc-broken",
          pipeline_state: "intake",
          outcome: "COMPLETED",
        },
      ],
      stageEntries: [],
      lineage: [
        { run_id: "sess-broken", lifecycle_id: "lc-broken", stage: "intake", artifact_type: "ProblemBrief" },
      ],
    });

    const report = await detectDesyncedSessions(db);
    const match = report.sessions.filter(
      (s) => s.desync_type === "COMPLETED_HANDOFF_WITHOUT_STAGE_ENTRY"
    );
    expect(match).toHaveLength(1);
    expect(match[0].session_id).toBe("sess-broken");
    expect(match[0].detail).toContain("lc-broken");
  });

  it("does NOT flag FAILED handoff events", async () => {
    const db = createMockDb({
      sessions: [{ session_id: "sess-failed", pipeline_state: "intake" }],
      handoffEvents: [
        { session_id: "sess-failed", lifecycle_id: "lc-failed", pipeline_state: "intake", outcome: "FAILED" },
      ],
      stageEntries: [],
      lineage: [],
    });

    const report = await detectDesyncedSessions(db);
    const match = report.sessions.filter(
      (s) => s.desync_type === "COMPLETED_HANDOFF_WITHOUT_STAGE_ENTRY"
    );
    expect(match).toHaveLength(0);
  });
});

describe("detectDesyncedSessions — STATE_ADVANCED_WITHOUT_STAGE_ENTRY", () => {
  it("detects a session whose pipeline_state has no stage_entries row", async () => {
    const db = createMockDb({
      sessions: [{ session_id: "sess-noentry", pipeline_state: "problem_framing" }],
      handoffEvents: [],
      stageEntries: [],
      lineage: [],
    });

    const report = await detectDesyncedSessions(db);
    const match = report.sessions.filter(
      (s) => s.desync_type === "STATE_ADVANCED_WITHOUT_STAGE_ENTRY"
    );
    expect(match).toHaveLength(1);
    expect(match[0].session_id).toBe("sess-noentry");
    expect(match[0].detail).toContain("problem_framing");
  });

  it("does NOT flag an intake session (initial state)", async () => {
    const db = createMockDb({
      sessions: [{ session_id: "sess-intake", pipeline_state: "intake" }],
      handoffEvents: [],
      stageEntries: [],
      lineage: [],
    });

    const report = await detectDesyncedSessions(db);
    const match = report.sessions.filter(
      (s) => s.desync_type === "STATE_ADVANCED_WITHOUT_STAGE_ENTRY"
    );
    expect(match).toHaveLength(0);
  });
});

describe("detectDesyncedSessions — TRANSITION_LINEAGE_WITHOUT_HANDOFF", () => {
  it("detects a ProblemBrief lineage row with lifecycle_id but no handoff_events row", async () => {
    const db = createMockDb({
      sessions: [{ session_id: "sess-nohandoff", pipeline_state: "intake" }],
      handoffEvents: [],
      stageEntries: [],
      lineage: [
        {
          run_id: "sess-nohandoff",
          lifecycle_id: "lc-nohandoff",
          stage: "intake",
          artifact_type: "ProblemBrief",
        },
      ],
    });

    const report = await detectDesyncedSessions(db);
    const match = report.sessions.filter(
      (s) => s.desync_type === "TRANSITION_LINEAGE_WITHOUT_HANDOFF"
    );
    expect(match).toHaveLength(1);
    expect(match[0].session_id).toBe("sess-nohandoff");
    expect(match[0].detail).toContain("lc-nohandoff");
  });

  it("does NOT flag non-transition artifact types (e.g. FramingAssessment)", async () => {
    const db = createMockDb({
      sessions: [{ session_id: "sess-framing", pipeline_state: "problem_framing" }],
      handoffEvents: [],
      stageEntries: [],
      lineage: [
        {
          run_id: "sess-framing",
          lifecycle_id: "lc-framing",
          stage: "problem_framing",
          artifact_type: "FramingAssessment",
        },
      ],
    });

    const report = await detectDesyncedSessions(db);
    const match = report.sessions.filter(
      (s) => s.desync_type === "TRANSITION_LINEAGE_WITHOUT_HANDOFF"
    );
    expect(match).toHaveLength(0);
  });

  it("does NOT flag lineage rows without lifecycle_id (pre-lifecycle-transaction rows)", async () => {
    const db = createMockDb({
      sessions: [{ session_id: "sess-legacy", pipeline_state: "problem_framing" }],
      handoffEvents: [],
      stageEntries: [],
      lineage: [
        {
          run_id: "sess-legacy",
          lifecycle_id: null,
          stage: "intake",
          artifact_type: "ProblemBrief",
        },
      ],
    });

    const report = await detectDesyncedSessions(db);
    const match = report.sessions.filter(
      (s) => s.desync_type === "TRANSITION_LINEAGE_WITHOUT_HANDOFF"
    );
    expect(match).toHaveLength(0);
  });
});

describe("detectDesyncedSessions — multiple patterns in same report", () => {
  it("reports all detected patterns for a fully inconsistent session", async () => {
    const db = createMockDb({
      sessions: [{ session_id: "sess-chaos", pipeline_state: "problem_framing" }],
      handoffEvents: [
        {
          session_id: "sess-chaos",
          lifecycle_id: "lc-chaos",
          pipeline_state: "intake",
          outcome: "COMPLETED",
        },
      ],
      stageEntries: [],
      lineage: [
        {
          run_id: "sess-chaos",
          lifecycle_id: "lc-chaos",
          stage: "intake",
          artifact_type: "ProblemBrief",
        },
      ],
    });

    const report = await detectDesyncedSessions(db);
    expect(report.total_desynced).toBeGreaterThanOrEqual(2);
    const types = new Set(report.sessions.map((s) => s.desync_type));
    expect(types.has("COMPLETED_HANDOFF_WITHOUT_STAGE_ENTRY")).toBe(true);
    expect(types.has("STATE_ADVANCED_WITHOUT_STAGE_ENTRY")).toBe(true);
  });
});
