
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
