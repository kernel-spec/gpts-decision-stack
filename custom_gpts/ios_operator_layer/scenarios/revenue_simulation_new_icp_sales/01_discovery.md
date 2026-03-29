# 01 — DISCOVERY

scenario: DISCOVERY
run_id: RUN_NEW_ICP_DISCOVERY_01
session_id: SESSION_NEW_ICP_SALES_01
artifact_id_prefix: REV_DISCOVERY

inputs:
- offer_name: Governed GPT Workflow Audit
- target_market: B2B SaaS
- target_buyer: Head of RevOps / Revenue Operations leader
- business_problem: GPT usage exists, but workflow truth, approvals, evidence, and production discipline are fragmented
- commercial_goal: identify the shortest credible wedge for first outreach
- primary_cta: Book a 20-min diagnostic call

constraints:
- no guarantee language
- no invented market proof
- keep the offer narrow
- do not broaden into full AI transformation

expected_specialist:
- MARKET_SCOUT_OUTBOUND

expected_artifact:
- DISCOVERY__market_scan__MARKET_SCOUT_OUTBOUND__RUN_NEW_ICP_DISCOVERY_01__v1

exit_criteria:
- one usable buyer problem is explicit
- one usable commercial wedge is explicit
- exclusions are explicit
- route stays audit-first

stop_conditions:
- generic AI consulting drift
- invented proof
- no clear wedge
