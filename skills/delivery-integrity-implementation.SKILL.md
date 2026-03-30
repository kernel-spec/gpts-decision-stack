# Delivery Integrity Implementation Skill

**WORKFLOW SKILL** — Step-by-step implementation and review process for delivery integrity instrumentation in a governed backend system.

## Purpose
This skill ensures that delivery integrity is implemented in a way that guarantees traceable, operator-facing truth, not just raw data logging. It is designed for backend engineers, reviewers, and operators working on systems where artifact lineage, handoff outcomes, and operational state must be provable and queryable.

---

## Workflow Steps

### 1. Persistence Layer
- Create append-only tables: `artifact_lineage`, `handoff_events`, `stage_entries`, `stage_loop_signals`.
- Enforce constraints: unique (run_id, stage, attempt), required reasons for supersedes/failures, idempotent migrations.
- **Done when:** Migration runs cleanly, constraints prevent incomplete/incoherent records.

### 2. Enum/Config Layer
- Define enums in a single repo-visible file (e.g., `07_DeliveryIntegrityEnums.yaml`).
- Import enums from code, never duplicate as literals.
- **Done when:** Orchestration imports enums, unknown/fallback policy is documented.

### 3. Orchestration Service Layer
- Implement: `recordArtifactAttempt`, `recordHandoffOutcome`, `recordStageEntry`.
- Orchestration must own all classification logic.
- **Done when:** All attempts and handoffs are classified and persisted by orchestration.

### 4. Event Emission Layer
- Emit events only after persistence: `artifact_attempt_created`, `artifact_superseded`, `handoff_completed`, `handoff_failed`, `stage_loop_detected`.
- **Done when:** Every persistence action emits a matching event.

### 5. Operator Read Model
- Build query layer to expose: current stage, artifact type, attempt, last reason, handoff status, loop flag, next action.
- **Done when:** Operator can load all required data without reconstructing from raw tables.

### 6. Operator UI Layer
- UI must show only orchestration/read-model truth, not raw logs or derived metrics.
- **Done when:** Operator can answer: Are we progressing? Why did this come back? What’s next?

### 7. Acceptance Tests
- Add system-level tests for all critical flows and failure modes.
- **Done when:** Tests fail if any critical delivery integrity property is violated.

### 8. Operational Alert Queries
- Add queries for: excessive rework, unknown reason overuse, repeated loops, repeated handoff failures.
- **Done when:** System can flag runs with weak classification or instability.

---

## Quality Criteria
- No business logic in UI or worker; orchestration is source of truth.
- All enums/configs are single-sourced and imported.
- All failure cases and loops are tested.
- Operator can answer core delivery questions from UI alone.

---

## Example Prompts
- “Guide me through delivery integrity implementation.”
- “Review my delivery integrity PR for completeness.”
- “What’s missing from my delivery integrity instrumentation?”

---

## Related Customizations
- Add a code review checklist skill for delivery integrity.
- Create a skill for operational alert query design.
- Build a skill for acceptance test authoring in governed systems.
