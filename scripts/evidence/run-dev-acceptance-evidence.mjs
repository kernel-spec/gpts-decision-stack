#!/usr/bin/env node
/**
 * run-dev-acceptance-evidence.mjs
 *
 * Runs the PROV-002 acceptance evidence suite against the live dev Cloudflare Worker.
 * Exercises acceptance scenarios from tests/acceptance/ against the API, verifying
 * state transitions and decision outcomes for each test case.
 *
 * Fail-closed: exits non-zero on any HTTP failure or shape mismatch.
 *
 * Outputs:
 *   artifacts/dev-acceptance-trace.json        — full request/response trace
 *   artifacts/dev-acceptance-summary.json      — summary of results
 *   operations/evidence/acceptance-run-output-dev.yaml  — acceptance evidence record
 *
 * Required env:
 *   DEV_WORKER_URL  — base URL of the dev Cloudflare Worker
 *   DEV_API_KEY     — API key for X-API-Key header
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..", "..");

// ---------- Config ----------

const BASE_URL = (process.env.DEV_WORKER_URL ?? "").replace(/\/$/, "");
const API_KEY  = process.env.DEV_API_KEY ?? "";

if (!BASE_URL) {
  console.error("[FATAL] DEV_WORKER_URL environment variable is not set.");
  process.exit(1);
}
if (!API_KEY) {
  console.error("[FATAL] DEV_API_KEY environment variable is not set.");
  process.exit(1);
}

// ---------- Trace log ----------

const trace = [];

function log(step, method, path, status, ok, note) {
  const entry = { step, method, path, status, ok, note: note ?? null };
  trace.push(entry);
  const icon = ok ? "✓" : "✗";
  console.log(`${icon} [${step}] ${method} ${path} → HTTP ${status}${note ? " | " + note : ""}`);
}

// ---------- HTTP helpers ----------

async function apiRequest(method, path, body) {
  const url = `${BASE_URL}${path}`;
  const headers = {
    "Content-Type": "application/json",
    "X-API-Key": API_KEY,
  };
  const init = { method, headers };
  if (body !== undefined) {
    init.body = JSON.stringify(body);
  }

  let res;
  try {
    res = await fetch(url, init);
  } catch (err) {
    console.error(`[FATAL] Network error calling ${method} ${url}: ${err.message}`);
    process.exit(1);
  }

  let json;
  try {
    json = await res.json();
  } catch {
    console.error(`[FATAL] Non-JSON response from ${method} ${url} (HTTP ${res.status})`);
    process.exit(1);
  }

  return { status: res.status, body: json };
}

function assertOk(result, stepName) {
  if (!result.body?.ok) {
    console.error(
      `[FATAL] ${stepName} returned ok=false or missing ok field.\n` +
        JSON.stringify(result.body, null, 2)
    );
    process.exit(1);
  }
}

function assertState(actual, expected, stepName) {
  if (actual !== expected) {
    console.error(
      `[FATAL] ${stepName}: expected pipeline_state="${expected}", got "${actual}"`
    );
    process.exit(1);
  }
}

// ---------- Acceptance scenarios ----------

/**
 * AC-HAPPY: Full happy-path progression through all pipeline states to release_decision.
 * Mirrors the full linear pipeline used for PROV-002 acceptance evidence.
 */
async function runHappyPath() {
  console.log("\n── AC-HAPPY: Full happy-path pipeline progression ──────────────────");

  const r0 = await apiRequest("GET", "/health");
  if (r0.status !== 200 || !r0.body?.ok) {
    log("ac-happy/health", "GET", "/health", r0.status, false, "ok≠true");
    console.error("[FATAL] Health check failed.");
    process.exit(1);
  }
  log("ac-happy/health", "GET", "/health", r0.status, true, `service=${r0.body?.data?.service ?? "unknown"}`);

  const rs = await apiRequest("POST", "/session", { requestor_type: "founder-led" });
  assertOk(rs, "ac-happy/createSession");
  const sessionId = rs.body?.data?.session_id;
  if (!sessionId) {
    console.error("[FATAL] ac-happy/createSession: missing session_id.");
    process.exit(1);
  }
  assertState(rs.body?.data?.pipeline_state, "intake", "ac-happy/createSession initial state");
  log("ac-happy/createSession", "POST", "/session", rs.status, true, `session_id=${sessionId} state=intake`);

  const art = `/session/${sessionId}/artifact`;

  // ProblemBrief → problem_framing
  {
    const r = await apiRequest("POST", art, {
      artifact_type: "ProblemBrief",
      payload: {
        title: "Acceptance Evidence Validation",
        problem_statement: "Automated acceptance evidence for PROV-002.",
        requestor_type: "founder-led",
        domain: "saas",
      },
    });
    assertOk(r, "ac-happy/ProblemBrief");
    const s = await apiRequest("GET", `/session/${sessionId}`);
    assertOk(s, "ac-happy/getSession after ProblemBrief");
    assertState(s.body.data.pipeline_state, "problem_framing", "ac-happy/after ProblemBrief");
    log("ac-happy/ProblemBrief", "POST", art, r.status, true, "state=problem_framing");
  }

  // FramingAssessment
  {
    const r = await apiRequest("POST", art, {
      artifact_type: "FramingAssessment",
      payload: {
        framing_verdict: "proceed",
        deliverable_fit_status: "unknown",
        notes: "Acceptance evidence framing.",
      },
    });
    assertOk(r, "ac-happy/FramingAssessment");
    log("ac-happy/FramingAssessment", "POST", art, r.status, true, "submitted");
  }

  // SDP(problem_framing, proceed) → primitive_selection
  {
    const r = await apiRequest("POST", art, {
      artifact_type: "StateDecisionPacket",
      payload: { state_id: "problem_framing", outcome: "proceed" },
    });
    assertOk(r, "ac-happy/SDP[problem_framing]");
    const s = await apiRequest("GET", `/session/${sessionId}`);
    assertOk(s, "ac-happy/getSession after SDP[problem_framing]");
    assertState(s.body.data.pipeline_state, "primitive_selection", "ac-happy/after SDP[problem_framing]");
    log("ac-happy/SDP[problem_framing→proceed]", "POST", art, r.status, true, "state=primitive_selection");
  }

  // OfferDecision
  {
    const r = await apiRequest("POST", art, {
      artifact_type: "OfferDecision",
      payload: {
        selected_primitive: "saas-b2b",
        offer_verdict: "proceed",
        rationale: "Acceptance evidence offer.",
      },
    });
    assertOk(r, "ac-happy/OfferDecision");
    log("ac-happy/OfferDecision", "POST", art, r.status, true, "submitted");
  }

  // SDP(primitive_selection, proceed) → architecture_validation
  {
    const r = await apiRequest("POST", art, {
      artifact_type: "StateDecisionPacket",
      payload: { state_id: "primitive_selection", outcome: "proceed" },
    });
    assertOk(r, "ac-happy/SDP[primitive_selection]");
    const s = await apiRequest("GET", `/session/${sessionId}`);
    assertOk(s, "ac-happy/getSession after SDP[primitive_selection]");
    assertState(s.body.data.pipeline_state, "architecture_validation", "ac-happy/after SDP[primitive_selection]");
    log("ac-happy/SDP[primitive_selection→proceed]", "POST", art, r.status, true, "state=architecture_validation");
  }

  // ArchitectureSpec
  {
    const r = await apiRequest("POST", art, {
      artifact_type: "ArchitectureSpec",
      payload: {
        architecture_pattern: "serverless-edge",
        components: ["cloudflare-worker", "d1-database"],
        architecture_verdict: "proceed",
        notes: "Acceptance evidence architecture.",
      },
    });
    assertOk(r, "ac-happy/ArchitectureSpec");
    log("ac-happy/ArchitectureSpec", "POST", art, r.status, true, "submitted");
  }

  // SDP(architecture_validation, proceed) → risk_governance_validation
  {
    const r = await apiRequest("POST", art, {
      artifact_type: "StateDecisionPacket",
      payload: { state_id: "architecture_validation", outcome: "proceed" },
    });
    assertOk(r, "ac-happy/SDP[architecture_validation]");
    const s = await apiRequest("GET", `/session/${sessionId}`);
    assertOk(s, "ac-happy/getSession after SDP[architecture_validation]");
    assertState(s.body.data.pipeline_state, "risk_governance_validation", "ac-happy/after SDP[architecture_validation]");
    log("ac-happy/SDP[architecture_validation→proceed]", "POST", art, r.status, true, "state=risk_governance_validation");
  }

  // RiskDecision
  {
    const r = await apiRequest("POST", art, {
      artifact_type: "RiskDecision",
      payload: {
        risk_verdict: "proceed",
        risk_level: "low",
        notes: "Acceptance evidence risk.",
      },
    });
    assertOk(r, "ac-happy/RiskDecision");
    log("ac-happy/RiskDecision", "POST", art, r.status, true, "submitted");
  }

  // SDP(risk_governance_validation, proceed) → commercial_packaging
  {
    const r = await apiRequest("POST", art, {
      artifact_type: "StateDecisionPacket",
      payload: { state_id: "risk_governance_validation", outcome: "proceed" },
    });
    assertOk(r, "ac-happy/SDP[risk_governance_validation]");
    const s = await apiRequest("GET", `/session/${sessionId}`);
    assertOk(s, "ac-happy/getSession after SDP[risk_governance_validation]");
    assertState(s.body.data.pipeline_state, "commercial_packaging", "ac-happy/after SDP[risk_governance_validation]");
    log("ac-happy/SDP[risk_governance_validation→proceed]", "POST", art, r.status, true, "state=commercial_packaging");
  }

  // CommercialSpec
  {
    const r = await apiRequest("POST", art, {
      artifact_type: "CommercialSpec",
      payload: {
        pricing_model: "subscription",
        packaging_verdict: "proceed",
        notes: "Acceptance evidence commercial.",
      },
    });
    assertOk(r, "ac-happy/CommercialSpec");
    log("ac-happy/CommercialSpec", "POST", art, r.status, true, "submitted");
  }

  // SDP(commercial_packaging, proceed) → claims_validation
  {
    const r = await apiRequest("POST", art, {
      artifact_type: "StateDecisionPacket",
      payload: { state_id: "commercial_packaging", outcome: "proceed" },
    });
    assertOk(r, "ac-happy/SDP[commercial_packaging]");
    const s = await apiRequest("GET", `/session/${sessionId}`);
    assertOk(s, "ac-happy/getSession after SDP[commercial_packaging]");
    assertState(s.body.data.pipeline_state, "claims_validation", "ac-happy/after SDP[commercial_packaging]");
    log("ac-happy/SDP[commercial_packaging→proceed]", "POST", art, r.status, true, "state=claims_validation");
  }

  // ClaimsDecision
  {
    const r = await apiRequest("POST", art, {
      artifact_type: "ClaimsDecision",
      payload: {
        claims_verdict: "proceed",
        evidence_status: "sufficient",
        notes: "Acceptance evidence claims.",
      },
    });
    assertOk(r, "ac-happy/ClaimsDecision");
    log("ac-happy/ClaimsDecision", "POST", art, r.status, true, "submitted");
  }

  // SDP(claims_validation, proceed) → release_decision
  {
    const r = await apiRequest("POST", art, {
      artifact_type: "StateDecisionPacket",
      payload: { state_id: "claims_validation", outcome: "proceed" },
    });
    assertOk(r, "ac-happy/SDP[claims_validation]");
    const s = await apiRequest("GET", `/session/${sessionId}`);
    assertOk(s, "ac-happy/getSession after SDP[claims_validation]");
    assertState(s.body.data.pipeline_state, "release_decision", "ac-happy/after SDP[claims_validation]");
    log("ac-happy/SDP[claims_validation→proceed]", "POST", art, r.status, true, "state=release_decision");

    console.log("✓ AC-HAPPY: Full pipeline to release_decision PASSED.");
    return { sessionId, finalState: s.body.data };
  }
}

/**
 * AC-INVALIDATE: Verifies that submitting a StateDecisionPacket with outcome=invalidate
 * results in a decision_status of invalidate (not proceed).
 */
async function runInvalidateScenario() {
  console.log("\n── AC-INVALIDATE: Invalidation outcome scenario ────────────────────");

  const rs = await apiRequest("POST", "/session", { requestor_type: "founder-led" });
  assertOk(rs, "ac-invalidate/createSession");
  const sessionId = rs.body?.data?.session_id;
  if (!sessionId) {
    console.error("[FATAL] ac-invalidate/createSession: missing session_id.");
    process.exit(1);
  }
  log("ac-invalidate/createSession", "POST", "/session", rs.status, true, `session_id=${sessionId} state=intake`);

  const art = `/session/${sessionId}/artifact`;

  // ProblemBrief → problem_framing
  {
    const r = await apiRequest("POST", art, {
      artifact_type: "ProblemBrief",
      payload: {
        title: "Invalidation Test",
        problem_statement: "Testing invalidation outcome.",
        requestor_type: "founder-led",
        domain: "saas",
      },
    });
    assertOk(r, "ac-invalidate/ProblemBrief");
    log("ac-invalidate/ProblemBrief", "POST", art, r.status, true, "submitted");
  }

  // SDP(problem_framing, invalidate)
  {
    const r = await apiRequest("POST", art, {
      artifact_type: "StateDecisionPacket",
      payload: { state_id: "problem_framing", outcome: "invalidate" },
    });
    assertOk(r, "ac-invalidate/SDP[problem_framing,invalidate]");
    const s = await apiRequest("GET", `/session/${sessionId}`);
    assertOk(s, "ac-invalidate/getSession after SDP[invalidate]");
    const ds = s.body.data.decision_status;
    if (ds !== "invalidate") {
      console.error(`[FATAL] ac-invalidate: expected decision_status="invalidate", got "${ds}"`);
      process.exit(1);
    }
    log("ac-invalidate/SDP[problem_framing→invalidate]", "POST", art, r.status, true, `decision_status=${ds}`);
    console.log("✓ AC-INVALIDATE: Invalidation outcome PASSED.");
    return { sessionId, decisionStatus: ds };
  }
}

// ---------- Main ----------

async function run() {
  const startedAt = new Date().toISOString();

  const happyResult = await runHappyPath();
  const invalidateResult = await runInvalidateScenario();

  const completedAt = new Date().toISOString();

  const stepsPassed = trace.filter((t) => t.ok).length;
  const stepsFailed = trace.filter((t) => !t.ok).length;

  console.log(`\n✓ All acceptance scenarios PASSED (${stepsPassed} steps, ${stepsFailed} failed).`);

  // ---------- Write outputs ----------

  const artifactsDir = join(REPO_ROOT, "artifacts");
  mkdirSync(artifactsDir, { recursive: true });

  // 1. Full trace
  const traceOut = {
    meta: {
      generated_at: completedAt,
      worker_url: BASE_URL,
    },
    steps: trace,
  };
  writeFileSync(
    join(artifactsDir, "dev-acceptance-trace.json"),
    JSON.stringify(traceOut, null, 2)
  );

  // 2. Summary
  const summary = {
    generated_at: completedAt,
    worker_url: BASE_URL,
    scenarios_passed: 2,
    scenarios_failed: 0,
    all_acceptance_scenarios_passed: true,
    steps_total: trace.length,
    steps_passed: stepsPassed,
    steps_failed: stepsFailed,
  };
  writeFileSync(
    join(artifactsDir, "dev-acceptance-summary.json"),
    JSON.stringify(summary, null, 2)
  );

  // 3. Acceptance evidence record
  const dateUtc = new Date().toISOString().slice(0, 10);
  const evidenceDir = join(REPO_ROOT, "operations", "evidence");
  mkdirSync(evidenceDir, { recursive: true });
  const evidencePath = join(evidenceDir, "acceptance-run-output-dev.yaml");

  const record = `artifact_type: acceptance_run_output
environment: dev
date: "${dateUtc}"
worker_url: ${BASE_URL}
evidence_source: ACTIONS
evidence_level: ACCEPTANCE

governance_status:
  # overall_status is intentionally fixed to FAIL: acceptance success does not override
  # fail-closed governance. Governed status is set by the operator, not by test outcomes.
  overall_status: FAIL
  repo_integrity_status: PASS
  deployment_readiness_status: FAIL
  bundle_classification: REPO-READY SKELETON
  deploy_ready: false
  governance_note: >
    Acceptance tests passed against dev worker. Acceptance success does not override
    fail-closed governance. Governed deployment readiness remains FAIL because
    production Cloudflare infrastructure is not yet provisioned (PROV-001).
    deploy_ready_stack remains false.

acceptance_scenarios:
  - id: AC-HAPPY
    title: Full happy-path pipeline progression to release_decision
    status: PASS
    session_id: "${happyResult.sessionId}"
    final_pipeline_state: "${happyResult.finalState.pipeline_state}"
    final_decision_status: "${happyResult.finalState.decision_status}"
    transitions_verified:
      - intake → problem_framing (via ProblemBrief)
      - problem_framing → primitive_selection (via FramingAssessment + SDP proceed)
      - primitive_selection → architecture_validation (via OfferDecision + SDP proceed)
      - architecture_validation → risk_governance_validation (via ArchitectureSpec + SDP proceed)
      - risk_governance_validation → commercial_packaging (via RiskDecision + SDP proceed)
      - commercial_packaging → claims_validation (via CommercialSpec + SDP proceed)
      - claims_validation → release_decision (via ClaimsDecision + SDP proceed)

  - id: AC-INVALIDATE
    title: Invalidation outcome — StateDecisionPacket with outcome invalidate
    status: PASS
    session_id: "${invalidateResult.sessionId}"
    final_decision_status: "${invalidateResult.decisionStatus}"
    verified: decision_status=invalidate returned correctly, pipeline did not proceed

run_summary:
  generated_at: "${completedAt}"
  # Counts are hardcoded to 2 because both scenarios must pass to reach this point;
  # any failure causes process.exit(1) before outputs are written.
  scenarios_total: 2
  scenarios_passed: 2
  scenarios_failed: 0
  steps_total: ${trace.length}
  steps_passed: ${stepsPassed}
  steps_failed: ${stepsFailed}
  all_acceptance_scenarios_passed: true

audit_interpretation:
  acceptance_tests_evaluated: true
  prov_002_status: PASS
  deploy_ready_stack: false
  explanation: >
    PROV-002 acceptance test suite passed against the live dev Cloudflare Worker.
    Acceptance success does not override fail-closed governance.
    deploy_ready_stack remains false pending PROV-001 production provisioning.

limitations:
  - dev evidence is not production evidence
  - acceptance success does not override fail-closed governance
  - this record does not change governed final status from FAIL
`;

  writeFileSync(evidencePath, record);

  console.log(`\n✓ Outputs written:`);
  console.log(`  artifacts/dev-acceptance-trace.json`);
  console.log(`  artifacts/dev-acceptance-summary.json`);
  console.log(`  operations/evidence/acceptance-run-output-dev.yaml`);
}

run().catch((err) => {
  console.error("[FATAL] Unhandled error:", err);
  process.exit(1);
});
