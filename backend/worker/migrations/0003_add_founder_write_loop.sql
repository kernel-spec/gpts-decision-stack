-- D1 schema migration: add founder artifact and model-output write-loop tables
-- Apply with: wrangler d1 execute gpts-decision-stack-db --file migrations/0003_add_founder_write_loop.sql

CREATE TABLE IF NOT EXISTS founder_artifacts (
  artifact_id        TEXT    PRIMARY KEY,
  project_id         TEXT    NOT NULL REFERENCES sessions(session_id),
  run_id             TEXT    NOT NULL,
  artifact_type      TEXT    NOT NULL,
  source_surface     TEXT    NOT NULL,
  source_role        TEXT    NOT NULL,
  status             TEXT    NOT NULL,
  version            INTEGER NOT NULL,
  created_at         TEXT    NOT NULL,
  storage_path       TEXT    NOT NULL,
  linked_decision_id TEXT
);
CREATE INDEX IF NOT EXISTS idx_founder_artifacts_project ON founder_artifacts(project_id);
CREATE INDEX IF NOT EXISTS idx_founder_artifacts_run ON founder_artifacts(project_id, run_id);

CREATE TABLE IF NOT EXISTS founder_model_outputs (
  record_id       TEXT    PRIMARY KEY,
  project_id      TEXT    NOT NULL REFERENCES sessions(session_id),
  run_id          TEXT    NOT NULL,
  source_surface  TEXT    NOT NULL,
  source_role     TEXT    NOT NULL,
  role_name       TEXT    NOT NULL,
  output_type     TEXT    NOT NULL,
  status          TEXT    NOT NULL,
  storage_path    TEXT    NOT NULL,
  operator_notes  TEXT,
  created_at      TEXT    NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_founder_model_outputs_project ON founder_model_outputs(project_id);
CREATE INDEX IF NOT EXISTS idx_founder_model_outputs_run ON founder_model_outputs(project_id, run_id);
