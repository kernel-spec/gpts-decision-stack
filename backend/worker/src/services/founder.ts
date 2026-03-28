import type {
  Env,
  FounderNextAction,
  FounderProjectStatus,
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

function asJsonBlock(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function buildProblemBriefPlan(): FounderStatePlan {
  return {
    current_step: "await_problem_brief",
    why_now:
      "The session is in intake. Worker advances to problem_framing only after a ProblemBrief artifact is stored.",
    next_surface: "founder_console",
    next_action: "save_problem_brief",
    where_to_do_it: "/session/{project_id}/artifact",
    copy_paste_block: asJsonBlock({
      artifact_type: "ProblemBrief",
      payload: {},
    }),
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
    where_to_do_it: "/session/{project_id}/artifact",
    copy_paste_block: asJsonBlock({
      artifact_type: "StateDecisionPacket",
      payload: {
        state_id: state,
        outcome: "proceed",
      },
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

async function getProjectSession(
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
