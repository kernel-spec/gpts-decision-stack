# GPTS_DECISION_STACK_IOS_OPERATOR_LAYER

Thin iOS/operator shell for governed revenue simulation workflows.

## Purpose

This package defines one deployable Custom GPT layer that:

- acts as a thin operator-facing shell
- routes through a single orchestration discipline
- does not become a new source of truth
- sits above Worker-backed canonical state and action contracts

## Canonical deployment name

`GPTS_DECISION_STACK_IOS_OPERATOR_LAYER`

This is the only intended operator-facing GPT deployment for this layer.

## Source-of-truth model

- Worker = operating truth
- D1 = canonical state / decisions / registry
- R2 = artifact and evidence storage
- Custom GPT = thin operator shell only

This package must not become business truth.

## Package structure

```text
custom_gpts/ios_operator_layer/
  README.md
  builder/
    instructions.en.md
    conversation_starters.en.md
    knowledge_notes.en.md
  operator/
    sop.cs.md
    quick_macros.cs.md
    fail_macros.cs.md
  scenarios/
    revenue_simulation_new_icp_sales/
      README.md
      01_discovery.md
      02_icp_shortlist.md
      03_positioning_claims.md
      04_asset_generation.md
      05_launch_safety.md
      06_post_batch_decision.md
```

## Builder wiring

### Instructions

Copy into Builder Instructions from:

`builder/instructions.en.md`

### Conversation Starters

Copy into Builder Conversation Starters from:

`builder/conversation_starters.en.md`

### Knowledge / notes

Copy into Builder Knowledge / notes from:

`builder/knowledge_notes.en.md`

## Operator usage

Use these files for human/operator-facing workflow support:

- `operator/sop.cs.md`
- `operator/quick_macros.cs.md`
- `operator/fail_macros.cs.md`

These are not Builder import files.
They are operating aids for the human operator layer.

## Scenario usage

Use one scenario at a time from:

- `scenarios/revenue_simulation_new_icp_sales/01_discovery.md`
- `scenarios/revenue_simulation_new_icp_sales/02_icp_shortlist.md`
- `scenarios/revenue_simulation_new_icp_sales/03_positioning_claims.md`
- `scenarios/revenue_simulation_new_icp_sales/04_asset_generation.md`
- `scenarios/revenue_simulation_new_icp_sales/05_launch_safety.md`
- `scenarios/revenue_simulation_new_icp_sales/06_post_batch_decision.md`

Do not parallelize scenario cards unless the runtime contract explicitly evolves to support that.

## Deployment rules

- deploy one GPT only
- do not deploy specialists as separate user-facing GPTs
- do not treat prompt files as runtime truth
- do not bypass Worker-backed action truth
- do not convert scenario cards into governance kernel

## Default lane

Revenue Simulation – New ICP Sales

Default commercial motion:
- Governed GPT Workflow Audit

Target buyer:
- Head of RevOps / Revenue Operations leader in B2B SaaS

Primary CTA:
- Book a 20-min diagnostic call

## Update order

When updating this layer:

1. update repo files in this package
2. update `operations/specs/ios-operator-layer-deployment.md`
3. update Builder fields
4. verify live behavior

## Related spec

See:

`operations/specs/ios-operator-layer-deployment.md`
