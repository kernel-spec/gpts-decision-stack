-- Adds lifecycle_id correlation column to the three core truth tables.
-- lifecycle_id ties together artifact_lineage + handoff_events + stage_entries
-- within a single executeArtifactLifecycleTransaction execution, enabling
-- exact desync detection (orphaned handoff without stage_entry, etc.).
-- Nullable for backward compatibility with existing rows written before this
-- migration; new rows written by executeArtifactLifecycleTransaction always
-- carry a non-null lifecycle_id.

ALTER TABLE artifact_lineage ADD COLUMN lifecycle_id TEXT;

ALTER TABLE handoff_events ADD COLUMN lifecycle_id TEXT;

ALTER TABLE stage_entries ADD COLUMN lifecycle_id TEXT;

CREATE INDEX IF NOT EXISTS idx_artifact_lineage_lifecycle
  ON artifact_lineage (lifecycle_id)
  WHERE lifecycle_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_handoff_events_lifecycle
  ON handoff_events (lifecycle_id)
  WHERE lifecycle_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_stage_entries_lifecycle
  ON stage_entries (lifecycle_id)
  WHERE lifecycle_id IS NOT NULL;
