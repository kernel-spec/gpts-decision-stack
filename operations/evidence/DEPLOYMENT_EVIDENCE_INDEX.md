# DEPLOYMENT EVIDENCE INDEX

**Version:** 1.0.0
**Repository:** gpts-decision-stack
**Authoritative gate:** `qa/final-gate-report.yaml`
**Purpose:** Factual index of deployment evidence artifacts. Not prose. Not gate authority. Cross-reference with `qa/final-gate-report.yaml` for authoritative gate status.

---

## Evidence Index

| Claim | Authoritative Source | Evidence Artifact | Environment | Timestamp | Verifier | Status |
|---|---|---|---|---|---|---|
| Dev Worker health endpoint returns HTTP 200 | `backend/worker/src/handlers/health.ts` | `operations/evidence/audit-evidence-bundle-dev.yaml` | dev | 2026-03-25 | CI evidence script | PASS |
| Dev Worker authenticated create_session returns HTTP 201 | `backend/worker/src/handlers/session.ts` | `operations/evidence/audit-evidence-bundle-dev.yaml` | dev | 2026-03-25 | CI evidence script | PASS |
| Dev Worker artifact submission advances pipeline state | `backend/worker/src/services/artifact.ts` | `operations/evidence/audit-evidence-bundle-dev.yaml` | dev | 2026-03-25 | CI evidence script | PASS |
| Dev pipeline progression to release_decision demonstrated | `backend/worker/src/services/state.ts` | `operations/evidence/audit-evidence-bundle-dev.yaml` | dev | 2026-03-25 | CI evidence script | PASS |
| Acceptance scenarios AC-001 through AC-012 pass on dev | `tests/acceptance/` | `operations/evidence/acceptance-run-output-dev.yaml` | dev | 2026-03-25 | CI workflow run 23537156141 | PASS (12/12) |
| Prod D1 migrations applied (gpts-decision-stack-db) | `backend/worker/migrations/` | `operations/evidence/audit-evidence-bundle-prod.yaml` | prod | 2026-03-25 | CI evidence script | PASS |
| Prod Worker health endpoint returns HTTP 200 | `backend/worker/src/handlers/health.ts` | `operations/evidence/audit-evidence-bundle-prod.yaml` | prod | 2026-03-25 | CI evidence script | PASS |
| Prod Worker authenticated create_session returns HTTP 201 | `backend/worker/src/handlers/session.ts` | `operations/evidence/audit-evidence-bundle-prod.yaml` | prod | 2026-03-25 | CI evidence script | PASS |
| Prod R2 bucket present (gpts-decision-stack-artifacts) | `backend/worker/wrangler.toml` | `operations/evidence/audit-evidence-bundle-prod.yaml` | prod | 2026-03-25 | CI evidence script | PASS |
| Prod KV namespace present (POLICY_STORE) | `backend/worker/wrangler.toml` | `operations/evidence/audit-evidence-bundle-prod.yaml` | prod | 2026-03-25 | CI evidence script | PASS |
| Final QA gate overall_status PASS | `qa/final-gate-report.yaml` | `qa/final-gate-report.yaml` | all | 2026-03-25 | Authoritative gate record | PASS |
| Repo integrity PASS (all layers present) | `repo.manifest.yaml` | `qa/final-gate-report.yaml` | all | 2026-03-25 | Gate report | PASS |
| Bundle classification DEPLOY-READY STACK | `qa/final-gate-report.yaml` | `qa/final-gate-report.yaml` | all | 2026-03-25 | Authoritative gate record | PASS |
| OpenAI GPT actions import confirmed | `actions/openapi.openai.yaml` | `operations/evidence/live-response-vs-openapi-openai.md` | prod | *(see file)* | *(see file)* | *(see file)* |
| Post-merge verification completed | `operations/evidence/post-merge-verification.md` | `operations/evidence/post-merge-verification.md` | all | *(see file)* | *(see file)* | *(see file)* |
| Pipeline progression (dev) documented | `operations/evidence/pipeline-progression-dev.md` | `operations/evidence/pipeline-progression-dev.md` | dev | *(see file)* | *(see file)* | *(see file)* |

---

## Notes

- This index is a factual summary. The authoritative gate status for all claims is in `qa/final-gate-report.yaml`.
- Timestamps marked as `*(see file)*` require inspection of the referenced evidence artifact for exact values.
- New evidence artifacts should be added as a new row when produced.
- Do not update Status in this index without updating the corresponding evidence artifact.
- Evidence produced before a secret rotation or Worker redeployment must be re-run; the corresponding row status must be updated to STALE until fresh evidence is produced.
