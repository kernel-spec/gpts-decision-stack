# 05 — LAUNCH SAFETY

scenario: LAUNCH SAFETY
run_id: RUN_NEW_ICP_LAUNCH_01
session_id: SESSION_NEW_ICP_SALES_01
artifact_id_prefix: REV_LAUNCH

inputs:
- locked_asset: approved outbound email
- locked_icp: Head of RevOps / Revenue Operations leader in B2B SaaS
- batch_size: 25
- sending_surface: founder-led manual / low-volume outbound
- release_scope:
  - single batch
  - single asset type
  - single CTA

constraints:
- do not skip release gate
- do not expand batch size
- no extra claims

expected_specialist:
- DELIVERABILITY_GUARD

expected_reviewer:
- RELEASE_GATE_REVIEWER

expected_artifact:
- LAUNCH_SAFETY__batch_release_check__DELIVERABILITY_GUARD__RUN_NEW_ICP_LAUNCH_01__v1

exit_criteria:
- risks explicit
- blockers explicit
- reviewer verdict READY or READY_WITH_FIXES
- operator knows if launch may proceed now

stop_conditions:
- release gate missing
- reviewer FAIL
- unresolved hard blocker
