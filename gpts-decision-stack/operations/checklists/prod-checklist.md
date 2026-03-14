
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
