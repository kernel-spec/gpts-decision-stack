-- Append-only stage entry and loop signal tracking; orchestration is final truth owner
CREATE TABLE IF NOT EXISTS stage_entries (
  entry_id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(session_id) ON DELETE RESTRICT,
  pipeline_state TEXT NOT NULL,
  entry_count INTEGER NOT NULL CHECK (entry_count >= 1),
  classified_by TEXT NOT NULL DEFAULT 'orchestration',
  classified_at TEXT NOT NULL,
  CHECK (classified_by = 'orchestration')
);

CREATE INDEX IF NOT EXISTS idx_stage_entries_session_state
  ON stage_entries (session_id, pipeline_state);

-- Loop signals: emitted when the same stage is entered more than once
CREATE TABLE IF NOT EXISTS stage_loop_signals (
  loop_signal_id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(session_id) ON DELETE RESTRICT,
  pipeline_state TEXT NOT NULL,
  entry_count INTEGER NOT NULL CHECK (entry_count >= 2),
  loop_type TEXT NOT NULL,
  classified_by TEXT NOT NULL DEFAULT 'orchestration',
  classified_at TEXT NOT NULL,
  CHECK (classified_by = 'orchestration')
);

CREATE INDEX IF NOT EXISTS idx_stage_loop_signals_session_state
  ON stage_loop_signals (session_id, pipeline_state);
