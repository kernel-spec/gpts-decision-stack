-- D1 schema migration: normalize legacy stage tracking tables to the runtime contract.
-- Some dev databases already contain the older shape:
--   stage_entries(entry_id, ..., classified_at)
--   stage_loop_signals(..., classified_at)
-- Upgrade those tables in-place so runtime inserts/selects use the canonical columns.
--
-- NOTE ON MIGRATION PREFIX: this file shares the "0007_" prefix with 0007_handoff_events.sql.
-- Wrangler tracks migrations by full filename, not just the numeric prefix, so both files are
-- applied as independent migrations in alphabetical order (0007_handoff_events.sql first).
-- The shared prefix is a historical artifact and must NOT be "fixed" by renaming — renaming a
-- migration that has already been applied would cause wrangler to treat it as a new migration
-- and attempt to re-apply it. Future migrations must use prefix 0009 or higher.

CREATE TABLE IF NOT EXISTS stage_entries (
  entry_id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(session_id) ON DELETE RESTRICT,
  pipeline_state TEXT NOT NULL,
  entry_count INTEGER NOT NULL CHECK (entry_count >= 1),
  classified_by TEXT NOT NULL DEFAULT 'orchestration',
  classified_at TEXT NOT NULL,
  CHECK (classified_by = 'orchestration')
);

ALTER TABLE stage_entries
  ADD COLUMN artifact_id TEXT REFERENCES artifacts(id) ON DELETE RESTRICT;

ALTER TABLE stage_entries
  RENAME COLUMN entry_id TO stage_entry_id;

ALTER TABLE stage_entries
  RENAME COLUMN classified_at TO created_at;

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
  classified_at TEXT NOT NULL,
  CHECK (classified_by = 'orchestration')
);

ALTER TABLE stage_loop_signals
  RENAME COLUMN classified_at TO created_at;

CREATE INDEX IF NOT EXISTS idx_stage_loop_signals_session_state
  ON stage_loop_signals (session_id, pipeline_state);