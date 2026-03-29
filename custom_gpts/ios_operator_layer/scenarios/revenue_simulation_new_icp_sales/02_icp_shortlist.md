# 02 — ICP → SHORTLIST

scenario: ICP → SHORTLIST
run_id: RUN_NEW_ICP_SHORTLIST_01
session_id: SESSION_NEW_ICP_SALES_01
artifact_id_prefix: REV_SHORTLIST

inputs:
- locked_offer: Governed GPT Workflow Audit
- locked_market: B2B SaaS
- target_buyer_title_primary: Head of RevOps
- target_buyer_title_secondary: Revenue Operations leader
- desired_output_count: 25
- inclusion_signals:
  - ops-heavy workflow ownership
  - revenue systems/process responsibility
  - tooling sprawl
- exclusion_signals:
  - agencies
  - solo founders without ops complexity
  - non-B2B SaaS

constraints:
- no speculative personalization
- no hidden narrowing
- explicit inclusion/exclusion logic required

expected_specialist:
- LIST_BUILDER

expected_artifact:
- ICP_SHORTLIST__candidate_list__LIST_BUILDER__RUN_NEW_ICP_SHORTLIST_01__v1

exit_criteria:
- shortlist exists
- inclusion logic explicit
- exclusion logic explicit
- list usable for outbound

stop_conditions:
- vague criteria
- title mixing drift
- hidden narrowing
