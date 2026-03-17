# Live response vs OpenAPI import contract

Date: 2026-03-16
Environment: dev
Schema file:
- actions/openapi.openai.yaml

## Goal
Record whether the live dev runtime responses used during Operator GPT testing matched the Builder-safe OpenAPI import contract closely enough for successful execution.

## Confirmed compatible operations
### GET /health
Status: PASS
Observed:
- ok: true
- data.status
- data.service
- data.timestamp

### POST /session
Status: PASS
Observed:
- ok: true
- data.session_id
- data.requestor_type
- data.pipeline_state
- data.decision_status
- data.veto_active

### POST /session/{session_id}/artifact
Status: PASS
Observed:
- artifact accepted
- artifact id returned
- session_id returned or inferable from runtime flow

### GET /session/{session_id}
Status: PASS
Observed:
- live pipeline_state
- decision_status
- veto_active

## Contract corrections made during validation
- OpenAPI version normalized to 3.1.0
- Builder-safe auth model applied
- submitArtifact request field aligned from artifact_payload to payload
- authenticated endpoint model stabilized for Builder use

## Verdict
live_vs_openapi_openai_status: PASS
environment: dev
limitations:
- contract alignment confirmed for tested endpoints only
- this is runtime compatibility evidence, not production certification
