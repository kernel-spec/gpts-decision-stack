import { describe, expect, it } from "vitest";
import type { Env } from "../types/index.js";
import {
  handleGetRunDeliverySummary,
  handleGetRunDeliveryHistory,
  handleGetRunNextAction,
} from "./operator-delivery.js";

// ---------- Helpers ----------

type SessionRow = { pipeline_state: string };

function createMockDb(session: SessionRow | null = null) {
  const db = {
    prepare(sql: string) {
      return {
        bind(..._params: unknown[]) {
          return {
            async first<T>() {
              if (sql.includes("FROM sessions")) {
                if (!session) return null as T;
                if (sql.includes("SELECT pipeline_state")) {
                  return { pipeline_state: session.pipeline_state } as T;
                }
                return { 1: 1 } as T;
              }
              if (sql.includes("FROM artifact_lineage")) {
                return null as T;
              }
              if (sql.includes("FROM delivery_integrity_events")) {
                return null as T;
              }
              return null as T;
            },
            async all<T>() {
              return { results: [] as T[] };
            },
          };
        },
      };
    },
  };

  return { db: db as unknown as Env["DECISIONS_DB"] };
}

function makeEnv(session: SessionRow | null = null): Env {
  const { db } = createMockDb(session);
  return {
    DECISIONS_DB: db,
    ARTIFACTS_BUCKET: {} as Env["ARTIFACTS_BUCKET"],
    POLICY_STORE: {} as Env["POLICY_STORE"],
    API_KEY_SECRET: "test-secret",
  };
}

// ---------- handleGetRunDeliverySummary ----------

describe("handleGetRunDeliverySummary", () => {
  it("returns 200 with delivery summary when session exists", async () => {
    const env = makeEnv({ pipeline_state: "problem_framing" });

    const response = await handleGetRunDeliverySummary("sess-001", env);
    const body = await response.json() as { ok: boolean; data: unknown };

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.data).toBeTruthy();
  });

  it("returns 404 when session does not exist", async () => {
    const env = makeEnv(null);

    const response = await handleGetRunDeliverySummary("nonexistent", env);
    const body = await response.json() as { ok: boolean; code: string };

    expect(response.status).toBe(404);
    expect(body.ok).toBe(false);
    expect(body.code).toBe("NOT_FOUND");
  });
});

// ---------- handleGetRunDeliveryHistory ----------

describe("handleGetRunDeliveryHistory", () => {
  it("returns 200 with delivery history when session exists", async () => {
    const env = makeEnv({ pipeline_state: "intake" });

    const response = await handleGetRunDeliveryHistory("sess-001", env);
    const body = await response.json() as { ok: boolean; data: unknown };

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.data).toBeTruthy();
  });

  it("returns 404 when session does not exist", async () => {
    const env = makeEnv(null);

    const response = await handleGetRunDeliveryHistory("nonexistent", env);
    const body = await response.json() as { ok: boolean; code: string };

    expect(response.status).toBe(404);
    expect(body.code).toBe("NOT_FOUND");
  });
});

// ---------- handleGetRunNextAction ----------

describe("handleGetRunNextAction", () => {
  it("returns 200 with next-action when session exists", async () => {
    const env = makeEnv({ pipeline_state: "intake" });

    const response = await handleGetRunNextAction("sess-001", env);
    const body = await response.json() as { ok: boolean; data: unknown };

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.data).toBeTruthy();
  });

  it("returns 404 when session does not exist", async () => {
    const env = makeEnv(null);

    const response = await handleGetRunNextAction("nonexistent", env);
    const body = await response.json() as { ok: boolean; code: string };

    expect(response.status).toBe(404);
    expect(body.code).toBe("NOT_FOUND");
  });
});
