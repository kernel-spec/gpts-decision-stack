# implementation_checklist_delivery_integrity_v1.md

## Status
Draft v1

## Purpose

This checklist defines the implementation order for `delivery_integrity_instrumentation_v1`.

It is intended for the builder/coder responsible for:
- persistence changes
- orchestration service changes
- event emission
- operator UI exposure
- acceptance test coverage

This checklist is execution-oriented.
It exists to prevent partial implementation that logs data without producing usable delivery truth.

---

## 1. Build Objective

Implementation is successful only if the system can answer, for any active run:

- Which attempt is the current artifact?
- Was the previous artifact replaced?
- Why was it replaced?
- Did the last handoff succeed or fail?
- Is the run progressing or looping?
- What is the next correct action?

If the implementation only stores lineage data but does not expose next-step operating truth, it is incomplete.

---

## 2. Implementation Sequence

Implementation order is mandatory:

1. Persistence layer
2. Enum/config layer
3. Orchestration service layer
4. Event emission layer
5. Operator read-model / query layer
6. Operator UI layer
7. Acceptance tests
8. Operational alert queries

Do not start with UI.
Do not start with dashboards.
Do not start with derived metrics.

---

## 3. Phase 1 — Persistence Layer

## Goal
Create append-only storage for delivery integrity records.

## Files
- `migrations/<timestamp>__create_delivery_integrity_tables.sql`

## Must create
- `artifact_lineage`
- `handoff_events`
- `stage_entries`
- `stage_loop_signals`

## Required checks
- unique `(run_id, stage, attempt)` on `artifact_lineage`
- `attempt > 1` requires `supersedes_artifact_id`
- `attempt > 1` requires `replacement_reason`
- `classified_by = orchestration`
- `handoff status = FAILED` requires `failure_reason`
- `stage_loop_signals.entry_count >= 2`

## Done when
- migration runs cleanly on empty DB
- migration is idempotent or safely guarded with `if not exists`
- schema constraints reject incomplete repair attempts

## Failure to avoid
Do not allow the DB layer to accept:
- superseding artifact without reason
- handoff failed without failure reason
- loop signal without loop type

---

## 4. Phase 2 — Enum / Config Layer

## Goal
Make reason taxonomy explicit and repo-visible.

## Files
- `knowledge/core/07_DeliveryIntegrityEnums.yaml`

## Must define
- `replacement_reason`
- `handoff_failure_reason`
- `loop_type`
- `next_action_code`

## Done when
- enums are not duplicated in code as hidden string literals
- orchestration imports from one source of truth
- unknown/fallback policy is documented

## Failure to avoid
Do not let:
- workers invent enum values
- UI remap enum values into alternate truth
- code silently accept unknown enum members

---

## 5. Phase 3 — Orchestration Service Layer

## Goal
Make orchestration the sole owner of delivery classification.

## Required service functions
- `recordArtifactAttempt(...)`
- `recordHandoffOutcome(...)`
- `recordStageEntry(...)`

## 5.1 recordArtifactAttempt

### Must do
- load latest lineage for `(run_id, stage)`
- assign `attempt`
- determine `supersedes_artifact_id`
- classify `replacement_reason`
- persist row into `artifact_lineage`

### Input dependencies
- parser verdict
- review verdict
- transition context
- scope fingerprint change flag if available
- override flag

### Hard rule
If `attempt > 1` and no replacement reason can be assigned:
- reject persist
- return explicit error

### Done when
- first artifact in stage always becomes `attempt = 1`
- second artifact in same stage always becomes `attempt = 2`
- every repair attempt is classified by orchestration

---

## 5.2 recordHandoffOutcome

### Must do
- evaluate whether transition boundary completed or failed
- assign handoff status
- if failed, assign `failure_reason`
- persist row into `handoff_events`

### Input dependencies
- parser verdict
- review verdict
- legal transition result
- reentry readiness
- owner resolution state

### Done when
- every stage transition attempt produces either completed or failed record
- no silent handoff failures remain

---

## 5.3 recordStageEntry

### Must do
- append stage entry record
- count entries for `(run_id, stage)`
- emit `SAME_STAGE_REPEAT` signal on second entry or later
- optionally detect `TWO_NODE_LOOP` later

### Done when
- repeated entry into same stage becomes explicitly visible

## Failure to avoid
Do not derive loops only in UI.
Loop detection must exist in orchestration/store truth.

---

## 6. Phase 4 — Event Emission Layer

## Goal
Emit lightweight append-only events after persistence truth is created.

## Must emit
- `artifact_attempt_created`
- `artifact_superseded`
- `handoff_completed`
- `handoff_failed`
- `stage_loop_detected`

## Rule
Persist first.
Emit second.

Event stream must not be the only truth source.

## Done when
- every successful persistence action produces matching event
- replay is not required to reconstruct primary truth

## Failure to avoid
Do not build an event-only design for v1.
This layer is instrumentation, not a full event-sourced rewrite.

---

## 7. Phase 5 — Operator Read Model

## Goal
Create a minimal query layer that turns raw lineage/handoff records into usable operating truth.

## Required query outputs per run
- `current_stage`
- `current_artifact_type`
- `current_attempt`
- `last_replacement_reason`
- `last_handoff_status`
- `loop_flag`
- `next_action_code`

## Suggested read-model functions
- `getRunDeliverySummary(run_id)`
- `getRunDeliveryHistory(run_id)`
- `getRunNextAction(run_id)`

## Done when
Operator-facing data can be loaded without reading raw logs or joining five tables manually in UI code.

## Failure to avoid
Do not make UI reconstruct truth directly from base tables.
That spreads classification logic out of orchestration.

---

## 8. Phase 6 — Operator UI Layer

## Goal
Expose minimal delivery truth, not observability noise.

## Must show
### Run Summary
- stage
- artifact type
- attempt number
- handoff status
- loop yes/no

### Delivery History
- compact attempt chain
- replacement reason per supersede

### Next Action
- `REPAIR_SAME_STAGE`
- `RETURN_TO_PREVIOUS_STAGE`
- `REVIEW_REQUIRED`
- `MANUAL_OVERRIDE_REQUIRED`
- `READY_FOR_NEXT_STAGE`

## Must not show by default
- raw parser defects dump
- deep transition internals
- full event stream
- low-level DB identifiers
- debug-only metadata

## Done when
An operator can answer:
- “Are we progressing?”
- “Why did this come back?”
- “Do I repair here or send it upstream?”

within one screen view.

## Failure to avoid
Do not turn operator UI into a debugging console.
If the UI needs raw logs to explain the state, orchestration read-model is incomplete.

---

## 9. Phase 7 — Acceptance Tests

## Goal
Prove the new layer works at system level, not only per function.

## Add tests
- `AC-DI-001-first-attempt`
- `AC-DI-002-missing-section-repair`
- `AC-DI-003-replacement-reason-required`
- `AC-DI-004-handoff-failed-reentry`
- `AC-DI-005-stage-loop`
- `AC-DI-006-unknown-threshold`

## Must verify
- first attempt behavior
- repair attempt classification
- failed persist when reason missing
- handoff failure classification
- loop signal creation
- unknown threshold alert logic

## Done when
Tests fail if:
- repair attempts can be persisted silently
- handoff failures disappear
- repeated stage entry is invisible
- unknown reason overuse is not detectable

---

## 10. Phase 8 — Operational Alert Queries

## Goal
Add minimal operational checks without building dashboard sprawl.

## Required alert checks
- excessive rework in stage
- unknown reason overuse
- repeated stage loop
- repeated handoff failure

## Suggested thresholds
- attempts in same stage > 2
- unknown replacement reasons > 20% of superseding attempts
- same stage entered more than once
- handoff failures >= 2 per run

## Done when
The system can flag:
- “this run is spinning”
- “classification quality is weak”
- “handoffs are unstable”

## Failure to avoid
Do not start with notifications or paging.
Start with queryable flags and operator/founder review.

---

## 11. Dependency Map

### Persistence depends on
- nothing new upstream

### Enum/config depends on
- agreed taxonomy

### Orchestration depends on
- persistence
- enums
- parser verdict availability
- review verdict availability
- transition context availability

### Events depend on
- orchestration persistence success

### Read-model depends on
- persistence truth existing

### UI depends on
- read-model existing

### Acceptance tests depend on
- full vertical slice from orchestration to persistence

---

## 12. Suggested Delivery Order by PR

## PR 1
- migration
- enums file

## PR 2
- `recordArtifactAttempt`
- DB writes for `artifact_lineage`

## PR 3
- `recordHandoffOutcome`
- DB writes for `handoff_events`

## PR 4
- `recordStageEntry`
- `stage_loop_signals`

## PR 5
- event emission

## PR 6
- read-model queries

## PR 7
- operator UI panels

## PR 8
- acceptance tests
- operational alert queries

This order keeps the system usable after each layer without pretending the UI exists before truth exists.

---

## 13. Code Review Checklist

Reviewer must confirm:

### Persistence
- constraints enforce required repair classification
- append-only behavior is preserved

### Orchestration
- worker is not source of truth for replacement reason
- parser influences but does not own final classification
- fallback to `UNKNOWN` is narrow and explicit

### Delivery truth ownership
- orchestration is the sole owner of delivery classification (attempt, replacement_reason, handoff verdict, loop signal)
- no delivery truth is derived from worker self-report, PR automation, or evidence document content
- evidence PRs (post-merge verification docs, pilot records, checklist updates) are operational artifacts — they are not deploy events and do not constitute delivery truth
- a merged PR that contains only docs/evidence changes does not imply a deploy ran; check the workflow run on the merge commit

### UI
- no hidden business logic in frontend
- UI renders orchestration truth, does not infer it

### Tests
- failure cases are covered, not just happy paths
- same-stage repeat is explicitly tested
- failed handoff is explicitly tested

---

## 14. Final Definition of Done

Implementation is done only when all of the following are true:

1. Every artifact attempt is recorded with deterministic attempt numbering.
2. Every superseding attempt has orchestration-owned replacement classification.
3. Every stage handoff is recorded as completed or failed.
4. Re-entry into the same stage emits a loop signal.
5. Operator can see current attempt, last reason, handoff state, and next action.
6. Acceptance tests cover the critical failure modes.
7. No delivery truth depends on worker self-report.
8. No delivery truth depends on operator memory or manual reconstruction.

If any one of these is false, delivery integrity is not implemented.

The hardest control question for the coder is only this:
Will the UI only display orchestration truth, or will it start calculating part of “why this came back” by itself?
If it does the latter, source of truth will split in v1.
