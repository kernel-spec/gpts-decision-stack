import type {
  FounderDecisionRequest,
  FounderDecisionResponse,
  Env,
  FounderNextAction,
  FounderProductionClosureStatus,
  FounderProjectStatus,
  FounderSellReadyStatus,
  PipelineState,
  Session,
} from "../types/index.js";
import * as stateService from "./state.js";

type FounderStatePlan = {
  current_step: string;
  why_now: string;
  next_surface: string;
  next_action: string;
  where_to_do_it: string;
  copy_paste_block: string | null;
  evidence_to_save: string[];
  fail_signal: string | null;
};

type FounderDecisionGate = {
  decision_type: string;
  blocker: string;
  why_it_cannot_be_skipped: string;
  option_a: string;
  option_b: string;
  recommended_option: string;
};

type FounderBlockerProjection = {
  go_no_go: "no_go" | "incomplete";
  blocker: string;
  founder_decision_required: boolean;
  decision_type: string | null;
};

const PIPELINE_ORDER: PipelineState[] = [
  "intake",
  "problem_framing",
  "primitive_selection",
  "architecture_validation",
  "risk_governance_validation",
  "commercial_packaging",
  "claims_validation",
  "release_decision",
];

function asJsonBlock(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function hasReachedState(
  current: PipelineState,
  target: PipelineState
): boolean {
  return PIPELINE_ORDER.indexOf(current) >= PIPELINE_ORDER.indexOf(target);
}

function buildArtifactSet(artifactTypes: Iterable<string>): Set<string> {
  return new Set(artifactTypes);
}

function hasArtifact(
  artifactTypes: Set<string>,
  artifactType: string
): boolean {
  return artifactTypes.has(artifactType);
}

function pushIfMissing(
  missing: string[],
  condition: boolean,
  label: string
): void {
  if (!condition) {
    missing.push(label);
  }
}

function getWorkerBlockerProjection(session: Session): FounderBlockerProjection | null {
  if (session.veto_active || session.decision_status === "blocked") {
    return {
      go_no_go: "no_go",
      blocker: "active_veto",
      founder_decision_required: true,
      decision_type: "closure_exception_resolution",
    };
  }

  if (session.decision_status === "stop") {
    return {
      go_no_go: "no_go",
      blocker: "session_stopped",
      founder_decision_required: true,
      decision_type: "closure_exception_resolution",
    };
  }

  if (session.decision_status === "invalidate") {
    return {
      go_no_go: "no_go",
      blocker: "session_invalidated",
      founder_decision_required: false,
      decision_type: null,
    };
  }

  if (session.decision_status === "escalate") {
    return {
      go_no_go: "incomplete",
      blocker: "manual_escalation_pending",
      founder_decision_required: true,
      decision_type: "closure_exception_resolution",
    };
  }

  if (session.decision_status === "revise") {
    return {
      go_no_go: "incomplete",
      blocker: "revision_requested",
      founder_decision_required: false,
      decision_type: null,
    };
  }

  return null;
}

function buildSellReadyGate(): FounderDecisionGate {
  return {
    decision_type: "sell_ready_signoff",
    blocker: "founder_sell_ready_signoff_required",
    why_it_cannot_be_skipped:
      "Sell-ready cannot be declared from chat alone. Worker-backed state has reached the commercial_packaging boundary with the required sell-ready artifacts, so the founder must explicitly approve or hold the sell-ready posture.",
    option_a: "Approve sell-ready and continue from the current commercial packaging posture.",
    option_b: "Hold sell-ready and collect more evidence or revise the commercial packaging posture.",
    recommended_option:
      "Approve sell-ready and continue from the current commercial packaging posture.",
  };
}

function buildProductionClosureGate(): FounderDecisionGate {
  return {
    decision_type: "production_closure_signoff",
    blocker: "founder_production_closure_signoff_required",
    why_it_cannot_be_skipped:
      "Production closure cannot be declared from chat alone. Worker-backed state is already at release_decision, but a founder closure sign-off is still required before production can be treated as closed.",
    option_a: "Approve production closure and save a ReleaseDecision artifact.",
    option_b:
      "Keep production open and collect any remaining closure evidence before closing.",
    recommended_option:
      "Approve production closure and save a ReleaseDecision artifact.",
  };
}

function buildClosureExceptionGate(session: Session): FounderDecisionGate | null {
  const blocker = getWorkerBlockerProjection(session);
  if (!blocker?.founder_decision_required || blocker.decision_type !== "closure_exception_resolution") {
    return null;
  }

  return {
    decision_type: "closure_exception_resolution",
    blocker: blocker.blocker,
    why_it_cannot_be_skipped:
      `Worker-backed state reports ${blocker.blocker}. Closure cannot proceed until the founder explicitly resolves this exception boundary.`,
    option_a:
      "Resolve the exception and re-check canonical closure state before proceeding.",
    option_b:
      "Keep the project paused or blocked until the Worker-reported blocker is intentionally cleared.",
    recommended_option:
      blocker.go_no_go === "no_go"
        ? "Keep the project paused or blocked until the Worker-reported blocker is intentionally cleared."
        : "Resolve the exception and re-check canonical closure state before proceeding.",
  };
}

async function listProjectArtifactTypes(
  db: Env["DECISIONS_DB"],
  project_id: string
): Promise<Set<string>> {
  const canonicalRows = await db
    .prepare(`SELECT DISTINCT artifact_type FROM artifacts WHERE session_id = ?`)
    .bind(project_id)
    .all<{ artifact_type: string | null }>();
  const founderRows = await db
    .prepare(`SELECT DISTINCT artifact_type FROM founder_artifacts WHERE project_id = ?`)
    .bind(project_id)
    .all<{ artifact_type: string | null }>();

  return buildArtifactSet(
    [...canonicalRows.results, ...founderRows.results]
      .map((row) => row.artifact_type)
      .filter((artifactType): artifactType is string => typeof artifactType === "string")
  );
}

function buildFounderArtifactSaveBlock(
  artifact_type: string,
  content: unknown
): string {
  return asJsonBlock({
    artifact_type,
    metadata: {
      run_id: "[REQUIRED_RUN_ID]",
    },
    content,
    submitted_by: "founder-console",
    linked_decision_id: null,
  });
}

function buildProblemBriefPlan(): FounderStatePlan {
  return {
    current_step: "await_problem_brief",
    why_now:
      "The session is in intake. Worker advances to problem_framing only after a ProblemBrief artifact is stored.",
    next_surface: "founder_console",
    next_action: "save_problem_brief",
    where_to_do_it: "/founder/project/{project_id}/artifact",
    copy_paste_block: buildFounderArtifactSaveBlock("ProblemBrief", "[TBD]"),
    evidence_to_save: ["ProblemBrief"],
    fail_signal: null,
  };
}

function buildStateDecisionPlan(state: Exclude<PipelineState, "intake" | "release_decision">): FounderStatePlan {
  const step = `await_${state}_decision`;

  return {
    current_step: step,
    why_now:
      `The session is in ${state}. Worker advances only after a StateDecisionPacket for ${state} is stored with outcome=proceed.`,
    next_surface: "founder_console",
    next_action: "save_state_decision_packet",
    where_to_do_it: "/founder/project/{project_id}/artifact",
    copy_paste_block: buildFounderArtifactSaveBlock("StateDecisionPacket", {
        state_id: state,
        outcome: "proceed",
    }),
    evidence_to_save: [`StateDecisionPacket(${state}, proceed)`],
    fail_signal: null,
  };
}

function buildReadOnlyPlan(
  why_now: string,
  fail_signal: string,
  next_action = "no_supported_action_in_pr3"
): FounderStatePlan {
  return {
    current_step: "await_read_only_followup",
    why_now,
    next_surface: "founder_console",
    next_action,
    where_to_do_it: "/founder/project/{project_id}/status",
    copy_paste_block: null,
    evidence_to_save: [],
    fail_signal,
  };
}

const STATE_PLANS: Record<PipelineState, FounderStatePlan> = {
  intake: buildProblemBriefPlan(),
  problem_framing: buildStateDecisionPlan("problem_framing"),
  primitive_selection: buildStateDecisionPlan("primitive_selection"),
  architecture_validation: buildStateDecisionPlan("architecture_validation"),
  claims_validation: buildStateDecisionPlan("claims_validation"),
  risk_governance_validation: buildStateDecisionPlan("risk_governance_validation"),
  commercial_packaging: buildStateDecisionPlan("commercial_packaging"),
  release_decision: {
    current_step: "await_future_release_decision_handler",
    why_now:
      "The session is already at release_decision. PR-3 is read-only for founder status and next-action lookup, so closure and founder-decision persistence remain intentionally unavailable.",
    next_surface: "founder_console",
    next_action: "no_supported_action_in_pr3",
    where_to_do_it: "/founder/project/{project_id}/status",
    copy_paste_block: null,
    evidence_to_save: [],
    fail_signal: "RELEASE_DECISION_HANDLER_NOT_IMPLEMENTED",
  },
};

function getMainBlocker(session: Session): string | null {
  if (session.veto_active || session.decision_status === "blocked") {
    return "active_veto";
  }

  if (session.decision_status === "revise") {
    return "revision_requested";
  }

  if (session.decision_status === "escalate") {
    return "manual_escalation_pending";
  }

  if (session.decision_status === "invalidate") {
    return "session_invalidated";
  }

  if (session.decision_status === "stop") {
    return "session_stopped";
  }

  if (session.pipeline_state === "release_decision") {
    return "release_decision_handler_not_implemented_in_pr3";
  }

  return null;
}

function getNextActionPlan(session: Session): FounderStatePlan {
  if (session.veto_active || session.decision_status === "blocked") {
    return {
      current_step: STATE_PLANS[session.pipeline_state].current_step,
      why_now:
        "The session has an active Worker block. Forward progress is paused until the veto is released from Worker state.",
      next_surface: "worker_admin",
      next_action: "resolve_active_veto",
      where_to_do_it: "/veto/{project_id}/release",
      copy_paste_block: asJsonBlock({
        released_by: "founder-console",
      }),
      evidence_to_save: [],
      fail_signal: "SESSION_BLOCKED_BY_ACTIVE_VETO",
    };
  }

  if (session.decision_status === "stop") {
    return {
      ...buildReadOnlyPlan(
        "The session decision_status is stop. PR-3 does not reopen or close stopped sessions, so no additional founder action is exposed here.",
        "SESSION_STOPPED"
      ),
      current_step: STATE_PLANS[session.pipeline_state].current_step,
    };
  }

  if (session.decision_status === "invalidate") {
    return {
      ...buildReadOnlyPlan(
        "The session decision_status is invalidate. PR-3 does not implement invalidation recovery or closure handlers.",
        "SESSION_INVALIDATED"
      ),
      current_step: STATE_PLANS[session.pipeline_state].current_step,
    };
  }

  if (session.decision_status === "escalate") {
    return {
      ...buildReadOnlyPlan(
        "The session decision_status is escalate. PR-3 keeps escalations read-only and returns the stored Worker state without adding new escalation workflows.",
        "SESSION_ESCALATED",
        "review_escalation_status"
      ),
      current_step: STATE_PLANS[session.pipeline_state].current_step,
    };
  }

  return STATE_PLANS[session.pipeline_state];
}

export function buildFounderProjectStatus(
  session: Session
): FounderProjectStatus {
  const nextAction = getNextActionPlan(session);

  return {
    project_id: session.session_id,
    current_phase: session.pipeline_state,
    current_step: STATE_PLANS[session.pipeline_state].current_step,
    closed: false,
    open: true,
    main_blocker: getMainBlocker(session),
    next_surface: nextAction.next_surface,
    next_action: nextAction.next_action,
    founder_decision_required: false,
  };
}

export function buildFounderNextAction(session: Session): FounderNextAction {
  const plan = getNextActionPlan(session);

  return {
    why_now: plan.why_now,
    next_surface: plan.next_surface,
    next_action: plan.next_action,
    where_to_do_it: plan.where_to_do_it,
    copy_paste_block: plan.copy_paste_block,
    evidence_to_save: plan.evidence_to_save,
    fail_signal: plan.fail_signal,
    founder_decision_required: false,
  };
}

export function buildFounderSellReadyStatus(
  session: Session,
  artifactTypes: Iterable<string>
): FounderSellReadyStatus {
  const artifacts = buildArtifactSet(artifactTypes);
  const confirmed: string[] = [];
  const missing: string[] = [];
  const workerBlocker = getWorkerBlockerProjection(session);
  const reachedCommercialPackaging = hasReachedState(
    session.pipeline_state,
    "commercial_packaging"
  );
  const hasOfferDecision = hasArtifact(artifacts, "OfferDecision");
  const hasCommercialSpec = hasArtifact(artifacts, "CommercialSpec");

  if (reachedCommercialPackaging) {
    confirmed.push("worker_state_reached_commercial_packaging");
  }
  if (hasOfferDecision) {
    confirmed.push("OfferDecision");
  }
  if (hasCommercialSpec) {
    confirmed.push("CommercialSpec");
  }

  pushIfMissing(missing, reachedCommercialPackaging, "commercial_packaging_state");
  pushIfMissing(missing, hasOfferDecision, "OfferDecision");
  pushIfMissing(missing, hasCommercialSpec, "CommercialSpec");

  if (workerBlocker) {
    return {
      closure_type: "sell_ready",
      go_no_go: workerBlocker.go_no_go,
      confirmed,
      missing,
      biggest_blocker: workerBlocker.blocker,
      founder_decision_required: workerBlocker.founder_decision_required,
    };
  }

  if (missing.length > 0) {
    return {
      closure_type: "sell_ready",
      go_no_go: "incomplete",
      confirmed,
      missing,
      biggest_blocker: missing[0],
      founder_decision_required: false,
    };
  }

  if (session.pipeline_state === "commercial_packaging") {
    const gate = buildSellReadyGate();
    return {
      closure_type: "sell_ready",
      go_no_go: "incomplete",
      confirmed,
      missing,
      biggest_blocker: gate.blocker,
      founder_decision_required: true,
    };
  }

  return {
    closure_type: "sell_ready",
    go_no_go: "go",
    confirmed,
    missing,
    biggest_blocker: null,
    founder_decision_required: false,
  };
}

export function buildFounderProductionClosureStatus(
  session: Session,
  artifactTypes: Iterable<string>
): FounderProductionClosureStatus {
  const artifacts = buildArtifactSet(artifactTypes);
  const confirmed: string[] = [];
  const missing: string[] = [];
  const workerBlocker = getWorkerBlockerProjection(session);
  const reachedReleaseDecision = session.pipeline_state === "release_decision";
  const hasClaimsDecision = hasArtifact(artifacts, "ClaimsDecision");
  const hasReleaseDecision = hasArtifact(artifacts, "ReleaseDecision");

  if (reachedReleaseDecision) {
    confirmed.push("worker_state_reached_release_decision");
  }
  if (hasClaimsDecision) {
    confirmed.push("ClaimsDecision");
  }
  if (hasReleaseDecision) {
    confirmed.push("ReleaseDecision");
  }

  pushIfMissing(missing, reachedReleaseDecision, "release_decision_state");
  pushIfMissing(missing, hasClaimsDecision, "ClaimsDecision");
  pushIfMissing(missing, hasReleaseDecision, "ReleaseDecision");

  if (workerBlocker) {
    return {
      closure_type: "production_closure",
      go_no_go: workerBlocker.go_no_go,
      confirmed,
      missing,
      biggest_blocker: workerBlocker.blocker,
      founder_decision_required: workerBlocker.founder_decision_required,
      decision_type: workerBlocker.decision_type,
    };
  }

  if (missing.length > 0) {
    const founderDecisionRequired =
      reachedReleaseDecision && hasClaimsDecision && !hasReleaseDecision;
    const productionClosureGate = founderDecisionRequired
      ? buildProductionClosureGate()
      : null;
    const decision_type = productionClosureGate?.decision_type ?? null;
    const biggest_blocker = productionClosureGate?.blocker ?? missing[0];

    return {
      closure_type: "production_closure",
      go_no_go: "incomplete",
      confirmed,
      missing,
      biggest_blocker,
      founder_decision_required: founderDecisionRequired,
      decision_type,
    };
  }

  return {
    closure_type: "production_closure",
    go_no_go: "go",
    confirmed,
    missing,
    biggest_blocker: null,
    founder_decision_required: false,
    decision_type: null,
  };
}

export function buildFounderDecisionResponse(
  session: Session,
  artifactTypes: Iterable<string>,
  request: FounderDecisionRequest
): FounderDecisionResponse {
  const decisionType = request.decision_type.trim();
  const sellReady = buildFounderSellReadyStatus(session, artifactTypes);
  const productionClosure = buildFounderProductionClosureStatus(session, artifactTypes);
  const exceptionGate = buildClosureExceptionGate(session);

  if (
    decisionType === "sell_ready_signoff" &&
    sellReady.founder_decision_required &&
    sellReady.biggest_blocker === buildSellReadyGate().blocker
  ) {
    const gate = buildSellReadyGate();
    return {
      decision_needed: true,
      why_it_cannot_be_skipped: gate.why_it_cannot_be_skipped,
      option_a: gate.option_a,
      option_b: gate.option_b,
      recommended_option: gate.recommended_option,
      founder_response_required: true,
    };
  }

  if (
    decisionType === "production_closure_signoff" &&
    productionClosure.founder_decision_required &&
    productionClosure.decision_type === "production_closure_signoff"
  ) {
    const gate = buildProductionClosureGate();
    return {
      decision_needed: true,
      why_it_cannot_be_skipped: gate.why_it_cannot_be_skipped,
      option_a: gate.option_a,
      option_b: gate.option_b,
      recommended_option: gate.recommended_option,
      founder_response_required: true,
    };
  }

  if (decisionType === "closure_exception_resolution" && exceptionGate) {
    return {
      decision_needed: true,
      why_it_cannot_be_skipped: exceptionGate.why_it_cannot_be_skipped,
      option_a: exceptionGate.option_a,
      option_b: exceptionGate.option_b,
      recommended_option: exceptionGate.recommended_option,
      founder_response_required: true,
    };
  }

  return {
    decision_needed: false,
    why_it_cannot_be_skipped:
      "No active founder decision gate is justified from current Worker-backed state.",
    option_a: "Continue collecting Worker-backed evidence.",
    option_b: "Re-run the relevant closure check after canonical state changes.",
    recommended_option:
      "Re-run the relevant closure check after canonical state changes.",
    founder_response_required: false,
  };
}

export async function getProjectSession(
  db: Env["DECISIONS_DB"],
  project_id: string
): Promise<Session | null> {
  // Temporary PR-3 normalization: founder project_id resolves directly to the
  // existing Worker session_id until a distinct project identity is introduced.
  return stateService.getSession(db, project_id);
}

export async function getProjectStatus(
  db: Env["DECISIONS_DB"],
  project_id: string
): Promise<FounderProjectStatus | null> {
  const session = await getProjectSession(db, project_id);
  return session ? buildFounderProjectStatus(session) : null;
}

export async function getNextAction(
  db: Env["DECISIONS_DB"],
  project_id: string
): Promise<FounderNextAction | null> {
  const session = await getProjectSession(db, project_id);
  return session ? buildFounderNextAction(session) : null;
}

export async function checkSellReady(
  db: Env["DECISIONS_DB"],
  project_id: string
): Promise<FounderSellReadyStatus | null> {
  const session = await getProjectSession(db, project_id);
  if (!session) {
    return null;
  }

  const artifactTypes = await listProjectArtifactTypes(db, project_id);
  return buildFounderSellReadyStatus(session, artifactTypes);
}

export async function checkProductionClosure(
  db: Env["DECISIONS_DB"],
  project_id: string
): Promise<FounderProductionClosureStatus | null> {
  const session = await getProjectSession(db, project_id);
  if (!session) {
    return null;
  }

  const artifactTypes = await listProjectArtifactTypes(db, project_id);
  return buildFounderProductionClosureStatus(session, artifactTypes);
}

export async function requestFounderDecision(
  db: Env["DECISIONS_DB"],
  project_id: string,
  request: FounderDecisionRequest
): Promise<FounderDecisionResponse | null> {
  const session = await getProjectSession(db, project_id);
  if (!session) {
    return null;
  }

  const artifactTypes = await listProjectArtifactTypes(db, project_id);
  return buildFounderDecisionResponse(session, artifactTypes, request);
}
