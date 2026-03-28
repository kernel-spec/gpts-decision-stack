import type {
  Env,
  FounderArtifactSaveRequest,
  FounderArtifactSaveResult,
  FounderModelOutputRecordRequest,
  FounderModelOutputRecordResult,
} from "../types/index.js";

function nowIso(): string {
  return new Date().toISOString();
}

function newId(): string {
  return crypto.randomUUID();
}

function cleanText(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function toPathSegment(value: string): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized || "unknown";
}

function serializeBody(body: unknown): {
  value: string;
  contentType: string;
  extension: string;
} {
  if (typeof body === "string") {
    return {
      value: body,
      contentType: "text/plain; charset=utf-8",
      extension: "txt",
    };
  }

  return {
    value: JSON.stringify(body),
    contentType: "application/json",
    extension: "json",
  };
}

async function getNextArtifactVersion(
  db: Env["DECISIONS_DB"],
  project_id: string,
  run_id: string,
  artifact_type: string
): Promise<number> {
  const row = await db
    .prepare(
      `SELECT COALESCE(MAX(version), 0) AS latest_version
       FROM founder_artifacts
       WHERE project_id = ? AND run_id = ? AND artifact_type = ?`
    )
    .bind(project_id, run_id, artifact_type)
    .first<{ latest_version: number | string | null }>();

  const latest =
    typeof row?.latest_version === "number"
      ? row.latest_version
      : Number(row?.latest_version ?? 0);

  return latest + 1;
}

function buildArtifactStoragePath(
  project_id: string,
  run_id: string,
  artifact_type: string,
  version: number,
  artifact_id: string,
  extension: string
): string {
  return [
    "founder",
    "projects",
    toPathSegment(project_id),
    "runs",
    toPathSegment(run_id),
    "artifacts",
    toPathSegment(artifact_type),
    `v${version}`,
    `${artifact_id}.${extension}`,
  ].join("/");
}

function buildModelOutputStoragePath(
  project_id: string,
  run_id: string,
  role_name: string,
  output_type: string,
  record_id: string,
  extension: string
): string {
  return [
    "founder",
    "projects",
    toPathSegment(project_id),
    "runs",
    toPathSegment(run_id),
    "model-outputs",
    toPathSegment(role_name),
    toPathSegment(output_type),
    `${record_id}.${extension}`,
  ].join("/");
}

export async function saveArtifact(
  db: Env["DECISIONS_DB"],
  bucket: Env["ARTIFACTS_BUCKET"],
  project_id: string,
  req: FounderArtifactSaveRequest
): Promise<FounderArtifactSaveResult> {
  const artifact_id = newId();
  const created_at = nowIso();
  const run_id = req.metadata.run_id.trim();
  const version = await getNextArtifactVersion(
    db,
    project_id,
    run_id,
    req.artifact_type
  );
  const source_surface = cleanText(req.metadata.source_surface) ?? "founder_console";
  const source_role =
    cleanText(req.metadata.source_role) ?? cleanText(req.submitted_by) ?? "founder_console";
  const status = cleanText(req.metadata.status) ?? "saved";
  const linked_decision_id = cleanText(req.linked_decision_id);
  const serialized = serializeBody(req.content);
  const storage_path = buildArtifactStoragePath(
    project_id,
    run_id,
    req.artifact_type,
    version,
    artifact_id,
    serialized.extension
  );

  await bucket.put(storage_path, serialized.value, {
    httpMetadata: { contentType: serialized.contentType },
    customMetadata: {
      artifact_id,
      project_id,
      run_id,
      artifact_type: req.artifact_type,
      source_surface,
      source_role,
      version: String(version),
    },
  });

  await db
    .prepare(
      `INSERT INTO founder_artifacts (
         artifact_id,
         project_id,
         run_id,
         artifact_type,
         source_surface,
         source_role,
         status,
         version,
         created_at,
         storage_path,
         linked_decision_id
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      artifact_id,
      project_id,
      run_id,
      req.artifact_type,
      source_surface,
      source_role,
      status,
      version,
      created_at,
      storage_path,
      linked_decision_id
    )
    .run();

  return {
    artifact_id,
    status,
    version,
    storage_path,
    linked_decision_id,
  };
}

export async function recordModelOutput(
  db: Env["DECISIONS_DB"],
  bucket: Env["ARTIFACTS_BUCKET"],
  project_id: string,
  req: FounderModelOutputRecordRequest
): Promise<FounderModelOutputRecordResult> {
  const record_id = newId();
  const created_at = nowIso();
  const run_id = req.run_id.trim();
  const status = "recorded";
  const serialized = serializeBody(req.raw_output);
  const storage_path = buildModelOutputStoragePath(
    project_id,
    run_id,
    req.role_name,
    req.output_type,
    record_id,
    serialized.extension
  );
  const operator_notes = cleanText(req.operator_notes);

  await bucket.put(storage_path, serialized.value, {
    httpMetadata: { contentType: serialized.contentType },
    customMetadata: {
      record_id,
      project_id,
      run_id,
      source_surface: "founder_console",
      source_role: req.role_name,
      output_type: req.output_type,
    },
  });

  await db
    .prepare(
      `INSERT INTO founder_model_outputs (
         record_id,
         project_id,
         run_id,
         source_surface,
         source_role,
         role_name,
         output_type,
         status,
         storage_path,
         operator_notes,
         created_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      record_id,
      project_id,
      run_id,
      "founder_console",
      req.role_name,
      req.role_name,
      req.output_type,
      status,
      storage_path,
      operator_notes,
      created_at
    )
    .run();

  return {
    record_id,
    status,
    linked_run_id: run_id,
    suggested_artifact_update: null,
    founder_decision_required: false,
  };
}
