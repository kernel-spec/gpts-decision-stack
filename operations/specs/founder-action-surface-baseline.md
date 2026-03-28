# founder action surface baseline

## Purpose

This document defines the minimal founder action surface for the first founder-console implementation pass.

The action surface is intentionally narrow. It gives the founder enough control to inspect status, save bounded outputs, and clear explicit founder gates without moving source-of-truth responsibility out of the Worker kernel.

## Baseline principles

- **Worker / D1 / R2 are the source of truth.**
- **Custom GPT Actions are a UI layer only.**
- **The founder console is a thin orchestration shell above Worker.**
- **Chat reasoning is advisory; persisted Worker state is authoritative.**
- **Stored files and artifacts outrank summaries.**

## Minimal action surface

| Action | Primary purpose | System of record | Notes |
|---|---|---|---|
| `get_project_status` | Return canonical project/session status for the founder surface | Worker + D1 | Read-only status view |
| `get_next_action` | Return the next bounded recommended action from canonical state | Worker + D1 | Must not invent state |
| `save_artifact` | Persist founder-approved artifact or note payload | Worker + D1/R2 | Writes durable artifact result |
| `record_model_output` | Persist model-produced output as a stored artifact or trace | Worker + R2 with D1 metadata | Model output is evidence, not truth |
| `check_sell_ready` | Evaluate whether sell-ready conditions are met | Worker + D1/R2 | May trigger founder gate |
| `check_production_closure` | Evaluate whether production closure conditions are met | Worker + D1/R2 | May trigger founder gate |
| `request_founder_decision` | Open or resolve an explicit founder decision gate | Worker + D1 | Required for bounded manual decisions |

## UI-layer rule

Custom GPT Actions MUST behave as a rendering and submission layer:

- read canonical state from Worker-backed actions
- show the founder the current status and next action
- collect a bounded founder decision or artifact payload
- submit that decision back to the Worker

Custom GPT Actions MUST NOT:

- become the authoritative owner of project state
- synthesize canonical state from memory alone
- silently mutate state without a backend write
- claim that the Custom GPT is the control plane

## Action contract baseline

The first implementation pass SHOULD keep requests and responses minimal, stable, and implementation-usable.

### `get_project_status`

Must return enough canonical data for the founder surface to render:

- session or project identifier
- canonical state
- current decision status
- founder-gate status
- active blockers
- latest stored artifact references

### `get_next_action`

Must return:

- next recommended action identifier
- why that action is next
- whether it is automatic or founder-gated
- the blocking condition if no action can proceed

### `save_artifact`

Must:

- accept a bounded artifact type and payload
- persist through Worker-backed validation
- return the canonical stored result or validation failure

### `record_model_output`

Must:

- store model output as trace/evidence
- label it as model-produced
- avoid promoting raw model text to canonical business truth by itself

### `check_sell_ready`

Must:

- evaluate sell-ready conditions from actual Worker state and stored artifacts
- return pass/fail/incomplete style status
- surface `FOUNDER_DECISION_REQUIRED` when a founder approval boundary is reached

### `check_production_closure`

Must:

- evaluate closure readiness from actual Worker state and stored artifacts
- return pass/fail/incomplete style status
- surface `FOUNDER_DECISION_REQUIRED` when closure requires founder sign-off

### `request_founder_decision`

Must:

- create or resolve an explicit founder gate record
- capture the decision topic, options, rationale, and outcome
- return the canonical stored decision result

## Founder gate behavior

`FOUNDER_DECISION_REQUIRED` is the founder-console signal that automatic progress must pause until a founder decision is captured through the action surface.

It SHOULD be used for:

- sell-ready sign-off
- production closure sign-off
- unresolved exceptions surfaced by Worker state
- bounded manual overrides that cannot be derived automatically

It MUST NOT be used to replace canonical Worker `pipeline_state` or `decision_status`.

## Source-of-truth rules

The founder surface MUST apply the following precedence:

1. Worker response data
2. D1 records and R2 artifacts behind that response
3. Action response envelopes
4. Chat summaries or model reasoning

If any summary conflicts with actual state or files, the founder surface MUST display the canonical state and treat the summary as non-authoritative.

## Done condition for the first implementation pass

The first implementation pass is done when:

1. the founder console exposes exactly the seven baseline actions in this document
2. each action reads from or writes to Worker-backed state only
3. founder decisions are captured only through `request_founder_decision`
4. sell-ready and production-closure checks can raise `FOUNDER_DECISION_REQUIRED`
5. the founder surface can operate without claiming control-plane or source-of-truth ownership
6. no implementation introduces hidden memory state as a substitute for D1 or R2

## Explicit exclusions for this baseline

This baseline does not include:

- backend handler implementation
- `actions/openapi.yaml` changes
- prompt rewrites
- pilot changes
- dashboard work
- any non-spec runtime behavior
