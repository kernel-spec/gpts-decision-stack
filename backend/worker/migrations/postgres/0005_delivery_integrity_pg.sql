-- PostgreSQL migration for delivery integrity instrumentation (append-only tables)
-- Applies orchestration-owned lineage, handoff, stage entry, and loop signals with strict constraints

CREATE TABLE IF NOT EXISTS artifact_lineage (
  lineage_id TEXT PRIMARY KEY,
  artifact_id TEXT NOT NULL REFERENCES artifacts(id) ON DELETE RESTRICT,
  session_id TEXT NOT NULL REFERENCES sessions(session_id) ON DELETE RESTRICT,
  pipeline_state TEXT NOT NULL,
  attempt INTEGER NOT NULL CHECK (attempt >= 1),
  supersedes_artifact_id TEXT REFERENCES artifacts(id) ON DELETE RESTRICT,
  replacement_reason TEXT,
  replacement_reason_source TEXT,
  classified_by TEXT NOT NULL DEFAULT 'orchestration',
  classified_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (classified_by = 'orchestration'),
  CHECK (
    attempt = 1
    OR (
      supersedes_artifact_id IS NOT NULL
      AND replacement_reason IS NOT NULL
      AND replacement_reason_source IS NOT NULL
    )
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_artifact_lineage_artifact
  ON artifact_lineage (artifact_id);

CREATE INDEX IF NOT EXISTS idx_artifact_lineage_session_state
  ON artifact_lineage (session_id, pipeline_state);

CREATE INDEX IF NOT EXISTS idx_artifact_lineage_supersedes
  ON artifact_lineage (supersedes_artifact_id);

CREATE TABLE IF NOT EXISTS handoff_events (
  handoff_event_id TEXT PRIMARY KEY,
  artifact_id TEXT NOT NULL REFERENCES artifacts(id) ON DELETE RESTRICT,
  session_id TEXT NOT NULL REFERENCES sessions(session_id) ON DELETE RESTRICT,
  pipeline_state TEXT NOT NULL,
  attempt INTEGER NOT NULL CHECK (attempt >= 1),
  handoff_status TEXT NOT NULL CHECK (handoff_status IN ('pending', 'completed', 'failed')),
  failure_reason TEXT,
  failure_reason_source TEXT,
  classified_by TEXT NOT NULL DEFAULT 'orchestration',
  classified_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (classified_by = 'orchestration'),
  CHECK (handoff_status <> 'failed' OR failure_reason IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_handoff_events_session_state
  ON handoff_events (session_id, pipeline_state);

CREATE INDEX IF NOT EXISTS idx_handoff_events_artifact
  ON handoff_events (artifact_id);

CREATE INDEX IF NOT EXISTS idx_handoff_events_status
  ON handoff_events (handoff_status);

CREATE TABLE IF NOT EXISTS stage_entries (
  stage_entry_id TEXT PRIMARY KEY,