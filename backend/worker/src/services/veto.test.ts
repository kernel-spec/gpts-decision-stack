import { describe, expect, it } from "vitest";
import type { Env } from "../types/index.js";
import { getVetoStatus, activateVeto, releaseVeto } from "./veto.js";

// ---------- Mock DB ----------

type VetoRow = {
  session_id: string;
  is_active: number;
  activated_by: string | null;
  activated_at: string | null;
  reason: string | null;
  released_by: string | null;
  released_at: string | null;
};

function createMockDb(seed?: VetoRow) {
  let row: VetoRow | null = seed ?? null;

  const db = {
    prepare(sql: string) {
      return {
        bind(...params: unknown[]) {
          return {
            async first<T>() {
              if (sql.includes("SELECT * FROM veto_records")) {
                return (row as T) ?? (null as T);
              }
              return null as T;
            },
            async run() {
              if (sql.includes("INSERT OR IGNORE INTO veto_records")) {
                if (!row) {
                  const [session_id] = params as [string];
                  row = {
                    session_id,
                    is_active: 0,
                    activated_by: null,
                    activated_at: null,
                    reason: null,
                    released_by: null,
                    released_at: null,
                  };
                }
              }
              if (sql.includes("SET is_active = 1")) {
                const [activated_by, activated_at, reason] = params as [string, string, string];
                if (row) {
                  row.is_active = 1;
                  row.activated_by = activated_by;
                  row.activated_at = activated_at;
                  row.reason = reason;
                  row.released_by = null;
                  row.released_at = null;
                }
              }
              if (sql.includes("SET is_active = 0")) {
                const [released_by, released_at] = params as [string, string];
                if (row) {
                  row.is_active = 0;
                  row.released_by = released_by;
                  row.released_at = released_at;
                }
              }
              return { success: true };
            },
          };
        },
      };
    },
  };

  return { db: db as unknown as Env["DECISIONS_DB"], getRow: () => row };
}

// ---------- getVetoStatus ----------

describe("getVetoStatus", () => {
  it("creates a default inactive veto record when none exists", async () => {
    const { db } = createMockDb();

    const status = await getVetoStatus(db, "sess-001");

    expect(status.session_id).toBe("sess-001");
    expect(status.is_active).toBe(false);
    expect(status.activated_by).toBeUndefined();
    expect(status.reason).toBeUndefined();
  });

  it("returns existing inactive veto record", async () => {
    const seed: VetoRow = {
      session_id: "sess-001",
      is_active: 0,
      activated_by: null,
      activated_at: null,
      reason: null,
      released_by: null,
      released_at: null,
    };
    const { db } = createMockDb(seed);

    const status = await getVetoStatus(db, "sess-001");

    expect(status.is_active).toBe(false);
  });

  it("returns active veto record with all fields", async () => {
    const seed: VetoRow = {
      session_id: "sess-001",
      is_active: 1,
      activated_by: "operator-001",
      activated_at: "2026-01-01T12:00:00.000Z",
      reason: "Compliance hold",
      released_by: null,
      released_at: null,
    };
    const { db } = createMockDb(seed);

    const status = await getVetoStatus(db, "sess-001");

    expect(status.is_active).toBe(true);
    expect(status.activated_by).toBe("operator-001");
    expect(status.reason).toBe("Compliance hold");
  });
});

// ---------- activateVeto ----------

describe("activateVeto", () => {
  it("sets is_active to true and records activation metadata", async () => {
    const { db, getRow } = createMockDb();

    const result = await activateVeto(db, "sess-001", {
      activated_by: "operator-001",
      reason: "Hold for legal review",
    });

    expect(result.is_active).toBe(true);
    expect(result.activated_by).toBe("operator-001");
    expect(result.reason).toBe("Hold for legal review");
    expect(result.activated_at).toBeTruthy();
    expect(result.released_by).toBeUndefined();
    expect(result.released_at).toBeUndefined();

    const row = getRow();
    expect(row!.is_active).toBe(1);
    expect(row!.activated_by).toBe("operator-001");
    expect(row!.released_by).toBeNull();
    expect(row!.released_at).toBeNull();
  });

  it("clears previous release fields on re-activation", async () => {
    const seed: VetoRow = {
      session_id: "sess-001",
      is_active: 0,
      activated_by: "op-prev",
      activated_at: "2026-01-01T00:00:00.000Z",
      reason: "old reason",
      released_by: "op-prev",
      released_at: "2026-01-02T00:00:00.000Z",
    };
    const { db, getRow } = createMockDb(seed);

    await activateVeto(db, "sess-001", { activated_by: "op-new", reason: "new reason" });

    const row = getRow();
    expect(row!.released_by).toBeNull();
    expect(row!.released_at).toBeNull();
    expect(row!.activated_by).toBe("op-new");
  });
});

// ---------- releaseVeto ----------

describe("releaseVeto", () => {
  it("sets is_active to false and records release metadata", async () => {
    const seed: VetoRow = {
      session_id: "sess-001",
      is_active: 1,
      activated_by: "operator-001",
      activated_at: "2026-01-01T12:00:00.000Z",
      reason: "Compliance hold",
      released_by: null,
      released_at: null,
    };
    const { db, getRow } = createMockDb(seed);

    const result = await releaseVeto(db, "sess-001", { released_by: "operator-002", release_reason: "Cleared" });

    expect(result.is_active).toBe(false);
    expect(result.released_by).toBe("operator-002");
    expect(result.released_at).toBeTruthy();

    const row = getRow();
    expect(row!.is_active).toBe(0);
    expect(row!.released_by).toBe("operator-002");
  });
});
