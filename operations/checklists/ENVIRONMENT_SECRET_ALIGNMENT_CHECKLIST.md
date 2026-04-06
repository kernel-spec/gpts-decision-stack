# ENVIRONMENT SECRET ALIGNMENT CHECKLIST

**Version:** 1.0.0
**Scope:** GitHub Actions secrets, Cloudflare Worker secrets (`API_KEY_SECRET`), and evidence script environment alignment
**Authoritative gate:** `qa/final-gate-report.yaml`
**Reference:** `operations/checklists/CODER_OPERATIONAL_DEPLOYMENT_CHECKLIST_GPTS_DECISION_STACK.md` Sections 5.4 and 5.5

> This checklist must be completed before any deployment is considered Handoff-Complete.
> Do not record secret values in this document. Confirm presence only.

---

## 1. GitHub Actions Secret Presence

Verify the following secrets are set in the repository's GitHub Actions secrets (Settings → Secrets and variables → Actions):

| Secret name | Required for | Status | Notes |
|---|---|---|---|
| `CLOUDFLARE_ACCOUNT_ID` | All deploy workflows | *(PRESENT / MISSING / UNKNOWN)* | |
| `DEV_API_KEY` | Dev deployment, dev evidence scripts | *(PRESENT / MISSING / UNKNOWN)* | |
| `PROD_API_KEY` | Prod deployment, prod evidence scripts | *(PRESENT / MISSING / UNKNOWN)* | |

---

## 2. Worker `API_KEY_SECRET` Presence Per Environment

Verify `API_KEY_SECRET` is set on the deployed Worker for each environment via:

```bash
wrangler secret list --env dev
wrangler secret list --env prod
```

| Environment | `API_KEY_SECRET` present | Verified via | Notes |
|---|---|---|---|
| dev | *(YES / NO / UNKNOWN)* | `wrangler secret list --env dev` | |
| prod | *(YES / NO / UNKNOWN)* | `wrangler secret list --env prod` | |
| staging | *(YES / NO / N/A)* | `wrangler secret list --env staging` | |

---

## 3. Evidence Script Environment Alignment

Confirm that evidence scripts use the correct URL and API key for each environment. Keys and URLs are never committed — they are passed as environment variables at execution time.

| Script | Expected env vars | Dev aligned | Prod aligned |
|---|---|---|---|
| `scripts/evidence/run-dev-runtime-evidence.mjs` | `DEV_WORKER_URL`, `DEV_API_KEY` | *(YES / NO)* | N/A |
| `scripts/evidence/run-dev-acceptance-evidence.mjs` | `DEV_WORKER_URL`, `DEV_API_KEY` | *(YES / NO)* | N/A |
| Prod equivalent evidence script (if applicable) | `PROD_WORKER_URL`, `PROD_API_KEY` | N/A | *(YES / NO / N/A)* |

- [ ] No evidence script has been run with dev credentials against a prod endpoint or vice versa
- [ ] Evidence run timestamps in `operations/evidence/` post-date the most recent Worker deployment and secret rotation

---

## 4. Rotation Invalidation Rules

When `API_KEY_SECRET` is rotated on a Worker, the following artifacts are invalidated and must be re-produced before gates can be claimed as PASS:

- All runtime evidence artifacts in `operations/evidence/` that were produced using the old key
- All acceptance evidence artifacts produced using the old key
- Any gate claims (`qa/final-gate-report.yaml`, `operations/gates/promotion-gate.yaml`) that relied on that evidence

**Rotation procedure:**

1. Set the new secret: `wrangler secret put API_KEY_SECRET --env <env>`
2. Update the corresponding GitHub Actions secret (`DEV_API_KEY` or `PROD_API_KEY`) to match
3. Invalidate and re-run all evidence scripts for the affected environment
4. Update gate artifacts after fresh evidence confirms PASS

---

## 5. Drift Detection Conditions

Secret drift occurs when the value of `API_KEY_SECRET` on the deployed Worker differs from the value of the corresponding GitHub Actions secret. Drift is a deployment blocker.

| Drift condition | Indicator | Response |
|---|---|---|
| Evidence script returns `401` despite a prior PASS | GitHub Actions secret updated without re-running `wrangler secret put` | Re-set `API_KEY_SECRET` on Worker; re-run evidence |
| Deploy workflow fails authentication step | `CLOUDFLARE_ACCOUNT_ID` missing or wrong | Verify and re-set `CLOUDFLARE_ACCOUNT_ID` |
| Worker returns `401` for known-good key | Secret may have been overwritten or Worker re-deployed without secret | Re-run `wrangler secret put`; confirm with `wrangler secret list` |
| `DEV_API_KEY` ≠ `API_KEY_SECRET` on dev Worker | Keys set independently without synchronization | Align both values; re-run dev evidence |
| `PROD_API_KEY` ≠ `API_KEY_SECRET` on prod Worker | Keys set independently without synchronization | Align both values; re-run prod evidence |

---

## 6. Drift Response Procedure

If drift is detected:

1. **Do not claim any gate PASS** until drift is resolved.
2. Identify which environment is affected (dev, staging, or prod).
3. Re-set `API_KEY_SECRET` on the affected Worker: `wrangler secret put API_KEY_SECRET --env <env>`
4. Confirm the corresponding GitHub Actions secret (`DEV_API_KEY` or `PROD_API_KEY`) matches.
5. Re-run all evidence scripts for the affected environment from scratch.
6. Update evidence artifacts in `operations/evidence/` with the new run output.
7. Update `qa/final-gate-report.yaml` if gate status changed.
8. Record the drift event and resolution in the handoff package (Section 7 Known Gaps, if not fully resolved).

---

## 7. Completion Confirmation

- [ ] All GitHub Actions secrets in Section 1 are PRESENT
- [ ] `API_KEY_SECRET` is PRESENT on all required Worker environments (Section 2)
- [ ] Evidence scripts are aligned to the correct environment URLs and keys (Section 3)
- [ ] No rotation has occurred since the last evidence run without evidence being re-produced (Section 4)
- [ ] No drift conditions from Section 5 are currently active
- [ ] This checklist has been reviewed as part of handoff completion
