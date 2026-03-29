# 06 — POST-BATCH DECISION

scenario: POST-BATCH DECISION
run_id: RUN_NEW_ICP_POSTBATCH_01
session_id: SESSION_NEW_ICP_SALES_01
artifact_id_prefix: REV_POSTBATCH

inputs:
- launched_batch_id: BATCH_NEW_ICP_01
- batch_size: 25
- asset_used: approved outbound email variant
- observed_signals:
  - reply_count: [TBD]
  - positive_reply_count: [TBD]
  - call_booked_count: [TBD]
  - bounce_count: [TBD]
  - objection_patterns: [TBD]

constraints:
- no vanity interpretation
- no invented performance signal
- decision must come from observed batch signals

expected_specialist:
- PERFORMANCE_MEMORY

expected_artifact:
- POST_BATCH_DECISION__performance_memory__PERFORMANCE_MEMORY__RUN_NEW_ICP_POSTBATCH_01__v1

exit_criteria:
- performance signals explicit
- repeated failures explicit
- one next bottleneck explicit
- one decision path chosen

stop_conditions:
- no usable batch evidence
- contradictory next steps
- no explicit bottleneck
