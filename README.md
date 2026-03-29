# gpts-decision-stack

Governed decision pipeline for GPT-backed workflows, implemented on Cloudflare Workers with D1, R2, KV, deployment evidence, and acceptance/runtime validation.

## What this repository is

`gpts-decision-stack` is a structured decision system for GPT-driven workflows.  
It combines:

- a governed state machine
- explicit artifact schemas
- acceptance fixtures and governed test scenarios
- a Cloudflare Workers backend
- deployment and evidence tracking
- operational ownership / approval / veto mapping

The repository is designed so that runtime behavior, deployment state, and governance evidence are all traceable.

## Current state

This repository contains:

- implementation-backed backend on Cloudflare Workers
- governed acceptance evidence for AC-001 through AC-012
- production runtime/provisioning evidence
- final gate closure recorded in governance artifacts

Core outcome:

- repo_integrity_status: PASS
- deployment_readiness_status: PASS
- bundle_classification: DEPLOY-READY STACK

Authoritative status is tracked in:

- `qa/final-gate-report.yaml`

## High-level architecture

### Control plane
The control plane governs the decision flow, transition rules, and release behavior.

Main prompt layer:

- `prompts/core/CP-Governor.system.md`
- `prompts/core/CP-ContractAuditor.system.md`
- `prompts/core/CP-TransitionJudge.system.md`
- `prompts/core/CP-ReleaseArbiter.system.md`

### Adaptive engines
Domain and stage-specific prompt logic lives under:

- `prompts/adaptive/`

Examples:

- intake
- framing
- primitive selection
- architecture
- risk/governance
- commercial packaging
- claims
- review routing

### Backend runtime
Production backend is implemented in:

- `backend/worker/`

Technology:

- Cloudflare Workers
- D1
- R2
- KV
- TypeScript

### Governance + evidence
Operational, audit, and gate artifacts live under:

- `operations/`
- `qa/`

This includes:

- runtime evidence
- acceptance evidence
- final gate reporting
- promotion gate
- operational maps
- deployment-related evidence bundles

## Repository map

### Backend
- `backend/worker/` — Cloudflare Worker implementation
- `backend/worker/src/handlers/` — HTTP handlers
- `backend/worker/src/services/` — state/artifact/decision log/policy logic
- `backend/worker/migrations/` — D1 migrations
- `backend/worker/wrangler.toml` — Worker config

### API + auth
- `actions/openapi.yaml` — OpenAPI/action contract
- `actions/auth.md` — auth model and action access notes

### Knowledge + rules
- `knowledge/core/` — canonical control-plane rules
- `knowledge/domains/default/` — domain rules and decision policy inputs

### Schemas + tests
- `schemas/artifacts/` — artifact schemas
- `tests/fixtures/` — governed fixture pack
- `tests/acceptance/` — AC-001 to AC-012 scenario definitions

### Operations + governance
- `operations/evidence/` — runtime and acceptance evidence
- `operations/gates/` — promotion gate artifacts
- `operations/checklists/` — local/dev/staging/prod checklists
- `qa/final-gate-report.yaml` — authoritative gate status

### Custom GPT layer
- `custom_gpts/` — deployment-oriented GPT packaging and operational materials

## iOS Operator Layer

This repository contains one canonical operator-facing Custom GPT package:

`custom_gpts/ios_operator_layer/`

Deployment name:

`GPTS_DECISION_STACK_IOS_OPERATOR_LAYER`

This package is intended as the single deployed operator/iOS shell above Worker-backed truth.

Builder wiring source files:

- `custom_gpts/ios_operator_layer/builder/instructions.en.md`
- `custom_gpts/ios_operator_layer/builder/conversation_starters.en.md`
- `custom_gpts/ios_operator_layer/builder/knowledge_notes.en.md`

Operator-facing usage files:

- `custom_gpts/ios_operator_layer/operator/sop.cs.md`
- `custom_gpts/ios_operator_layer/operator/quick_macros.cs.md`
- `custom_gpts/ios_operator_layer/operator/fail_macros.cs.md`

Canonical deployment spec:

`operations/specs/ios-operator-layer-deployment.md`

Rules:

- Worker remains source of truth
- the Custom GPT remains a thin orchestration shell
- specialists remain internal protocol roles, not separate deployed GPTs
- Builder is not the canonical authoring location; the repository is

## Core pipeline concepts

The system operates as an explicit governed flow, not an opaque chatbot flow.

Representative pipeline states include:

- intake
- problem_framing
- primitive_selection
- architecture_validation
- risk_governance_validation
- commercial_packaging
- claims_validation
- release_decision

Artifacts are submitted into sessions and evaluated against rules, policies, and transition constraints.

Representative artifact types include:

- `ProblemBrief`
- `FramingAssessment`
- `OfferDecision`
- `ArchitectureSpec`
- `RiskDecision`
- `CommercialSpec`
- `ClaimsDecision`
- `ReviewTopologyPlan`
- `StateDecisionPacket`
- `ReleaseDecision`

## Local development

### Prerequisites
- Node.js
- npm
- Wrangler
- Cloudflare access for bound environments

### Install
From the worker directory:

```bash
cd backend/worker
npm ci
```