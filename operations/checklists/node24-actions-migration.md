# Node 24 Actions Migration Plan

## Purpose

Prepare GitHub Actions workflows for the runner transition from Node.js 20 to Node.js 24 and remove deprecation risk before enforcement deadlines.

## Scope

Workflows in this repository currently using JavaScript actions:

- `.github/workflows/dev-runtime-evidence.yaml`
- `.github/workflows/dev-acceptance-evidence.yaml`
- `.github/workflows/deploy-workers.yaml`
- `.github/workflows/deploy-worker.yml`

Affected actions:

- `actions/checkout@v4`
- `actions/setup-node@v4`
- `actions/upload-artifact@v4`
- `peter-evans/create-pull-request@v7`

## Deadlines

- Node 24 forced by default on runners: `2026-06-02`
- Node 20 removed from runners: `2026-09-16`

## Success Criteria

- No Node 20 deprecation warning in CI logs.
- `Dev Runtime Evidence` workflow stays green.
- `Dev Acceptance Evidence` workflow stays green.
- `deploy-workers` workflow stays green for dev and prod lanes.
- No regression in artifact upload/download behavior.

## Rollout Strategy

### Phase 1: Inventory and pinning

1. Record current workflow run IDs that are known-good baseline.
2. Pin each JavaScript action to an immutable commit SHA.
3. Keep existing major versions during pinning to isolate change risk.

### Phase 2: Node 24 canary

1. Add workflow-level env variable in all four workflow files:
   - `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24: "true"`
2. Run canary on:
   - `dev-runtime-evidence.yaml`
   - `dev-acceptance-evidence.yaml`
   - `deploy-workers.yaml` with dev path
3. Compare with baseline run duration and failure signatures.

### Phase 3: Version upgrade sweep

1. Upgrade actions to latest major versions that officially support Node 24.
2. Prefer one PR for evidence workflows and one PR for deploy workflows.
3. Re-run canary matrix and confirm no warning and no behavior drift.

### Phase 4: Enforcement and cleanup

1. Remove temporary compatibility notes from runbooks after stable period.
2. Keep SHA pinning policy in place for supply-chain integrity.
3. Add a periodic check to detect deprecated action runtimes.

## Verification Matrix

| Workflow | Trigger | Required Result |
|---|---|---|
| `dev-runtime-evidence.yaml` | workflow_dispatch | PASS |
| `dev-acceptance-evidence.yaml` | workflow_dispatch | PASS |
| `deploy-workers.yaml` (dev) | workflow_dispatch / push lane | PASS |
| `deploy-workers.yaml` (prod) | controlled release lane | PASS |
| `deploy-worker.yml` | existing trigger path | PASS |

## Rollback Plan

1. Revert workflow files to the last known-good commit.
2. Re-run `dev-runtime-evidence.yaml` and `dev-acceptance-evidence.yaml` to validate restoration.
3. Open incident note with failing action version and runner image details.

## Owner Map

- Platform Owner: workflow updates and action version governance.
- Release Coordinator: canary scheduling and go/no-go decision.
- Audit Owner: evidence retention and run log traceability.

## Tracking Checklist

| ID | Task | Owner | Status |
|---|---|---|---|
| N24-001 | Capture known-good baseline run IDs | Release Coordinator |  |
| N24-002 | Pin all JavaScript actions to SHA | Platform Owner |  |
| N24-003 | Add `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24` to all workflows | Platform Owner |  |
| N24-004 | Run evidence canary workflows on Node 24 | Platform Owner |  |
| N24-005 | Run deploy canary on Node 24 (dev path) | Platform Owner |  |
| N24-006 | Upgrade actions to latest Node 24-compatible majors | Platform Owner |  |
| N24-007 | Validate prod path in release window | Release Coordinator |  |
| N24-008 | Remove temporary migration notes and close checklist | Audit Owner |  |

## Evidence to Attach

- Workflow run URLs for baseline and canary.
- Logs proving warning removal.
- Diff of workflow changes.
- Final go/no-go record.
