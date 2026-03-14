# Domain Ontology - Default Domain

**Status**: ADAPTIVE
**Version**: 1.0.0

## Purpose

This ontology defines the domain concepts, terminology, and relationships for the default domain. Domain ontologies are ADAPTIVE and may be customized per deployment context.

## Core Concepts

### Artifact

A discrete unit of work or deliverable submitted for evaluation and potential release.

**Properties**:
- Unique identifier
- Type classification
- Submitter identity
- Creation timestamp
- Target environment

**Types**:
- `PACKAGE_RELEASE`: Software package or library release
- `CONFIGURATION_CHANGE`: System configuration modification
- `POLICY_UPDATE`: Governance or operational policy change
- `KNOWLEDGE_UPDATE`: Knowledge base or documentation update

### Claim

An assertion about an artifact's properties, quality, or compliance status.

**Properties**:
- Claim statement
- Evidence requirements
- Verification status
- Verification authority

**Examples**:
- "All unit tests pass"
- "Security scan shows no critical vulnerabilities"
- "Documentation is complete and accurate"
- "Complies with regulatory requirements"

### Evidence

Supporting material that validates or refutes a claim.

**Types**:
- `TEST_RESULTS`: Automated test execution results
- `DOCUMENTATION`: Technical or user documentation
- `CERTIFICATION`: Third-party certifications or attestations
- `AUDIT_REPORT`: Internal or external audit findings
- `REVIEW_FINDINGS`: Expert review conclusions

**Properties**:
- Evidence type
- Content reference (URI/path)
- Verification status
- Verifier identity

### Decision

A judgment made by an authorized GPT or authority regarding an artifact's progression.

**Components**:
- Decision maker
- Decision rationale
- State transition attempted
- Authority verification
- Audit trail entry

### Review Lane

A classification mechanism for routing artifacts to appropriate review authorities.

**Categories** (ADAPTIVE):
- `TECHNICAL`: Technical correctness and quality
- `SECURITY`: Security and vulnerability assessment
- `COMPLIANCE`: Regulatory and policy compliance
- `BUSINESS`: Business value and priority
- `OPERATIONAL`: Operational readiness and impact

### Approval Workflow

A sequence of approval steps required before artifact release.

**Stages** (ADAPTIVE):
- Technical approval
- Security approval
- Business approval
- Executive approval (for high-impact changes)

## Relationships

```
Artifact
  ├─ hasType → ArtifactType
  ├─ submittedBy → Submitter
  ├─ makes → Claims
  │   └─ supportedBy → Evidence
  ├─ routedTo → ReviewLane
  ├─ requires → ApprovalWorkflow
  └─ progressesThrough → States

Decision
  ├─ madeBy → Authority
  ├─ affects → Artifact
  ├─ causes → StateTransition
  └─ recordedIn → DecisionLog
```

## Domain-Specific Rules (ADAPTIVE)

These rules may be adapted per deployment:

### Claim Requirements

- `PACKAGE_RELEASE` requires:
  - Test coverage claim with test results evidence
  - Security scan claim with scan results evidence
  - Documentation claim with documentation artifacts
  - Breaking change claim with impact analysis

- `CONFIGURATION_CHANGE` requires:
  - Validation claim with validation test evidence
  - Rollback plan claim with rollback procedure evidence
  - Impact assessment claim with impact analysis evidence

- `POLICY_UPDATE` requires:
  - Legal review claim with legal review evidence
  - Stakeholder approval claim with approval records evidence

### Review Lane Assignment

Assignment is based on:
1. Artifact type
2. Target environment
3. Estimated impact
4. Compliance requirements

### Escalation Triggers

Automatic escalation occurs when:
- High or critical priority artifacts
- Significant or major impact estimated
- Production environment targeted
- Compliance concerns identified

## Terminology

### Domain-Specific Terms (ADAPTIVE)

- **Intake**: Initial evaluation of submitted artifact
- **Claims Verification**: Process of validating claims against evidence
- **Review Lane**: Classification for routing to appropriate reviewers
- **Governance Approval**: Formal approval by governance authority
- **Operational Veto**: Release block by operational authority
- **Release Controller**: Authority that executes approved releases

### Invariant Terms (from Core)

These terms have fixed meanings from core knowledge:

- **State**: Canonical state in state machine
- **Transition**: Movement between states
- **Authority**: Decision-making power
- **Audit Trail**: Immutable decision log
- **Terminal State**: State with no outward transitions

## Extension Points

Domains may extend this ontology with:

- Additional artifact types
- Custom claim categories
- Domain-specific evidence types
- Specialized review lanes
- Custom approval workflows
- Domain-specific terminology

Extensions must not:

- Conflict with core invariants
- Weaken governance requirements
- Bypass audit requirements
- Compromise authority model

## Version History

- 1.0.0 (2026-03-14): Initial default domain ontology
