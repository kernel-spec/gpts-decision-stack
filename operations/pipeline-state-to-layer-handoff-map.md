# Pipeline State to Layer Handoff Map

Implementation-facing handoff artifact for RUN-002 FLOW 6.

This document maps the canonical pipeline states to the validated 3-layer GPT model while preserving existing repository authority boundaries:

- **Worker/kernel remains the system of record**
- **GPT layers remain thin shells**
- **UNKNOWN remains fail-closed**
- **Review / Gate remains mandatory**
- **No Proven/Productized claim is made here**

## Layer legend

| GPT layer | Scope | Primary owners |
|---|---|---|
| Layer 1 — Intake / Routing | Session intake, state identification, next-owner routing, explicit UNKNOWN capture, explicit re-entry logging | `CP-Governor`, `AE-Intake` |
| Layer 2 — Specialist Execution | State-scoped artifact production only | `AE-Framing`, `AE-Primitive`, `AE-Architecture`, `AE-Claims`, `AE-RiskGov`, `AE-Commercial` |
| Layer 3 — Review / Gate | Claims audit, transition validation, release gating | `CP-ContractAuditor`, `CP-TransitionJudge`, `CP-ReleaseArbiter` |

## Canonical pipeline handoff map

| Pipeline state | Owning GPT layer | Primary GPT owner | Required Worker-held inputs | Required gate checks | Explicit re-entry target if unmet |
|---|---|---|---|---|---|
| `intake` | Layer 1 — Intake / Routing | `AE-Intake` with `CP-Governor` routing | `session_id`; raw request package; current session state; prior decision log; prior re-entry record if present | Request package exists; missing required intake fields are persisted as `UNKNOWN`; no speculative normalization; route decision recorded in `StateDecisionPacket` | `intake` |
| `problem_framing` | Layer 2 — Specialist Execution | `AE-Framing` | persisted `ProblemBrief`; session context; requestor/buyer fields as provided; current decision log | `ProblemBrief.decision_status = proceed`; framing-required fields are present or explicitly `UNKNOWN`; `UNKNOWN` blocks a valid framing outcome where required | `intake` |
| `primitive_selection` | Layer 2 — Specialist Execution | `AE-Primitive` | persisted `FramingAssessment`; current state; prior blocking issues and unknowns | `FramingAssessment.framing_validity = valid`; no skipped state; no unresolved framing blockers | `problem_framing` |
| `architecture_validation` | Layer 2 — Specialist Execution | `AE-Architecture` | persisted `OfferDecision`; current state; prior decision log; active governance context | `OfferDecision.decision_status = proceed`; selected primitive is valid for the framing; no unresolved upstream blocker | `primitive_selection` |
| `claims_validation` | Layer 2 — Specialist Execution | `AE-Claims` | persisted `ArchitectureSpec`; evidence package references held by Worker; current state; prior unknowns | `ArchitectureSpec.decision_status = proceed`; claims evidence is present and explicit; `UNKNOWN` evidence cannot be treated as verified or allowed | `architecture_validation` |
| `risk_governance_validation` | Layer 2 — Specialist Execution | `AE-RiskGov` | persisted `ClaimsDecision`; governance context; active policy state; current decision log | `ClaimsDecision.decision_status = allowed` or `proceed`; forbidden or unsupported claims block progression; unresolved governance inputs remain fail-closed | `claims_validation` |
| `commercial_packaging` | Layer 2 — Specialist Execution | `AE-Commercial` | persisted `RiskDecision`; commercial context; active review topology inputs; current state | `RiskDecision.decision_status = proceed` or `escalate`; packaging cannot weaken governance constraints; unresolved required review/approval inputs remain blocking | `risk_governance_validation` |
| `release_decision` | Layer 3 — Review / Gate | `CP-ReleaseArbiter` with `CP-TransitionJudge` and `CP-ContractAuditor` support | persisted `CommercialSpec`; persisted `ClaimsDecision`; persisted `RiskDecision`; approval status; veto status; review-lane status; staging/promotional gate status; full decision log | `CommercialSpec.decision_status = proceed`; no active veto; all mandatory approvals present; all mandatory review lanes cleared; no forbidden claims remain; no blocking risk status remains; regulated approval gaps escalate; missing required artifacts block | `commercial_packaging` for package defects; otherwise **no automatic re-entry** — remain `blocked` or `escalate` until explicit authority action is recorded by Worker |

## Supporting review-routing handoff

`review_routing` is present in the repository as an adaptive support capability and is not added here as a new canonical forward pipeline layer or state sequence.

| Support capability | Owning GPT layer | Primary GPT owner | Required Worker-held inputs | Required gate checks | Explicit re-entry target if unmet |
|---|---|---|---|---|---|
| `review_routing` | Layer 2 — Specialist Execution | `AE-ReviewRouter` | `ProblemBrief`; requestor type; buyer type; `RiskDecision`; compliance triggers; current review status | Mandatory review lanes must be activated for enterprise / regulated / high-risk contexts; `UNKNOWN` requestor or buyer type triggers conservative routing and blocks minimal topology | Re-enter the state that requested routing, with explicit blocker resolution recorded in Worker |

## Worker authority notes

The Worker/kernel remains authoritative for:

- pipeline state
- artifact persistence
- decision log persistence
- approval truth
- veto truth
- release authority
- explicit re-entry recording

GPT outputs may recommend, validate, block, or escalate, but they do not replace Worker-held truth.

## Source anchors

- `/home/runner/work/gpts-decision-stack/gpts-decision-stack/MASTER_SPEC.md`
- `/home/runner/work/gpts-decision-stack/gpts-decision-stack/repo.manifest.yaml`
- `/home/runner/work/gpts-decision-stack/gpts-decision-stack/operations/backend_binding.yaml`
- `/home/runner/work/gpts-decision-stack/gpts-decision-stack/knowledge/core/02_TransitionRules.yaml`
- `/home/runner/work/gpts-decision-stack/gpts-decision-stack/knowledge/core/04_AuthorityMatrix.yaml`
- `/home/runner/work/gpts-decision-stack/gpts-decision-stack/knowledge/domains/default/17_ReviewLaneRules.yaml`
