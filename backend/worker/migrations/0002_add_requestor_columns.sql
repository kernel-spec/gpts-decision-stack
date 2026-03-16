-- D1 schema migration: add requestor_type and external_ref to sessions
-- Apply with: wrangler d1 execute gpts-decision-stack-db --file migrations/0002_add_requestor_columns.sql

ALTER TABLE sessions ADD COLUMN requestor_type TEXT NOT NULL DEFAULT 'founder-led';
ALTER TABLE sessions ADD COLUMN external_ref TEXT;
