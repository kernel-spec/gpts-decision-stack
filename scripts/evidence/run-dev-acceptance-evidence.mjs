#!/usr/bin/env node
/**
 * run-dev-acceptance-evidence.mjs
 *
 * Runs the acceptance criteria test suite (AC-001 through AC-012) against the
 * live dev Cloudflare Worker. Fail-closed: exits non-zero on any assertion failure.
 *
 * Outputs:
 *   artifacts/dev-acceptance-trace.json        — full request/response trace
 *   artifacts/dev-acceptance-summary.json      — summary of AC results
 *   operations/evidence/acceptance-run-output-dev.yaml — governed evidence file
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

// ---------- Trace & Results ----------

const trace = [];
const acResults = [];

function log(step, method, path, status, ok, note) {
  const entry = { step, method, path, status, ok, note: note ?? null };
  trace.push(entry);
  const icon = ok ? "✓" : "✗";
  console.log(
    `${icon} [${step}] ${method} ${path} → HTTP ${status}${note ? " | " + note : ""}`
  );
}

function recordAC(ac, scenario, status, note) {
  acResults.push({ ac, scenario, status, note: note ?? null });
  const icon = status === "PASS" ? "✓" : "✗";
  console.log(`  ${icon} ${ac}/${scenario}: ${note ?? status}`);
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

// ---------- progressTo helper ----------

/**
 * Drives a fresh session from intake to the target pipeline state using all
 * required happy-path artifacts. Returns the session_id.
 */
async function progressTo(targetState, requestorType = "founder-led") {
  const states = [
    "intake",
    "problem_framing",
    "primitive_selection",
    "architecture_validation",
    "risk_governance_validation",
    "commercial_packaging",
    "claims_validation",
    "release_decision",
  ];
  const targetIdx = states.indexOf(targetState);
  if (targetIdx < 0) {
    console.error(`[FATAL] progressTo: unknown target state "${targetState}"`);
    process.exit(1);
  }

  // Create session
  const r0 = await apiRequest("POST", "/session", { requestor_type: requestorType });
  assertOk(r0, `progressTo(${targetState}): createSession`);
  const sessionId = r0.body.data.session_id;
  const artifactUrl = `/session/${sessionId}/artifact`;

  if (targetIdx === 0) return sessionId; // intake

  // intake → problem_framing: ProblemBrief
  {
    const r = await apiRequest("POST", artifactUrl, {
      artifact_type: "ProblemBrief",
      payload: {
        title: "Acceptance Test Session",
        problem_statement: "Automated acceptance criteria validation.",
        requestor_type: requestorType,
        domain: "saas",
      },
    });
    assertOk(r, `progressTo(${targetState}): ProblemBrief`);
  }
  if (targetIdx === 1) return sessionId; // problem_framing

  // problem_framing → primitive_selection
  {
    await apiRequest("POST", artifactUrl, {
      artifact_type: "FramingAssessment",
      payload: { framing_verdict: "proceed", deliverable_fit_status: "unknown" },
    });
    const r = await apiRequest("POST", artifactUrl, {
      artifact_type: "StateDecisionPacket",
      payload: { state_id: "problem_framing", outcome: "proceed" },
    });
    assertOk(r, `progressTo(${targetState}): SDP[problem_framing→proceed]`);
  }
  if (targetIdx === 2) return sessionId; // primitive_selection

  // primitive_selection → architecture_validation
  {
    await apiRequest("POST", artifactUrl, {
      artifact_type: "OfferDecision",
      payload: { selected_primitive: "saas-b2b", offer_verdict: "proceed" },
    });
    const r = await apiRequest("POST", artifactUrl, {
      artifact_type: "StateDecisionPacket",
      payload: { state_id: "primitive_selection", outcome: "proceed" },
    });
    assertOk(r, `progressTo(${targetState}): SDP[primitive_selection→proceed]`);
  }
  if (targetIdx === 3) return sessionId; // architecture_validation

  // architecture_validation → risk_governance_validation
  {
    await apiRequest("POST", artifactUrl, {
      artifact_type: "ArchitectureSpec",
      payload: { architecture_pattern: "serverless-edge", architecture_verdict: "proceed" },
    });
    const r = await apiRequest("POST", artifactUrl, {
      artifact_type: "StateDecisionPacket",
      payload: { state_id: "architecture_validation", outcome: "proceed" },
    });
    assertOk(r, `progressTo(${targetState}): SDP[architecture_validation→proceed]`);
  }
  if (targetIdx === 4) return sessionId; // risk_governance_validation

  // risk_governance_validation → commercial_packaging
  {
    await apiRequest("POST", artifactUrl, {
      artifact_type: "RiskDecision",
      payload: { risk_verdict: "proceed", risk_level: "low" },
    });
    const r = await apiRequest("POST", artifactUrl, {
      artifact_type: "StateDecisionPacket",
      payload: { state_id: "risk_governance_validation", outcome: "proceed" },
    });
    assertOk(r, `progressTo(${targetState}): SDP[risk_governance_validation→proceed]`);
  }
  if (targetIdx === 5) return sessionId; // commercial_packaging

  // commercial_packaging → claims_validation
  {
    await apiRequest("POST", artifactUrl, {
      artifact_type: "CommercialSpec",
      payload: { pricing_model: "subscription", packaging_verdict: "proceed" },
    });
    const r = await apiRequest("POST", artifactUrl, {
      artifact_type: "StateDecisionPacket",
      payload: { state_id: "commercial_packaging", outcome: "proceed" },
    });
    assertOk(r, `progressTo(${targetState}): SDP[commercial_packaging→proceed]`);
  }
  if (targetIdx === 6) return sessionId; // claims_validation

  // claims_validation → release_decision
  {
    await apiRequest("POST", artifactUrl, {
      artifact_type: "ClaimsDecision",
      payload: { claims_verdict: "proceed", evidence_status: "sufficient" },
    });
    const r = await apiRequest("POST", artifactUrl, {
      artifact_type: "StateDecisionPacket",
      payload: { state_id: "claims_validation", outcome: "proceed" },
    });
    assertOk(r, `progressTo(${targetState}): SDP[claims_validation→proceed]`);
  }
  return sessionId; // release_decision
}

// ---------- assertNotState helper ----------

/**
 * Asserts that the session is NOT in the forbidden state (fail-closed).
 * Returns the actual pipeline_state.
 */
async function assertNotState(sessionId, forbiddenState, stepName) {
  const s = await apiRequest("GET", `/session/${sessionId}`);
  assertOk(s, `assertNotState(${stepName}): getSession`);
  const actual = s.body.data.pipeline_state;
  if (actual === forbiddenState) {
    console.error(
      `[FATAL] ${stepName}: pipeline_state must NOT be "${forbiddenState}", but it is.`
    );
    process.exit(1);
  }
  log(stepName, "GET", `/session/${sessionId}`, s.status, true,
    `state=${actual} ≠ ${forbiddenState} ✓`);
  return actual;
}

// ---------- assertSessionState helper ----------

async function assertSessionState(sessionId, expectedState, stepName) {
  const s = await apiRequest("GET", `/session/${sessionId}`);
  assertOk(s, `assertSessionState(${stepName}): getSession`);
  const actual = s.body.data.pipeline_state;
  if (actual !== expectedState) {
    console.error(
      `[FATAL] ${stepName}: expected pipeline_state="${expectedState}", got "${actual}"`
    );
    process.exit(1);
  }
  log(stepName, "GET", `/session/${sessionId}`, s.status, true,
    `state=${actual} ✓`);
  return s.body.data;
}

// ---------- Main ----------

async function run() {
  const startedAt = new Date().toISOString();

  // ── Health check ─────────────────────────────────────────────────────────
  console.log("\n── Health ──────────────────────────────────────────────────────");
  {
    const r = await apiRequest("GET", "/health");
    if (r.status !== 200 || !r.body?.ok) {
      log("health", "GET", "/health", r.status, false, "ok≠true");
      console.error("[FATAL] Health check failed.");
      process.exit(1);
    }
    log("health", "GET", "/health", r.status, true,
      `service=${r.body?.data?.service ?? "unknown"}`);
  }

  // ── AC-HAPPY: Full happy-path progression ─────────────────────────────────
  console.log("\n── AC-HAPPY: Full happy-path pipeline ──────────────────────────");
  {
    const sessionId = await progressTo("problem_framing");
    await assertSessionState(sessionId, "problem_framing", "AC-HAPPY/initial-state");

    // Drive to release_decision through all states
    const art = `/session/${sessionId}/artifact`;

    await apiRequest("POST", art, {
      artifact_type: "FramingAssessment",
      payload: { framing_verdict: "proceed", deliverable_fit_status: "unknown" },
    });
    let r = await apiRequest("POST", art, {
      artifact_type: "StateDecisionPacket",
      payload: { state_id: "problem_framing", outcome: "proceed" },
    });
    assertOk(r, "AC-HAPPY: SDP[problem_framing→proceed]");
    await assertSessionState(sessionId, "primitive_selection", "AC-HAPPY/primitive_selection");

    await apiRequest("POST", art, {
      artifact_type: "OfferDecision",
      payload: { selected_primitive: "saas-b2b", offer_verdict: "proceed" },
    });
    r = await apiRequest("POST", art, {
      artifact_type: "StateDecisionPacket",
      payload: { state_id: "primitive_selection", outcome: "proceed" },
    });
    assertOk(r, "AC-HAPPY: SDP[primitive_selection→proceed]");
    await assertSessionState(sessionId, "architecture_validation", "AC-HAPPY/architecture_validation");

    await apiRequest("POST", art, {
      artifact_type: "ArchitectureSpec",
      payload: { architecture_pattern: "serverless-edge", architecture_verdict: "proceed" },
    });
    r = await apiRequest("POST", art, {
      artifact_type: "StateDecisionPacket",
      payload: { state_id: "architecture_validation", outcome: "proceed" },
    });
    assertOk(r, "AC-HAPPY: SDP[architecture_validation→proceed]");
    await assertSessionState(sessionId, "risk_governance_validation", "AC-HAPPY/risk_governance_validation");

    await apiRequest("POST", art, {
      artifact_type: "RiskDecision",
      payload: { risk_verdict: "proceed", risk_level: "low" },
    });
    r = await apiRequest("POST", art, {
      artifact_type: "StateDecisionPacket",
      payload: { state_id: "risk_governance_validation", outcome: "proceed" },
    });
    assertOk(r, "AC-HAPPY: SDP[risk_governance_validation→proceed]");
    await assertSessionState(sessionId, "commercial_packaging", "AC-HAPPY/commercial_packaging");

    await apiRequest("POST", art, {
      artifact_type: "CommercialSpec",
      payload: { pricing_model: "subscription", packaging_verdict: "proceed" },
    });
    r = await apiRequest("POST", art, {
      artifact_type: "StateDecisionPacket",
      payload: { state_id: "commercial_packaging", outcome: "proceed" },
    });
    assertOk(r, "AC-HAPPY: SDP[commercial_packaging→proceed]");
    await assertSessionState(sessionId, "claims_validation", "AC-HAPPY/claims_validation");

    await apiRequest("POST", art, {
      artifact_type: "ClaimsDecision",
      payload: { claims_verdict: "proceed", evidence_status: "sufficient" },
    });
    r = await apiRequest("POST", art, {
      artifact_type: "StateDecisionPacket",
      payload: { state_id: "claims_validation", outcome: "proceed" },
    });
    assertOk(r, "AC-HAPPY: SDP[claims_validation→proceed]");
    const final = await assertSessionState(sessionId, "release_decision", "AC-HAPPY/release_decision");

    recordAC("AC-HAPPY", "full-pipeline", "PASS",
      `All 7 transitions verified. final_state=${final.pipeline_state}`);
  }

  // ── AC-001/A: Invalid framing → pipeline does not advance ─────────────────
  console.log("\n── AC-001/A: Invalid framing — no advance to primitive_selection ─");
  {
    const sessionId = await progressTo("problem_framing");
    const art = `/session/${sessionId}/artifact`;

    // Submit invalid framing assessment
    await apiRequest("POST", art, {
      artifact_type: "FramingAssessment",
      payload: {
        framing_verdict: "invalidate",
        framing_validity: "invalid",
        buyer_fit_status: "mismatch",
        decision_status: "invalidate",
        blocking_issues: ["buyer_fit_mismatch"],
        valid_reentry_targets: ["intake"],
      },
    });

    // Attempt SDP with invalidate outcome — must NOT advance
    await apiRequest("POST", art, {
      artifact_type: "StateDecisionPacket",
      payload: { state_id: "problem_framing", outcome: "invalidate" },
    });

    // assertNotState #1
    const actual = await assertNotState(sessionId, "primitive_selection",
      "AC-001/A: no-advance after invalid framing");
    recordAC("AC-001", "A-framing-invalidate", "PASS",
      `state=${actual} — did not advance to primitive_selection ✓`);
  }

  // ── AC-001/B: Claims fail → pipeline does not advance to release_decision ──
  console.log("\n── AC-001/B: Claims fail — no advance to release_decision ────────");
  {
    const sessionId = await progressTo("claims_validation");
    const art = `/session/${sessionId}/artifact`;

    // Submit failing claims decision
    await apiRequest("POST", art, {
      artifact_type: "ClaimsDecision",
      payload: {
        claim_fit_status: "fail",
        decision_status: "stop",
        forbidden_claims: ["guarantees regulatory compliance without audit"],
        evidence_gaps: ["audit_report", "security_review"],
      },
    });

    // Attempt SDP with stop outcome — must NOT advance
    await apiRequest("POST", art, {
      artifact_type: "StateDecisionPacket",
      payload: { state_id: "claims_validation", outcome: "stop" },
    });

    // assertNotState #2
    const actual = await assertNotState(sessionId, "release_decision",
      "AC-001/B: no-advance after claims fail");
    recordAC("AC-001", "B-claims-fail", "PASS",
      `state=${actual} — did not advance to release_decision ✓`);
  }

  // ── AC-002: Allowed decision_status values ────────────────────────────────
  console.log("\n── AC-002: Allowed decision_status values ──────────────────────");
  {
    // Verify that creating sessions and advancing returns only permitted values
    const sessionId = await progressTo("primitive_selection");
    const s = await apiRequest("GET", `/session/${sessionId}`);
    assertOk(s, "AC-002: getSession");
    const allowed = ["proceed", "revise", "invalidate", "unresolved", "blocked", "stop", "escalate"];
    const ds = s.body.data.decision_status;
    if (!allowed.includes(ds)) {
      console.error(`[FATAL] AC-002: decision_status "${ds}" is not in allowed set`);
      process.exit(1);
    }
    log("AC-002/allowed-values", "GET", `/session/${sessionId}`, s.status, true,
      `decision_status=${ds} ∈ allowed ✓`);
    recordAC("AC-002", "allowed-decision-status", "PASS",
      `decision_status=${ds} is within allowed set ✓`);
  }

  // ── AC-003: Infeasible architecture → no advance to risk_governance ────────
  console.log("\n── AC-003: Infeasible arch — no advance to risk_governance ───────");
  {
    const sessionId = await progressTo("architecture_validation");
    const art = `/session/${sessionId}/artifact`;

    // Submit infeasible architecture spec
    await apiRequest("POST", art, {
      artifact_type: "ArchitectureSpec",
      payload: {
        feasibility_status: "infeasible",
        decision_status: "invalidate",
        architecture_verdict: "invalidate",
        blocking_issues: ["buyer_fit_check_mismatch", "delivery_shape_incompatible"],
        fallback_architecture_options: ["internal-saas", "managed-service"],
      },
    });

    // Attempt SDP with invalidate outcome — must NOT advance
    await apiRequest("POST", art, {
      artifact_type: "StateDecisionPacket",
      payload: { state_id: "architecture_validation", outcome: "invalidate" },
    });

    // assertNotState #3
    const actual = await assertNotState(sessionId, "risk_governance_validation",
      "AC-003: no-advance after infeasible architecture");
    recordAC("AC-003", "infeasible-arch-invalidate", "PASS",
      `state=${actual} — did not advance to risk_governance_validation ✓`);
  }

  // ── AC-004: Active veto blocks release ────────────────────────────────────
  console.log("\n── AC-004: Active veto blocks release ──────────────────────────");
  {
    const sessionId = await progressTo("release_decision");

    // Activate veto
    const vr = await apiRequest("POST", `/veto/${sessionId}/activate`, {
      activated_by: "risk_governance_review",
      reason: "Active risk veto — acceptance test AC-004",
    });
    assertOk(vr, "AC-004: activateVeto");

    // Verify veto is active
    const vs = await apiRequest("GET", `/veto/${sessionId}/status`);
    assertOk(vs, "AC-004: getVetoStatus");
    if (!vs.body.data.is_active) {
      console.error("[FATAL] AC-004: veto should be active but is_active=false");
      process.exit(1);
    }
    log("AC-004/veto-status", "GET", `/veto/${sessionId}/status`, vs.status, true,
      `is_active=${vs.body.data.is_active} ✓`);

    // Verify session decision_status is blocked
    const ss = await apiRequest("GET", `/session/${sessionId}`);
    assertOk(ss, "AC-004: getSession after veto");
    if (ss.body.data.decision_status !== "blocked") {
      console.error(
        `[FATAL] AC-004: decision_status should be "blocked", got "${ss.body.data.decision_status}"`
      );
      process.exit(1);
    }
    log("AC-004/decision-status-blocked", "GET", `/session/${sessionId}`, ss.status, true,
      `decision_status=blocked ✓`);

    recordAC("AC-004", "veto-blocks-release", "PASS",
      `veto is_active=true, decision_status=blocked ✓`);
  }

  // ── AC-005/A: Framing revise — no advance to primitive_selection ──────────
  console.log("\n── AC-005/A: Framing revise — no advance ───────────────────────");
  {
    const sessionId = await progressTo("problem_framing");
    const art = `/session/${sessionId}/artifact`;

    // Submit framing with revise
    await apiRequest("POST", art, {
      artifact_type: "FramingAssessment",
      payload: {
        framing_verdict: "revise",
        deliverable_fit_status: "unknown",
        decision_status: "revise",
        blocking_issues: ["insufficient_context"],
        valid_reentry_targets: ["problem_framing"],
      },
    });

    // Attempt SDP with revise outcome — must NOT advance
    await apiRequest("POST", art, {
      artifact_type: "StateDecisionPacket",
      payload: { state_id: "problem_framing", outcome: "revise" },
    });

    // assertNotState #4
    const actual = await assertNotState(sessionId, "primitive_selection",
      "AC-005/A: no-advance after framing revise");
    recordAC("AC-005", "A-reentry-framing-revise", "PASS",
      `state=${actual} — revise outcome did not advance to primitive_selection ✓`);
  }

  // ── AC-005/B: Explicit re-entry via /reentry endpoint ────────────────────
  console.log("\n── AC-005/B: Explicit re-entry endpoint ───────────────────────");
  {
    const sessionId = await progressTo("architecture_validation");

    // Trigger explicit re-entry to primitive_selection
    const rr = await apiRequest("POST", `/session/${sessionId}/reentry`, {
      to_state: "primitive_selection",
      from_state: "architecture_validation",
      reason: "AC-005/B: Infeasible architecture — explicit re-entry to primitive_selection",
      agent_id: "AE-Architecture",
    });
    assertOk(rr, "AC-005/B: triggerReentry");
    log("AC-005/B/reentry", "POST", `/session/${sessionId}/reentry`, rr.status, true,
      "reentry to primitive_selection ✓");

    // Verify decision log records re-entry
    const dl = await apiRequest("GET", `/session/${sessionId}/decision-log`);
    assertOk(dl, "AC-005/B: getDecisionLog");
    const entries = dl.body.data ?? [];
    const hasReentry = entries.some((e) => e.action === "session.reentry");
    if (!hasReentry) {
      console.error("[FATAL] AC-005/B: decision log has no session.reentry entry");
      process.exit(1);
    }
    log("AC-005/B/decision-log", "GET", `/session/${sessionId}/decision-log`,
      dl.status, true, "session.reentry recorded ✓");

    // assertNotState #5: after re-entry to primitive_selection, not at architecture_validation
    const actual = await assertNotState(sessionId, "architecture_validation",
      "AC-005/B: after reentry — not at architecture_validation");
    recordAC("AC-005", "B-explicit-reentry-recorded", "PASS",
      `state=${actual}, reentry logged in decision-log ✓`);
  }

  // ── AC-006: Missing evidence → unresolved, not stop ──────────────────────
  console.log("\n── AC-006: Missing evidence → unresolved — no advance ──────────");
  {
    const sessionId = await progressTo("claims_validation");
    const art = `/session/${sessionId}/artifact`;

    // Submit claims with missing evidence (unresolved — no explicit counter-evidence)
    await apiRequest("POST", art, {
      artifact_type: "ClaimsDecision",
      payload: {
        claim_fit_status: "unresolved",
        decision_status: "unresolved",
        evidence_gaps: ["audit_report", "customer_reference", "security_review"],
        forbidden_claims: [],
        permitted_claims: [],
      },
    });

    // Attempt SDP with unresolved outcome — must NOT advance
    await apiRequest("POST", art, {
      artifact_type: "StateDecisionPacket",
      payload: { state_id: "claims_validation", outcome: "unresolved" },
    });

    // assertNotState #6
    const actual = await assertNotState(sessionId, "release_decision",
      "AC-006: no-advance after unresolved claims");
    recordAC("AC-006", "unresolved-no-advance", "PASS",
      `state=${actual} — unresolved claims did not advance to release_decision ✓`);
  }

  // ── AC-007/A: Packaging gate — revise outcome does not advance ─────────────
  console.log("\n── AC-007/A: Packaging gate — revise outcome ───────────────────");
  {
    const sessionId = await progressTo("commercial_packaging");
    const art = `/session/${sessionId}/artifact`;

    // Submit CommercialSpec with revise (missing required inputs)
    await apiRequest("POST", art, {
      artifact_type: "CommercialSpec",
      payload: {
        decision_status: "revise",
        blocking_issues: ["missing_offer_decision", "target_audience_unknown"],
        target_audience: "UNKNOWN",
      },
    });

    // Attempt SDP with revise — must NOT advance
    await apiRequest("POST", art, {
      artifact_type: "StateDecisionPacket",
      payload: { state_id: "commercial_packaging", outcome: "revise" },
    });

    // assertNotState #7
    const actual = await assertNotState(sessionId, "claims_validation",
      "AC-007/A: no-advance after commercial revise");
    recordAC("AC-007", "A-packaging-revise-blocks", "PASS",
      `state=${actual} — revise did not advance to claims_validation ✓`);
  }

  // ── AC-007/B: Packaging gate — blocked outcome does not advance ────────────
  console.log("\n── AC-007/B: Packaging gate — blocked outcome ──────────────────");
  {
    const sessionId = await progressTo("commercial_packaging");
    const art = `/session/${sessionId}/artifact`;

    // Submit CommercialSpec with blocked
    await apiRequest("POST", art, {
      artifact_type: "CommercialSpec",
      payload: {
        decision_status: "blocked",
        blocking_issues: ["forbidden_claims_present"],
      },
    });

    // Attempt SDP with blocked — must NOT advance
    await apiRequest("POST", art, {
      artifact_type: "StateDecisionPacket",
      payload: { state_id: "commercial_packaging", outcome: "blocked" },
    });

    // assertNotState #8
    const actual = await assertNotState(sessionId, "claims_validation",
      "AC-007/B: no-advance after commercial blocked");
    recordAC("AC-007", "B-packaging-blocked-blocks", "PASS",
      `state=${actual} — blocked did not advance to claims_validation ✓`);
  }

  // ── AC-008/A: Claims gate — revise outcome does not advance ───────────────
  console.log("\n── AC-008/A: Claims gate — revise outcome ──────────────────────");
  {
    const sessionId = await progressTo("claims_validation");
    const art = `/session/${sessionId}/artifact`;

    // Submit ClaimsDecision with revise (restricted claims present)
    await apiRequest("POST", art, {
      artifact_type: "ClaimsDecision",
      payload: {
        decision_status: "revise",
        claim_fit_status: "fail",
        restricted_claims: ["guarantees best-in-class support"],
        evidence_gaps: ["customer_reference"],
      },
    });

    // Attempt SDP with revise — must NOT advance
    await apiRequest("POST", art, {
      artifact_type: "StateDecisionPacket",
      payload: { state_id: "claims_validation", outcome: "revise" },
    });

    // assertNotState #9
    const actual = await assertNotState(sessionId, "release_decision",
      "AC-008/A: no-advance after claims revise");
    recordAC("AC-008", "A-claims-revise-blocks", "PASS",
      `state=${actual} — revise did not advance to release_decision ✓`);
  }

  // ── AC-008/B: Claims gate — blocked outcome does not advance ──────────────
  console.log("\n── AC-008/B: Claims gate — blocked outcome ─────────────────────");
  {
    const sessionId = await progressTo("claims_validation");
    const art = `/session/${sessionId}/artifact`;

    // Submit ClaimsDecision with forbidden claims (blocked)
    await apiRequest("POST", art, {
      artifact_type: "ClaimsDecision",
      payload: {
        decision_status: "blocked",
        claim_fit_status: "fail",
        forbidden_claims: ["guarantees regulatory compliance without audit"],
        evidence_gaps: ["audit_report", "security_review"],
      },
    });

    // Attempt SDP with blocked — must NOT advance
    await apiRequest("POST", art, {
      artifact_type: "StateDecisionPacket",
      payload: { state_id: "claims_validation", outcome: "blocked" },
    });

    // assertNotState #10
    const actual = await assertNotState(sessionId, "release_decision",
      "AC-008/B: no-advance after claims blocked");
    recordAC("AC-008", "B-forbidden-claims-blocked", "PASS",
      `state=${actual} — forbidden claims blocked advance to release_decision ✓`);
  }

  // ── AC-009: Enterprise topology — escalate does not advance ───────────────
  console.log("\n── AC-009: Enterprise topology — escalate outcome ──────────────");
  {
    const sessionId = await progressTo("risk_governance_validation", "enterprise");
    const art = `/session/${sessionId}/artifact`;

    // Submit ReviewTopologyPlan for enterprise (mandatory procurement + legal)
    await apiRequest("POST", art, {
      artifact_type: "ReviewTopologyPlan",
      payload: {
        activated_lanes: ["procurement", "legal"],
        mandatory_reviews: ["procurement", "legal"],
        topology_blockers: ["procurement_not_cleared", "legal_not_cleared"],
        lane_entry_conditions: ["enterprise_buyer_detected"],
        decision_status: "blocked",
      },
    });

    // Attempt SDP with escalate — must NOT advance past risk_governance_validation
    await apiRequest("POST", art, {
      artifact_type: "StateDecisionPacket",
      payload: { state_id: "risk_governance_validation", outcome: "escalate" },
    });

    // assertNotState #11
    const actual = await assertNotState(sessionId, "commercial_packaging",
      "AC-009: enterprise escalate does not advance to commercial_packaging");
    recordAC("AC-009", "enterprise-topology-escalate", "PASS",
      `state=${actual} — enterprise escalate did not advance to commercial_packaging ✓`);
  }

  // ── AC-010/A: Regulated escalation — escalate does not advance ────────────
  console.log("\n── AC-010/A: Regulated escalation — escalate outcome ──────────");
  {
    const sessionId = await progressTo("risk_governance_validation", "regulated");
    const art = `/session/${sessionId}/artifact`;

    // Submit RiskDecision requiring escalation (missing manual approval)
    await apiRequest("POST", art, {
      artifact_type: "RiskDecision",
      payload: {
        risk_verdict: "escalate",
        risk_classification: "critical",
        decision_status: "escalate",
        mandatory_approvals: ["regulated_approval_board"],
        hard_block_conditions: ["approval_missing"],
      },
    });

    // Attempt SDP with escalate — must NOT advance
    await apiRequest("POST", art, {
      artifact_type: "StateDecisionPacket",
      payload: { state_id: "risk_governance_validation", outcome: "escalate" },
    });

    // assertNotState #12
    const actual = await assertNotState(sessionId, "commercial_packaging",
      "AC-010/A: escalate does not advance to commercial_packaging");
    recordAC("AC-010", "A-regulated-escalate", "PASS",
      `state=${actual} — regulated escalate did not advance to commercial_packaging ✓`);
  }

  // ── AC-010/B: Regulated — blocked does not advance ────────────────────────
  console.log("\n── AC-010/B: Regulated — blocked outcome ───────────────────────");
  {
    const sessionId = await progressTo("risk_governance_validation", "regulated");
    const art = `/session/${sessionId}/artifact`;

    // Submit RiskDecision with blocked
    await apiRequest("POST", art, {
      artifact_type: "RiskDecision",
      payload: {
        risk_verdict: "blocked",
        decision_status: "blocked",
        mandatory_approvals: ["regulated_approval_board"],
        hard_block_conditions: ["approval_missing"],
      },
    });

    // Attempt SDP with blocked — must NOT advance
    await apiRequest("POST", art, {
      artifact_type: "StateDecisionPacket",
      payload: { state_id: "risk_governance_validation", outcome: "blocked" },
    });

    // assertNotState #13
    const actual = await assertNotState(sessionId, "commercial_packaging",
      "AC-010/B: blocked does not advance to commercial_packaging");
    recordAC("AC-010", "B-regulated-blocked", "PASS",
      `state=${actual} — blocked did not advance to commercial_packaging ✓`);
  }

  // ── AC-011/A: Enablement bypass — stop without bypass does not advance ─────
  console.log("\n── AC-011/A: Enablement — stop outcome does not advance ────────");
  {
    const sessionId = await progressTo("commercial_packaging", "enablement");
    const art = `/session/${sessionId}/artifact`;

    // Submit CommercialSpec with stop (no bypass policy present)
    await apiRequest("POST", art, {
      artifact_type: "CommercialSpec",
      payload: {
        decision_status: "stop",
        lane_bypass_active: false,
        blocking_issues: ["commercial_lane_optional_not_set"],
      },
    });

    // Attempt SDP with stop — must NOT advance
    await apiRequest("POST", art, {
      artifact_type: "StateDecisionPacket",
      payload: { state_id: "commercial_packaging", outcome: "stop" },
    });

    // assertNotState #14
    const actual = await assertNotState(sessionId, "claims_validation",
      "AC-011/A: stop outcome does not advance to claims_validation");
    recordAC("AC-011", "A-no-bypass-stop-blocks", "PASS",
      `state=${actual} — stop without bypass did not advance to claims_validation ✓`);
  }

  // ── AC-011/B: Enablement bypass — explicit bypass proceeds ────────────────
  console.log("\n── AC-011/B: Enablement bypass with policy proceed ─────────────");
  {
    const sessionId = await progressTo("commercial_packaging", "enablement");
    const art = `/session/${sessionId}/artifact`;

    // Submit CommercialSpec with lane_bypass_active (commercial_lane_optional=true policy)
    await apiRequest("POST", art, {
      artifact_type: "CommercialSpec",
      payload: {
        decision_status: "proceed",
        lane_bypass_active: true,
        lane_bypass_authority: "PolicyContext.commercial_lane_optional=true",
        pricing_model: null,
      },
    });

    // SDP with proceed — should advance to claims_validation
    const r = await apiRequest("POST", art, {
      artifact_type: "StateDecisionPacket",
      payload: { state_id: "commercial_packaging", outcome: "proceed" },
    });
    assertOk(r, "AC-011/B: SDP[commercial_packaging→proceed]");

    // assertNotState #15: should NOT still be at commercial_packaging
    const actual = await assertNotState(sessionId, "commercial_packaging",
      "AC-011/B: bypass proceed did advance past commercial_packaging");
    recordAC("AC-011", "B-explicit-bypass-proceeds", "PASS",
      `state=${actual} — explicit bypass proceed advanced past commercial_packaging ✓`);
  }

  // ── AC-012/A: UNKNOWN intake — revise does not advance ───────────────────
  console.log("\n── AC-012/A: UNKNOWN values — revise does not advance ──────────");
  {
    const sessionId = await progressTo("intake");
    const art = `/session/${sessionId}/artifact`;

    // Submit ProblemBrief with UNKNOWN stakeholders
    await apiRequest("POST", art, {
      artifact_type: "ProblemBrief",
      payload: {
        title: "Partial Intake Test",
        problem_statement: "Automated acceptance test — partial intake.",
        requestor_type: "founder-led",
        domain: "UNKNOWN",
        stakeholders: ["UNKNOWN"],
        unknowns: ["buyer_type", "target_audience", "delivery_model"],
        decision_status: "revise",
      },
    });

    // Attempt SDP with revise outcome — must NOT advance to primitive_selection
    await apiRequest("POST", art, {
      artifact_type: "StateDecisionPacket",
      payload: { state_id: "problem_framing", outcome: "revise" },
    });

    // assertNotState #16
    const actual = await assertNotState(sessionId, "primitive_selection",
      "AC-012/A: UNKNOWN intake — revise does not advance to primitive_selection");
    recordAC("AC-012", "A-unknown-intake-revise", "PASS",
      `state=${actual} — UNKNOWN intake revise did not advance to primitive_selection ✓`);
  }

  // ── AC-012/B: UNKNOWN framing — revise does not advance ──────────────────
  console.log("\n── AC-012/B: UNKNOWN framing — revise from problem_framing ─────");
  {
    const sessionId = await progressTo("problem_framing");
    const art = `/session/${sessionId}/artifact`;

    // Submit FramingAssessment with UNKNOWN values
    await apiRequest("POST", art, {
      artifact_type: "FramingAssessment",
      payload: {
        framing_verdict: "revise",
        deliverable_fit_status: "unknown",
        decision_status: "revise",
        unknowns: ["buyer_type", "domain"],
        assumptions: [],
        blocking_issues: ["incomplete_problem_brief"],
      },
    });

    // Attempt SDP with revise — must NOT advance
    await apiRequest("POST", art, {
      artifact_type: "StateDecisionPacket",
      payload: { state_id: "problem_framing", outcome: "revise" },
    });

    // assertNotState #17
    const actual = await assertNotState(sessionId, "primitive_selection",
      "AC-012/B: UNKNOWN framing — revise does not advance to primitive_selection");
    recordAC("AC-012", "B-unknown-framing-revise", "PASS",
      `state=${actual} — UNKNOWN framing revise did not advance to primitive_selection ✓`);
  }

  // ---------- Compute totals ----------

  const completedAt = new Date().toISOString();
  const passed = acResults.filter((r) => r.status === "PASS").length;
  const failed = acResults.filter((r) => r.status === "FAIL").length;
  const overallStatus = failed === 0 ? "PASS" : "FAIL";

  console.log("\n────────────────────────────────────────────────────────────────");
  console.log(`Acceptance suite complete: ${passed} passed, ${failed} failed`);
  console.log(`Overall status: ${overallStatus}`);

  // ---------- Write outputs ----------

  const artifactsDir = join(REPO_ROOT, "artifacts");
  mkdirSync(artifactsDir, { recursive: true });

  const evidenceDir = join(REPO_ROOT, "operations", "evidence");
  mkdirSync(evidenceDir, { recursive: true });

  // 1. Full trace
  writeFileSync(
    join(artifactsDir, "dev-acceptance-trace.json"),
    JSON.stringify(
      { meta: { generated_at: completedAt, worker_url: BASE_URL }, steps: trace },
      null,
      2
    )
  );

  // 2. Summary
  writeFileSync(
    join(artifactsDir, "dev-acceptance-summary.json"),
    JSON.stringify(
      {
        generated_at: completedAt,
        worker_url: BASE_URL,
        overall_status: overallStatus,
        scenarios_total: acResults.length,
        scenarios_passed: passed,
        scenarios_failed: failed,
        assertNotState_checks: 17,
        results: acResults,
      },
      null,
      2
    )
  );

  // 3. Governed evidence YAML
  const dateUtc = new Date().toISOString().slice(0, 10);
  const resultLines = acResults
    .map(
      (r) =>
        `  - ac: ${r.ac}\n    scenario: ${r.scenario}\n    status: ${r.status}\n    note: "${(r.note ?? "").replace(/"/g, '\\"')}"`
    )
    .join("\n");

  const evidenceYaml = `artifact_type: acceptance_run_output
environment: dev
date: "${dateUtc}"
generated_at: "${completedAt}"
worker_url: ${BASE_URL}
evidence_source: ACTIONS
script: scripts/evidence/run-dev-acceptance-evidence.mjs

overall_status: ${overallStatus}
scenarios_total: ${acResults.length}
scenarios_passed: ${passed}
scenarios_failed: ${failed}
assertNotState_checks: 17

prov_002_evidence:
  status: ${overallStatus}
  acceptance_criteria_covered:
    - AC-001
    - AC-002
    - AC-003
    - AC-004
    - AC-005
    - AC-006
    - AC-007
    - AC-008
    - AC-009
    - AC-010
    - AC-011
    - AC-012
  note: >
    All 12 acceptance criteria evaluated against the live dev worker.
    17 assertNotState checks confirmed fail-closed governance enforcement.
    Script is fail-closed: exits non-zero on any assertion failure.

scenario_results:
${resultLines}

governance_note: >
  Acceptance evidence is generated against the dev Cloudflare Worker.
  Overall status ${overallStatus} reflects all AC scenarios passing.
  This evidence satisfies PROV-002 (acceptance test evaluation) for dev.
  Prod provisioning (PROV-001) remains required before DEPLOY-READY STACK.
`;

  writeFileSync(join(evidenceDir, "acceptance-run-output-dev.yaml"), evidenceYaml);

  console.log(`\n✓ Outputs written:`);
  console.log(`  artifacts/dev-acceptance-trace.json`);
  console.log(`  artifacts/dev-acceptance-summary.json`);
  console.log(`  operations/evidence/acceptance-run-output-dev.yaml`);

  if (failed > 0) {
    console.error(`\n[FAIL] ${failed} acceptance scenario(s) failed. Exiting non-zero.`);
    process.exit(1);
  }
}

run().catch((err) => {
  console.error("[FATAL] Unhandled error:", err);
  process.exit(1);
});
