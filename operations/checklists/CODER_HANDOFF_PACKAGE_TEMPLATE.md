# CODER HANDOFF PACKAGE TEMPLATE

**Template version:** 1.0.0
**Source checklist:** `operations/checklists/CODER_OPERATIONAL_DEPLOYMENT_CHECKLIST_GPTS_DECISION_STACK.md`
**Authoritative gate:** `qa/final-gate-report.yaml`

> Fill in every field below before submitting as a handoff artifact.
> Do not include secret values. Mark fields as UNKNOWN if not yet resolved.
> Completed handoff packages must be committed to `operations/` or `release/` — not delivered out-of-band.

---

## 1. Deployment Identity

| Field | Value |
|---|---|
| Handoff timestamp | *(ISO 8601, e.g., 2026-04-06T00:00:00Z)* |
| Handoff owner (submitter) | *(name or role)* |
| Receiving owner | *(name or role)* |
| Repository | gpts-decision-stack |

---

## 2. Deployed Commit

| Environment | Commit SHA | Branch / Tag |
|---|---|---|
| dev | *(exact 40-char SHA)* | *(branch or tag name)* |
| prod | *(exact 40-char SHA)* | *(branch or tag name)* |
| staging | *(exact 40-char SHA or N/A)* | *(branch or tag name or N/A)* |

---

## 3. Environment Targets

List every environment that has been deployed as part of this handoff:

- [ ] **dev** — deployed and evidence-verified
- [ ] **staging** — deployed and evidence-verified (or N/A)
- [ ] **prod** — deployed and evidence-verified

---

## 4. Worker URLs

| Environment | Worker URL | Custom Domain (if any) |
|---|---|---|
| dev | *(e.g., https://gpts-decision-stack-dev.ACCOUNT.workers.dev)* | *(or N/A)* |
| prod | *(e.g., https://gpts-decision-stack.ACCOUNT.workers.dev)* | *(or N/A)* |
| staging | *(or N/A)* | *(or N/A)* |

---

## 5. Evidence References

List all evidence artifacts in `operations/evidence/` that cover this deployment:

| Evidence file | Environment | Coverage | Timestamp |
|---|---|---|---|
| `operations/evidence/audit-evidence-bundle-dev.yaml` | dev | health, create_session, artifact_submission, pipeline_progression | *(timestamp)* |
| `operations/evidence/audit-evidence-bundle-prod.yaml` | prod | D1 migrations, health, create_session, R2/KV presence | *(timestamp)* |
| `operations/evidence/acceptance-run-output-dev.yaml` | dev | AC-001 – AC-012 (12/12 PASS) | *(timestamp)* |
| *(add additional evidence files as needed)* | | | |

Authoritative gate report: `qa/final-gate-report.yaml` — `overall_status`: *(state value at time of handoff)*

---

## 6. Secret / Config Alignment Confirmation

> Do NOT include secret values. Confirm presence only.

| Check | Status | Notes |
|---|---|---|
| `API_KEY_SECRET` set on dev Worker via `wrangler secret put` | *(CONFIRMED / NOT YET / UNKNOWN)* | |
| `API_KEY_SECRET` set on prod Worker via `wrangler secret put` | *(CONFIRMED / NOT YET / UNKNOWN)* | |
| `CLOUDFLARE_ACCOUNT_ID` GitHub Actions secret set | *(CONFIRMED / NOT YET / UNKNOWN)* | |
| `DEV_API_KEY` GitHub Actions secret matches dev Worker `API_KEY_SECRET` | *(CONFIRMED / NOT YET / UNKNOWN)* | |
| `PROD_API_KEY` GitHub Actions secret matches prod Worker `API_KEY_SECRET` | *(CONFIRMED / NOT YET / UNKNOWN)* | |
| D1 binding IDs in `wrangler.toml` match provisioned resources | *(CONFIRMED / NOT YET / UNKNOWN)* | |
| R2 binding names in `wrangler.toml` match provisioned buckets | *(CONFIRMED / NOT YET / UNKNOWN)* | |
| KV namespace IDs in `wrangler.toml` match provisioned namespaces | *(CONFIRMED / NOT YET / UNKNOWN)* | |

See `operations/checklists/ENVIRONMENT_SECRET_ALIGNMENT_CHECKLIST.md` for full secret alignment verification procedure.

---

## 7. Known Gaps

List all functionality that is not yet production-ready, with rationale and accepted-or-blocking status:

| Gap ID | Description | Accepted (Y/N) | Rationale / Next step |
|---|---|---|---|
| *(e.g., GAP-001)* | *(description)* | *(Y / N)* | *(rationale)* |

If there are no known gaps: explicitly state **"No known gaps at time of handoff."**

---

## 8. Final Gate Reference

| Field | Value |
|---|---|
| Gate artifact | `qa/final-gate-report.yaml` |
| `overall_status` at handoff | *(PASS / FAIL)* |
| `bundle_classification` at handoff | *(DEPLOY-READY STACK / REPO-READY SKELETON)* |
| `deployment_readiness_status` at handoff | *(PASS / FAIL)* |
| Evidence backing the PASS | *(list key evidence files)* |

---

## 9. Handoff Confirmation

By completing this package, the handoff owner confirms:

- [ ] All fields above are filled with accurate, verifiable information
- [ ] No secret values are included in this document
- [ ] Evidence artifacts referenced above are present in the repository
- [ ] The receiving owner has access to the repository and all referenced artifacts
- [ ] This package has been committed to the repository (not delivered out-of-band)
