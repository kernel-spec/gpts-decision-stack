# delivery_integrity_instrumentation_v1.md

## Status
Draft v1

## Owner
Orchestration / Control Plane

## Purpose

This document defines the first delivery-integrity instrumentation layer for `gpts-decision-stack`.

The repository already defines:
- explicit control-plane agents
- explicit adaptive engines
- ordered pipeline states
- artifact schemas per stage
- re-entry policy
- backend bindings
- acceptance tests

This instrumentation does not introduce a new workflow system.
It introduces visibility into whether delivery is actually progressing.

---

## 1. Problem Statement

The stack can currently appear healthy while delivery is functionally degraded.

A run may have:
- valid artifacts
- valid schemas
- legal stage transitions
- active re-entry
- review routing
- release logic

and still fail economically and operationally because:
- the same stage is retried multiple times without visible reason
- handoff failures are not represented as first-class delivery events
- a run loops between stages and looks "active"
- operators cannot tell whether a return is due to quality, handoff, review, or latent scope drift
- founders see pipeline movement but not delivery truth

This creates a delivery illusion:
artifact activity is mistaken for progress.

---

## 2. Design Objective

Add the minimum instrumentation required to answer these questions for every run:

1. Is this a first attempt or a repair attempt?
2. If it is a repair attempt, what caused the previous attempt to be replaced?
3. Did the handoff to the next stage actually succeed?
4. Is the run moving forward or looping?
5. Can the operator see the next correct action without reading raw logs?

---

## 3. Non-Goals

This specification does not:
- change business truth
- change routing legality
- replace parser validation
- replace review topology
- replace release logic
- build a dashboarding platform
- build a generalized observability layer
- classify semantic business correctness

It only adds delivery-integrity truth.

---

## 4. Architectural Principle

### 4.1 Source of truth

Delivery instrumentation truth is owned by orchestration.

Not by:
- worker self-report
- parser alone
- reviewer alone
- UI annotations
- manual operator memory

### 4.2 Why orchestration owns classification

Orchestration is the only layer that can see all of:
- current expected stage
- previous artifact in stage
- parser verdict
- review outcome
- legal transition outcome
- re-entry readiness
- actual return to same stage
- downstream handoff acceptance or rejection

Therefore:
- `attempt`
- `supersedes_artifact_id`
- `replacement_reason`
- `handoff status`
- `handoff failure reason`
- `stage loop signal`

must all be orchestration-owned.

### 4.3 Parser role

Parser may emit inputs such as:
- `schema_valid`
- `required_sections_present`
- `stage_matches_expected`
- `reentry_ready`
- `issues_flagged[]`

Parser does not own delivery reason truth.

### 4.4 Worker role

Worker may emit:
- raw artifact
- normalized artifact
- internal worker metadata if needed

Worker does not own:
- replacement reason
- handoff verdict
- loop detection
- repair classification

---

## 5. Scope of Implementation

This v1 introduces:

### New persistence objects
- `artifact_lineage`
- `handoff_events`
- `stage_entries`
- `stage_loop_signals`

### New orchestration event types
- `artifact_attempt_created`
- `artifact_superseded`
- `handoff_completed`
- `handoff_failed`
- `stage_loop_detected`

### New orchestration service functions
- `recordArtifactAttempt`
- `recordHandoffOutcome`
- `recordStageEntry`

### New operator-facing outputs
- current attempt number
- last replacement reason
- handoff status
- loop flag
- next action

---

## 6. Attachment Points in Current Stack

This layer attaches to the existing repository topology defined in the canonical manifest.

### 6.1 Adaptive engine artifact return
Attach immediately after artifact return from:
- `AE-Intake`
- `AE-Framing`
- `AE-Primitive`
- `AE-Architecture`
- `AE-Claims`
- `AE-RiskGov`
- `AE-Commercial`
- `AE-ReviewRouter`

### 6.2 Transition decision boundary
Attach at the transition boundary aligned with `CP-TransitionJudge`.

### 6.3 Store / evidence boundary
Persist all delivery-integrity objects append-only.

### 6.4 UI / operator layer
Expose only minimal operating truth:
- current attempt
- last reason
- handoff success/failure
- loop flag
- next action

---

## 7. Delivery Integrity Data Model

## 7.1 artifact_lineage

One row per artifact attempt in a given run/stage.

### Logical meaning
This object answers:
- Is this the first attempt in this stage?
- If not, which artifact did it replace?
- Why was the previous attempt replaced?
- Was this a repair attempt?

### Required fields
- `lineage_id`
- `run_id`
- `artifact_id`
- `artifact_type`
- `stage`
- `attempt`
- `created_at`
- `created_by_role`
- `classified_by`
- `is_repair_attempt`
- `is_first_attempt_in_stage`

### Conditional fields
- `supersedes_artifact_id` is required when `attempt > 1`
- `replacement_reason` is required when `attempt > 1`
- `replacement_reason_source` is required when `attempt > 1`

### Invariants
- exactly one row per `(run_id, stage, attempt)`
- `attempt = 1` implies no superseded artifact
- `attempt > 1` implies replacement reason must exist
- `classified_by = orchestration`

---

## 7.2 handoff_events

One row per attempted stage handoff.

### Logical meaning
This object answers:
- Did a transition boundary actually succeed?
- If not, what failed?
- Was the artifact accepted as valid input to the next step?

### Required fields
- `handoff_id`
- `run_id`
- `from_stage`
- `to_stage`
- `from_artifact_id`
- `status`
- `classified_by`
- `created_at`

### Conditional fields
- `failure_reason` is required if `status = FAILED`
- `to_artifact_id` may be null on failed handoff

---

## 7.3 stage_entries

One row per stage entry.

### Logical meaning
This object answers:
- How many times has this run entered this stage?
- Is the same stage being reopened?
- Can a loop signal be computed deterministically?

### Required fields
- `entry_id`
- `run_id`
- `stage`
- `entered_by`
- `entered_at`

---

## 7.4 stage_loop_signals

A small signal object emitted when looping is detected.

### Logical meaning
This object answers:
- Is the run re-entering a stage?
- Is the run bouncing in a simple stage loop?

### Required fields
- `loop_signal_id`
- `run_id`
- `stage`
- `loop_type`
- `entry_count`
- `classified_by`
- `detected_at`

---

## 8. Enum Definitions

Enum values are defined in:
`knowledge/core/07_DeliveryIntegrityEnums.yaml`

### replacement_reason
- QUALITY_ISSUE
- MISSING_REQUIRED_SECTION
- INVALID_SCHEMA
- HANDOFF_REJECTED
- REVIEW_BLOCK
- SCOPE_CHANGE
- STAGE_MISMATCH
- UNKNOWN

### handoff_failure_reason
- INVALID_INPUT
- MISSING_FIELDS
- AMBIGUOUS_OWNER
- SCHEMA_MISMATCH
- REVIEW_REJECTED
- REENTRY_NOT_READY
- UNKNOWN

### loop_type
- SAME_STAGE_REPEAT
- TWO_NODE_LOOP

### next_action_code
- REPAIR_SAME_STAGE
- RETURN_TO_PREVIOUS_STAGE
- REVIEW_REQUIRED
- MANUAL_OVERRIDE_REQUIRED
- READY_FOR_NEXT_STAGE

---

## 9. Orchestration Rules

## 9.1 Attempt assignment

When a new artifact is received for `(run_id, stage)`:

1. Query latest `artifact_lineage` row for `(run_id, stage)`
2. If none exists:
   - `attempt = 1`
   - `supersedes_artifact_id = null`
   - `is_first_attempt_in_stage = true`
   - `is_repair_attempt = false`
3. Else:
   - `attempt = previous.attempt + 1`
   - `supersedes_artifact_id = previous.artifact_id`
   - `is_first_attempt_in_stage = false`
   - `is_repair_attempt = true`

### Pseudocode

```text
previous = find_latest_lineage(run_id, stage)

if previous is null:
    attempt = 1
    supersedes_artifact_id = null
    is_first_attempt_in_stage = true
    is_repair_attempt = false
else:
    attempt = previous.attempt + 1
    supersedes_artifact_id = previous.artifact_id
    is_first_attempt_in_stage = false
    is_repair_attempt = true
```

---

## 9.2 Replacement reason classification

### Inputs used by orchestration
- parser verdict
- review verdict
- legal transition status
- handoff outcome
- scope fingerprint delta if already available
- current stage expectation

### v1 classification precedence

Use first-match precedence:

```text
if parser.schema_valid == false:
    replacement_reason = INVALID_SCHEMA

else if parser.required_sections_present == false:
    replacement_reason = MISSING_REQUIRED_SECTION

else if parser.stage_matches_expected == false:
    replacement_reason = STAGE_MISMATCH

else if review.status == 'BLOCKED':
    replacement_reason = REVIEW_BLOCK

else if handoff.status == 'FAILED':
    replacement_reason = HANDOFF_REJECTED

else if scope_fingerprint_changed == true:
    replacement_reason = SCOPE_CHANGE

else if attempt > 1:
    replacement_reason = QUALITY_ISSUE

else:
    replacement_reason = null
```

### Important design note

This is not causal truth for the entire system.
It is the nearest operational reason for replacement in the delivery layer.

---

## 9.3 Hard write rule

No superseding artifact may persist without orchestration classification.

### Rule

```text
if attempt > 1 and replacement_reason is null:
    reject_persist("replacement_reason_required")
```

This prevents silent rework.

---

## 9.4 Handoff outcome classification

A handoff exists whenever orchestration evaluates a move from one stage to the next legal stage boundary.

### Handoff = COMPLETED when
- artifact is valid for current stage
- required review is complete or not required
- `reentry_ready = true`
- next stage is legal
- no blocking delivery defect remains

### Handoff = FAILED when
- downstream stage cannot open
- review blocks transition
- parser blocks transition
- re-entry is not ready
- artifact is not acceptable as next-step input

### Pseudocode

```text
if legal_transition == true
   and parser.reentry_ready == true
   and no_blockers == true:
    status = COMPLETED
else:
    status = FAILED
```

---

## 9.5 Handoff failure reason classification

### v1 precedence

```text
if parser.schema_valid == false:
    failure_reason = SCHEMA_MISMATCH

else if parser.required_sections_present == false:
    failure_reason = MISSING_FIELDS

else if owner_resolution_failed == true:
    failure_reason = AMBIGUOUS_OWNER

else if review.status == 'BLOCKED':
    failure_reason = REVIEW_REJECTED

else if parser.reentry_ready == false:
    failure_reason = REENTRY_NOT_READY

else:
    failure_reason = INVALID_INPUT
```

Use `UNKNOWN` only for legacy or emergency fallback.

---

## 9.6 Stage loop detection

### SAME_STAGE_REPEAT

At each stage entry:
1. insert into `stage_entries`
2. count entries for `(run_id, stage)`
3. if count > 1, emit `stage_loop_detected` with `loop_type = SAME_STAGE_REPEAT`

### Pseudocode

```text
entry_count = count_stage_entries(run_id, stage)

if entry_count > 1:
    emit loop_type = SAME_STAGE_REPEAT
```

### TWO_NODE_LOOP

Optional in v1, recommended in v1.1.

Detect last three entries:
- `A -> B -> A`

### Pseudocode

```text
recent = last_three_stage_entries(run_id)

if recent matches [A, B, A]:
    emit loop_type = TWO_NODE_LOOP
```

---

## 10. Internal Service Contract

Suggested service functions.

### 10.1 recordArtifactAttempt

#### Input
- `run_id`
- `artifact_id`
- `artifact_type`
- `stage`
- `created_by_role`
- `parser_verdict`
- `review_verdict`
- `scope_fingerprint_changed`
- `transition_context`
- `override_flag`

#### Output
- `artifact_lineage` row

#### Responsibilities
- assign attempt number
- determine superseding relationship
- classify replacement reason
- persist `artifact_lineage`
- emit:
  - `artifact_attempt_created`
  - optionally `artifact_superseded`

---

### 10.2 recordHandoffOutcome

#### Input
- `run_id`
- `from_stage`
- `to_stage`
- `from_artifact_id`
- `to_artifact_id`
- `parser_verdict`
- `review_verdict`
- `legal_transition`
- `reentry_ready`
- `owner_resolution_state`
- `override_flag`

#### Output
- `handoff_events` row

#### Responsibilities
- classify completed vs failed
- classify failure reason if failed
- persist handoff event
- emit:
  - `handoff_completed`
  - or `handoff_failed`

---

### 10.3 recordStageEntry

#### Input
- `run_id`
- `stage`
- `entered_by`

#### Output
- `stage_entries` row
- optional `stage_loop_signals` row

#### Responsibilities
- persist stage entry
- count entries in stage
- detect same-stage repeat
- optionally detect two-node loop

---

## 11. Event Payloads

These are lightweight append-only events.
They are not the persistence truth themselves.

### artifact_attempt_created

```json
{
  "event_type": "artifact_attempt_created",
  "run_id": "RUN_2026_03_29_001",
  "artifact_id": "ART_009",
  "artifact_type": "FramingAssessment",
  "stage": "problem_framing",
  "attempt": 2,
  "timestamp": "2026-03-29T10:12:00Z"
}
```

### artifact_superseded

```json
{
  "event_type": "artifact_superseded",
  "run_id": "RUN_2026_03_29_001",
  "artifact_id": "ART_009",
  "supersedes_artifact_id": "ART_007",
  "artifact_type": "FramingAssessment",
  "stage": "problem_framing",
  "attempt": 2,
  "replacement_reason": "QUALITY_ISSUE",
  "timestamp": "2026-03-29T10:12:00Z"
}
```

### handoff_completed

```json
{
  "event_type": "handoff_completed",
  "run_id": "RUN_2026_03_29_001",
  "from_stage": "problem_framing",
  "to_stage": "primitive_selection",
  "from_artifact_id": "ART_009",
  "timestamp": "2026-03-29T10:13:00Z"
}
```

### handoff_failed

```json
{
  "event_type": "handoff_failed",
  "run_id": "RUN_2026_03_29_001",
  "from_stage": "problem_framing",
  "to_stage": "primitive_selection",
  "from_artifact_id": "ART_009",
  "failure_reason": "MISSING_FIELDS",
  "timestamp": "2026-03-29T10:13:00Z"
}
```

### stage_loop_detected

```json
{
  "event_type": "stage_loop_detected",
  "run_id": "RUN_2026_03_29_001",
  "stage": "problem_framing",
  "loop_type": "SAME_STAGE_REPEAT",
  "entry_count": 2,
  "timestamp": "2026-03-29T10:15:00Z"
}
```

---

## 12. Operator Layer Contract

The operator layer must stay narrow.
This is not a debugging console.

### 12.1 Run Summary Panel

Show:
- `current_stage`
- `current_artifact_type`
- `current_attempt`
- `handoff_status`
- `loop_flag`

### 12.2 Delivery History Panel

Show compact lineage:

`Attempt 1 -> Attempt 2 (MISSING_REQUIRED_SECTION) -> Attempt 3 (QUALITY_ISSUE)`

### 12.3 Next Action Panel

Return only orchestration-derived action codes:
- `REPAIR_SAME_STAGE`
- `RETURN_TO_PREVIOUS_STAGE`
- `REVIEW_REQUIRED`
- `MANUAL_OVERRIDE_REQUIRED`
- `READY_FOR_NEXT_STAGE`

UI displays; orchestration decides.

---

## 13. Derived Metrics

Do not store these as primary truth objects.
Compute them from persisted events or tables.

### Attempts per run
Count all rows in `artifact_lineage` grouped by `run_id`.

### Rework rate
`count(attempt > 1) / count(all attempts)`

### Stage loop rate
`count(distinct run_id in stage_loop_signals) / count(distinct run_id overall)`

### Replacement reason distribution
Count `replacement_reason` where `attempt > 1`.

### Handoff failure rate
`count(status = FAILED) / count(all handoffs)`

---

## 14. Operational Alerts

Keep alerts minimal and action-linked.

### Excessive rework
Flag run when:
- attempts in same stage > 2

### Unknown reason overuse
Flag system when:
- `UNKNOWN > 20%` of superseding attempts

### Repeated stage loop
Flag run when:
- same stage entered more than once

### Handoff instability
Flag run when:
- `handoff_failed >= 2`

---

## 15. Edge Cases

### 15.1 Legacy artifacts

If historical artifacts exist without lineage:
- create synthetic `attempt = 1`
- `supersedes_artifact_id = null`
- `replacement_reason = null`

Do not fabricate repair history retroactively.

### 15.2 Manual override

If a human forces a return, skip, or state jump:
- persist standard lineage/handoff object
- set `override_flag = true`
- classify best-effort reason
- if reason is genuinely unknown, use `UNKNOWN`

### 15.3 Parallel artifacts in one stage

Not supported in v1.
Linearize by time and preserve invariant:

`one active lineage chain per (run_id, stage)`

### 15.4 Scope drift + delivery defect together

Use precedence rules.
Record nearest delivery reason in this layer.
Do not try to model full causal graphs in v1.

---

## 16. Acceptance Tests

Add acceptance tests covering these scenarios.

### 16.1 First artifact in stage

Given:
- no prior artifact for `(run_id, stage)`

When:
- orchestration records artifact

Then:
- `attempt = 1`
- `supersedes_artifact_id` is null
- `is_first_attempt_in_stage = true`
- no `artifact_superseded` event emitted

### 16.2 Repair attempt after missing required section

Given:
- first artifact failed parser on missing required section

When:
- second artifact is recorded for same `(run_id, stage)`

Then:
- `attempt = 2`
- `supersedes_artifact_id = previous artifact_id`
- `replacement_reason = MISSING_REQUIRED_SECTION`

### 16.3 Reject superseding write without reason

Given:
- second attempt in same stage

When:
- orchestration tries to persist lineage with null `replacement_reason`

Then:
- persist fails

### 16.4 Failed handoff on re-entry not ready

Given:
- artifact exists
- `reentry_ready = false`

When:
- orchestration records handoff

Then:
- `status = FAILED`
- `failure_reason = REENTRY_NOT_READY`

### 16.5 Same-stage loop signal

Given:
- run enters `problem_framing` twice

When:
- second stage entry is recorded

Then:
- `stage_loop_signals.loop_type = SAME_STAGE_REPEAT`

### 16.6 Unknown reason alert threshold

Given:
- more than 20% of superseding attempts have `replacement_reason = UNKNOWN`

Then:
- operational alert is triggered

---

## 17. Suggested Repository Placement

Suggested file additions:
- `docs/instrumentation/delivery_integrity_instrumentation_v1.md`
- `knowledge/core/07_DeliveryIntegrityEnums.yaml`
- `migrations/<timestamp>__create_delivery_integrity_tables.sql`
- `tests/acceptance/AC-DI-001-first-attempt.yaml`
- `tests/acceptance/AC-DI-002-missing-section-repair.yaml`
- `tests/acceptance/AC-DI-003-replacement-reason-required.yaml`
- `tests/acceptance/AC-DI-004-handoff-failed-reentry.yaml`
- `tests/acceptance/AC-DI-005-stage-loop.yaml`
- `tests/acceptance/AC-DI-006-unknown-threshold.yaml`

---

## 18. Definition of Done

This delivery instrumentation is done when:
1. Every artifact written through orchestration has an attempt number.
2. Every superseding artifact has an orchestration-owned replacement reason.
3. Every stage handoff is recorded as `COMPLETED` or `FAILED`.
4. Every repeated entry into the same stage emits a loop signal.
5. Operator UI can show:
   - current attempt
   - last replacement reason
   - handoff status
   - loop flag
   - next action
6. No worker can persist its own delivery reason as source of truth.
7. Parser inputs may influence classification, but parser is not final owner of delivery reason truth.
8. All delivery-integrity records are append-only.

---

## 19. Why This Layer Exists

The repository already has enough governance structure to look complete:
control-plane agents, ordered states, schemas, backend bindings, acceptance fixtures, and release artifacts.

That is exactly why this layer is needed.

Without delivery-integrity instrumentation, the stack can:
- generate artifacts
- pass schemas
- move between states
- appear active

while still failing at the thing that matters operationally:
actual movement toward a usable delivery artifact

This layer makes three invisible conditions visible:
- a new artifact vs a retry of the same work
- a legal transition vs a failed handoff
- an active run vs a looping run

That is why it is the right first instrument for delivery.
