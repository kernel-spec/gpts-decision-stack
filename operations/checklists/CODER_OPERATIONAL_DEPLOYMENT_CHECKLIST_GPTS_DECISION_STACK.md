# CODER OPERATIONAL DEPLOYMENT CHECKLIST — GPTS-DECISION-STACK

**Version:** 1.1.0
**Produced from:** Repository reality as of `qa/final-gate-report.yaml` (report_updated: 2026-03-25)
**Classification:** Operational execution document — not a design specification
**Canonical status authority:** `qa/final-gate-report.yaml`
**Canonical checklist path:** `operations/checklists/CODER_OPERATIONAL_DEPLOYMENT_CHECKLIST_GPTS_DECISION_STACK.md`

---

## Assumptions

> The following items are stated assumptions that require explicit repository verification before use. Do not treat README status lines (`repo_integrity_status: PASS`) as sufficient proof of any deployment condition. Each assumption below must be verified by physical inspection or live evidence before the relevant checklist section is considered complete.

- **A-01** `operations/specs/ios-operator-layer-deployment.md` is the canonical deployment spec for the iOS operator layer. Its contents must be read before executing Section 8.
- **A-02** All migrations in `backend/worker/migrations/` are meant to be applied in filename-alphabetical order. Note: files `0007_handoff_events.sql` and `0007_stage_tracking.sql` share the `0007_` prefix — Wrangler applies them alphabetically (`handoff_events` before `stage_tracking`). Both use `IF NOT EXISTS`; this is a naming debt, not a runtime blocker.
- **A-03** The `promotion-gate.yaml` `current_gate_position` section reflects a snapshot in time. The `qa/final-gate-report.yaml` is the authoritative gate record; consult it, not `promotion-gate.yaml` snapshot fields, for current truth.
- **A-04** Evidence scripts under `scripts/evidence/` require `DEV_WORKER_URL` and `DEV_API_KEY` (or prod equivalents) as environment variables. These values are never committed to the repository.
- **A-05** `actions/openapi.openai.yaml` exists alongside `actions/openapi.yaml` — the primary action contract surface is `actions/openapi.yaml`; the `.openai.yaml` variant is for OpenAI action import only. Verify both are consistent before GPT deployment.
- **A-06** The commercial layer at `custom_gpts/commercial_layer/` is a secondary package. This checklist focuses on `custom_gpts/ios_operator_layer/` as the primary operator deployment target.
- **A-07** Assumption requiring repository verification: whether staging environment Cloudflare resources (D1, R2, KV) are provisioned independently of dev and prod.

---

## 1. Purpose

This document is an **execution checklist** for a Coder tasked with implementing and deploying the `gpts-decision-stack` project to production-readiness. It is not a design specification, an architecture document, or a strategic overview.

Every item in this checklist has a concrete, verifiable action. The Coder must be able to check each item by examining a file, running a command, or producing an evidence artifact. Items that cannot be verified by direct evidence must be explicitly flagged as open.

This checklist covers:
- what must exist before implementation begins
- what must be verified in repository structure
- what must be configured in Cloudflare and GitHub
- what must be tested before promotion
- what evidence must be produced
- what gate conditions must be satisfied before handoff

Do not mark this checklist complete by asserting status from README lines alone. Every pass must be backed by a file, a command output, or an evidence artifact.

---

## 2. System Boundary and Source-of-Truth Rules

These rules are invariant. No tool, platform, or operator decision overrides them.

### 2.1 Canonical Authoring Location
- [ ] The **repository** is the canonical authoring location for all source, configuration, schemas, knowledge, prompts, and governance artifacts.
- [ ] Builder (OpenAI GPT Builder UI) is **not** the canonical authoring location. Changes made in Builder must be reflected back into the repository before they are considered authoritative.

### 2.2 Runtime Truth
- [ ] `backend/worker/` is the **runtime source of truth**. The Worker implementation defines what the system actually does at runtime.
- [ ] Custom GPT layers (`custom_gpts/ios_operator_layer/`, `custom_gpts/commercial_layer/`) are **thin orchestration shells** above the Worker. They do not contain business logic. They do not replace Worker truth.

### 2.3 Action Contract Surface
- [ ] `actions/openapi.yaml` is the **GPT action contract surface**. It defines the routes, methods, and auth patterns exposed to Custom GPT actions.
- [ ] `actions/openapi.openai.yaml` is the OpenAI-import variant. It must remain consistent with `actions/openapi.yaml`. Discrepancies between the two are a deployment blocker.
- [ ] The runtime router (`backend/worker/src/router.ts`) may contain routes not present in `actions/openapi.yaml` (e.g., internal, health, or admin routes). This is expected and not a gap.

### 2.4 Authoritative Gate Status
- [ ] `qa/final-gate-report.yaml` is the **authoritative gate status record**. Do not use README status lines, `promotion-gate.yaml` snapshot fields, or informal notes as gate authority.
- [ ] `operations/gates/promotion-gate.yaml` defines promotion rules but its `current_gate_position` snapshot is a point-in-time record. Always cross-reference with `qa/final-gate-report.yaml`.

### 2.5 External Platform Configuration
- [ ] Cloudflare dashboard configuration must **reflect** repository truth (bindings declared in `backend/worker/wrangler.toml`), not redefine it.
- [ ] GitHub Actions secrets must align with Worker secrets set via `wrangler secret put`. Drift between the two is a deployment blocker.
- [ ] External tooling (OpenAI Builder UI, Cloudflare dashboard) is a delivery surface only. It is never promoted above repository truth.

### 2.6 What Must Never Be Treated as Authoritative
- [ ] README status lines alone are NOT authoritative gate proof.
- [ ] OpenAI Builder configuration is NOT authoritative.
- [ ] Cloudflare dashboard resource names are NOT authoritative (repository binding declarations are).
- [ ] Local `.env` files or runtime assumptions not captured in evidence are NOT authoritative.
- [ ] Oral or chat-based "done" declarations are NOT authoritative. Done = evidence artifact present.

---

## 3. Required Repo Structure Checks

Verify physical existence of every item below. Existence alone is necessary but not sufficient — also confirm files contain non-stub content (non-empty, structurally valid).

### 3.1 Backend Worker
- [ ] `backend/worker/` exists and is a non-empty directory
- [ ] `backend/worker/src/handlers/` exists and contains handler files (health.ts, session.ts, artifact.ts, decisionlog.ts, veto.ts, approval.ts)
- [ ] `backend/worker/src/services/` exists and contains service files (state.ts, artifact.ts, decisionlog.ts, veto.ts, approval.ts, policy.ts, and delivery/integrity services)
- [ ] `backend/worker/src/index.ts` exists (Worker entry point)
- [ ] `backend/worker/src/router.ts` exists (route dispatch)
- [ ] `backend/worker/src/types/index.ts` exists (canonical type definitions)
- [ ] `backend/worker/migrations/` exists and contains all migration files in order:
  - [ ] `0001_init.sql`
  - [ ] `0002_add_requestor_columns.sql`
  - [ ] `0003_add_founder_write_loop.sql`
  - [ ] `0004_delivery_integrity.sql`
  - [ ] `0006_artifact_lineage.sql`
  - [ ] `0007_handoff_events.sql`
  - [ ] `0007_stage_tracking.sql` *(Note: shares prefix with above — applied alphabetically by Wrangler)*
  - [ ] `0008_stage_entries.sql`
  - [ ] `0009_lifecycle_id.sql`
- [ ] `backend/worker/wrangler.toml` exists and defines dev and prod environments, D1/R2/KV bindings, and worker name
- [ ] `backend/worker/package.json` exists with build and test scripts
- [ ] `backend/worker/tsconfig.json` exists

### 3.2 API and Auth Contract
- [ ] `actions/openapi.yaml` exists and is structurally valid YAML/OpenAPI
- [ ] `actions/openapi.openai.yaml` exists and is consistent with `actions/openapi.yaml`
- [ ] `actions/auth.md` exists and describes the authentication model

### 3.3 Knowledge and Rules
- [ ] `knowledge/core/` exists with all 7 core files:
  - [ ] `00_ControlPlane_Charter.md`
  - [ ] `01_CanonicalStates.yaml`
  - [ ] `02_TransitionRules.yaml`
  - [ ] `03_ArtifactSchemas.yaml`
  - [ ] `04_AuthorityMatrix.yaml`
  - [ ] `05_FailureSemantics.yaml`
  - [ ] `06_DecisionLogSchema.yaml`
  - [ ] `07_DeliveryIntegrityEnums.yaml`
- [ ] `knowledge/domains/default/` exists with all 9 domain files:
  - [ ] `10_DomainOntology.md`
  - [ ] `11_FramingRules.yaml`
  - [ ] `12_PrimitiveCatalog.yaml`
  - [ ] `13_DeliveryTopologyRules.yaml`
  - [ ] `14_RiskComplianceTriggers.yaml`
  - [ ] `15_CommercialPackagingRules.yaml`
  - [ ] `16_ClaimsEvidencePolicy.yaml`
  - [ ] `17_ReviewLaneRules.yaml`
  - [ ] `18_ApprovalEscalationMatrix.yaml`

### 3.4 Tests and Fixtures
- [ ] `tests/acceptance/` exists with AC-001 through AC-012 plus AC-DI pack:
  - [ ] `AC-001-nonlinear-model.yaml`
  - [ ] `AC-002-allowed-outcomes.yaml`
  - [ ] `AC-003-invalidation.yaml`
  - [ ] `AC-004-veto.yaml`
  - [ ] `AC-005-reentry.yaml`
  - [ ] `AC-006-unresolved.yaml`
  - [ ] `AC-007-packaging-gate.yaml`
  - [ ] `AC-008-claims-gate.yaml`
  - [ ] `AC-009-enterprise-topology.yaml`
  - [ ] `AC-010-regulated-escalation.yaml`
  - [ ] `AC-011-enablement-bypass.yaml`
  - [ ] `AC-012-unknown-discipline.yaml`
  - [ ] `AC-DI-pack.yaml` *(Delivery Integrity pack)*
- [ ] `tests/fixtures/` exists with all fixture files:
  - [ ] `founder-led/framing-invalid.yaml`
  - [ ] `founder-led/claims-fail.yaml`
  - [ ] `founder-led/wrong-primitive.yaml`
  - [ ] `founder-led/missing-claims-evidence.yaml`
  - [ ] `founder-led/unsupported-claims.yaml`
  - [ ] `founder-led/partial-intake.yaml`
  - [ ] `enterprise/active-risk-veto.yaml`
  - [ ] `enterprise/procurement-legal-required.yaml`
  - [ ] `regulated/mandatory-approval-matrix.yaml`
  - [ ] `enablement/non-sales-internal.yaml`

### 3.5 Schemas
- [ ] `schemas/artifacts/` exists with all 10 artifact schemas:
  - [ ] `ProblemBrief.schema.yaml`
  - [ ] `FramingAssessment.schema.yaml`
  - [ ] `OfferDecision.schema.yaml`
  - [ ] `ArchitectureSpec.schema.yaml`
  - [ ] `ClaimsDecision.schema.yaml`
  - [ ] `RiskDecision.schema.yaml`
  - [ ] `CommercialSpec.schema.yaml`
  - [ ] `ReviewTopologyPlan.schema.yaml`
  - [ ] `StateDecisionPacket.schema.yaml`
  - [ ] `ReleaseDecision.schema.yaml`

### 3.6 Operations and Governance
- [ ] `operations/evidence/` exists and is non-empty (contains evidence bundles)
- [ ] `operations/gates/promotion-gate.yaml` exists
- [ ] `operations/checklists/local-checklist.md` exists
- [ ] `operations/checklists/dev-checklist.md` exists
- [ ] `operations/checklists/staging-checklist.md` exists
- [ ] `operations/checklists/prod-checklist.md` exists
- [ ] `operations/backend_binding.yaml` exists
- [ ] `operations/endpoint_owner_mapping.yaml` exists
- [ ] `operations/operational_ownership_map.yaml` exists
- [ ] `operations/operational_approval_map.yaml` exists
- [ ] `operations/operational_veto_mapping.yaml` exists
- [ ] `operations/specs/ios-operator-layer-deployment.md` exists
- [ ] `qa/final-gate-report.yaml` exists and `overall_status` is explicitly stated

### 3.7 Custom GPT Layer
- [ ] `custom_gpts/ios_operator_layer/` exists and is non-empty
- [ ] `custom_gpts/ios_operator_layer/builder/` exists with builder files
- [ ] `custom_gpts/ios_operator_layer/operator/` exists with operator SOP/macro files

### 3.8 Root Control Files
- [ ] `MASTER_SPEC.md` exists at repo root
- [ ] `repo.manifest.yaml` exists at repo root
- [ ] `release/deployment_target.yaml` exists
- [ ] `release/authoritative_release_notes.md` exists

---

## 4. Required Implementation Checks

Verify that the Worker implementation is not merely scaffolded but is actually functional. These checks require running the build and tests — not just checking file existence.

### 4.1 Build Verification
- [ ] Run `cd backend/worker && npm ci` — succeeds without error
- [ ] Run `cd backend/worker && npm run build` — TypeScript compilation completes
  - Note: A pre-existing `TS2688` error for `@cloudflare/workers-types` may appear; this does not block test execution
- [ ] Run `cd backend/worker && npm run typecheck` — no blocking type errors beyond the known pre-existing one

### 4.2 Test Verification
- [ ] Run `cd backend/worker && npm test` — all tests pass
  - Current baseline: 248 tests across 27 files (as of 2026-04-04)
  - Tests include: lifecycle-transaction.test.ts (23 tests), desync-detection.test.ts (10 tests), production-verification.test.ts (flows A–F + adversarial tests 1–5)

### 4.3 Handler Completeness
Confirm each of the following routes has a concrete handler implementation (not a stub returning 200 with no logic):
- [ ] `GET /health` — health handler
- [ ] `POST /sessions` — session creation using `createSessionWithLifecycle` (atomic batch: INSERT sessions + INSERT stage_entries)
- [ ] `GET /sessions/:id` — session state retrieval
- [ ] `POST /sessions/:id/artifacts` — artifact submission using `submitArtifactWithLifecycle`
- [ ] `GET /sessions/:id/artifacts` — artifact listing
- [ ] `GET /sessions/:id/decision-log` — decision log retrieval
- [ ] `POST /sessions/:id/veto` — veto creation
- [ ] `DELETE /sessions/:id/veto` — veto release
- [ ] `POST /sessions/:id/approvals` — approval creation
- [ ] `POST /sessions/:id/reentry` — reentry using `triggerReentryWithLifecycle`
- [ ] `GET /sessions/:id/run-summary` — operator run delivery summary

### 4.4 Service Logic Completeness
- [ ] `state.ts` implements `createSessionWithLifecycle` as a D1 batch (INSERT sessions + INSERT stage_entries in single atomic call)
- [ ] `state.ts` implements `triggerReentryWithLifecycle` as a D1 batch (UPDATE sessions + INSERT stage_entries + INSERT stage_loop_signals)
- [ ] `state.ts` implements `assertLegalReentry` which checks `veto_active` before validating transition direction — rejects with `ILLEGAL_REENTRY_TRANSITION` if veto is active
- [ ] `artifact.ts` implements `submitArtifactWithLifecycle` which delegates to `executeArtifactLifecycleTransaction`
- [ ] `lifecycle-transaction.ts` implements `executeArtifactLifecycleTransaction` as a single D1 batch covering all 6 truth writes: lineage, delivery_integrity_events, handoff_events, UPDATE sessions, stage_entries, loop_signals
- [ ] `operator-delivery.ts` implements `getRunDeliverySummary` reading handoff_status exclusively from `handoff_events` (no delivery_integrity_events fallback)
- [ ] `veto.ts` enforces active veto as absolute release blocker
- [ ] `policy.ts` enforces fail-closed decision logic

### 4.5 Migration Completeness
- [ ] All migrations in `backend/worker/migrations/` exist and are non-empty
- [ ] Migration `0007_stage_tracking.sql` renames `classified_at` to `created_at` on `stage_loop_signals` and `stage_entries` — confirm no code references `classified_at` for these tables
- [ ] No production route is claimed as implemented while its handler returns a stub response

### 4.6 Schema and Acceptance Alignment
- [ ] Each artifact type in `schemas/artifacts/` has a corresponding acceptance scenario that exercises it
- [ ] No acceptance scenario references an artifact type that does not have a schema file

---

## 5. Cloudflare Environment and Secret Checks

These checks require Cloudflare account access and Wrangler CLI. Complete them before any deployment attempt.

### 5.1 Account Access
- [ ] Cloudflare account access is confirmed for the deploying identity
- [ ] `CLOUDFLARE_ACCOUNT_ID` is available as a GitHub Actions secret
- [ ] Wrangler is authenticated: `wrangler whoami` returns the correct account

### 5.2 Dev Environment Bindings (verify against `wrangler.toml` `[env.dev]`)
- [ ] D1 database `gpts-decision-stack-db-dev` (ID: `597ae973-2869-4ebb-89bd-1ebc62ac6674`) exists in Cloudflare
- [ ] D1 binding name is `DECISIONS_DB` as declared in `wrangler.toml`
- [ ] R2 bucket `gpts-decision-stack-artifacts-dev` exists and is reachable
- [ ] R2 binding name is `ARTIFACTS_BUCKET` as declared in `wrangler.toml`
- [ ] KV namespace `POLICY_STORE` (dev ID: `02dbad5ba7dd496f8f44865fba72ebed`) exists
- [ ] KV binding name is `POLICY_STORE` as declared in `wrangler.toml`
- [ ] `API_KEY_SECRET` is set as a Worker secret on the dev Worker via `wrangler secret put API_KEY_SECRET --env dev`
  - **Never commit the secret value to the repository**

### 5.3 Prod Environment Bindings (verify against `wrangler.toml` `[env.prod]`)
- [ ] D1 database `gpts-decision-stack-db` (ID: `d10b83ff-29a0-4ddd-99ac-c8fecf0a8ef3`) exists in Cloudflare
- [ ] D1 binding name is `DECISIONS_DB` as declared in `wrangler.toml`
- [ ] R2 bucket `gpts-decision-stack-artifacts` exists and is reachable
- [ ] R2 binding name is `ARTIFACTS_BUCKET` as declared in `wrangler.toml`
- [ ] KV namespace `POLICY_STORE` (prod ID: `b406728e872e41c8ac865946295ad4fc`) exists
- [ ] KV binding name is `POLICY_STORE` as declared in `wrangler.toml`
- [ ] `API_KEY_SECRET` is set as a Worker secret on the prod Worker via `wrangler secret put API_KEY_SECRET --env prod`
  - **Never commit the secret value to the repository**

### 5.4 GitHub Actions Secrets Alignment
- [ ] `CLOUDFLARE_ACCOUNT_ID` GitHub Actions secret is set
- [ ] `DEV_API_KEY` GitHub Actions secret matches the `API_KEY_SECRET` set on the dev Worker
- [ ] `PROD_API_KEY` GitHub Actions secret matches the `API_KEY_SECRET` set on the prod Worker
- [ ] No secret value is present in any committed file, environment variable log, or CI output

### 5.5 Anti-Drift Check (Critical)
- [ ] The API key used in dev evidence scripts equals the `API_KEY_SECRET` deployed into the dev Worker — confirm these are the same value, not different test keys
- [ ] The API key used in prod evidence scripts equals the `API_KEY_SECRET` deployed into the prod Worker
- [ ] No evidence run has been executed against a Worker using a different key than the one currently deployed
- [ ] If a Worker secret is rotated, all evidence artifacts produced before rotation are invalidated and must be re-executed

### 5.6 Deploy Workflow Verification
- [ ] `.github/workflows/deploy-workers.yaml` exists and is the canonical multi-environment deploy workflow
- [ ] `.github/workflows/deploy-worker.yml` exists (dev-only variant, if applicable)
- [ ] `.github/workflows/ci-guard.yml` runs on push to main and validates: workflow YAML, migration placement, presence of `backend/worker/package-lock.json`
- [ ] No manual Cloudflare dashboard configuration has overridden the binding declarations in `wrangler.toml`

---

## 6. Deployment Verification Checks

> **IMPORTANT: OpenAPI action surface and runtime router surface are SEPARATE concerns.**
>
> - **OpenAPI action surface** (`actions/openapi.yaml`): defines the routes exposed to Custom GPT actions. Not every Worker route needs to be exposed here.
> - **Runtime router surface** (`backend/worker/src/router.ts`): defines all routes the Worker handles. This may include routes that are NOT in the OpenAPI action surface (e.g., health, internal, admin).
>
> A route being absent from `actions/openapi.yaml` while present in `router.ts` is NOT a gap — it is intentional scoping.

### 6.1 OpenAPI Action Surface Checks
*Source: `actions/openapi.yaml`*

These checks confirm that the Custom GPT action surface is correctly defined and consistent.

- [ ] `actions/openapi.yaml` is structurally valid OpenAPI YAML
- [ ] Every path declared in `actions/openapi.yaml` has a corresponding implemented handler in `backend/worker/src/handlers/`
- [ ] HTTP methods declared in `actions/openapi.yaml` match the methods implemented in the router for those paths
- [ ] Request and response body shapes in `actions/openapi.yaml` match the TypeScript types in `backend/worker/src/types/index.ts`
- [ ] `actions/openapi.openai.yaml` (builder-safe projection) is consistent with `actions/openapi.yaml` — no path, method, or schema divergence that would break GPT action calls
  - Note: `actions/openapi.openai.yaml` is for OpenAI action import only; minor structural differences from the primary file are acceptable if they do not affect action surface semantics.
- [ ] Auth scheme declared in `actions/openapi.yaml` matches the `X-API-Key` pattern documented in `actions/auth.md`

### 6.2 Runtime Router Surface Checks
*Source: `backend/worker/src/router.ts`*

These checks confirm that the Worker's full route dispatch is complete and correct. These are independent of the OpenAPI action surface.

- [ ] All routes listed in Section 4.3 are present in `backend/worker/src/router.ts` with concrete dispatch to handler functions
- [ ] `GET /health` is handled as a public route (no auth middleware applied)
- [ ] All non-health routes have auth middleware applied — unauthenticated requests return `401`
- [ ] No route in `router.ts` dispatches to a stub or placeholder handler
- [ ] Evidence scripts in `scripts/evidence/` target routes that exist in `router.ts` with the correct HTTP method and path

### 6.3 Auth Model Consistency
- [ ] `actions/auth.md` describes the `X-API-Key` authentication pattern actually implemented in the Worker
- [ ] `GET /health` is a public endpoint (no auth required) — confirm this matches both `actions/openapi.yaml` and `router.ts`
- [ ] All non-health endpoints require `X-API-Key` auth header — confirm this matches `actions/auth.md` and `router.ts`
- [ ] Unauthenticated requests to protected endpoints return `401` — not `200` or `500`
- [ ] Evidence scripts in `scripts/evidence/` use the same auth header name and format as the Worker expects

### 6.4 Evidence Script to Worker Alignment
- [ ] Runtime evidence scripts pass the correct auth header to the correct endpoint
- [ ] There is no mismatch where an evidence script bypasses auth (e.g., directly querying D1 instead of calling the Worker API)
- [ ] If auth has changed (key rotation, header name change), evidence must be re-run after the change

---

## 7. Data/Storage Checks

These checks confirm that D1 migrations, R2, and KV are correctly provisioned and applied before any runtime evidence run.

### 7.1 D1 Migration Application
- [ ] All migrations are applied to the dev D1 database in filename-alphabetical order:
  - `0001_init.sql` → `0002_...` → `0003_...` → `0004_...` → `0006_...` → `0007_handoff_events.sql` → `0007_stage_tracking.sql` → `0008_...` → `0009_...`
- [ ] All migrations are applied to the prod D1 database in the same order
- [ ] Migration application is verified by querying the D1 database for table existence (not just assuming wrangler ran successfully)
- [ ] `stage_loop_signals` table uses `created_at` column (not `classified_at`) — confirmed by `0007_stage_tracking.sql` rename
- [ ] `stage_entries` table uses `created_at` column (not `classified_at`)
- [ ] No migration file has been edited after initial application without a new migration file being created

### 7.2 D1 Table Verification
Confirm the following tables exist in the deployed database:
- [ ] `sessions`
- [ ] `stage_entries`
- [ ] `artifacts`
- [ ] `artifact_lineage`
- [ ] `decision_log`
- [ ] `veto_events`
- [ ] `approval_events`
- [ ] `delivery_integrity_events`
- [ ] `handoff_events`
- [ ] `stage_loop_signals`

### 7.3 R2 Bucket
- [ ] Dev R2 bucket `gpts-decision-stack-artifacts-dev` is bound and reachable via the dev Worker
- [ ] Prod R2 bucket `gpts-decision-stack-artifacts` is bound and reachable via the prod Worker
- [ ] No dev Worker is pointed at a prod bucket; no prod Worker is pointed at a dev bucket

### 7.4 KV Namespace
- [ ] Dev KV namespace `POLICY_STORE` (ID: `02dbad5ba7dd496f8f44865fba72ebed`) is bound and reachable via the dev Worker
- [ ] Prod KV namespace `POLICY_STORE` (ID: `b406728e872e41c8ac865946295ad4fc`) is bound and reachable via the prod Worker
- [ ] Storage binding IDs in `wrangler.toml` match the resource IDs in the Cloudflare dashboard — no drift

### 7.5 Environment Isolation
- [ ] Dev and prod environments each have their own D1 database ID (confirmed in `wrangler.toml`)
- [ ] No environment variable or secret causes a dev Worker to write to prod storage or vice versa
- [ ] Storage bindings are documented in `wrangler.toml` for both environments — no undocumented overrides

---

## 8. Prompt/Custom GPT Deployment Checks

These checks cover the iOS operator layer deployment. Read `operations/specs/ios-operator-layer-deployment.md` before executing this section.

### 8.1 iOS Operator Layer File Completeness
- [ ] `custom_gpts/ios_operator_layer/` exists and is non-empty
- [ ] Builder wiring files exist:
  - [ ] `custom_gpts/ios_operator_layer/builder/instructions.en.md`
  - [ ] `custom_gpts/ios_operator_layer/builder/conversation_starters.en.md`
  - [ ] `custom_gpts/ios_operator_layer/builder/knowledge_notes.en.md`
- [ ] Operator-facing usage files exist:
  - [ ] `custom_gpts/ios_operator_layer/operator/sop.cs.md`
  - [ ] `custom_gpts/ios_operator_layer/operator/quick_macros.cs.md`
  - [ ] `custom_gpts/ios_operator_layer/operator/fail_macros.cs.md`
- [ ] `custom_gpts/ios_operator_layer/scenarios/` exists (if applicable per deployment spec)

### 8.2 Deployment Spec Compliance
- [ ] `operations/specs/ios-operator-layer-deployment.md` has been read and all pre-conditions listed there are satisfied
- [ ] Deployment name `GPTS_DECISION_STACK_IOS_OPERATOR_LAYER` matches the name in Builder
- [ ] The GPT in Builder is wired to `actions/openapi.yaml` (or `actions/openapi.openai.yaml`) and the live Worker URL
- [ ] The authentication configuration in Builder matches `actions/auth.md`

### 8.3 Boundary Enforcement
- [ ] The iOS operator layer is treated as a **thin orchestration shell** — it calls Worker APIs; it does not contain decision logic
- [ ] Specialists (pipeline-stage agents) are **internal protocol roles**, not separately deployed GPTs
- [ ] Builder is **not** the canonical authoring location — all prompt content must originate from `custom_gpts/ios_operator_layer/builder/instructions.en.md` in the repository
- [ ] No business logic or governance rules are hardcoded in the Builder instructions that are not present in the repository files

### 8.4 Control Plane Prompts (Deployed to Builder Knowledge)
Verify all 4 control plane prompts are present in the repository and have been uploaded to Builder knowledge or referenced as instructed by the deployment spec:
- [ ] `prompts/core/CP-Governor.system.md`
- [ ] `prompts/core/CP-ContractAuditor.system.md`
- [ ] `prompts/core/CP-TransitionJudge.system.md`
- [ ] `prompts/core/CP-ReleaseArbiter.system.md`

### 8.5 Adaptive Engine Prompts
Verify all 8 adaptive engine prompts are present in the repository:
- [ ] `prompts/adaptive/AE-Intake.system.md`
- [ ] `prompts/adaptive/AE-Framing.system.md`
- [ ] `prompts/adaptive/AE-Primitive.system.md`
- [ ] `prompts/adaptive/AE-Architecture.system.md`
- [ ] `prompts/adaptive/AE-Claims.system.md`
- [ ] `prompts/adaptive/AE-RiskGov.system.md`
- [ ] `prompts/adaptive/AE-Commercial.system.md`
- [ ] `prompts/adaptive/AE-ReviewRouter.system.md`

### 8.6 Post-Deployment Verification
- [ ] After Builder configuration, a test conversation is run confirming that:
  - [ ] The GPT correctly calls the Worker `/health` endpoint
  - [ ] The GPT correctly calls the Worker with authentication
  - [ ] The GPT does not hallucinate Worker endpoints not defined in `actions/openapi.yaml`
- [ ] Evidence of this test is recorded in `operations/evidence/` or linked in the handoff package

---

## 9. Acceptance/Test Evidence Checks

Evidence produced in this section must be stored as artifacts in `operations/evidence/`. Evidence files must include the run date, environment, and pass/fail status for each scenario.

### 9.1 Acceptance Scenario Coverage
The following scenarios must each be executed and produce a PASS result. No gate can be claimed as passed without evidence artifacts:
- [ ] AC-001: Non-linear model — verified PASS with evidence
- [ ] AC-002: Allowed outcomes — verified PASS with evidence
- [ ] AC-003: Invalidation — verified PASS with evidence
- [ ] AC-004: Veto — verified PASS with evidence (active veto blocks reentry and release)
- [ ] AC-005: Reentry — verified PASS with evidence (explicit reentry, no silent re-entry)
- [ ] AC-006: Unresolved — verified PASS with evidence
- [ ] AC-007: Packaging gate — verified PASS with evidence
- [ ] AC-008: Claims gate — verified PASS with evidence
- [ ] AC-009: Enterprise topology — verified PASS with evidence
- [ ] AC-010: Regulated escalation — verified PASS with evidence
- [ ] AC-011: Enablement bypass — verified PASS with evidence
- [ ] AC-012: Unknown discipline — verified PASS with evidence (UNKNOWN inputs are not estimated)
- [ ] AC-DI pack (Delivery Integrity) — verified PASS with evidence (if applicable to current environment)

### 9.2 Acceptance Evidence Artifacts
- [ ] Evidence file exists at `operations/evidence/acceptance-run-output-dev.yaml` (or environment-equivalent)
- [ ] Evidence file includes: run date, environment, workflow run ID (if CI-executed), scenario results (12/12 PASS expected)
- [ ] Evidence file was produced by running actual scenarios against a live Worker, not by manual assertion
- [ ] No acceptance scenario is marked PASS based only on local assumption or test file inspection

### 9.3 Fixture Pack Integrity
- [ ] All 10 fixture files are non-empty and structurally valid YAML
- [ ] Fixtures are not modified to produce artificial pass results
- [ ] Each fixture maps to one or more acceptance scenarios that use it

---

## 10. Runtime Evidence Checks

Runtime evidence confirms that the deployed Worker is live, correctly authenticated, and responding as expected. This section cannot be completed without a deployed Worker.

### 10.1 Health Endpoint
- [ ] `GET /health` (no auth required) returns HTTP 200 with `ok: true` on the target environment
- [ ] Health check is performed against the actual deployed Worker URL, not localhost

### 10.2 Protected Endpoint Authentication
- [ ] `POST /sessions` with a valid `X-API-Key` header returns HTTP 201 with `pipeline_state: intake`
- [ ] `POST /sessions` without an auth header returns HTTP 401
- [ ] `POST /sessions` with an incorrect `X-API-Key` returns HTTP 401

### 10.3 Session and Pipeline Progression
- [ ] Session creation succeeds and returns a session ID
- [ ] Artifact submission for `ProblemBrief` advances the session from `intake` to the expected next state
- [ ] State machine progression to `release_decision` is demonstrated (at minimum via evidence script, not manual assertion)
- [ ] Veto creation blocks further progression — reentry fails with `ILLEGAL_REENTRY_TRANSITION` while veto is active

### 10.4 Evidence Scripts
- [ ] `scripts/evidence/run-dev-runtime-evidence.mjs` is executed with correct `DEV_WORKER_URL` and `DEV_API_KEY`
- [ ] `scripts/evidence/run-dev-acceptance-evidence.mjs` is executed and produces output confirming scenario results
- [ ] For prod: equivalent evidence scripts are executed with prod URL and prod API key
- [ ] Evidence script output is captured and stored in `operations/evidence/`

### 10.5 Fresh Evidence Requirement
- [ ] Evidence in `operations/evidence/` is fresh for the target environment — not recycled from a previous deployment
- [ ] If Worker code or secrets have changed since the last evidence run, evidence must be re-executed
- [ ] No gate pass is claimed based on evidence from a different environment, different commit, or different secret

### 10.6 Evidence Bundle Contents
Verify `operations/evidence/audit-evidence-bundle-dev.yaml` and `operations/evidence/audit-evidence-bundle-prod.yaml` contain:
- [ ] Dev evidence bundle includes: health check result, authenticated create_session result, artifact submission result, pipeline progression result
- [ ] Prod evidence bundle includes: D1 migration confirmation, health check result, authenticated create_session result, R2/KV presence confirmation
- [ ] Both bundles include the Worker URL and timestamp of the evidence run

---

## 11. Promotion and Final Gate Checks

These checks must be satisfied before promotion to a higher environment. The order is: local → dev → staging → prod. Each step requires the previous step's gate to be PASS.

### 11.1 Local → Dev Promotion Gate
Per `operations/gates/promotion-gate.yaml`:
- [ ] `repo_manifest_complete` — `repo.manifest.yaml` is complete and accurate
- [ ] `prompt_completeness == PASS` — all 12 prompts (4 core + 8 adaptive) present and non-empty
- [ ] `schema_consistency == PASS` — all 10 artifact schemas present and structurally consistent with `knowledge/core/03_ArtifactSchemas.yaml`
- [ ] `backend_binding_defined == PASS` — `operations/backend_binding.yaml` reflects implemented routes

### 11.2 Dev → Staging Promotion Gate
Per `operations/gates/promotion-gate.yaml`:
- [ ] `dev_gate == PASS` — dev runtime evidence confirms Worker is live and authenticated
- [ ] `backend_health == PASS` — `/health` returns HTTP 200 on dev
- [ ] `auth_binding == PASS` — authenticated endpoints return 201/200 on dev; unauthenticated return 401
- [ ] `gpt_provisioning == PASS` — iOS operator layer Builder is configured and tested
- [ ] `smoke_tests == PASS` — acceptance scenarios pass on dev

### 11.3 Staging → Prod Promotion Gate
Per `operations/gates/promotion-gate.yaml`:
- [ ] `staging_gate == PASS` — staging runtime and acceptance evidence is present
- [ ] `final_qa_artifact == PASS` — `qa/final-gate-report.yaml` shows `overall_status: PASS`
- [ ] `ownership_map_approved == PASS` — `operations/operational_ownership_map.yaml` approved
- [ ] `approval_map_approved == PASS` — `operations/operational_approval_map.yaml` approved
- [ ] `veto_map_approved == PASS` — `operations/operational_veto_mapping.yaml` approved
- [ ] `authoritative_release_notes_approved == PASS` — `release/authoritative_release_notes.md` approved

### 11.4 Final Gate Artifact Consistency
- [ ] `qa/final-gate-report.yaml` `overall_status: PASS` is backed by physical evidence in `operations/evidence/`
- [ ] `qa/final-gate-report.yaml` `deployment_readiness_status: PASS` reflects actual provisioned infrastructure
- [ ] `qa/final-gate-report.yaml` `bundle_classification: DEPLOY-READY STACK` is not a self-declared status — it is backed by evidence showing prod infrastructure provisioned, health passing, and acceptance tests passing
- [ ] `operations/gates/promotion-gate.yaml` `current_gate_position` section is consistent with `qa/final-gate-report.yaml`

### 11.5 No Promotion with Open Blockers
- [ ] No environment is promoted while any item in `blocking_gaps` of `qa/final-gate-report.yaml` is non-empty
- [ ] No environment is promoted with unresolved auth/config drift (per Section 5.5)
- [ ] No environment is promoted based on README status lines alone

---

## 12. Handoff Package Requirements

A handoff package is required before this deployment is considered complete. The handoff package enables a different Coder to take over implementation state without hidden knowledge. Use `operations/checklists/CODER_HANDOFF_PACKAGE_TEMPLATE.md` as the template for producing the handoff artifact.

### 12.1 Required Handoff Contents
The handoff package must include:
- [ ] **Deployed commit SHA** — the exact Git commit SHA that is deployed to each environment (dev, prod)
- [ ] **Environment target** — explicit statement of which environments have been deployed (dev, prod, or staging)
- [ ] **Worker URLs** — the live URLs for each deployed environment
  - Dev: `https://gpts-decision-stack-dev.{ACCOUNT_SUBDOMAIN}.workers.dev` (or custom domain if configured)
  - Prod: `https://gpts-decision-stack.{ACCOUNT_SUBDOMAIN}.workers.dev` (or custom domain if configured)
- [ ] **Evidence references** — list of evidence files in `operations/evidence/` that cover this deployment
- [ ] **Secret/config mapping confirmation** — a statement (without exposing secret values) confirming:
  - `API_KEY_SECRET` is set on each deployed Worker
  - GitHub Actions secrets (`CLOUDFLARE_ACCOUNT_ID`, `DEV_API_KEY`, `PROD_API_KEY`) are configured
  - D1/R2/KV binding IDs match what is deployed
- [ ] **Known limitations / accepted gaps** — explicit list of any functionality that is not yet production-ready, with rationale
- [ ] **Final gate status reference** — a pointer to `qa/final-gate-report.yaml` and its `overall_status` value at time of handoff

### 12.2 Handoff Delivery Location
- [ ] Handoff package is committed to `operations/` or `release/` in the repository — not delivered out-of-band
- [ ] Handoff package is not a README edit — it is a separate artifact with a clear filename and date stamp
- [ ] Handoff package does not contain secret values

---

## 13. Failure Handling / Rollback Checks

### 13.1 Build Failure
- [ ] If `npm run build` fails: do not deploy. Fix TypeScript errors. Re-run build before proceeding.
- [ ] If CI build fails: check `.github/workflows/` logs. Do not proceed with a broken build artifact.
- [ ] Build failure does not justify skipping type checking — fix the build.

### 13.2 Migration Failure
- [ ] If a D1 migration fails: do not proceed with Worker deployment on that database.
- [ ] Identify which migration failed (check Wrangler output for the exact SQL statement).
- [ ] If the migration error is recoverable (e.g., table already exists with `IF NOT EXISTS`): re-run and verify.
- [ ] If the migration error is not recoverable: roll back by applying a corrective migration — do not edit previously applied migration files.
- [ ] After recovery, verify all tables exist (per Section 7.2) before deploying the Worker.

### 13.3 Auth Failure
- [ ] If the Worker returns 401 for authenticated requests: verify `API_KEY_SECRET` is set on the Worker via `wrangler secret list`.
- [ ] Re-set the secret if needed: `wrangler secret put API_KEY_SECRET --env <env>`.
- [ ] After re-setting, re-run runtime evidence from scratch. Previous evidence that used the old key is invalidated.
- [ ] If evidence scripts return auth failures: confirm the script's API key matches the Worker's deployed secret.

### 13.4 Runtime Evidence Failure
- [ ] If a runtime evidence script fails: do not claim PASS for any gate that depends on that evidence.
- [ ] Diagnose the failure against the Worker logs (Cloudflare dashboard or `wrangler tail`).
- [ ] Fix the root cause (code, migration, secret, binding) before re-running evidence.
- [ ] Do not update `qa/final-gate-report.yaml` to PASS while evidence scripts are failing.

### 13.5 Wrong Environment Deployment
- [ ] If the wrong environment was targeted (e.g., prod Worker deployed with dev secrets):
  - [ ] Do not attempt a silent redeploy.
  - [ ] Explicitly re-deploy with correct environment flags.
  - [ ] Re-run evidence for that environment after the corrective deployment.
  - [ ] Update evidence artifacts to reflect the corrective deployment commit and timestamp.

### 13.6 Rollback Path
- [ ] Rollback target is the previous known-good deployed commit SHA (from the handoff package or Git history).
- [ ] Rollback procedure: `wrangler deploy --env <env>` from the previous commit.
- [ ] After rollback: re-run `/health` and authentication checks to confirm the rolled-back Worker is live.
- [ ] Rollback evidence must be recorded in `operations/evidence/` — do not reuse pre-rollback evidence artifacts.
- [ ] If rollback is executed: update `qa/final-gate-report.yaml` to reflect the new state.

### 13.7 Silent Redeploy Prohibition
- [ ] A silent redeploy (deploying a new version without updating evidence) is NOT permitted.
- [ ] Every deployment that changes Worker code must be followed by a fresh evidence run.
- [ ] Gate artifacts (`qa/final-gate-report.yaml`, `operations/gates/promotion-gate.yaml`) must be updated after any deployment that changes gate-relevant state.

---

## 14. Final Completion Gate

This section defines the three levels of completion. A Coder must explicitly identify which level has been achieved and produce evidence to support the claim.

---

### Level 1: Minimum-Valid

All of the following must be true:

- [ ] Repository structure is complete — all files listed in Section 3 exist and are non-empty
- [ ] All D1/R2/KV bindings are declared in `wrangler.toml` for both dev and prod environments
- [ ] All D1 migrations exist in `backend/worker/migrations/` and are non-empty
- [ ] `actions/openapi.yaml` defines all required GPT action routes
- [ ] All required action handlers in `backend/worker/src/handlers/` are implemented (not stubbed)
- [ ] `API_KEY_SECRET` is set on at least one deployed Worker environment
- [ ] `npm test` passes with no failures

**Minimum-Valid does NOT mean the system is ready for operator use or GPT deployment.**

---

### Level 2: Operational

All of the following must be true (in addition to Level 1):

- [ ] Worker deployment succeeds for at least one environment (dev or prod)
- [ ] `GET /health` returns HTTP 200 on the deployed environment
- [ ] Protected routes (`POST /sessions`, etc.) return HTTP 401 without auth and HTTP 201/200 with correct auth
- [ ] Runtime evidence scripts pass and their output is stored in `operations/evidence/`
- [ ] Acceptance scenarios AC-001 through AC-012 pass against the deployed Worker
- [ ] Acceptance evidence is stored in `operations/evidence/`
- [ ] iOS operator layer Builder is configured and a test conversation confirms Worker integration

**Operational means the system is functionally deployed and verified. It is ready for governed use.**

---

### Level 3: Handoff-Complete

All of the following must be true (in addition to Levels 1 and 2):

- [ ] `operations/gates/promotion-gate.yaml` `current_gate_position` section is consistent with `qa/final-gate-report.yaml`
- [ ] `qa/final-gate-report.yaml` `overall_status: PASS` is backed by explicit evidence references
- [ ] All `blocking_gaps` and `provisioning_gaps` in `qa/final-gate-report.yaml` are empty or explicitly accepted
- [ ] Handoff package is assembled per Section 12 (using `operations/checklists/CODER_HANDOFF_PACKAGE_TEMPLATE.md`) and committed to the repository
- [ ] Secret/config alignment is verified per `operations/checklists/ENVIRONMENT_SECRET_ALIGNMENT_CHECKLIST.md`
- [ ] Deployment evidence is indexed in `operations/evidence/DEPLOYMENT_EVIDENCE_INDEX.md`
- [ ] A different Coder can pick up implementation state from the repository alone — no hidden knowledge required
- [ ] All open assumptions (from the Assumptions section at the top of this document) are either resolved or explicitly accepted as known gaps in the handoff package

**Handoff-Complete means the deployment is fully governed, evidenced, and transferable. This is the required state for production release authority.**

---

*This document must be updated if the deployment target, environment bindings, or acceptance scenario set changes. Do not treat it as static after initial production deployment.*
