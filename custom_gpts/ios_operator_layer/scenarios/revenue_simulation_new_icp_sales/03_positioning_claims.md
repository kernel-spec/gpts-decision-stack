# 03 — POSITIONING &amp; CLAIMS

scenario: POSITIONING &amp; CLAIMS
run_id: RUN_NEW_ICP_POSITIONING_01
session_id: SESSION_NEW_ICP_SALES_01
artifact_id_prefix: REV_POSITIONING

inputs:
- locked_offer: Governed GPT Workflow Audit
- locked_icp: Head of RevOps / Revenue Operations leader in B2B SaaS
- primary_cta: Book a 20-min diagnostic call
- allowed_proof_basis:
  - founder-built governed stack exists
  - worker-backed state/evidence/closure discipline exists
- disallowed_claims:
  - no guaranteed revenue lift
  - no guaranteed production outcome
  - no fake compliance guarantees

constraints:
- no guarantee language
- no inflated transformation claims
- preserve audit-first wedge

expected_specialist:
- POSITIONING_POLICE

expected_reviewer:
- CLAIMS_EVIDENCE_REVIEWER

expected_artifact:
- POSITIONING_AND_CLAIMS__message_policy__POSITIONING_POLICE__RUN_NEW_ICP_POSITIONING_01__v1

exit_criteria:
- core positioning explicit
- claim boundary explicit
- banned wording explicit
- CTA locked
- reviewer verdict READY or READY_WITH_FIXES

stop_conditions:
- unsupported claims
- CTA drift
- reviewer FAIL
