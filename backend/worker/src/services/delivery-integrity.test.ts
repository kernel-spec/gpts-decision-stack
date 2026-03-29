import { describe, expect, it, vi } from "vitest";
import type { Env, Session } from "../types/index.js";
import { appendDeliveryIntegrityEvent } from "./delivery-integrity.js";

type DeliveryIntegrityRow = {
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

function createMockDb() {
  const deliveryIntegrityEvents: DeliveryIntegrityRow[] = [];

  const db = {
    prepare(sql: string) {
      return {
        bind(...params: unknown[]) {
          return {
            async first<T>() {
              if (sql.includes("FROM delivery_integrity_events")) {
                const [session_id, pipeline_state] = params as [string, string];
                const exists = deliveryIntegrityEvents.some(
                  (event) =>
                    event.session_id === session_id && event.pipeline_state === pipeline_state
                );
                return exists ? ({ has_prior: 1 } as T) : null;
              }
              return null;
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
                deliveryIntegrityEvents.push({
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

              if (sql.includes("DELETE FROM delivery_integrity_events WHERE event_id = ?")) {
                const [event_id] = params as [string];
                const idx = deliveryIntegrityEvents.findIndex((row) => row.event_id === event_id);
                if (idx >= 0) {
                  deliveryIntegrityEvents.splice(idx, 1);
                }
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
    deliveryIntegrityEvents,
  };
}

describe("appendDeliveryIntegrityEvent", () => {
  it("emits repair classification event for superseding attempt", async () => {
    const { db, deliveryIntegrityEvents } = createMockDb();
    const session = makeSession();
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    const record = await appendDeliveryIntegrityEvent(db, session, "artifact-002", {
      attempt: 2,
      supersedes_artifact_id: "artifact-001",
      replacement_reason: "QUALITY_ISSUE",
    });

    expect(record.attempt).toBe(2);
    expect(record.supersedes_artifact_id).toBe("artifact-001");
    expect(deliveryIntegrityEvents).toHaveLength(1);
    expect(logSpy).toHaveBeenCalledTimes(1);
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('"event":"delivery_repair_attempt_classified"')
    );

    logSpy.mockRestore();
  });

  it("rolls back persisted classification when emit fails", async () => {
    const { db, deliveryIntegrityEvents } = createMockDb();
    const session = makeSession();
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {
      throw new Error("emit failed");
    });

    await expect(
      appendDeliveryIntegrityEvent(db, session, "artifact-002", {
        attempt: 2,
        supersedes_artifact_id: "artifact-001",
        replacement_reason: "QUALITY_ISSUE",
      })
    ).rejects.toThrow("emit failed");

    expect(deliveryIntegrityEvents).toHaveLength(0);

    logSpy.mockRestore();
  });
});
