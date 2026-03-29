-- Delivery Integrity Instrumentation v1 — PR-2
-- artifact_lineage: append-only record of every artifact attempt per (run_id, stage).
-- classified_by is enforced as 'orchestration' by DB constraint.
-- attempt > 1 requires both supersedes_artifact_id and replacement_reason.

CREATE TABLE IF NOT EXISTS artifact_lineage (
  lineage_id                TEXT    PRIMARY KEY,
  run_id                    TEXT    NOT NULL,
  artifact_id               TEXT    NOT NULL,
  artifact_type             TEXT    NOT NULL,
  stage                     TEXT    NOT NULL,
  attempt                   INTEGER NOT NULL CHECK (attempt >= 1),
  supersedes_artifact_id    TEXT,
  created_at                TEXT    NOT NULL,
  created_by_role           TEXT    NOT NULL,
  classified_by             TEXT    NOT NULL DEFAULT 'orchestration',
  replacement_reason        TEXT,
  replacement_reason_source TEXT,
  is_repair_attempt         INTEGER NOT NULL DEFAULT 0
    CHECK (is_repair_attempt IN (0, 1)),
  is_first_attempt_in_stage INTEGER NOT NULL DEFAULT 1
    CHECK (is_first_attempt_in_stage IN (0, 1)),
  override_flag             INTEGER NOT NULL DEFAULT 0
    CHECK (override_flag IN (0, 1)),
  UNIQUE (run_id, stage, attempt),
  UNIQUE (artifact_id),
  CHECK (classified_by = 'orchestration'),
  CHECK (
    (attempt = 1
      AND supersedes_artifact_id IS NULL
      AND is_first_attempt_in_stage = 1)
    OR
    (attempt > 1
      AND supersedes_artifact_id IS NOT NULL
      AND is_first_attempt_in_stage = 0)
  ),
  CHECK (
    (attempt = 1
      AND replacement_reason IS NULL
      AND replacement_reason_source IS NULL)
    OR
    (attempt > 1
      AND replacement_reason IS NOT NULL
      AND replacement_reason_source IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_artifact_lineage_run_stage
  ON artifact_lineage (run_id, stage);

CREATE INDEX IF NOT EXISTS idx_artifact_lineage_artifact
  ON artifact_lineage (artifact_id);

CREATE INDEX IF NOT EXISTS idx_artifact_lineage_run_created
  ON artifact_lineage (run_id, created_at);
