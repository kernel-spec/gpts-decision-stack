
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
