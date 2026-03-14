# MASTER_SPEC: GPTs Decision Stack

## Overview

The GPTs Decision Stack is a governance-first architecture for deploying Custom GPTs with explicit decision authority, state management, and audit trails.

## Architecture Principles

1. **Control Plane First**: All GPTs operate under explicit governance constraints
2. **State Invariance**: Core decision states are immutable and canonical
3. **Audit by Design**: Every decision is logged with full context
4. **Adaptive Domains**: Domain-specific rules can adapt while core remains invariant
5. **No Workflow Conversion**: This is a decision model, not a workflow engine

## Core Components

### Knowledge Layer

The knowledge layer provides the canonical truth for:

- **Core Knowledge** (`/knowledge/core/`): Invariant control plane rules
  - Charter and authority definitions
  - Canonical states and transitions
  - Artifact schemas and validation rules
  - Failure semantics and recovery paths
  - Decision log structure

- **Domain Knowledge** (`/knowledge/domains/default/`): Adaptive domain rules
  - Domain ontology and concepts
  - Framing rules for GPT behavior
  - Primitive catalogs and operations
  - Delivery topology constraints
  - Risk and compliance triggers
  - Commercial packaging rules
  - Claims evidence policies
  - Review lane routing
  - Approval escalation matrix

### Deployment Gates

Progressive deployment through four environments:

1. **Local**: Structural validation and completeness checks
2. **Dev**: Integration testing with backend services
3. **Staging**: Full governance reality with acceptance testing
4. **Prod**: Authorized production deployment

### Governance Model

- **Ownership Maps**: Define who owns what components
- **Approval Maps**: Define approval workflows
- **Veto Maps**: Define operational veto authority
- **Release Controller**: Outside-the-model release blocking

## File Structure

```
/
├── MASTER_SPEC.md                    # This file
├── repo.manifest.yaml                # File inventory and references
├── README.md                         # Repository overview
├── bootstrap_checklists_pack.sh      # Generate operational checklists
├── bootstrap_knowledge_pack.sh       # Generate knowledge files
├── knowledge/
│   ├── core/                         # Invariant core knowledge
│   │   ├── 00_ControlPlane_Charter.md
│   │   ├── 01_CanonicalStates.yaml
│   │   ├── 02_TransitionRules.yaml
│   │   ├── 03_ArtifactSchemas.yaml
│   │   ├── 04_AuthorityMatrix.yaml
│   │   ├── 05_FailureSemantics.yaml
│   │   └── 06_DecisionLogSchema.yaml
│   └── domains/
│       └── default/                  # Adaptive domain knowledge
│           ├── 10_DomainOntology.md
│           ├── 11_FramingRules.yaml
│           ├── 12_PrimitiveCatalog.yaml
│           ├── 13_DeliveryTopologyRules.yaml
│           ├── 14_RiskComplianceTriggers.yaml
│           ├── 15_CommercialPackagingRules.yaml
│           ├── 16_ClaimsEvidencePolicy.yaml
│           ├── 17_ReviewLaneRules.yaml
│           └── 18_ApprovalEscalationMatrix.yaml
├── prompts/                          # GPT instruction sets (future)
├── schemas/                          # Validation schemas (future)
├── tests/
│   ├── acceptance/                   # Acceptance test definitions (future)
│   └── fixtures/                     # Test fixtures (future)
└── operations/
    ├── checklists/                   # Environment readiness checklists
    └── gates/                        # Promotion gate rules
```

## State Machine Model

The system operates as a state machine, NOT a workflow:

- **States are canonical**: Defined once, never altered
- **Transitions are explicit**: All paths are defined upfront
- **Decisions trigger transitions**: GPTs don't execute; they decide
- **Audit is mandatory**: Every transition is logged

## Deployment Readiness

Deployment to staging/prod is BLOCKED if:

- Any knowledge file is missing content
- Any test fixture is missing or empty
- QA artifacts are incomplete
- Ownership/approval/veto maps are not approved

Current status: Knowledge files are being created in this phase.

## Version

Specification Version: 1.0.0
Last Updated: 2026-03-14
