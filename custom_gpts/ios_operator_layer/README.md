# GPTS_DECISION_STACK_IOS_OPERATOR_LAYER

Thin iOS/operator shell for governed revenue simulation workflows.

## Purpose

This package defines one deployable Custom GPT layer that:
- acts as a thin operator-facing shell,
- routes through a single orchestration discipline,
- does not become a new source of truth,
- is designed to sit above Worker-backed canonical state and action contracts.

## Deployment intent

Use this package for one GPT deployment only:

`GPTS_DECISION_STACK_IOS_OPERATOR_LAYER`

Do not split this into multiple deployed specialist GPTs.
Specialists remain internal protocol roles, not separate user-facing GPT deployments.

## Package structure

- `builder/`
  - Builder import text for Instructions, Conversation Starters, and Knowledge notes
- `operator/`
  - Czech operator-facing SOP and macro layer
- `scenarios/`
  - Scenario cards for the default revenue lane

## Default lane

Revenue Simulation – New ICP Sales

Default commercial motion:
- Governed GPT Workflow Audit

Target buyer:
- Head of RevOps / Revenue Operations leader in B2B SaaS

Primary CTA:
- Book a 20-min diagnostic call

## Deployment rules

- Worker remains source of truth
- Custom GPT remains UI/orchestration shell only
- No prompt layer may become canonical business truth
- No step is complete until re-entry is confirmed through the defined handoff protocol
