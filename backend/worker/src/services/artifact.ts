import type {
  Env,
  Artifact,
  SubmitArtifactRequest,
} from "../types/index.js";

function nowIso(): string {
  return new Date().toISOString();
}

function newId(): string {
  return crypto.randomUUID();
}

export async function submitArtifact(
  db: Env["DECISIONS_DB"],
  bucket: Env["ARTIFACTS_BUCKET"],
  session_id: string,
  req: SubmitArtifactRequest
): Promise<Artifact> {
  const id = newId();
  const submitted_at = nowIso();
  const payloadJson = JSON.stringify(req.payload);

  // Persist payload in R2 for immutable storage
  const r2Key = `${session_id}/${id}/${req.artifact_type}.json`;
  await bucket.put(r2Key, payloadJson, {
    httpMetadata: { contentType: "application/json" },
    customMetadata: {
      session_id,
      artifact_type: req.artifact_type,
      submitted_at,
    },
  });

  // Record artifact reference in D1
  await db
    .prepare(
      `INSERT INTO artifacts (id, session_id, artifact_type, r2_key, submitted_at)
       VALUES (?, ?, ?, ?, ?)`
    )
    .bind(id, session_id, req.artifact_type, r2Key, submitted_at)
    .run();

  return {
    id,
    session_id,
    artifact_type: req.artifact_type,
    payload: req.payload,
    submitted_at,
  };
}

export async function getArtifacts(
  db: Env["DECISIONS_DB"],
  bucket: Env["ARTIFACTS_BUCKET"],
  session_id: string
): Promise<Artifact[]> {
  const rows = await db
    .prepare(
      `SELECT id, session_id, artifact_type, r2_key, submitted_at
       FROM artifacts WHERE session_id = ? ORDER BY submitted_at ASC`
    )
    .bind(session_id)
    .all<{
      id: string;
      session_id: string;
      artifact_type: string;
      r2_key: string;
      submitted_at: string;
    }>();

  return Promise.all(
    rows.results.map(async (row) => {
      let payload: unknown = null;
      try {
        const obj = await bucket.get(row.r2_key);
        if (obj) {
          payload = await obj.json();
        }
      } catch {
        // artifact payload missing from R2 — return null payload
      }
      return {
        id: row.id,
        session_id: row.session_id,
        artifact_type: row.artifact_type as Artifact["artifact_type"],
        payload,
        submitted_at: row.submitted_at,
      };
    })
  );
}
