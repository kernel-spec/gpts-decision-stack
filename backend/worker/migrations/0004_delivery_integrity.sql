-- Append-only delivery integrity instrumentation; ON DELETE RESTRICT preserves historical truth
CREATE TABLE IF NOT EXISTS delivery_integrity_events (
  event_id TEXT PRIMARY KEY,
  artifact_id TEXT NOT NULL REFERENCES artifacts(id) ON DELETE RESTRICT,
  session_id TEXT NOT NULL REFERENCES sessions(session_id) ON DELETE RESTRICT,
  pipeline_state TEXT NOT NULL,
  attempt INTEGER NOT NULL CHECK (attempt >= 1),
  supersedes_artifact_id TEXT REFERENCES artifacts(id) ON DELETE RESTRICT,
  replacement_reason TEXT,
  handoff_status TEXT NOT NULL DEFAULT 'pending',
  handoff_failure_reason TEXT,
  stage_loop_detected INTEGER NOT NULL DEFAULT 0 CHECK (stage_loop_detected IN (0, 1)),
  classified_by TEXT NOT NULL,
  classified_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_delivery_integrity_session_state
  ON delivery_integrity_events (session_id, pipeline_state);

CREATE INDEX IF NOT EXISTS idx_delivery_integrity_artifact
  ON delivery_integrity_events (artifact_id);
