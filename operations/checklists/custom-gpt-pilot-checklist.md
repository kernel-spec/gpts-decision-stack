# Custom GPT Pilot Checklist — Web → iOS

## Purpose

Track readiness and validation steps for the first Custom GPT pilot deployment.
Covers initial web deployment in ChatGPT Builder followed by iOS (ChatGPT app) validation.

## Status values

Use only:

- `PASS`
- `FAIL`
- `BLOCKED`
- `N/A`

`BLOCKED` means the checklist cannot be fairly evaluated because required inputs are missing.

## Entry criteria

| Criterion | Required |
|---|---|
| `qa/final-gate-report.yaml` overall_status = PASS | yes |
| prod backend health endpoint = HTTP 200 | yes |
| `actions/openapi.yaml` finalised | yes |
| API_KEY_SECRET provisioned in prod worker | yes |

---

## Phase 1 — ChatGPT Builder setup (web)

| Check ID | Check | Owner | Status |
|---|---|---|---|
| P1-001 | GPT name and description entered in Builder (no prod URL in description) | GPT Operator |  |
| P1-002 | Instructions pasted from canonical prompt source — no ad-hoc edits | GPT Operator |  |
| P1-003 | Action schema imported from `actions/openapi.yaml` | GPT Operator |  |
| P1-004 | Authentication configured (type matches `actions/auth.md`) | GPT Operator |  |
| P1-005 | Knowledge files attached per canonical list (no raw secrets, no internal tokens) | GPT Operator |  |
| P1-006 | Web browsing OFF (unless explicitly required by design) | GPT Operator |  |
| P1-007 | Code interpreter OFF | GPT Operator |  |
| P1-008 | Image generation OFF | GPT Operator |  |
| P1-009 | GPT saved as draft in ChatGPT Builder before any sharing | GPT Operator |  |

---

## Phase 2 — Web pilot validation

| Check ID | Check | Owner | Status |
|---|---|---|---|
| P2-001 | Action health call returns HTTP 200 from within Builder preview | GPT Operator |  |
| P2-002 | `create_session` returns HTTP 201 and `pipeline_state = intake` | GPT Operator |  |
| P2-003 | Artifact submission accepted and state advances from `intake` to `problem_framing` | GPT Operator |  |
| P2-004 | Full governed pipeline progression confirmed through at least `intake → problem_framing → primitive_selection` | GPT Operator |  |
| P2-005 | Invalid artifact submission returns HTTP 400/422 and state does not advance | QA Owner |  |
| P2-006 | No sensitive data (keys, tokens, internal URLs) visible in GPT responses | GPT Operator |  |
| P2-007 | Conversation context does not leak cross-session data | QA Owner |  |

---

## Phase 3 — iOS expansion

| Check ID | Check | Owner | Status |
|---|---|---|---|
| P3-001 | GPT published (at minimum to "Only me") before iOS test | GPT Operator |  |
| P3-002 | GPT accessible in ChatGPT iOS app under same account | GPT Operator |  |
| P3-003 | Action calls succeed from iOS (no CORS or auth regression) | GPT Operator |  |
| P3-004 | Pipeline progression confirmed on iOS identical to web result | QA Owner |  |
| P3-005 | No UI/formatting issues that break governed output structure | QA Owner |  |

---

## Exit criteria

| Criterion | Required |
|---|---|
| All Phase 1 checks = PASS | yes |
| All Phase 2 checks = PASS or N/A | yes |
| All Phase 3 checks = PASS or N/A | yes |
| No FAIL remaining | yes |

## Notes

- Production backend URL and authentication details are tracked in `operations/evidence/` and `release/deployment_target.yaml` — not in this checklist.
- Do not commit API keys, bearer tokens, or example credentials anywhere in the repository.
- If any check is BLOCKED, record the blocking reason and do not mark as PASS.
