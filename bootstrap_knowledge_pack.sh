#!/usr/bin/env bash
set -euo pipefail

ROOT="${1:-gpts-decision-stack}"

mkdir -p \
  "$ROOT/knowledge/core" \
  "$ROOT/knowledge/domains/default"

cat > "$ROOT/knowledge/core/00_ControlPlane_Charter.md" <<'EOF'
# Control Plane Charter

## Purpose

This charter defines the governance model for the GPTs Decision Stack. All Custom GPTs operate under explicit control plane authority.

## Core Principles

### 1. Decision Authority, Not Execution

GPTs **decide** what should happen. They do not execute actions directly. Every decision is:

- Explicit and recorded
- Subject to governance constraints
- Auditable with full context
- Reversible through defined paths

### 2. State Machine Model

The system operates as a state machine:

- **States** are canonical and invariant
- **Transitions** are explicit and defined
- **Decisions** trigger state transitions
- **Workflows** are NOT the model

### 3. Audit by Design

Every decision produces:

- Decision timestamp
- Decision maker (GPT identifier)
- Input context and artifacts
- Decision output and rationale
- State transition attempted
- Authorization result

### 4. Governance First

All operations are subject to:

- Authority matrix checks
- Approval workflows (where required)
- Operational veto (where authorized)
- Release control (outside the model)

## Control Plane Scope

The control plane manages:

1. **State Authority**: What states exist and who can transition between them
2. **Decision Authority**: Which GPTs can make which decisions
3. **Audit Authority**: What must be logged and how
4. **Governance Authority**: Who can approve, veto, or block

## GPT Roles

### CP-Governor

**Authority**: Control plane governance and state management

**Responsibilities**:
- Validate state transitions
- Enforce authority constraints
- Maintain decision log
- Report governance violations

**Cannot**: Execute business operations, bypass audit, weaken governance

### AE-Intake

**Authority**: Artifact evaluation and intake decisions

**Responsibilities**:
- Evaluate submitted artifacts
- Decide on intake acceptance
- Flag compliance issues
- Route to appropriate review lanes

**Cannot**: Approve final releases, bypass evidence requirements

### AE-Claims

**Authority**: Claims verification against evidence

**Responsibilities**:
- Verify claims against provided evidence
- Decide on evidence sufficiency
- Escalate when evidence is insufficient
- Document verification rationale

**Cannot**: Accept claims without evidence, bypass review requirements

## Invariant Rules

These rules **CANNOT** be changed by domain adaptation:

1. All decisions must be logged
2. State transitions require authority
3. Audit trails are immutable
4. Governance checks are mandatory
5. Core states are canonical

## Domain Adaptation

Domains **MAY** adapt:

- Specific state definitions within canonical framework
- Review lane routing rules
- Approval escalation paths
- Commercial packaging constraints
- Risk tolerance thresholds

Domains **MAY NOT** adapt:

- Core decision model
- Audit requirements
- Authority enforcement
- State machine invariants

## Version

Charter Version: 1.0.0
Status: INVARIANT
Last Updated: 2026-03-14
EOF

cat > "$ROOT/knowledge/core/01_CanonicalStates.yaml" <<'EOF'
# Canonical States
# Status: INVARIANT
# These states form the canonical state machine for all artifacts

canonical_states:
  initial:
    - name: UNSUBMITTED
      description: Artifact not yet submitted to the system
      entry_authority: NONE
      exit_authority: ANY_SUBMITTER
  
  intake:
    - name: SUBMITTED
      description: Artifact submitted and awaiting intake evaluation
      entry_authority: ANY_SUBMITTER
      exit_authority: AE-Intake
    
    - name: INTAKE_REJECTED
      description: Artifact rejected during intake evaluation
      entry_authority: AE-Intake
      exit_authority: NONE
      terminal: true
    
    - name: INTAKE_ACCEPTED
      description: Artifact accepted for further processing
      entry_authority: AE-Intake
      exit_authority: AE-Claims
  
  verification:
    - name: CLAIMS_VERIFICATION
      description: Claims being verified against evidence
      entry_authority: AE-Claims
      exit_authority: AE-Claims
    
    - name: CLAIMS_INSUFFICIENT
      description: Claims lack sufficient evidence
      entry_authority: AE-Claims
      exit_authority: AE-Intake
    
    - name: CLAIMS_VERIFIED
      description: Claims verified with sufficient evidence
      entry_authority: AE-Claims
      exit_authority: CP-Governor
  
  review:
    - name: REVIEW_REQUIRED
      description: Artifact requires review before approval
      entry_authority: CP-Governor
      exit_authority: REVIEW_AUTHORITY
    
    - name: REVIEW_IN_PROGRESS
      description: Review is actively in progress
      entry_authority: REVIEW_AUTHORITY
      exit_authority: REVIEW_AUTHORITY
    
    - name: REVIEW_REJECTED
      description: Review rejected the artifact
      entry_authority: REVIEW_AUTHORITY
      exit_authority: NONE
      terminal: true
    
    - name: REVIEW_APPROVED
      description: Review approved the artifact
      entry_authority: REVIEW_AUTHORITY
      exit_authority: CP-Governor
  
  governance:
    - name: APPROVAL_REQUIRED
      description: Governance approval required
      entry_authority: CP-Governor
      exit_authority: APPROVAL_AUTHORITY
    
    - name: APPROVAL_IN_PROGRESS
      description: Approval workflow in progress
      entry_authority: APPROVAL_AUTHORITY
      exit_authority: APPROVAL_AUTHORITY
    
    - name: APPROVAL_REJECTED
      description: Governance approval rejected
      entry_authority: APPROVAL_AUTHORITY
      exit_authority: NONE
      terminal: true
    
    - name: APPROVAL_GRANTED
      description: Governance approval granted
      entry_authority: APPROVAL_AUTHORITY
      exit_authority: CP-Governor
  
  release:
    - name: RELEASE_READY
      description: Artifact ready for release
      entry_authority: CP-Governor
      exit_authority: RELEASE_CONTROLLER
    
    - name: RELEASE_BLOCKED
      description: Release blocked by operational veto or controller
      entry_authority: RELEASE_CONTROLLER
      exit_authority: RELEASE_CONTROLLER
    
    - name: RELEASED
      description: Artifact successfully released
      entry_authority: RELEASE_CONTROLLER
      exit_authority: NONE
      terminal: true

state_categories:
  intake_states:
    - UNSUBMITTED
    - SUBMITTED
    - INTAKE_REJECTED
    - INTAKE_ACCEPTED
  
  verification_states:
    - CLAIMS_VERIFICATION
    - CLAIMS_INSUFFICIENT
    - CLAIMS_VERIFIED
  
  review_states:
    - REVIEW_REQUIRED
    - REVIEW_IN_PROGRESS
    - REVIEW_REJECTED
    - REVIEW_APPROVED
  
  governance_states:
    - APPROVAL_REQUIRED
    - APPROVAL_IN_PROGRESS
    - APPROVAL_REJECTED
    - APPROVAL_GRANTED
  
  release_states:
    - RELEASE_READY
    - RELEASE_BLOCKED
    - RELEASED
  
  terminal_states:
    - INTAKE_REJECTED
    - REVIEW_REJECTED
    - APPROVAL_REJECTED
    - RELEASED

invariants:
  - Terminal states cannot transition to any other state
  - All state transitions must be authorized
  - State history is immutable
  - Backward transitions require explicit rules
EOF

cat > "$ROOT/knowledge/core/02_TransitionRules.yaml" <<'EOF'
# State Transition Rules
# Status: INVARIANT
# Defines all allowed state transitions and conditions

transition_rules:
  # Initial submission
  - from: UNSUBMITTED
    to: SUBMITTED
    authority: ANY_SUBMITTER
    conditions:
      - artifact_provided
      - artifact_metadata_complete
    validation:
      - artifact_schema_valid
  
  # Intake evaluation
  - from: SUBMITTED
    to: INTAKE_REJECTED
    authority: AE-Intake
    conditions:
      - intake_evaluation_complete
      - intake_decision_is_reject
    effects:
      - log_rejection_reason
      - notify_submitter
  
  - from: SUBMITTED
    to: INTAKE_ACCEPTED
    authority: AE-Intake
    conditions:
      - intake_evaluation_complete
      - intake_decision_is_accept
    effects:
      - assign_tracking_id
      - route_to_claims_verification
  
  # Claims verification
  - from: INTAKE_ACCEPTED
    to: CLAIMS_VERIFICATION
    authority: AE-Claims
    conditions:
      - claims_identified
      - evidence_requirements_defined
    effects:
      - create_claims_checklist
  
  - from: CLAIMS_VERIFICATION
    to: CLAIMS_INSUFFICIENT
    authority: AE-Claims
    conditions:
      - claims_evaluation_complete
      - evidence_insufficient
    effects:
      - document_gaps
      - notify_submitter
  
  - from: CLAIMS_VERIFICATION
    to: CLAIMS_VERIFIED
    authority: AE-Claims
    conditions:
      - claims_evaluation_complete
      - evidence_sufficient
      - all_claims_supported
    effects:
      - finalize_verification_report
  
  # Re-submission after insufficient claims
  - from: CLAIMS_INSUFFICIENT
    to: SUBMITTED
    authority: ANY_SUBMITTER
    conditions:
      - additional_evidence_provided
      - resubmission_requested
    effects:
      - reset_intake_evaluation
  
  # Review routing
  - from: CLAIMS_VERIFIED
    to: REVIEW_REQUIRED
    authority: CP-Governor
    conditions:
      - review_required_by_policy
    effects:
      - assign_review_lane
      - notify_reviewers
  
  - from: CLAIMS_VERIFIED
    to: APPROVAL_REQUIRED
    authority: CP-Governor
    conditions:
      - review_not_required_by_policy
    effects:
      - route_to_approval_workflow
  
  # Review process
  - from: REVIEW_REQUIRED
    to: REVIEW_IN_PROGRESS
    authority: REVIEW_AUTHORITY
    conditions:
      - reviewer_assigned
      - review_started
  
  - from: REVIEW_IN_PROGRESS
    to: REVIEW_REJECTED
    authority: REVIEW_AUTHORITY
    conditions:
      - review_complete
      - review_decision_is_reject
    effects:
      - log_review_findings
      - notify_stakeholders
  
  - from: REVIEW_IN_PROGRESS
    to: REVIEW_APPROVED
    authority: REVIEW_AUTHORITY
    conditions:
      - review_complete
      - review_decision_is_approve
    effects:
      - finalize_review_report
      - route_to_governance
  
  # Governance approval
  - from: REVIEW_APPROVED
    to: APPROVAL_REQUIRED
    authority: CP-Governor
    conditions:
      - approval_workflow_required
  
  - from: APPROVAL_REQUIRED
    to: APPROVAL_IN_PROGRESS
    authority: APPROVAL_AUTHORITY
    conditions:
      - approvers_notified
      - approval_workflow_started
  
  - from: APPROVAL_IN_PROGRESS
    to: APPROVAL_REJECTED
    authority: APPROVAL_AUTHORITY
    conditions:
      - approval_decision_complete
      - approval_decision_is_reject
    effects:
      - log_rejection_rationale
      - notify_all_parties
  
  - from: APPROVAL_IN_PROGRESS
    to: APPROVAL_GRANTED
    authority: APPROVAL_AUTHORITY
    conditions:
      - approval_decision_complete
      - approval_decision_is_approve
      - all_required_approvers_approved
    effects:
      - finalize_approval_record
      - route_to_release_prep
  
  # Release preparation and control
  - from: APPROVAL_GRANTED
    to: RELEASE_READY
    authority: CP-Governor
    conditions:
      - all_governance_complete
      - release_artifacts_prepared
      - deployment_plan_ready
  
  - from: RELEASE_READY
    to: RELEASE_BLOCKED
    authority: RELEASE_CONTROLLER
    conditions:
      any_of:
        - operational_veto_active
        - release_block_triggered
    effects:
      - log_block_reason
      - notify_release_coordinator
  
  - from: RELEASE_BLOCKED
    to: RELEASE_READY
    authority: RELEASE_CONTROLLER
    conditions:
      - block_reason_resolved
      - veto_cleared
  
  - from: RELEASE_READY
    to: RELEASED
    authority: RELEASE_CONTROLLER
    conditions:
      - no_active_blocks
      - deployment_authorized
      - deployment_successful
    effects:
      - finalize_release_record
      - notify_all_stakeholders
      - archive_decision_trail

invariant_rules:
  - All transitions require authority check
  - All transitions must be logged
  - Terminal states cannot transition
  - Backward transitions require explicit definition
  - Authority cannot be bypassed
EOF

cat > "$ROOT/knowledge/core/03_ArtifactSchemas.yaml" <<'EOF'
# Artifact Schemas
# Status: INVARIANT
# Validation schemas for artifacts processed through the decision stack

artifact_types:
  submission:
    schema:
      artifact_id:
        type: string
        required: true
        pattern: "^[A-Z]{3}-[0-9]{6}$"
        description: Unique artifact identifier
      
      submitter:
        type: object
        required: true
        properties:
          name:
            type: string
            required: true
          email:
            type: string
            required: true
            format: email
          organization:
            type: string
            required: false
      
      submission_timestamp:
        type: string
        required: true
        format: iso8601
      
      artifact_type:
        type: string
        required: true
        enum:
          - PACKAGE_RELEASE
          - CONFIGURATION_CHANGE
          - POLICY_UPDATE
          - KNOWLEDGE_UPDATE
      
      artifact_payload:
        type: object
        required: true
        description: Type-specific artifact content
      
      claims:
        type: array
        required: true
        items:
          type: object
          properties:
            claim_id:
              type: string
              required: true
            claim_statement:
              type: string
              required: true
            evidence_references:
              type: array
              items:
                type: string
      
      metadata:
        type: object
        required: true
        properties:
          priority:
            type: string
            enum: [LOW, MEDIUM, HIGH, CRITICAL]
          target_environment:
            type: string
            enum: [DEV, STAGING, PROD]
          estimated_impact:
            type: string
            enum: [MINIMAL, MODERATE, SIGNIFICANT, MAJOR]
  
  decision_record:
    schema:
      decision_id:
        type: string
        required: true
        pattern: "^DEC-[0-9]{8}$"
      
      artifact_id:
        type: string
        required: true
      
      decision_maker:
        type: string
        required: true
        enum:
          - CP-Governor
          - AE-Intake
          - AE-Claims
          - REVIEW_AUTHORITY
          - APPROVAL_AUTHORITY
          - RELEASE_CONTROLLER
      
      decision_timestamp:
        type: string
        required: true
        format: iso8601
      
      state_transition:
        type: object
        required: true
        properties:
          from_state:
            type: string
            required: true
          to_state:
            type: string
            required: true
          transition_valid:
            type: boolean
            required: true
      
      decision_rationale:
        type: string
        required: true
        min_length: 10
      
      supporting_evidence:
        type: array
        required: false
        items:
          type: string
      
      authority_check:
        type: object
        required: true
        properties:
          authorized:
            type: boolean
            required: true
          authority_source:
            type: string
            required: true
  
  evidence:
    schema:
      evidence_id:
        type: string
        required: true
      
      evidence_type:
        type: string
        required: true
        enum:
          - TEST_RESULTS
          - DOCUMENTATION
          - CERTIFICATION
          - AUDIT_REPORT
          - REVIEW_FINDINGS
          - APPROVAL_RECORD
      
      content_reference:
        type: string
        required: true
        description: URI or path to evidence content
      
      verification_status:
        type: string
        required: true
        enum:
          - UNVERIFIED
          - VERIFIED
          - REJECTED
      
      verified_by:
        type: string
        required: false
      
      verification_timestamp:
        type: string
        required: false
        format: iso8601

validation_rules:
  artifact_submission:
    - All required fields must be present
    - Artifact ID must be unique
    - At least one claim must be provided
    - All claims must reference evidence
  
  decision_record:
    - Decision ID must be unique
    - State transition must be valid per TransitionRules
    - Authority check must pass
    - Rationale must be substantive
  
  evidence:
    - Evidence must be accessible
    - Verification must be traceable
    - Evidence type must match claim type

schema_version: "1.0.0"
status: INVARIANT
EOF

cat > "$ROOT/knowledge/core/04_AuthorityMatrix.yaml" <<'EOF'
# Authority Matrix
# Status: INVARIANT
# Defines decision-making authority for each GPT and role

authorities:
  gpt_roles:
    CP-Governor:
      authority_level: CONTROL_PLANE
      can_decide:
        - validate_state_transitions
        - enforce_governance_constraints
        - route_to_review
        - route_to_approval
        - route_to_release
        - maintain_decision_log
        - report_violations
      
      cannot_decide:
        - intake_artifact_evaluation
        - claims_verification
        - review_approval
        - governance_approval
        - release_execution
      
      decision_scope:
        - All state transitions requiring governance validation
        - Authority enforcement
        - Routing decisions
      
      audit_requirement: MANDATORY
    
    AE-Intake:
      authority_level: INTAKE
      can_decide:
        - evaluate_artifact_submission
        - accept_or_reject_intake
        - route_to_claims_verification
        - flag_compliance_issues
      
      cannot_decide:
        - verify_claims
        - approve_releases
        - bypass_evidence_requirements
        - override_governance
      
      decision_scope:
        - Initial artifact evaluation
        - Intake acceptance decisions
        - Basic compliance flagging
      
      audit_requirement: MANDATORY
    
    AE-Claims:
      authority_level: VERIFICATION
      can_decide:
        - verify_claims_against_evidence
        - determine_evidence_sufficiency
        - escalate_insufficient_evidence
        - document_verification_rationale
      
      cannot_decide:
        - accept_claims_without_evidence
        - bypass_review_requirements
        - grant_final_approval
        - execute_releases
      
      decision_scope:
        - Claims verification
        - Evidence sufficiency
        - Verification escalation
      
      audit_requirement: MANDATORY
    
    REVIEW_AUTHORITY:
      authority_level: REVIEW
      can_decide:
        - conduct_technical_review
        - approve_or_reject_review
        - request_additional_information
        - escalate_to_governance
      
      cannot_decide:
        - bypass_approval_requirements
        - execute_releases
        - override_veto
      
      decision_scope:
        - Technical review decisions
        - Review approval/rejection
        - Escalation to governance
      
      audit_requirement: MANDATORY
    
    APPROVAL_AUTHORITY:
      authority_level: GOVERNANCE
      can_decide:
        - grant_or_reject_governance_approval
        - require_additional_reviews
        - escalate_to_executive_authority
        - document_approval_conditions
      
      cannot_decide:
        - bypass_evidence_requirements
        - override_operational_veto
        - execute_releases_directly
      
      decision_scope:
        - Governance approval decisions
        - Conditional approvals
        - Executive escalation
      
      audit_requirement: MANDATORY
    
    RELEASE_CONTROLLER:
      authority_level: RELEASE
      can_decide:
        - authorize_release_execution
        - block_release_for_operational_reasons
        - clear_release_blocks
        - execute_authorized_releases
      
      cannot_decide:
        - bypass_governance_approval
        - override_approval_rejection
        - alter_decision_history
      
      decision_scope:
        - Release authorization
        - Operational veto enforcement
        - Release execution
      
      audit_requirement: MANDATORY

authority_checks:
  required_for:
    - All state transitions
    - All decision records
    - All governance actions
  
  check_sequence:
    1. Verify decision maker identity
    2. Validate authority level for decision type
    3. Check decision scope alignment
    4. Confirm no prohibited actions
    5. Log authority check result
  
  failure_handling:
    - Reject decision immediately
    - Log unauthorized attempt
    - Notify governance authority
    - Do not execute state transition

escalation_paths:
  intake_escalation:
    from: AE-Intake
    to: AE-Claims
    conditions:
      - Intake accepted
      - Claims verification required
  
  claims_escalation:
    from: AE-Claims
    to: CP-Governor
    conditions:
      - Claims verified
      - Review or approval required
  
  review_escalation:
    from: REVIEW_AUTHORITY
    to: APPROVAL_AUTHORITY
    conditions:
      - Review approved
      - Governance approval required
  
  approval_escalation:
    from: APPROVAL_AUTHORITY
    to: EXECUTIVE_AUTHORITY
    conditions:
      - Standard approval authority insufficient
      - Executive decision required
  
  operational_escalation:
    from: RELEASE_CONTROLLER
    to: APPROVAL_AUTHORITY
    conditions:
      - Release blocked
      - Governance review of block required

invariant_rules:
  - Authority cannot be delegated or transferred
  - All decisions must have authority backing
  - Authority checks are mandatory and cannot be bypassed
  - Audit requirements are absolute

matrix_version: "1.0.0"
status: INVARIANT
EOF

cat > "$ROOT/knowledge/core/05_FailureSemantics.yaml" <<'EOF'
# Failure Semantics
# Status: INVARIANT
# Defines how failures are handled and recovered

failure_categories:
  authorization_failure:
    severity: CRITICAL
    description: Decision maker lacks authority for attempted action
    
    handling:
      immediate:
        - Reject decision immediately
        - Do not execute state transition
        - Log unauthorized attempt with full context
      
      notification:
        - Notify governance authority
        - Alert security monitoring
        - Record in audit trail
      
      recovery:
        - No automatic recovery
        - Requires governance review
        - May require authority escalation
    
    examples:
      - AE-Intake attempting to grant final approval
      - AE-Claims bypassing evidence requirements
      - Any GPT attempting to alter decision history
  
  validation_failure:
    severity: HIGH
    description: Artifact or decision fails schema validation
    
    handling:
      immediate:
        - Reject artifact or decision
        - Return validation errors
        - Do not proceed with transition
      
      notification:
        - Notify submitter with specific errors
        - Log validation failure
      
      recovery:
        - Automatic retry allowed after correction
        - No escalation required for simple validation errors
        - Escalate if validation failures persist
    
    examples:
      - Missing required artifact metadata
      - Invalid state transition request
      - Malformed decision record
  
  evidence_insufficient:
    severity: MEDIUM
    description: Claims lack sufficient supporting evidence
    
    handling:
      immediate:
        - Transition to CLAIMS_INSUFFICIENT state
        - Document specific evidence gaps
        - Preserve artifact for resubmission
      
      notification:
        - Notify submitter with gap analysis
        - Provide guidance on evidence requirements
      
      recovery:
        - Resubmission allowed with additional evidence
        - No penalty for good-faith resubmission
        - Track resubmission count
    
    examples:
      - Test results missing
      - Documentation incomplete
      - Certification not provided
  
  governance_rejection:
    severity: MEDIUM
    description: Review or approval authority rejects artifact
    
    handling:
      immediate:
        - Transition to appropriate rejection state
        - Finalize rejection record
        - Make state terminal
      
      notification:
        - Notify all stakeholders
        - Document rejection rationale
        - Provide feedback for future submissions
      
      recovery:
        - No automatic recovery from terminal rejection
        - New submission required for retry
        - Learn from rejection feedback
    
    examples:
      - Review identifies critical issues
      - Approval authority denies governance approval
      - Policy compliance failure
  
  operational_block:
    severity: MEDIUM
    description: Release blocked by operational veto or controller
    
    handling:
      immediate:
        - Transition to RELEASE_BLOCKED state
        - Preserve release-ready status
        - Do not execute release
      
      notification:
        - Notify release coordinator
        - Document block reason
        - Provide expected resolution path
      
      recovery:
        - Automatic unblock when reason resolved
        - Return to RELEASE_READY state
        - Resume release process
    
    examples:
      - Production incident in progress
      - Maintenance window conflict
      - Operational capacity constraint
  
  system_failure:
    severity: CRITICAL
    description: System-level failure preventing normal operation
    
    handling:
      immediate:
        - Halt processing
        - Preserve current state
        - Do not lose audit trail
      
      notification:
        - Alert system administrators
        - Log failure details
        - Trigger incident response
      
      recovery:
        - Manual intervention required
        - Resume from preserved state
        - Verify audit trail integrity
    
    examples:
      - Database connection failure
      - Decision log corruption
      - Authority service unavailable

recovery_principles:
  state_preservation:
    - Never lose artifact data
    - Preserve all decision history
    - Maintain audit trail integrity
  
  graceful_degradation:
    - Fail safe, not fail forward
    - Reject rather than proceed incorrectly
    - Preserve governance constraints
  
  audit_continuity:
    - All failures are logged
    - Recovery actions are logged
    - No gaps in audit trail
  
  no_silent_failures:
    - All failures generate notifications
    - Stakeholders are informed
    - Failures are escalated appropriately

retry_policies:
  validation_failure:
    automatic_retry: false
    manual_retry: allowed
    retry_limit: none
    backoff: not_applicable
  
  evidence_insufficient:
    automatic_retry: false
    manual_retry: allowed
    retry_limit: 3_resubmissions
    backoff: not_applicable
  
  operational_block:
    automatic_retry: true
    manual_retry: allowed
    retry_limit: none
    backoff: 5_minutes
  
  system_failure:
    automatic_retry: true
    manual_retry: allowed
    retry_limit: 3_attempts
    backoff: exponential

invariant_rules:
  - Failures never bypass governance
  - Failures never skip audit logging
  - Recovery never compromises authority
  - Terminal states remain terminal

semantics_version: "1.0.0"
status: INVARIANT
EOF

cat > "$ROOT/knowledge/core/06_DecisionLogSchema.yaml" <<'EOF'
# Decision Log Schema
# Status: INVARIANT
# Structure for decision audit trail

decision_log_entry:
  schema:
    log_entry_id:
      type: string
      required: true
      pattern: "^LOG-[0-9]{10}$"
      description: Unique log entry identifier
    
    timestamp:
      type: string
      required: true
      format: iso8601_with_milliseconds
      description: Precise timestamp of log entry
    
    artifact_id:
      type: string
      required: true
      description: Artifact being processed
    
    decision_record:
      type: object
      required: true
      properties:
        decision_id:
          type: string
          required: true
        
        decision_maker:
          type: string
          required: true
          description: GPT role or authority making decision
        
        decision_type:
          type: string
          required: true
          enum:
            - STATE_TRANSITION
            - AUTHORITY_CHECK
            - VALIDATION
            - GOVERNANCE_ACTION
            - RELEASE_ACTION
        
        decision_outcome:
          type: string
          required: true
          enum:
            - APPROVED
            - REJECTED
            - BLOCKED
            - ESCALATED
            - FAILED
        
        rationale:
          type: string
          required: true
          min_length: 10
    
    state_context:
      type: object
      required: true
      properties:
        previous_state:
          type: string
          required: true
        
        attempted_state:
          type: string
          required: true
        
        resulting_state:
          type: string
          required: true
        
        transition_valid:
          type: boolean
          required: true
    
    authority_context:
      type: object
      required: true
      properties:
        authority_required:
          type: string
          required: true
        
        authority_held:
          type: string
          required: true
        
        authority_check_passed:
          type: boolean
          required: true
        
        authority_source:
          type: string
          required: true
    
    input_context:
      type: object
      required: true
      description: Full context provided to decision maker
      properties:
        artifacts:
          type: array
        
        evidence:
          type: array
        
        prior_decisions:
          type: array
        
        governance_constraints:
          type: object
    
    supporting_data:
      type: object
      required: false
      description: Additional data supporting the decision
    
    audit_metadata:
      type: object
      required: true
      properties:
        log_schema_version:
          type: string
          required: true
        
        log_integrity_hash:
          type: string
          required: true
          description: Hash of log entry for tamper detection
        
        previous_entry_hash:
          type: string
          required: false
          description: Hash of previous log entry for chain integrity
        
        correlation_id:
          type: string
          required: true
          description: Correlation ID for related decisions

log_chain_properties:
  immutability:
    - Log entries cannot be modified after creation
    - Log entries cannot be deleted
    - Log chain integrity is cryptographically verified
  
  completeness:
    - All decisions must be logged
    - No gaps in decision sequence
    - Failed decisions are logged
  
  integrity:
    - Each entry hashes previous entry
    - Chain integrity is verifiable
    - Tampering is detectable
  
  accessibility:
    - Logs are queryable by artifact_id
    - Logs are queryable by timestamp
    - Logs are queryable by decision_maker
    - Full audit trail is accessible

query_interfaces:
  by_artifact:
    input: artifact_id
    output: All log entries for artifact in chronological order
  
  by_decision_maker:
    input: decision_maker_id
    output: All decisions made by specific authority
  
  by_time_range:
    input: start_timestamp, end_timestamp
    output: All log entries in time range
  
  by_state_transition:
    input: from_state, to_state
    output: All transitions matching criteria
  
  integrity_check:
    input: log_entry_id
    output: Chain integrity verification result

retention_policy:
  minimum_retention: 7_years
  archive_after: 1_year
  deletion_policy: NEVER
  backup_frequency: CONTINUOUS

invariant_rules:
  - All decisions must be logged before execution
  - Log entries are immutable
  - Log chain integrity is mandatory
  - No decisions without audit trail

schema_version: "1.0.0"
status: INVARIANT
EOF

echo "Created core knowledge files:"
printf '  - %s\n' \
  "$ROOT/knowledge/core/00_ControlPlane_Charter.md" \
  "$ROOT/knowledge/core/01_CanonicalStates.yaml" \
  "$ROOT/knowledge/core/02_TransitionRules.yaml" \
  "$ROOT/knowledge/core/03_ArtifactSchemas.yaml" \
  "$ROOT/knowledge/core/04_AuthorityMatrix.yaml" \
  "$ROOT/knowledge/core/05_FailureSemantics.yaml" \
  "$ROOT/knowledge/core/06_DecisionLogSchema.yaml"

cat > "$ROOT/knowledge/domains/default/10_DomainOntology.md" <<'EOF'
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
EOF

cat > "$ROOT/knowledge/domains/default/11_FramingRules.yaml" <<'EOF'
# Framing Rules - Default Domain
# Status: ADAPTIVE
# Defines how GPTs should frame their decision-making

gpt_framing:
  CP-Governor:
    role_framing: >
      You are the Control Plane Governor. Your purpose is to enforce governance
      constraints and validate state transitions. You operate at the control
      plane level and ensure all decisions comply with authority and audit
      requirements. You are neutral and procedural.
    
    decision_framing:
      - Always verify authority before allowing state transitions
      - Enforce audit requirements without exception
      - Route artifacts according to defined rules
      - Never bypass governance constraints
      - Document all violations and escalations
    
    output_format:
      - State transition validation results
      - Authority check results
      - Routing decisions with rationale
      - Violation reports
    
    prohibited_behaviors:
      - Making business or technical judgments
      - Bypassing authority checks
      - Altering audit trails
      - Weakening governance rules
  
  AE-Intake:
    role_framing: >
      You are the Artifact Evaluator for Intake. Your purpose is to perform
      initial evaluation of submitted artifacts. You assess completeness,
      basic compliance, and route to claims verification. You are thorough
      but do not make final approval decisions.
    
    decision_framing:
      - Evaluate artifact completeness and basic quality
      - Check for obvious compliance issues
      - Decide accept or reject for intake
      - Route accepted artifacts to claims verification
      - Provide clear feedback on rejections
    
    output_format:
      - Intake decision (ACCEPT/REJECT)
      - Evaluation findings
      - Compliance flags
      - Routing instructions
    
    prohibited_behaviors:
      - Granting final approvals
      - Verifying claims and evidence
      - Bypassing evidence requirements
      - Making technical or security judgments beyond intake scope
  
  AE-Claims:
    role_framing: >
      You are the Artifact Evaluator for Claims Verification. Your purpose is
      to verify that all claims made about an artifact are supported by
      sufficient evidence. You are rigorous and objective in assessing
      evidence quality and completeness.
    
    decision_framing:
      - Identify all claims made about the artifact
      - For each claim, assess supporting evidence
      - Determine if evidence is sufficient and credible
      - Escalate when evidence is insufficient
      - Document verification rationale clearly
    
    output_format:
      - Claims verification results
      - Evidence sufficiency assessment
      - Gaps identified (if any)
      - Verification report
    
    prohibited_behaviors:
      - Accepting claims without evidence
      - Granting final approvals
      - Bypassing review requirements
      - Making technical judgments beyond evidence assessment

behavioral_constraints:
  all_gpts:
    must_always:
      - Operate within assigned authority
      - Log all decisions with rationale
      - Provide clear, specific rationale
      - Use defined state and transition vocabulary
      - Request human intervention when uncertain
    
    must_never:
      - Bypass authority checks
      - Skip audit logging
      - Make decisions outside authority scope
      - Weaken governance constraints
      - Proceed when information is UNKNOWN

  decision_quality:
    rationale_requirements:
      - Minimum 10 words
      - Specific, not generic
      - References evidence or rules
      - Explains reasoning clearly
    
    uncertainty_handling:
      - Explicitly state UNKNOWN when information is not available
      - Do not guess or assume
      - Escalate when information gaps prevent decision
      - Document what information is needed

  tone_and_style:
    - Professional and neutral
    - Clear and specific
    - Evidence-based
    - Procedural, not subjective
    - Appropriate for audit trail

context_awareness:
  artifact_context:
    always_consider:
      - Artifact type
      - Target environment
      - Priority and impact
      - Compliance requirements
      - Previous decision history
  
  state_context:
    always_consider:
      - Current state
      - Valid next states
      - Authority required
      - Governance constraints
  
  governance_context:
    always_consider:
      - Ownership and approval maps
      - Operational veto status
      - Release controller constraints

interaction_patterns:
  with_submitters:
    - Provide clear, actionable feedback
    - Explain rejection reasons specifically
    - Guide on evidence requirements
    - Encourage resubmission with corrections
  
  with_reviewers:
    - Route with full context
    - Provide artifact summary
    - Highlight compliance flags
    - Support informed review decisions
  
  with_governance:
    - Escalate appropriately
    - Provide complete information
    - Document governance concerns
    - Support audit and oversight

adaptation_notes:
  domains_may_customize:
    - Role framings for domain context
    - Decision framing specifics
    - Output format details
    - Interaction patterns
  
  domains_must_preserve:
    - Authority constraints
    - Audit requirements
    - Prohibited behaviors
    - Uncertainty handling

version: "1.0.0"
status: ADAPTIVE
EOF

cat > "$ROOT/knowledge/domains/default/12_PrimitiveCatalog.yaml" <<'EOF'
# Primitive Catalog - Default Domain
# Status: ADAPTIVE
# Defines available operations and primitives for GPTs

primitives:
  state_operations:
    get_current_state:
      description: Retrieve current state of an artifact
      inputs:
        - artifact_id
      outputs:
        - current_state
        - state_timestamp
      authority_required: ANY
    
    validate_transition:
      description: Check if a state transition is valid
      inputs:
        - artifact_id
        - from_state
        - to_state
      outputs:
        - transition_valid
        - validation_errors
      authority_required: CP-Governor
    
    execute_transition:
      description: Execute a validated state transition
      inputs:
        - artifact_id
        - to_state
        - decision_rationale
      outputs:
        - transition_result
        - new_state
      authority_required: TRANSITION_AUTHORITY
      audit_required: true
  
  artifact_operations:
    retrieve_artifact:
      description: Retrieve artifact details
      inputs:
        - artifact_id
      outputs:
        - artifact_metadata
        - artifact_payload
        - claims
      authority_required: ANY
    
    evaluate_completeness:
      description: Check if artifact is complete
      inputs:
        - artifact_id
      outputs:
        - completeness_status
        - missing_elements
      authority_required: AE-Intake
    
    extract_claims:
      description: Extract claims from artifact
      inputs:
        - artifact_id
      outputs:
        - claims_list
        - evidence_requirements
      authority_required: AE-Claims
  
  evidence_operations:
    retrieve_evidence:
      description: Retrieve evidence for a claim
      inputs:
        - evidence_id
      outputs:
        - evidence_content
        - evidence_metadata
      authority_required: AE-Claims
    
    verify_evidence:
      description: Verify evidence supports claim
      inputs:
        - claim_id
        - evidence_id
      outputs:
        - verification_result
        - sufficiency_assessment
      authority_required: AE-Claims
      audit_required: true
    
    assess_evidence_quality:
      description: Assess overall evidence quality
      inputs:
        - artifact_id
      outputs:
        - quality_score
        - gaps_identified
      authority_required: AE-Claims
  
  decision_operations:
    make_decision:
      description: Make and log a decision
      inputs:
        - artifact_id
        - decision_type
        - decision_outcome
        - rationale
      outputs:
        - decision_id
        - log_entry_id
      authority_required: DECISION_MAKER
      audit_required: true
    
    check_authority:
      description: Verify decision maker has authority
      inputs:
        - decision_maker
        - decision_type
        - artifact_context
      outputs:
        - authority_check_result
        - authority_source
      authority_required: CP-Governor
    
    log_decision:
      description: Create audit log entry
      inputs:
        - decision_record
        - state_context
        - authority_context
      outputs:
        - log_entry_id
        - log_integrity_hash
      authority_required: ANY
      audit_required: MANDATORY
  
  routing_operations:
    assign_review_lane:
      description: Determine appropriate review lane
      inputs:
        - artifact_id
        - artifact_type
        - impact_level
      outputs:
        - review_lane
        - assigned_reviewers
      authority_required: CP-Governor
    
    route_to_approval:
      description: Route to approval workflow
      inputs:
        - artifact_id
        - approval_requirements
      outputs:
        - approval_workflow_id
        - required_approvers
      authority_required: CP-Governor
    
    escalate:
      description: Escalate to higher authority
      inputs:
        - artifact_id
        - escalation_reason
        - current_authority
      outputs:
        - escalation_target
        - escalation_id
      authority_required: ANY
  
  governance_operations:
    check_veto_status:
      description: Check if operational veto is active
      inputs:
        - artifact_id
      outputs:
        - veto_active
        - veto_reason
      authority_required: RELEASE_CONTROLLER
    
    enforce_block:
      description: Block release for operational reasons
      inputs:
        - artifact_id
        - block_reason
      outputs:
        - block_id
        - block_status
      authority_required: RELEASE_CONTROLLER
      audit_required: true
    
    clear_block:
      description: Clear release block
      inputs:
        - block_id
        - resolution_notes
      outputs:
        - clear_result
      authority_required: RELEASE_CONTROLLER
      audit_required: true

primitive_constraints:
  authority_enforcement:
    - All primitives check authority before execution
    - Authority violations raise errors immediately
    - No primitive can bypass authority checks
  
  audit_logging:
    - Audit-required primitives always log
    - Log entry created before state mutation
    - Failed operations are also logged
  
  error_handling:
    - Primitives return errors, not exceptions
    - Errors include specific reason codes
    - Partial execution is not allowed

composition_rules:
  allowed:
    - Chain read operations freely
    - Compose validation operations
    - Build complex queries from simple ones
  
  prohibited:
    - Bypass authority through composition
    - Skip audit through operation splitting
    - Circumvent governance through indirection

extension_guidelines:
  domains_may_add:
    - Domain-specific primitives
    - Custom validation operations
    - Specialized routing logic
    - Domain evidence operations
  
  domains_must_not:
    - Add primitives that bypass authority
    - Create audit-free mutation operations
    - Weaken error handling
    - Violate composition rules

version: "1.0.0"
status: ADAPTIVE
EOF

cat > "$ROOT/knowledge/domains/default/13_DeliveryTopologyRules.yaml" <<'EOF'
# Delivery Topology Rules - Default Domain
# Status: ADAPTIVE
# Defines deployment topology and environment constraints

environments:
  local:
    purpose: Local development and structural validation
    characteristics:
      - No backend integration
      - File-based validation only
      - Completeness checking
      - Schema validation
    
    deployment_allowed_if:
      - Bootstrap scripts execute successfully
      - All required files exist
      - YAML syntax is valid
      - Manifest references resolve
    
    deployment_blocked_if: []
    
    testing_scope:
      - File existence checks
      - Schema validation
      - Manifest consistency
      - No runtime testing
  
  dev:
    purpose: First real integration environment
    characteristics:
      - Backend services integrated
      - GPT configuration deployed
      - Enforcement services active
      - Smoke testing enabled
    
    deployment_allowed_if:
      - local_gate == PASS
      - Backend build exists
      - Auth binding defined
      - Endpoint mapping complete
      - GPT config binding prepared
    
    deployment_blocked_if:
      - openapi_not_bound_to_concrete_backend
      - auth_binding_missing
      - endpoint_owner_mapping_missing
      - gpt_action_binding_missing
    
    testing_scope:
      - Backend health checks
      - Auth validation
      - GPT provisioning smoke tests
      - Decision log append tests
      - Basic end-to-end flows
  
  staging:
    purpose: Full governance reality rehearsal
    characteristics:
      - Production-like topology
      - Full governance enforcement
      - Acceptance testing
      - Approval workflows active
      - Operational veto enabled
    
    deployment_allowed_if:
      - dev_gate == PASS
      - knowledge_file_completeness == PASS
      - fixture_completeness == PASS
      - qa_artifact_exists
      - ownership_map_exists
      - approval_map_exists
      - veto_map_exists
    
    deployment_blocked_if:
      - knowledge_file_completeness != PASS
      - fixture_completeness != PASS
      - qa_artifact_missing
      - ownership_map_missing
      - approval_map_missing
      - veto_map_missing
    
    testing_scope:
      - Full acceptance test suite
      - Approval workflow validation
      - Veto enforcement testing
      - Release block testing
      - False proceed detection
      - Performance testing
  
  prod:
    purpose: Production deployment
    characteristics:
      - Live user traffic
      - Full audit logging
      - Governance enforcement
      - Monitoring and alerting
      - Rollback capability
    
    deployment_allowed_if:
      - staging_gate == PASS
      - final_qa_artifact == PASS
      - ownership_map_approved
      - approval_map_approved
      - veto_map_approved
      - authoritative_release_notes_approved
      - rollback_plan_exists
      - monitoring_alerting_exist
    
    deployment_blocked_if:
      - staging_gate != PASS
      - final_qa_artifact != PASS
      - knowledge_file_completeness != PASS
      - fixture_completeness != PASS
      - ownership_map_not_approved
      - approval_map_not_approved
      - veto_map_not_approved
      - authoritative_release_notes_missing
    
    testing_scope:
      - Production smoke tests
      - Audit logging validation
      - Monitoring verification
      - Rollback readiness
      - Performance monitoring

promotion_paths:
  local_to_dev:
    requirements:
      - All structural validations pass
      - Backend infrastructure ready
      - Configuration bindings complete
    
    validation:
      - Manifest completeness
      - Schema validity
      - File existence
      - Backend connectivity
  
  dev_to_staging:
    requirements:
      - Dev smoke tests pass
      - Knowledge files complete
      - Test fixtures complete
      - Governance maps exist
    
    validation:
      - Backend health confirmed
      - GPT provisioning verified
      - Governance prerequisites met
  
  staging_to_prod:
    requirements:
      - All acceptance tests pass
      - Governance approval obtained
      - Operational readiness confirmed
      - Rollback plan validated
    
    validation:
      - QA artifact approved
      - All governance maps approved
      - Release notes approved
      - Monitoring operational

rollback_requirements:
  dev:
    rollback_trigger:
      - Backend health failure
      - Critical smoke test failure
    rollback_target: previous_working_dev_version
    rollback_time: under_5_minutes
  
  staging:
    rollback_trigger:
      - Acceptance test failure
      - Governance violation detected
    rollback_target: previous_working_staging_version
    rollback_time: under_10_minutes
  
  prod:
    rollback_trigger:
      - Production smoke failure
      - Critical incident
      - Operational veto
    rollback_target: last_known_good_production
    rollback_time: under_2_minutes
    approval_required: true

topology_constraints:
  data_flow:
    - All environments use same decision log schema
    - No production data in dev/staging
    - Audit trails are environment-specific
    - Test fixtures don't leak to production
  
  access_control:
    - Dev: Development team access
    - Staging: QA and governance team access
    - Prod: Authorized operations team only
    - Audit logs: Read-only for most, append-only for system
  
  resource_isolation:
    - Each environment has dedicated resources
    - No cross-environment dependencies
    - State is environment-specific
    - Decision logs are per-environment

adaptation_guidelines:
  domains_may_customize:
    - Environment characteristics
    - Deployment conditions
    - Testing scope per environment
    - Promotion requirements
    - Rollback procedures
  
  domains_must_preserve:
    - Progressive deployment model
    - Gate-based promotion
    - Audit trail integrity
    - Rollback capability
    - Resource isolation

version: "1.0.0"
status: ADAPTIVE
EOF

cat > "$ROOT/knowledge/domains/default/14_RiskComplianceTriggers.yaml" <<'EOF'
# Risk and Compliance Triggers - Default Domain
# Status: ADAPTIVE
# Defines conditions that trigger additional scrutiny or requirements

risk_levels:
  minimal:
    criteria:
      - Documentation-only changes
      - Non-production environment
      - No user-facing impact
      - Fully reversible
    
    additional_requirements: []
    
    approval_level: STANDARD
  
  moderate:
    criteria:
      - Configuration changes
      - Dev or staging environment
      - Limited user impact
      - Reversible with effort
    
    additional_requirements:
      - Rollback plan required
      - Impact assessment required
    
    approval_level: STANDARD
  
  significant:
    criteria:
      - Code or package changes
      - Staging environment
      - Moderate user impact
      - Complex rollback
    
    additional_requirements:
      - Comprehensive testing required
      - Rollback plan and validation required
      - Security review required
    
    approval_level: ELEVATED
  
  major:
    criteria:
      - Production deployment
      - High user impact
      - Data migration involved
      - Difficult rollback
    
    additional_requirements:
      - Full acceptance test suite required
      - Security and compliance review required
      - Executive approval required
      - Staged rollout plan required
      - 24/7 support coverage required
    
    approval_level: EXECUTIVE

compliance_triggers:
  security_review_required:
    conditions:
      - Authentication or authorization changes
      - Cryptographic changes
      - Security-sensitive configuration
      - External service integration
      - User data handling changes
    
    review_authority: SECURITY_TEAM
    
    evidence_required:
      - Security scan results
      - Penetration test results (for prod)
      - Security architecture review
  
  legal_review_required:
    conditions:
      - Privacy policy changes
      - Terms of service changes
      - Data retention policy changes
      - Cross-border data transfer
      - Regulatory compliance impact
    
    review_authority: LEGAL_TEAM
    
    evidence_required:
      - Legal review memo
      - Compliance checklist
      - Privacy impact assessment
  
  compliance_review_required:
    conditions:
      - Audit trail changes
      - Governance process changes
      - Regulatory control changes
      - Industry standard compliance
    
    review_authority: COMPLIANCE_TEAM
    
    evidence_required:
      - Compliance assessment
      - Control validation results
      - Audit trail verification
  
  architecture_review_required:
    conditions:
      - New service introduction
      - Architecture pattern change
      - Scalability concerns
      - Performance-critical changes
    
    review_authority: ARCHITECTURE_TEAM
    
    evidence_required:
      - Architecture decision record
      - Scalability analysis
      - Performance test results

escalation_triggers:
  automatic_escalation:
    conditions:
      - Risk level == MAJOR
      - Production environment
      - Critical priority
      - Compliance trigger active
      - Previous failure history
    
    escalation_target: EXECUTIVE_APPROVAL
    
    escalation_requirements:
      - Executive briefing prepared
      - Risk mitigation plan documented
      - Rollback procedures validated
  
  manual_escalation_available:
    conditions:
      - Reviewer requests escalation
      - Approver requests executive input
      - Stakeholder raises concern
      - Uncertainty about authority
    
    escalation_process:
      - Document escalation reason
      - Provide full context
      - Await executive decision

veto_triggers:
  operational_veto_conditions:
    - Production incident in progress
    - Maintenance window conflict
    - Resource capacity constraint
    - Monitoring system degraded
    - On-call team unavailable
    - Recent production failure
  
  veto_authority: OPERATIONAL_TEAM
  
  veto_process:
    - Veto reason must be documented
    - Expected resolution time provided
    - Artifact moves to RELEASE_BLOCKED
    - Veto can be cleared when condition resolves

release_block_triggers:
  automatic_block:
    conditions:
      - Staging gate != PASS
      - Knowledge completeness != PASS
      - Fixture completeness != PASS
      - Any terminal rejection state
      - Active security incident
    
    block_authority: RELEASE_CONTROLLER
    
    unblock_requirements:
      - Block condition fully resolved
      - Re-validation completed
      - Governance sign-off obtained
  
  manual_block:
    conditions:
      - Executive decision
      - Emergency operational need
      - External regulatory requirement
    
    block_authority: EXECUTIVE_AUTHORITY
    
    unblock_requirements:
      - Explicit executive approval
      - Documented resolution
      - Audit trail entry

monitoring_requirements:
  by_risk_level:
    minimal:
      monitoring: STANDARD
      alerting: NONE
      on_call: NOT_REQUIRED
    
    moderate:
      monitoring: STANDARD
      alerting: BASIC
      on_call: BUSINESS_HOURS
    
    significant:
      monitoring: ENHANCED
      alerting: COMPREHENSIVE
      on_call: EXTENDED_HOURS
    
    major:
      monitoring: INTENSIVE
      alerting: CRITICAL_PATH
      on_call: 24x7

adaptation_guidelines:
  domains_may_customize:
    - Risk level criteria
    - Compliance trigger conditions
    - Review authority definitions
    - Escalation thresholds
    - Monitoring requirements
  
  domains_must_preserve:
    - Progressive risk management
    - Compliance enforcement
    - Escalation capability
    - Veto mechanism
    - Audit trail of triggers

version: "1.0.0"
status: ADAPTIVE
EOF

cat > "$ROOT/knowledge/domains/default/15_CommercialPackagingRules.yaml" <<'EOF'
# Commercial Packaging Rules - Default Domain
# Status: ADAPTIVE
# Defines how artifacts are packaged for commercial distribution

packaging_types:
  internal_use:
    description: Artifacts for internal organizational use only
    
    requirements:
      licensing: NOT_REQUIRED
      third_party_notices: RECOMMENDED
      distribution_rights: INTERNAL_ONLY
      support_commitment: BEST_EFFORT
    
    validation:
      - Internal approval sufficient
      - No export control check required
      - Standard testing required
    
    distribution_channels:
      - Internal artifact repository
      - Internal deployment systems
  
  open_source:
    description: Artifacts released under open source license
    
    requirements:
      licensing: REQUIRED
      license_type: OSI_APPROVED
      third_party_notices: REQUIRED
      source_code: MUST_INCLUDE
      distribution_rights: PUBLIC
      support_commitment: COMMUNITY
    
    validation:
      - License compatibility check required
      - Third-party dependency review required
      - Source code completeness check required
      - Documentation standards check required
    
    distribution_channels:
      - Public package repositories
      - Public source control
      - Official download sites
  
  commercial:
    description: Artifacts for commercial sale or licensing
    
    requirements:
      licensing: REQUIRED
      license_type: PROPRIETARY_OR_COMMERCIAL
      third_party_notices: REQUIRED
      licensing_terms: MUST_DEFINE
      distribution_rights: LICENSED
      support_commitment: CONTRACTUAL
      warranty_terms: MUST_DEFINE
    
    validation:
      - License review required
      - Legal approval required
      - Third-party licensing cleared
      - Support plan validated
      - Warranty terms reviewed
    
    distribution_channels:
      - Licensed customer repositories
      - Commercial distribution platforms
      - Customer-specific delivery

licensing_constraints:
  third_party_dependencies:
    allowed_licenses:
      permissive:
        - MIT
        - Apache-2.0
        - BSD-2-Clause
        - BSD-3-Clause
      
      copyleft_weak:
        - LGPL-2.1
        - LGPL-3.0
        - MPL-2.0
      
      copyleft_strong:
        - GPL-2.0
        - GPL-3.0
        - AGPL-3.0
    
    compatibility_rules:
      - Permissive licenses compatible with all packaging types
      - Weak copyleft requires source distribution for library
      - Strong copyleft requires full source distribution
      - AGPL requires network use source provision
  
  license_verification:
    required_for: ALL_PACKAGING_TYPES
    
    verification_steps:
      - Enumerate all dependencies
      - Identify license for each dependency
      - Check compatibility with packaging type
      - Verify license text inclusion
      - Generate third-party notices file

distribution_restrictions:
  export_control:
    check_required:
      - Commercial packaging
      - Open source with encryption
      - Cross-border distribution
    
    validation:
      - Export control classification
      - Restricted country check
      - Encryption registration check
  
  geographic_restrictions:
    by_packaging_type:
      internal_use:
        restrictions: ORGANIZATIONAL_BOUNDARIES
      
      open_source:
        restrictions: EXPORT_CONTROL_ONLY
      
      commercial:
        restrictions: PER_LICENSE_AGREEMENT

versioning_requirements:
  semantic_versioning:
    required_for: ALL_PACKAGING_TYPES
    
    format: MAJOR.MINOR.PATCH
    
    increment_rules:
      major: Breaking changes or major features
      minor: New features, backward compatible
      patch: Bug fixes, backward compatible
  
  version_metadata:
    required_fields:
      - version_number
      - release_date
      - package_type
      - license_identifier
      - support_level
  
  changelog:
    required_for: ALL_PACKAGING_TYPES
    
    required_sections:
      - Added: New features
      - Changed: Changes in existing functionality
      - Deprecated: Soon-to-be removed features
      - Removed: Removed features
      - Fixed: Bug fixes
      - Security: Security-related changes

support_commitments:
  by_packaging_type:
    internal_use:
      support_level: BEST_EFFORT
      sla: NONE
      support_channels:
        - Internal ticketing system
        - Team communication channels
    
    open_source:
      support_level: COMMUNITY
      sla: NONE
      support_channels:
        - Public issue tracker
        - Community forums
        - Documentation
      
      expectations:
        - Bug reports welcome
        - Pull requests considered
        - No guaranteed response time
    
    commercial:
      support_level: CONTRACTUAL
      sla: PER_CONTRACT
      support_channels:
        - Dedicated support portal
        - Email support
        - Phone support (for premium)
      
      expectations:
        - Response time per SLA
        - Issue resolution per SLA
        - Security patch commitment

documentation_requirements:
  all_packaging_types:
    required:
      - README with overview
      - Installation instructions
      - Basic usage examples
      - License information
      - Third-party notices
  
  open_source_additional:
    required:
      - Contributing guidelines
      - Code of conduct
      - Development setup guide
      - Architecture documentation
  
  commercial_additional:
    required:
      - Comprehensive user guide
      - API reference
      - Troubleshooting guide
      - Support contact information
      - SLA documentation

adaptation_guidelines:
  domains_may_customize:
    - Packaging types
    - License policies
    - Distribution channels
    - Support commitments
    - Documentation requirements
  
  domains_must_preserve:
    - License compliance enforcement
    - Third-party notice requirements
    - Export control compliance
    - Version traceability

version: "1.0.0"
status: ADAPTIVE
EOF

cat > "$ROOT/knowledge/domains/default/16_ClaimsEvidencePolicy.yaml" <<'EOF'
# Claims and Evidence Policy - Default Domain
# Status: ADAPTIVE
# Defines what claims require what evidence

claim_categories:
  functional_correctness:
    description: Claims about functional behavior and correctness
    
    claim_types:
      - Feature works as specified
      - Bug is fixed
      - Requirements are met
      - Acceptance criteria satisfied
    
    required_evidence:
      - automated_test_results:
          description: Automated test suite results
          sufficiency: Test coverage > 80% for changed code
          verification: AE-Claims validates test execution
      
      - manual_test_results:
          description: Manual test execution records
          sufficiency: All critical paths tested
          verification: AE-Claims validates test completeness
      
      - acceptance_test_results:
          description: User acceptance test results
          sufficiency: All acceptance criteria pass
          verification: AE-Claims validates against requirements
  
  quality_assurance:
    description: Claims about code quality and maintainability
    
    claim_types:
      - Code meets quality standards
      - Technical debt is acceptable
      - Performance is adequate
      - Maintainability is good
    
    required_evidence:
      - code_review_results:
          description: Code review findings and approvals
          sufficiency: At least one reviewer approval
          verification: AE-Claims validates reviewer authority
      
      - static_analysis_results:
          description: Static code analysis results
          sufficiency: No critical or high severity issues
          verification: AE-Claims validates analysis execution
      
      - performance_test_results:
          description: Performance benchmark results
          sufficiency: Meets defined performance thresholds
          verification: AE-Claims validates against baselines
  
  security:
    description: Claims about security properties
    
    claim_types:
      - No security vulnerabilities introduced
      - Security controls are effective
      - Authentication/authorization correct
      - Data protection adequate
    
    required_evidence:
      - security_scan_results:
          description: Automated security scan results
          sufficiency: No critical or high vulnerabilities
          verification: AE-Claims validates scan coverage
      
      - security_review_findings:
          description: Security team review results
          sufficiency: Security team approval obtained
          verification: AE-Claims validates reviewer authority
      
      - penetration_test_results:
          description: Penetration testing results (prod only)
          sufficiency: No exploitable vulnerabilities found
          verification: AE-Claims validates test scope
  
  compliance:
    description: Claims about regulatory and policy compliance
    
    claim_types:
      - Meets regulatory requirements
      - Complies with internal policies
      - Audit trail is complete
      - Privacy requirements satisfied
    
    required_evidence:
      - compliance_checklist:
          description: Completed compliance checklist
          sufficiency: All items checked and validated
          verification: AE-Claims validates checklist completeness
      
      - compliance_review_approval:
          description: Compliance team review and approval
          sufficiency: Formal approval documented
          verification: AE-Claims validates approver authority
      
      - audit_trail_validation:
          description: Audit trail completeness verification
          sufficiency: All required events logged
          verification: AE-Claims validates log integrity
  
  operational_readiness:
    description: Claims about production readiness
    
    claim_types:
      - Monitoring is in place
      - Rollback plan is validated
      - Documentation is complete
      - Support is prepared
    
    required_evidence:
      - monitoring_validation:
          description: Monitoring and alerting configuration
          sufficiency: All critical paths monitored
          verification: AE-Claims validates coverage
      
      - rollback_plan:
          description: Documented and tested rollback procedure
          sufficiency: Rollback tested in staging
          verification: AE-Claims validates test results
      
      - documentation:
          description: User and operational documentation
          sufficiency: All required sections complete
          verification: AE-Claims validates completeness
      
      - support_readiness:
          description: Support team prepared
          sufficiency: Training complete, on-call coverage
          verification: AE-Claims validates readiness

evidence_sufficiency_rules:
  minimum_requirements:
    all_claims:
      - At least one piece of evidence per claim
      - Evidence must be verifiable
      - Evidence must be recent (not stale)
      - Evidence must be from authoritative source
  
  high_risk_artifacts:
    - Multiple independent evidence sources required
    - Third-party verification may be required
    - Executive sign-off may be required
  
  low_risk_artifacts:
    - Single evidence source may be sufficient
    - Self-verification may be acceptable
    - Standard approval process

evidence_freshness:
  automated_test_results:
    maximum_age: 24_hours
    must_be_from: Current artifact version
  
  security_scans:
    maximum_age: 7_days
    must_be_from: Current artifact version
  
  manual_reviews:
    maximum_age: 30_days
    must_be_from: Current or compatible version
  
  compliance_approvals:
    maximum_age: 90_days
    must_be_from: Current policy version

evidence_quality:
  trustworthiness:
    high_trust:
      - Automated test systems
      - Certified scanning tools
      - Approved review authorities
    
    medium_trust:
      - Manual test records
      - Self-reported metrics
      - Peer reviews
    
    low_trust:
      - Unverified claims
      - Outdated evidence
      - Unauthorized sources
  
  completeness:
    complete:
      - All claims have evidence
      - All evidence is verifiable
      - No gaps in coverage
    
    incomplete:
      - Some claims lack evidence
      - Some evidence not verifiable
      - Coverage gaps exist
    
    insufficient:
      - Most claims lack evidence
      - Evidence quality poor
      - Major coverage gaps

verification_process:
  for_each_claim:
    steps:
      1. Identify claim statement
      2. Determine required evidence type
      3. Locate and retrieve evidence
      4. Verify evidence authenticity
      5. Assess evidence freshness
      6. Evaluate evidence quality
      7. Determine sufficiency
      8. Document verification result
  
  verification_outcomes:
    verified:
      condition: Sufficient high-quality evidence
      next_state: CLAIMS_VERIFIED
    
    insufficient:
      condition: Evidence missing or inadequate
      next_state: CLAIMS_INSUFFICIENT
      action: Document gaps, request additional evidence
    
    rejected:
      condition: Evidence contradicts claim
      next_state: INTAKE_REJECTED
      action: Reject artifact, document reason

special_cases:
  no_evidence_available:
    handling: >
      If evidence cannot be provided due to legitimate constraints,
      escalate to appropriate authority for waiver decision.
      Document reason and obtain explicit approval.
    
    must_not: Accept claim without evidence or approval
  
  conflicting_evidence:
    handling: >
      If evidence sources conflict, escalate to review authority
      for investigation and resolution. Do not proceed until resolved.
    
    must_not: Ignore conflicting evidence or choose selectively
  
  unknown_claim_type:
    handling: >
      If claim type is not defined in this policy, escalate to
      governance for policy clarification or extension.
    
    must_not: Proceed without defined evidence requirements

adaptation_guidelines:
  domains_may_customize:
    - Claim categories
    - Evidence requirements
    - Sufficiency thresholds
    - Freshness requirements
    - Quality criteria
  
  domains_must_preserve:
    - Evidence is required for all claims
    - Verification process is mandatory
    - Quality assessment is required
    - Escalation paths exist for exceptions

version: "1.0.0"
status: ADAPTIVE
EOF

cat > "$ROOT/knowledge/domains/default/17_ReviewLaneRules.yaml" <<'EOF'
# Review Lane Rules - Default Domain
# Status: ADAPTIVE
# Defines how artifacts are routed to appropriate review lanes

review_lanes:
  technical:
    description: Technical correctness and code quality review
    
    triggers:
      - artifact_type in [PACKAGE_RELEASE, CONFIGURATION_CHANGE]
      - code_changes_present
      - technical_risk >= MODERATE
    
    reviewer_qualifications:
      - Technical expertise in relevant area
      - Familiarity with codebase
      - Understanding of architecture
    
    review_focus:
      - Code quality and maintainability
      - Architecture alignment
      - Technical debt impact
      - Performance considerations
      - Error handling robustness
    
    approval_criteria:
      - Code meets quality standards
      - Architecture principles followed
      - Technical risks acceptable
      - No critical technical issues
    
    typical_duration: 2_to_4_hours
  
  security:
    description: Security and vulnerability assessment
    
    triggers:
      - artifact_type in [PACKAGE_RELEASE, CONFIGURATION_CHANGE]
      - security_sensitive_changes
      - target_environment == PROD
      - authentication_or_authorization_changes
      - cryptographic_changes
      - external_integration_changes
    
    reviewer_qualifications:
      - Security expertise
      - Threat modeling experience
      - Vulnerability assessment skills
    
    review_focus:
      - Security vulnerabilities
      - Authentication and authorization
      - Data protection
      - Cryptographic correctness
      - Input validation
      - Security best practices
    
    approval_criteria:
      - No critical or high vulnerabilities
      - Security controls effective
      - Threat model updated
      - Security best practices followed
    
    typical_duration: 4_to_8_hours
  
  compliance:
    description: Regulatory and policy compliance review
    
    triggers:
      - compliance_flags_present
      - privacy_impact
      - regulatory_requirements_affected
      - audit_trail_changes
      - policy_changes
    
    reviewer_qualifications:
      - Compliance expertise
      - Regulatory knowledge
      - Policy interpretation skills
    
    review_focus:
      - Regulatory compliance
      - Policy adherence
      - Privacy requirements
      - Audit trail completeness
      - Record retention
    
    approval_criteria:
      - Regulatory requirements met
      - Policies followed
      - Privacy protections adequate
      - Audit trail complete
    
    typical_duration: 2_to_6_hours
  
  business:
    description: Business value and priority review
    
    triggers:
      - high_business_impact
      - strategic_initiative
      - customer_facing_changes
      - commercial_implications
    
    reviewer_qualifications:
      - Business domain expertise
      - Product management experience
      - Customer understanding
    
    review_focus:
      - Business value alignment
      - Customer impact
      - Market positioning
      - Strategic fit
      - Commercial viability
    
    approval_criteria:
      - Business value clear
      - Customer impact acceptable
      - Strategic alignment confirmed
      - Commercial model sound
    
    typical_duration: 1_to_3_hours
  
  operational:
    description: Operational readiness and impact review
    
    triggers:
      - target_environment in [STAGING, PROD]
      - operational_impact >= MODERATE
      - infrastructure_changes
      - capacity_implications
    
    reviewer_qualifications:
      - Operations expertise
      - Production support experience
      - Incident response skills
    
    review_focus:
      - Operational readiness
      - Monitoring and alerting
      - Rollback procedures
      - Support preparedness
      - Capacity planning
      - Impact on existing systems
    
    approval_criteria:
      - Operations team ready
      - Monitoring adequate
      - Rollback validated
      - Support prepared
      - Capacity sufficient
    
    typical_duration: 2_to_4_hours

routing_rules:
  automatic_routing:
    rules:
      - if: target_environment == PROD
        then: route_to [technical, security, operational]
      
      - if: security_sensitive_changes == true
        then: route_to [security]
      
      - if: compliance_flags_present == true
        then: route_to [compliance]
      
      - if: estimated_impact >= SIGNIFICANT
        then: route_to [technical, business, operational]
      
      - if: estimated_impact == MODERATE
        then: route_to [technical]
      
      - if: estimated_impact == MINIMAL
        then: skip_review
  
  manual_routing_override:
    allowed: true
    authority: CP-Governor
    rationale_required: true

multi_lane_coordination:
  parallel_review:
    allowed: true
    lanes_can_run_parallel:
      - technical and security
      - technical and compliance
      - business and operational
  
  sequential_review:
    required_when:
      - Review findings block other reviews
      - Interdependencies between lanes
  
  conflict_resolution:
    - If lanes disagree on approval, escalate to governance
    - Document disagreement and rationale
    - Governance makes final decision

review_timeouts:
  by_lane:
    technical: 48_hours
    security: 72_hours
    compliance: 72_hours
    business: 24_hours
    operational: 48_hours
  
  escalation_on_timeout:
    - Notify reviewer and governance
    - Escalate to review manager
    - May proceed with partial review if risk acceptable

reviewer_assignment:
  assignment_criteria:
    - Reviewer availability
    - Relevant expertise
    - No conflict of interest
    - Workload balance
  
  assignment_process:
    1. Identify required review lanes
    2. Match lanes to available reviewers
    3. Check reviewer qualifications
    4. Verify availability
    5. Assign and notify
  
  reassignment:
    allowed_if:
      - Reviewer unavailable
      - Expertise mismatch discovered
      - Conflict of interest identified

review_completion:
  required_outputs:
    - Review decision (APPROVE/REJECT/NEEDS_WORK)
    - Review findings document
    - Risk assessment
    - Recommendations
  
  approval_requirements:
    - All assigned lanes must approve
    - No unresolved critical findings
    - All recommendations addressed or accepted
  
  rejection_handling:
    - Document rejection reason
    - Provide specific feedback
    - Suggest remediation steps
    - Allow resubmission after fixes

adaptation_guidelines:
  domains_may_customize:
    - Review lane definitions
    - Routing triggers
    - Reviewer qualifications
    - Review focus areas
    - Approval criteria
    - Timeout values
  
  domains_must_preserve:
    - Review requirement for high-risk artifacts
    - Approval requirement for production
    - Escalation mechanism
    - Documentation requirements

version: "1.0.0"
status: ADAPTIVE
EOF

cat > "$ROOT/knowledge/domains/default/18_ApprovalEscalationMatrix.yaml" <<'EOF'
# Approval Escalation Matrix - Default Domain
# Status: ADAPTIVE
# Defines approval paths and escalation rules

approval_levels:
  standard:
    authority: TECHNICAL_LEAD
    scope:
      - Development and staging deployments
      - Low to moderate risk changes
      - Standard operational changes
    
    approval_requirements:
      - Technical review approved
      - No compliance flags
      - Standard testing complete
    
    typical_turnaround: 4_hours
  
  elevated:
    authority: ENGINEERING_MANAGER
    scope:
      - Production deployments (low risk)
      - Significant impact changes
      - Security-related changes
      - Compliance-flagged changes
    
    approval_requirements:
      - Technical and security review approved
      - Compliance review approved (if flagged)
      - Comprehensive testing complete
      - Rollback plan validated
    
    typical_turnaround: 24_hours
  
  executive:
    authority: EXECUTIVE_AUTHORITY
    scope:
      - High-risk production deployments
      - Major impact changes
      - Strategic initiatives
      - Regulatory-significant changes
    
    approval_requirements:
      - All review lanes approved
      - Risk mitigation plan approved
      - Executive briefing provided
      - Stakeholder alignment confirmed
    
    typical_turnaround: 72_hours

escalation_triggers:
  automatic_escalation:
    conditions:
      - risk_level == MAJOR
      - target_environment == PROD AND estimated_impact >= SIGNIFICANT
      - compliance_trigger_active
      - security_critical_changes
      - previous_failure_in_same_area
      - regulatory_implications
    
    escalation_target: EXECUTIVE
    
    escalation_requirements:
      - Prepare executive briefing
      - Document risk mitigation
      - Validate rollback procedures
      - Confirm stakeholder alignment
  
  conditional_escalation:
    conditions:
      - risk_level == SIGNIFICANT AND target_environment == PROD
      - multiple_review_lanes_required
      - business_critical_changes
    
    escalation_target: ELEVATED
    
    escalation_requirements:
      - Comprehensive test results
      - Security validation
      - Operational readiness confirmed
  
  manual_escalation:
    triggers:
      - Reviewer requests escalation
      - Approver uncertain about authority
      - Stakeholder raises significant concern
      - Unexpected risk identified
    
    escalation_process:
      - Document escalation reason
      - Provide full context
      - Identify appropriate escalation level
      - Await higher authority decision

approval_workflow:
  standard_workflow:
    steps:
      1. Technical review
      2. Technical lead approval
      3. Deploy to target environment
    
    applicable_to:
      - Dev deployments
      - Low-risk staging deployments
      - Documentation changes
  
  elevated_workflow:
    steps:
      1. Technical review
      2. Security review (if applicable)
      3. Compliance review (if applicable)
      4. Engineering manager approval
      5. Deploy to target environment
    
    applicable_to:
      - Low-risk production deployments
      - Staging deployments with compliance flags
      - Security-related changes
  
  executive_workflow:
    steps:
      1. All applicable review lanes
      2. Engineering manager pre-approval
      3. Executive briefing preparation
      4. Executive review and approval
      5. Final deployment authorization
      6. Deploy with enhanced monitoring
    
    applicable_to:
      - High-risk production deployments
      - Strategic or regulatory changes
      - Changes with major business impact

delegation_rules:
  delegation_allowed:
    - Standard approvals may be delegated to qualified deputies
    - Delegation must be documented
    - Delegated authority has same responsibilities
  
  delegation_prohibited:
    - Executive approvals cannot be delegated
    - Compliance approvals cannot be delegated
    - Security critical approvals cannot be delegated
  
  delegation_requirements:
    - Deputy must meet qualification requirements
    - Delegation must be time-bound
    - Delegation must be revocable

parallel_approvals:
  allowed_parallel:
    - Technical and security reviews
    - Technical and compliance reviews
    - Business and operational reviews
  
  must_be_sequential:
    - Technical review before manager approval
    - Manager approval before executive approval
    - All reviews before final deployment approval

approval_timeout_handling:
  timeout_periods:
    standard: 24_hours
    elevated: 72_hours
    executive: 120_hours
  
  on_timeout:
    - Automatic notification to approver
    - Notification to approver's manager
    - Escalation to next level if no response
    - Never proceed without approval

approval_revocation:
  revocation_allowed:
    - Approver discovers new information
    - Risk assessment changes
    - Compliance violation discovered
  
  revocation_process:
    - Document revocation reason
    - Notify all stakeholders
    - Halt deployment if in progress
    - Require re-approval after remediation
  
  revocation_authority:
    - Original approver
    - Higher authority level
    - Compliance authority
    - Executive authority

conditional_approvals:
  allowed: true
  
  conditions_types:
    - Deploy only during specified time window
    - Deploy with staged rollout
    - Deploy with enhanced monitoring
    - Deploy with on-call team ready
  
  condition_enforcement:
    - Conditions must be met before deployment
    - Violations invalidate approval
    - Condition adherence is audited

approval_documentation:
  required_for_all_approvals:
    - Approver identity
    - Approval timestamp
    - Approval level
    - Conditions (if any)
    - Decision rationale
  
  required_for_elevated_and_executive:
    - Risk assessment review
    - Mitigation plan acceptance
    - Stakeholder alignment confirmation
    - Rollback readiness verification

exceptional_circumstances:
  emergency_bypass:
    allowed: true
    authority: EXECUTIVE_ONLY
    
    conditions:
      - Production incident resolution
      - Security vulnerability remediation
      - Regulatory compliance emergency
    
    requirements:
      - Executive pre-approval or ratification
      - Enhanced audit logging
      - Post-incident review required
      - Lessons learned documentation
  
  retroactive_approval:
    allowed: LIMITED
    
    applicable_to:
      - Emergency bypasses only
      - Must be ratified within 24 hours
      - Full audit trail required
    
    not_applicable_to:
      - Standard deployments
      - Planned releases
      - Non-emergency changes

adaptation_guidelines:
  domains_may_customize:
    - Approval level definitions
    - Escalation triggers
    - Approval workflows
    - Timeout periods
    - Delegation policies
  
  domains_must_preserve:
    - Progressive approval model
    - Escalation capability
    - Executive override authority
    - Audit trail requirements
    - Emergency response capability

version: "1.0.0"
status: ADAPTIVE
EOF

echo ""
echo "Created domain knowledge files:"
printf '  - %s\n' \
  "$ROOT/knowledge/domains/default/10_DomainOntology.md" \
  "$ROOT/knowledge/domains/default/11_FramingRules.yaml" \
  "$ROOT/knowledge/domains/default/12_PrimitiveCatalog.yaml" \
  "$ROOT/knowledge/domains/default/13_DeliveryTopologyRules.yaml" \
  "$ROOT/knowledge/domains/default/14_RiskComplianceTriggers.yaml" \
  "$ROOT/knowledge/domains/default/15_CommercialPackagingRules.yaml" \
  "$ROOT/knowledge/domains/default/16_ClaimsEvidencePolicy.yaml" \
  "$ROOT/knowledge/domains/default/17_ReviewLaneRules.yaml" \
  "$ROOT/knowledge/domains/default/18_ApprovalEscalationMatrix.yaml"

echo ""
echo "Knowledge file pack creation complete!"
echo ""
echo "Summary:"
echo "  - 7 core knowledge files (INVARIANT)"
echo "  - 9 domain knowledge files (ADAPTIVE)"
echo "  - Total: 16 knowledge files"
