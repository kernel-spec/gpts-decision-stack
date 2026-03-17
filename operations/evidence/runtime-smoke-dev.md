# Runtime smoke evidence (dev)

Date: 2026-03-16
Environment: dev
Worker URL: https://gpts-decision-stack-dev.victorain92.workers.dev

## Scope
This record captures evidence-backed runtime smoke validation for the dev Cloudflare Worker.

## Proven checks
- GET /health responded with status ok
- createSession succeeded
- submitArtifact succeeded for canonical artifacts used in the runtime validation flow
- getSessionState returned live session state
- state transitions executed through the pipeline up to release_decision

## Health evidence
Observed:
- service: gpts-decision-stack-worker
- status: ok

Interpretation:
- Worker reachable
- Runtime responding
- Health endpoint valid

## Session creation evidence
Observed:
- session creation succeeded
- requestor_type: founder-led
- initial pipeline_state: intake
- initial decision_status: unresolved

Interpretation:
- session store works
- pipeline starts correctly in intake

## Runtime smoke verdict
runtime_smoke_status: PASS
environment: dev
evidence_basis: explicit_live_runtime_calls
limitations:
- this is dev evidence, not production evidence
- this does not override governance gate status
