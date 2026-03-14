-- D1 schema migration: initial tables for gpts-decision-stack backend
-- Apply with: wrangler d1 execute gpts-decision-stack-db --file migrations/0001_init.sql

CREATE TABLE IF NOT EXISTS sessions (
  session_id    TEXT    PRIMARY KEY,
  agent_id      TEXT    NOT NULL,
  pipeline_state TEXT   NOT NULL,
  decision_status TEXT  NOT NULL,
  created_at    TEXT    NOT NULL,
  updated_at    TEXT    NOT NULL
);

CREATE TABLE IF NOT EXISTS artifacts (
  id            TEXT    PRIMARY KEY,
  session_id    TEXT    NOT NULL REFERENCES sessions(session_id),
  artifact_type TEXT    NOT NULL,
  r2_key        TEXT    NOT NULL,
  submitted_at  TEXT    NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_artifacts_session ON artifacts(session_id);

CREATE TABLE IF NOT EXISTS decision_log (
  id              TEXT  PRIMARY KEY,
  session_id      TEXT  NOT NULL REFERENCES sessions(session_id),
  agent_id        TEXT  NOT NULL,
  action          TEXT  NOT NULL,
  pipeline_state  TEXT  NOT NULL,
  decision_status TEXT  NOT NULL,
  notes           TEXT,
  logged_at       TEXT  NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_decision_log_session ON decision_log(session_id);

CREATE TABLE IF NOT EXISTS veto_records (
  session_id    TEXT    PRIMARY KEY REFERENCES sessions(session_id),
  is_active     INTEGER NOT NULL DEFAULT 0,
  activated_by  TEXT,
  activated_at  TEXT,
  reason        TEXT,
  released_by   TEXT,
  released_at   TEXT
);

CREATE TABLE IF NOT EXISTS approvals (
  id            TEXT    PRIMARY KEY,
  session_id    TEXT    NOT NULL REFERENCES sessions(session_id),
  approval_type TEXT    NOT NULL,
  submitted_by  TEXT    NOT NULL,
  decision      TEXT    NOT NULL,
  notes         TEXT,
  submitted_at  TEXT    NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_approvals_session ON approvals(session_id);
