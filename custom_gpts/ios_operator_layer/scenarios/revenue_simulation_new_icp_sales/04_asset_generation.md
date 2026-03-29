# 04 — ASSET GENERATION

scenario: ASSET GENERATION
run_id: RUN_NEW_ICP_ASSET_01
session_id: SESSION_NEW_ICP_SALES_01
artifact_id_prefix: REV_ASSET

inputs:
- locked_offer: Governed GPT Workflow Audit
- locked_icp: Head of RevOps / Revenue Operations leader in B2B SaaS
- locked_positioning: audit-first, governed operating discipline
- locked_claim_boundary:
  - audit / map / recommend
  - no performance guarantee
  - no implementation guarantee
- locked_cta: Book a 20-min diagnostic call
- asset_type: cold outbound email
- desired_variants: 3

constraints:
- single CTA only
- no fake familiarity
- no fluff
- no unapproved claims

expected_specialist:
- ASSET_ENGINE

expected_reviewer:
- CLAIMS_EVIDENCE_REVIEWER

expected_artifact:
- ASSET_GENERATION__cold_email__ASSET_ENGINE__RUN_NEW_ICP_ASSET_01__v1

exit_criteria:
- 3 usable variants exist
- CTA preserved
- claim boundary preserved
- reviewer verdict READY or READY_WITH_FIXES

stop_conditions:
- multiple CTA drift
- claim inflation
- reviewer FAIL
