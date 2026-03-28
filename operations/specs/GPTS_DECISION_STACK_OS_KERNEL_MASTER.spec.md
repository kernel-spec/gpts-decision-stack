# GPTS_DECISION_STACK_OS_KERNEL_MASTER — founder OS kernel baseline

## Purpose

This spec defines the baseline operating contract for a founder-facing console that sits above the existing Worker kernel in `gpts-decision-stack`.

This document is intentionally spec-only. It does **not** introduce runtime handlers, action implementations, prompt rewrites, dashboard behavior, or control-plane ownership changes.

## Baseline architecture

The founder OS kernel is a two-layer operating model:

1. **Worker kernel (system of record):** Cloudflare Worker plus D1 and R2 own persisted state, artifact storage, transition enforcement, and auditability.
2. **Founder console (thin orchestration shell):** Custom GPT Actions provide a founder-facing UI surface for reading state, surfacing next steps, collecting founder decisions, and sending bounded requests to the Worker kernel.

The founder console is **not** a monolithic super-GPT and is **not** control-plane truth. It is a thin orchestration shell above the Worker.

## Source-of-truth precedence

When sources disagree, the founder OS kernel MUST normalize in the following order:

1. **Actual Worker state** in D1 and Worker responses
2. **Actual files and stored artifacts** in R2 or canonical repository artifacts
3. **Structured action responses** returned by the backend contract
4. **Chat reasoning, summaries, or model memory**

Normalization rules:

- Actual Worker state **wins** over chat reasoning.
- Actual files and stored artifacts **win** over summaries.
- Custom GPT output may explain or summarize state, but it MUST NOT redefine it.
- The founder console MUST treat missing or uncertain data as unresolved and request canonical state rather than infer.

## Responsibility split

| Layer | Owns | Must not own |
|---|---|---|
| Worker | Canonical session state, transition rules, decision logs, approvals, veto enforcement, action execution, durable writes | Conversational UX, freeform founder explanation |
| D1 | Session state, decision status, approval/veto records, founder gate records, audit metadata | Artifact payload blobs, chat summaries |
| R2 | Canonical artifacts, stored files, model output payloads, evidence objects | Pipeline transition authority |
| Custom GPT founder console | Read state, present next action, collect founder input, call bounded actions, explain current gate | Durable control-plane truth, hidden state mutation, autonomous governance override |

## Founder console role

The founder console exists to give the founder a minimal operating surface above the Worker kernel.

It MUST:

- read canonical project status from Worker-backed actions
- surface the next bounded founder or system action
- save or submit founder artifacts through Worker-backed actions
- record model outputs as artifacts, not as truth
- raise explicit founder decision requests when a gate is reached

It MUST NOT:

- declare project state from chat alone
- advance canonical state without a Worker-backed action
- bypass veto, approval, or release constraints
- present itself as the owner of business truth, artifact truth, or pipeline truth

## Mandatory founder gate boundaries

The founder console MUST surface `FOUNDER_DECISION_REQUIRED` at the following boundaries:

1. **Commercial commitment boundary**  
   When the system is ready to propose a concrete commercial direction, offer, or sell-ready posture that changes external go-to-market behavior.

2. **Production closure boundary**  
   When the system is ready to declare a project closed, shipped, retired, or operationally complete.

3. **Exception boundary**  
   When the Worker returns `escalate`, `blocked`, `stop`, `unresolved`, or a conflict that cannot be resolved automatically from canonical data.

4. **Founder override boundary**  
   When a proposed action would change priorities, scope, sequencing, or acceptance of material artifacts beyond deterministic Worker rules.

`FOUNDER_DECISION_REQUIRED` is a founder gate marker for the founder surface. It is **not** a replacement for canonical `pipeline_state` or `decision_status` in the Worker contract.

## Worker and GPT operating contract

### Worker responsibilities

The Worker kernel MUST:

- evaluate and persist canonical state
- enforce transition and veto rules
- persist artifacts and model outputs to D1 and/or R2
- return structured responses that the founder console can render
- mark when founder input is required before further progress

### Founder console responsibilities

The founder console MUST:

- call only defined Actions
- render Worker-returned state without reinterpretation
- request a founder decision only when the Worker or spec boundary requires it
- submit founder choices as explicit action calls

## Required actions

The founder baseline action surface consists of:

- `get_project_status`
- `get_next_action`
- `save_artifact`
- `record_model_output`
- `check_sell_ready`
- `check_production_closure`
- `request_founder_decision`

These actions are founder-console entry points only. Their implementation of record belongs to Worker + D1 + R2.

## Request/response contract baseline references

Until PR-2 adds runtime handlers, the founder OS kernel baseline MUST align to these existing references:

- `/home/runner/work/gpts-decision-stack/gpts-decision-stack/actions/openapi.yaml`
- `/home/runner/work/gpts-decision-stack/gpts-decision-stack/operations/endpoint_owner_mapping.yaml`
- `/home/runner/work/gpts-decision-stack/gpts-decision-stack/knowledge/core/01_CanonicalStates.yaml`
- `/home/runner/work/gpts-decision-stack/gpts-decision-stack/knowledge/core/04_AuthorityMatrix.yaml`
- `/home/runner/work/gpts-decision-stack/gpts-decision-stack/MASTER_SPEC.md`

Baseline contract expectations:

- responses MUST be structured and machine-readable
- state-bearing responses MUST come from Worker-backed reads
- write actions MUST return the persisted canonical result, not only an acknowledgement
- founder-gate responses SHOULD include a machine-readable marker equivalent to `FOUNDER_DECISION_REQUIRED`
- canonical state enums remain Worker-owned even when a founder gate is active

## Automatic state changes vs founder-required gates

### States that may change automatically

The following canonical states may advance automatically when their existing Worker entry conditions are satisfied and no founder gate is active:

- `intake`
- `problem_framing`
- `primitive_selection`
- `architecture_validation`
- `claims_validation`
- `risk_governance_validation`

`commercial_packaging` may be updated automatically for evidence collection, packaging drafts, and status refreshes, but not for founder-significant commitment decisions.

### States or transitions that require `FOUNDER_DECISION_REQUIRED`

The founder console MUST require `FOUNDER_DECISION_REQUIRED` before allowing or presenting a final founder approval on:

- a sell-ready determination emerging from `commercial_packaging`
- any production closure or completion decision associated with `release_decision` or `completed`
- any path where the Worker returns `escalate`, `blocked`, `stop`, or `unresolved`
- any manual override that changes scope, sequence, external commitment, or closure posture

## Operating rules for founder decisions

- Founder decisions MUST be explicit, durable, and action-backed.
- Founder decisions MUST be logged in Worker-controlled storage.
- A founder explanation in chat is insufficient unless submitted through the action surface.
- Founder decisions may authorize a next action, but they do not rewrite historical canonical state.
- If Worker state and founder chat conflict, the console MUST re-read Worker state and present the conflict rather than improvise.

## Baseline outcome for PR-1

PR-1 establishes only the documentation baseline:

- Worker remains the operating kernel.
- D1 and R2 remain the source of truth.
- Custom GPT remains a thin founder console / UI layer.
- Founder decisions are mandatory only at defined boundaries.
- Action implementation, prompt updates, and backend changes are deferred to later PRs.
