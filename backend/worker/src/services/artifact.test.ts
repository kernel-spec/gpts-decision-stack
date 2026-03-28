import { describe, expect, it, vi } from "vitest";

import { getArtifacts } from "./artifact.js";

type ArtifactRow = {
  id: string;
  session_id: string;
  artifact_type: string;
  r2_key: string;
  submitted_at: string;
};

function createDb(rows: ArtifactRow[]) {
  const all = vi.fn().mockResolvedValue({ results: rows });
  const bind = vi.fn(() => ({ all }));
  const prepare = vi.fn(() => ({ bind }));

  return {
    db: { prepare },
    all,
    bind,
    prepare,
  };
}

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

describe("getArtifacts", () => {
  it("starts R2 payload fetches concurrently while preserving row order", async () => {
    const rows: ArtifactRow[] = [
      {
        id: "artifact-1",
        session_id: "session-1",
        artifact_type: "ProblemBrief",
        r2_key: "session-1/artifact-1/ProblemBrief.json",
        submitted_at: "2026-01-01T00:00:00.000Z",
      },
      {
        id: "artifact-2",
        session_id: "session-1",
        artifact_type: "OfferDecision",
        r2_key: "session-1/artifact-2/OfferDecision.json",
        submitted_at: "2026-01-01T00:00:01.000Z",
      },
      {
        id: "artifact-3",
        session_id: "session-1",
        artifact_type: "ReleaseDecision",
        r2_key: "session-1/artifact-3/ReleaseDecision.json",
        submitted_at: "2026-01-01T00:00:02.000Z",
      },
    ];
    const { db } = createDb(rows);
    const calls: string[] = [];
    const deferredByKey = new Map<
      string,
      ReturnType<typeof createDeferred<{ json: () => Promise<{ key: string }> }>>
    >();
    const bucket = {
      get: vi.fn((key: string) => {
        calls.push(key);
        const deferred = createDeferred<{ json: () => Promise<{ key: string }> }>();
        deferredByKey.set(key, deferred);
        return deferred.promise;
      }),
    };

    const artifactsPromise = getArtifacts(
      db as never,
      bucket as never,
      "session-1"
    );

    await Promise.resolve();

    expect(calls).toEqual(rows.map((row) => row.r2_key));

    for (const row of rows) {
      deferredByKey.get(row.r2_key)?.resolve({
        json: async () => ({ key: row.r2_key }),
      });
    }

    await expect(artifactsPromise).resolves.toEqual([
      {
        id: "artifact-1",
        session_id: "session-1",
        artifact_type: "ProblemBrief",
        payload: { key: "session-1/artifact-1/ProblemBrief.json" },
        submitted_at: "2026-01-01T00:00:00.000Z",
      },
      {
        id: "artifact-2",
        session_id: "session-1",
        artifact_type: "OfferDecision",
        payload: { key: "session-1/artifact-2/OfferDecision.json" },
        submitted_at: "2026-01-01T00:00:01.000Z",
      },
      {
        id: "artifact-3",
        session_id: "session-1",
        artifact_type: "ReleaseDecision",
        payload: { key: "session-1/artifact-3/ReleaseDecision.json" },
        submitted_at: "2026-01-01T00:00:02.000Z",
      },
    ]);
  });

  it("returns null payloads when R2 objects are missing or unreadable", async () => {
    const rows: ArtifactRow[] = [
      {
        id: "artifact-1",
        session_id: "session-1",
        artifact_type: "ProblemBrief",
        r2_key: "missing",
        submitted_at: "2026-01-01T00:00:00.000Z",
      },
      {
        id: "artifact-2",
        session_id: "session-1",
        artifact_type: "OfferDecision",
        r2_key: "broken",
        submitted_at: "2026-01-01T00:00:01.000Z",
      },
    ];
    const { db } = createDb(rows);
    const bucket = {
      get: vi
        .fn()
        .mockResolvedValueOnce(null)
        .mockRejectedValueOnce(new Error("R2 unavailable")),
    };

    await expect(
      getArtifacts(db as never, bucket as never, "session-1")
    ).resolves.toEqual([
      {
        id: "artifact-1",
        session_id: "session-1",
        artifact_type: "ProblemBrief",
        payload: null,
        submitted_at: "2026-01-01T00:00:00.000Z",
      },
      {
        id: "artifact-2",
        session_id: "session-1",
        artifact_type: "OfferDecision",
        payload: null,
        submitted_at: "2026-01-01T00:00:01.000Z",
      },
    ]);
  });
});
