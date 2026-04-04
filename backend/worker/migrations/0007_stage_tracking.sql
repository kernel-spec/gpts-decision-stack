-- D1 schema migration: add append-only stage entry and loop signal tables

CREATE TABLE IF NOT EXISTS stage_entries (
  stage_entry_id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(session_id) ON DELETE RESTRICT,
  artifact_id TEXT REFERENCES artifacts(id) ON DELETE RESTRICT,
  pipeline_state TEXT NOT NULL,
  entry_count INTEGER NOT NULL CHECK (entry_count >= 1),
  classified_by TEXT NOT NULL DEFAULT 'orchestration',
  created_at TEXT NOT NULL,
  CHECK (classified_by = 'orchestration')
);

CREATE INDEX IF NOT EXISTS idx_stage_entries_session_state
  ON stage_entries (session_id, pipeline_state);

CREATE INDEX IF NOT EXISTS idx_stage_entries_artifact
  ON stage_entries (artifact_id);

CREATE TABLE IF NOT EXISTS stage_loop_signals (
  loop_signal_id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(session_id) ON DELETE RESTRICT,
  pipeline_state TEXT NOT NULL,
  entry_count INTEGER NOT NULL CHECK (entry_count >= 2),
  loop_type TEXT NOT NULL CHECK (loop_type IN ('SAME_STAGE_REPEAT', 'TWO_NODE_LOOP')),
  classified_by TEXT NOT NULL DEFAULT 'orchestration',
  created_at TEXT NOT NULL,
  CHECK (classified_by = 'orchestration')
);

CREATE INDEX IF NOT EXISTS idx_stage_loop_signals_session_state
  ON stage_loop_signals (session_id, pipeline_state);