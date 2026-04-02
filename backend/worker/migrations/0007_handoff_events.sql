-- Append-only handoff outcome tracking; orchestration is final truth owner
CREATE TABLE IF NOT EXISTS handoff_events (
  event_id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(session_id) ON DELETE RESTRICT,
  pipeline_state TEXT NOT NULL,
  outcome TEXT NOT NULL CHECK (outcome IN ('COMPLETED', 'FAILED')),
  failure_reason TEXT CHECK (failure_reason IS NULL OR failure_reason IN (
    'SCHEMA_MISMATCH', 'MISSING_FIELDS', 'AMBIGUOUS_OWNER',
    'REVIEW_REJECTED', 'REENTRY_NOT_READY', 'INVALID_INPUT'
  )),
  classified_by TEXT NOT NULL DEFAULT 'orchestration',
  classified_at TEXT NOT NULL,
  CHECK (
    (outcome = 'COMPLETED') OR
    (outcome = 'FAILED' AND failure_reason IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_handoff_events_session
  ON handoff_events (session_id);

CREATE INDEX IF NOT EXISTS idx_handoff_events_session_state
  ON handoff_events (session_id, pipeline_state);
