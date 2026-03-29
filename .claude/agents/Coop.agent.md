---
name: Coop
description: Describe what this custom agent does and when to use it.
tools: Read, Grep, Glob, Bash # specify the tools this agent can use. If not set, all enabled tools are allowed.
---

<!-- Tip: Use /create-agent in chat to generate content with agent assistance -->
Read the repository first and infer the most likely implementation paths for:
- orchestration layer
- persistence layer
- acceptance tests
- operator read model / UI contract

Then implement DELIVERY INTEGRITY INSTRUMENTATION v1 with the following constraints:

- orchestration is the only source of truth for delivery classification
- workers cannot set replacement_reason
- parser can provide inputs but cannot own final delivery truth
- UI must render orchestration truth only
- persistence must be append-only
- PostgreSQL migration required
- acceptance tests required
- minimal read model required

Required implementation scope:
1. create SQL migration for artifact_lineage, handoff_events, stage_entries, stage_loop_signals
2. create or update enum/config YAML for delivery integrity enums
3. implement orchestration functions:
   - recordArtifactAttempt
   - recordHandoffOutcome
   - recordStageEntry
4. emit events after successful persistence
5. implement read-model functions:
   - getRunDeliverySummary
   - getRunDeliveryHistory
   - getRunNextAction
6. add acceptance tests
7. output exact files changed and full code

Use these classification precedence rules exactly:

replacement_reason precedence:
1. INVALID_SCHEMA
2. MISSING_REQUIRED_SECTION
3. STAGE_MISMATCH
4. REVIEW_BLOCK
5. HANDOFF_REJECTED
6. SCOPE_CHANGE
7. QUALITY_ISSUE

handoff_failure_reason precedence:
1. SCHEMA_MISMATCH
2. MISSING_FIELDS
3. AMBIGUOUS_OWNER
4. REVIEW_REJECTED
5. REENTRY_NOT_READY
6. INVALID_INPUT

Hard rules:
- attempt > 1 requires supersedes_artifact_id
- attempt > 1 requires replacement_reason
- failed handoff requires failure_reason
- classified_by must equal orchestration
- same-stage repeat must emit stage_loop_detected
- persist first, emit second

Return:
- assumptions
- file plan
- full migration
- full code
- full tests
- brief explanation only where needed