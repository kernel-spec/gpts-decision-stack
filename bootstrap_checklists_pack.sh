#!/usr/bin/env bash
set -euo pipefail

ROOT="${1:-gpts-decision-stack}"

mkdir -p \
  "$ROOT/operations/checklists" \
  "$ROOT/operations/gates"

cat > "$ROOT/operations/checklists/local-checklist.md" <<'EOF'
# Local Checklist

## Purpose

Catch structural errors, missing content, and schema issues before any integration environment is used.

## Status values

Use only:

- `PASS`
- `FAIL`
- `BLOCKED`
- `N/A`

`BLOCKED` means the checklist cannot be fairly evaluated because required inputs are missing.

## Readiness checklist

| Check ID | Check | Owner | Status |
|---|---|---|---|
| L-001 | `README.md` exists | Repo Owner |  |
| L-002 | `MASTER_SPEC.md` exists | Repo Owner |  |
| L-003 | `repo.manifest.yaml` exists and is a full final file | Repo Owner |  |
| L-004 | all `prompts/...` files exist | Prompt Owner |  |
| L-005 | all `prompts/...` files have content | Prompt Owner |  |
| L-006 | all `knowledge/...` files exist | Knowledge Owner |  |
| L-007 | all `knowledge/...` files have content | Knowledge Owner |  |
| L-008 | all `schemas/...` files exist | Schema Owner |  |
| L-009 | all `tests/acceptance/...` files exist | QA Owner |  |
| L-010 | all `tests/fixtures/...` files exist | QA Owner |  |
| L-011 | all `tests/fixtures/...` files have content | QA Owner |  |
| L-012 | YAML syntax validation completed | Repo Owner |  |
| L-013 | manifest references point to existing files | Repo Owner |  |
| L-014 | acceptance references point to existing fixtures | QA Owner |  |
| L-015 | ownership map exists | Governance Ops |  |
| L-016 | approval map exists | Governance Ops |  |
| L-017 | operational veto map exists | Governance Ops |  |
| L-018 | QA artifact path is defined | QA Owner |  |

## Exit criteria

| Criterion | Required Result |
|---|---|
| all required files exist | `PASS` |
| knowledge completeness | `PASS` |
| fixture completeness | `PASS` |
| schema syntax | `PASS` |
| manifest consistency | `PASS` |

## Evidence pack

| Evidence | Required |
|---|---|
| file existence report | yes |
| YAML validation output | yes |
| manifest reference check | yes |
| local QA report | yes |

## Gate result template

```yaml
local_gate_result:
  environment: local
  overall_status: PASS|FAIL|BLOCKED
  blocking_gaps: []
  evidence:
    - file_existence_report
    - yaml_validation_output
    - manifest_reference_check
    - local_qa_report
```

## Fail-fast rule

If any knowledge_file is missing content, or any fixture is missing or empty, local may continue only as working draft validation.

Required result:

```yaml
overall_status: FAIL
bundle_classification: REPO-READY SKELETON
deployment_ready_stack: false
```

EOF

cat > "$ROOT/operations/checklists/dev-checklist.md" <<'EOF'

Dev Checklist

Purpose

Validate the first real integration of GPT configuration with backend services and enforcement services.

Status values

Use only:
	•	PASS
	•	FAIL
	•	BLOCKED
	•	N/A

Entry criteria

Criterion	Required
local gate = PASS	yes
backend image build exists	yes
dev target exists	yes
dev secrets exist	yes
GPT config binding is prepared	yes

Readiness checklist

Check ID	Check	Owner	Status
D-001	local gate = PASS	Release Coordinator	
D-002	action backend build exists	Platform Owner	
D-003	actions/openapi.yaml is bound to a concrete backend	Platform Owner	
D-004	auth binding is defined	Security Owner	
D-005	endpoint owner mapping exists	Platform Owner	
D-006	deployment target for dev exists	Platform Owner	
D-007	core GPTs are provisioned	GPT Ops Owner	
D-008	adaptive GPTs are provisioned	GPT Ops Owner	
D-009	knowledge bundle binding matches manifest	GPT Ops Owner	
D-010	actions binding matches manifest	GPT Ops Owner	
D-011	/v1/state/read responds	Platform Owner	
D-012	/v1/artifacts/validate responds	Platform Owner	
D-013	/v1/policy/read responds	Platform Owner	
D-014	/v1/decision-log/append responds	Platform Owner	
D-015	/v1/veto/check responds	Platform Owner	
D-016	CP-Governor smoke test = PASS	GPT Ops Owner	
D-017	AE-Intake smoke test = PASS	GPT Ops Owner	
D-018	AE-Claims without evidence returns non-proceed	GPT Ops Owner	
D-019	decision log append works	Audit Owner	
D-020	auth failures return expected failure semantics	Security Owner	

Exit criteria

Criterion	Required Result
backend health	PASS
GPT provisioning	PASS
auth binding	PASS
endpoint mapping	PASS
smoke tests	PASS
decision log write	PASS

Evidence pack

Evidence	Required
deploy log	yes
backend health output	yes
auth check output	yes
GPT smoke results	yes
decision log append sample	yes

Gate result template

dev_gate_result:
  environment: dev
  overall_status: PASS|FAIL|BLOCKED
  blocking_gaps: []
  evidence:
    - deploy_log
    - backend_health_output
    - auth_check_output
    - gpt_smoke_results
    - decision_log_append_sample

Blocking rule

Dev is BLOCKED if the backend is not concretely bound, or if auth binding, endpoint ownership, or GPT/action binding is missing.
EOF

cat > "$ROOT/operations/checklists/staging-checklist.md" <<'EOF'

Staging Checklist

Purpose

Run a full release rehearsal with governance reality enabled.

This environment validates:
	•	full acceptance coverage
	•	enterprise topology
	•	regulated escalation
	•	approval workflow
	•	operational veto
	•	release block outside the model
	•	final staging gate

Status values

Use only:
	•	PASS
	•	FAIL
	•	BLOCKED
	•	N/A

Entry blockers

If any of the following are not true, staging is automatically BLOCKED:

Blocker	Required
all knowledge_files have content	yes
all tests/fixtures/... files exist and have content	yes
QA artifact exists	yes
ownership map exists	yes
approval map exists	yes
veto map exists	yes

Readiness checklist

Check ID	Check	Owner	Status
S-001	dev gate = PASS	Release Coordinator	
S-002	knowledge completeness = PASS	Knowledge Owner	
S-003	fixture completeness = PASS	QA Owner	
S-004	QA artifact exists	QA Owner	
S-005	ownership map exists	Governance Ops	
S-006	approval map exists	Governance Ops	
S-007	veto map exists	Governance Ops	
S-008	approval queue is connected	Platform Owner	
S-009	veto registry is connected	Platform Owner	
S-010	release controller is connected	Platform Owner	
S-011	AC-001 = PASS	QA Owner	
S-012	AC-002 = PASS	QA Owner	
S-013	AC-003 = PASS	QA Owner	
S-014	AC-004 = PASS	QA Owner	
S-015	AC-005 = PASS	QA Owner	
S-016	AC-006 = PASS	QA Owner	
S-017	AC-007 = PASS	QA Owner	
S-018	AC-008 = PASS	QA Owner	
S-019	AC-009 = PASS	QA Owner	
S-020	AC-010 = PASS	QA Owner	
S-021	AC-011 = PASS	QA Owner	
S-022	AC-012 = PASS	QA Owner	
S-023	no scenario ends in false proceed	QA Owner	
S-024	approval escalation works	Governance Ops	
S-025	active veto blocks release	Governance Ops	
S-026	release.block works outside model	Platform Owner	
S-027	final staging gate report = PASS	QA Owner	

Exit criteria

Criterion	Required Result
all acceptance tests	PASS
veto enforcement	PASS
approval workflow	PASS
release blocking	PASS
QA artifact	PASS
false proceed count	0

Evidence pack

Evidence	Required
acceptance run output	yes
QA gate report	yes
approval evidence	yes
veto evidence	yes
release block evidence	yes

Gate result template

staging_gate_result:
  environment: staging
  overall_status: PASS|FAIL|BLOCKED
  blocking_gaps: []
  evidence:
    - acceptance_run_output
    - qa_gate_report
    - approval_evidence
    - veto_evidence
    - release_block_evidence

Hard rule

Staging must remain BLOCKED if knowledge completeness or fixture completeness is not PASS.
EOF

cat > "$ROOT/operations/checklists/prod-checklist.md" <<'EOF'

Prod Checklist

Purpose

Control the production release of an approved release candidate.

Status values

Use only:
	•	PASS
	•	FAIL
	•	BLOCKED
	•	N/A

Entry criteria

Criterion	Required
staging gate = PASS	yes
final QA artifact = PASS	yes
authoritative release notes exist	yes
ownership / approval / veto maps are approved	yes
rollback plan exists	yes
monitoring and alerting exist	yes

Readiness checklist

Check ID	Check	Owner	Status
P-001	staging gate = PASS	Release Coordinator	
P-002	final QA artifact = PASS	QA Owner	
P-003	authoritative release notes approved	Release Authority	
P-004	derived packaging notes are separated	Release Coordinator	
P-005	ownership map approved	Governance Approver	
P-006	approval map approved	Governance Approver	
P-007	veto map approved	Governance Approver	
P-008	shell script export scope explicitly decided	Release Authority	
P-009	approved image tag / release scope freeze exists	Platform Owner	
P-010	production backend healthy	Platform Owner	
P-011	production auth healthy	Security Owner	
P-012	production GPT config active	GPT Ops Owner	
P-013	post-deploy smoke = PASS	GPT Ops Owner	
P-014	decision log writes successfully	Audit Owner	
P-015	veto check works	Governance Ops	
P-016	release block works	Governance Ops	
P-017	alerting green	Platform Owner	
P-018	rollback readiness confirmed	Platform Owner	

Exit criteria

Criterion	Required Result
governance sign-off	PASS
production smoke	PASS
audit logging	PASS
veto and release block	PASS
rollback readiness	PASS

Evidence pack

Evidence	Required
production deployment record	yes
approved release scope	yes
final QA artifact	yes
production smoke output	yes
monitoring snapshot	yes
authoritative release notes	yes

Gate result template

prod_gate_result:
  environment: prod
  overall_status: PASS|FAIL|BLOCKED
  blocking_gaps: []
  evidence:
    - production_deployment_record
    - approved_release_scope
    - final_qa_artifact
    - production_smoke_output
    - monitoring_snapshot
    - authoritative_release_notes

Hard rule

Production must remain BLOCKED if staging is not PASS, or if knowledge completeness or fixture completeness is not PASS.
EOF

cat > "$ROOT/operations/gates/promotion-gate.yaml" <<'EOF'
status_model:
  allowed_statuses:
    - PASS
    - FAIL
    - BLOCKED
    - N/A

global_promotion_gate:
  fail_if:
    - any_knowledge_file_missing_content
    - any_fixture_missing
    - any_fixture_missing_content
  result_if_triggered:
    overall_status: FAIL
    bundle_classification: REPO-READY SKELETON
    deployment_ready_stack: false
    staging: BLOCKED
    prod: BLOCKED
    blocking_gaps:
      - knowledge_content
      - fixture_content

environment_promotion_map:
  - from: local
    to: dev
    allowed_only_if:
      - repo_manifest_complete
      - prompt_completeness == PASS
      - schema_consistency == PASS
      - backend_binding_defined == PASS
  - from: dev
    to: staging
    allowed_only_if:
      - dev_gate == PASS
      - backend_health == PASS
      - auth_binding == PASS
      - gpt_provisioning == PASS
      - smoke_tests == PASS
  - from: staging
    to: prod
    allowed_only_if:
      - staging_gate == PASS
      - final_qa_artifact == PASS
      - ownership_map_approved == PASS
      - approval_map_approved == PASS
      - veto_map_approved == PASS
      - authoritative_release_notes_approved == PASS

environment_blockers:
  local:
    blocked_if: []
  dev:
    blocked_if:
      - openapi_not_bound_to_concrete_backend
      - auth_binding_missing
      - endpoint_owner_mapping_missing
      - gpt_action_binding_missing
  staging:
    blocked_if:
      - knowledge_file_completeness != PASS
      - fixture_completeness != PASS
      - qa_artifact_missing
      - ownership_map_missing
      - approval_map_missing
      - veto_map_missing
  prod:
    blocked_if:
      - staging_gate != PASS
      - final_qa_artifact != PASS
      - knowledge_file_completeness != PASS
      - fixture_completeness != PASS
      - ownership_map_not_approved
      - approval_map_not_approved
      - veto_map_not_approved
      - authoritative_release_notes_missing

promotion_override_rule:
  if_any:
    - knowledge_file_completeness != PASS
    - fixture_completeness != PASS
  force_result:
    staging: BLOCKED
    prod: BLOCKED
    overall_status: FAIL
    bundle_classification: REPO-READY SKELETON
    deployment_ready_stack: false
    blocking_gaps:
      - knowledge_content
      - fixture_content

current_gate_position:
  overall_status: FAIL
  bundle_classification: REPO-READY SKELETON
  deployment_ready_stack: false
  staging: BLOCKED
  prod: BLOCKED
  blocking_gaps:
    - knowledge_content
    - fixture_content
  reason: >
    Final deployment readiness cannot pass until all knowledge_files and
    tests/fixtures content are explicitly present and auditable.
EOF


echo "Created files:"
printf ' - %s\n' \
  "$ROOT/operations/checklists/local-checklist.md" \
  "$ROOT/operations/checklists/dev-checklist.md" \
  "$ROOT/operations/checklists/staging-checklist.md" \
  "$ROOT/operations/checklists/prod-checklist.md" \
  "$ROOT/operations/gates/promotion-gate.yaml"
