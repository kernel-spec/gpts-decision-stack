# iOS Operator Layer Deployment Spec

## Spec status

Canonical deployment spec for the single operator-facing GPT shell.

## Canonical deployment name

`GPTS_DECISION_STACK_IOS_OPERATOR_LAYER`

This is the only intended deployed GPT for the operator-facing mobile/iOS layer.

## Deployment model

The deployment model is:

- Worker = source of truth
- D1 = canonical runtime state / decisions / registry
- R2 = artifact and evidence storage
- Custom GPT = thin iOS/operator shell
- Specialists = internal orchestration protocol roles, not separate deployed GPTs

## Non-goals

This deployment is not:

- a second control plane
- a second governance kernel
- a second source of business truth
- a separate specialist GPT marketplace
- a dashboard replacement
- a freeform strategy assistant

## Deployment rule

Deploy exactly one operator-facing GPT:

`GPTS_DECISION_STACK_IOS_OPERATOR_LAYER`

Do not deploy separate user-facing GPTs for:

- MARKET_SCOUT_OUTBOUND
- LIST_BUILDER
- POSITIONING_POLICE
- ASSET_ENGINE
- DELIVERABILITY_GUARD
- PERFORMANCE_MEMORY
- CLAIMS_EVIDENCE_REVIEWER
- RELEASE_GATE_REVIEWER

Those remain internal protocol roles only.

## Source-of-truth precedence

The deployment must preserve this precedence:

1. Worker action results
2. actual saved artifacts
3. pasted model outputs
4. pasted terminal outputs
5. confirmed merged repo state
6. summaries / screenshots / previews

No GPT prompt or chat memory may override Worker-backed truth.

## Canonical repo package

The canonical deployment package lives at:

`custom_gpts/ios_operator_layer/`

### Builder import files

Use these repo files as the only Builder source:

- `custom_gpts/ios_operator_layer/builder/instructions.en.md`
- `custom_gpts/ios_operator_layer/builder/conversation_starters.en.md`
- `custom_gpts/ios_operator_layer/builder/knowledge_notes.en.md`

### Operator-facing files

Use these files for operator SOP and internal usage:

- `custom_gpts/ios_operator_layer/operator/sop.cs.md`
- `custom_gpts/ios_operator_layer/operator/quick_macros.cs.md`
- `custom_gpts/ios_operator_layer/operator/fail_macros.cs.md`

### Scenario cards

Use these files as canonical scenario inputs:

- `custom_gpts/ios_operator_layer/scenarios/revenue_simulation_new_icp_sales/01_discovery.md`
- `custom_gpts/ios_operator_layer/scenarios/revenue_simulation_new_icp_sales/02_icp_shortlist.md`
- `custom_gpts/ios_operator_layer/scenarios/revenue_simulation_new_icp_sales/03_positioning_claims.md`
- `custom_gpts/ios_operator_layer/scenarios/revenue_simulation_new_icp_sales/04_asset_generation.md`
- `custom_gpts/ios_operator_layer/scenarios/revenue_simulation_new_icp_sales/05_launch_safety.md`
- `custom_gpts/ios_operator_layer/scenarios/revenue_simulation_new_icp_sales/06_post_batch_decision.md`

## Builder wiring contract

### Builder Instructions field

Copy from:

`custom_gpts/ios_operator_layer/builder/instructions.en.md`

### Builder Conversation Starters field

Copy from:

`custom_gpts/ios_operator_layer/builder/conversation_starters.en.md`

### Builder Knowledge / notes field

Copy from:

`custom_gpts/ios_operator_layer/builder/knowledge_notes.en.md`

## Language split

The deployment contract is intentionally split:

- Builder import text = English
- operator usage layer = Czech

This keeps Builder stable and import-safe while preserving natural operator usage.

## Allowed action model

This GPT must remain a thin shell above Worker-backed actions.

The intended live action surface is Worker-backed and remains authoritative.

The GPT may:

- read current state
- read next action
- save artifacts
- record model outputs
- read closure/gating status
- request founder/operator decision packets when implemented in Worker-backed surface

The GPT may not:

- infer canonical state when an action exists
- invent closure
- invent approval
- invent evidence
- bypass required Worker checks
- promote review-required outputs directly to ready status

## Routing model

The internal orchestration model remains:

`SYSTEM_OS_MASTER → specialist → STACK_DEV_LAYER → SYSTEM_OS_MASTER`

This routing model is a prompt/protocol discipline, not a second runtime authority.

## Re-entry rule

No step is complete until:

`ROUTER RE-ENTRY READY: YES`

## Final status contract

Every step must close only as:

- PASS
- BLOCKED
- STOP

If status is not PASS, include:

- DEFECT TYPE
- BLOCKING REASON
- MINIMUM FIX REQUIRED

## Artifact naming rule

Use:

`[scenario]__[stage]__[role]__[run_id]__[version]`

## Deployment checklist

Before publishing or updating the GPT in Builder:

1. Confirm the deployment name remains `GPTS_DECISION_STACK_IOS_OPERATOR_LAYER`
2. Confirm only one operator-facing GPT is being deployed
3. Confirm Builder Instructions are copied from `builder/instructions.en.md`
4. Confirm Conversation Starters are copied from `builder/conversation_starters.en.md`
5. Confirm Knowledge notes are copied from `builder/knowledge_notes.en.md`
6. Confirm the live Actions import points to the builder-safe action schema currently intended for the operator shell
7. Confirm Worker remains source of truth
8. Confirm no scenario card has been turned into runtime truth
9. Confirm no specialist has been split into a separate user-facing GPT
10. Confirm operator SOP still matches the currently intended lane

## Operational update rule

When the iOS/operator layer changes:

- update repo package first
- update this deployment spec second
- update Builder fields third
- verify live behavior last

Never treat Builder as the canonical authoring location.

## Current default lane

Revenue Simulation – New ICP Sales

Default motion:
- Governed GPT Workflow Audit

Default target buyer:
- Head of RevOps / Revenue Operations leader in B2B SaaS

Default CTA:
- Book a 20-min diagnostic call

## Verdict

This deployment spec locks the repository to one canonical operator-facing GPT shell above Worker-backed truth.
