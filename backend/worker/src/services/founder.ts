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

const STATE_PLANS: Record<PipelineState, FounderStatePlan> = {
  intake: {
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
  },
  problem_framing: {
    current_step: "await_problem_framing_decision",
    why_now:
      "The session is in problem_framing. Worker advances only after a StateDecisionPacket for problem_framing is stored with outcome=proceed.",
    next_surface: "founder_console",
    next_action: "save_state_decision_packet",
    where_to_do_it: "/session/{project_id}/artifact",
    copy_paste_block: asJsonBlock({
      artifact_type: "StateDecisionPacket",
      payload: {
        state_id: "problem_framing",
        outcome: "proceed",
      },
    }),
    evidence_to_save: ["StateDecisionPacket(problem_framing, proceed)"],
    fail_signal: null,
  },
  primitive_selection: {
    current_step: "await_primitive_selection_decision",
    why_now:
      "The session is in primitive_selection. Worker advances only after a StateDecisionPacket for primitive_selection is stored with outcome=proceed.",
    next_surface: "founder_console",
    next_action: "save_state_decision_packet",
    where_to_do_it: "/session/{project_id}/artifact",
    copy_paste_block: asJsonBlock({
      artifact_type: "StateDecisionPacket",
      payload: {
        state_id: "primitive_selection",
        outcome: "proceed",
      },
    }),
    evidence_to_save: ["StateDecisionPacket(primitive_selection, proceed)"],
    fail_signal: null,
  },
  architecture_validation: {
    current_step: "await_architecture_validation_decision",
    why_now:
      "The session is in architecture_validation. Worker advances only after a StateDecisionPacket for architecture_validation is stored with outcome=proceed.",
    next_surface: "founder_console",
    next_action: "save_state_decision_packet",
    where_to_do_it: "/session/{project_id}/artifact",
    copy_paste_block: asJsonBlock({
      artifact_type: "StateDecisionPacket",
      payload: {
        state_id: "architecture_validation",
        outcome: "proceed",
      },
    }),
    evidence_to_save: ["StateDecisionPacket(architecture_validation, proceed)"],
    fail_signal: null,
  },
  claims_validation: {
    current_step: "await_claims_validation_decision",
    why_now:
      "The session is in claims_validation. Worker advances only after a StateDecisionPacket for claims_validation is stored with outcome=proceed.",
    next_surface: "founder_console",
    next_action: "save_state_decision_packet",
    where_to_do_it: "/session/{project_id}/artifact",
    copy_paste_block: asJsonBlock({
      artifact_type: "StateDecisionPacket",
      payload: {
        state_id: "claims_validation",
        outcome: "proceed",
      },
    }),
    evidence_to_save: ["StateDecisionPacket(claims_validation, proceed)"],
    fail_signal: null,
  },
  risk_governance_validation: {
    current_step: "await_risk_governance_validation_decision",
    why_now:
      "The session is in risk_governance_validation. Worker advances only after a StateDecisionPacket for risk_governance_validation is stored with outcome=proceed.",
    next_surface: "founder_console",
    next_action: "save_state_decision_packet",
    where_to_do_it: "/session/{project_id}/artifact",
    copy_paste_block: asJsonBlock({
      artifact_type: "StateDecisionPacket",
      payload: {
        state_id: "risk_governance_validation",
        outcome: "proceed",
      },
    }),
    evidence_to_save: ["StateDecisionPacket(risk_governance_validation, proceed)"],
    fail_signal: null,
  },
  commercial_packaging: {
    current_step: "await_commercial_packaging_decision",
    why_now:
      "The session is in commercial_packaging. Worker advances only after a StateDecisionPacket for commercial_packaging is stored with outcome=proceed.",
    next_surface: "founder_console",
    next_action: "save_state_decision_packet",
    where_to_do_it: "/session/{project_id}/artifact",
    copy_paste_block: asJsonBlock({
      artifact_type: "StateDecisionPacket",
      payload: {
        state_id: "commercial_packaging",
        outcome: "proceed",
      },
    }),
    evidence_to_save: ["StateDecisionPacket(commercial_packaging, proceed)"],
    fail_signal: null,
  },
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
      current_step: STATE_PLANS[session.pipeline_state].current_step,
      why_now:
        "The session decision_status is stop. PR-3 does not reopen or close stopped sessions, so no additional founder action is exposed here.",
      next_surface: "founder_console",
      next_action: "no_supported_action_in_pr3",
      where_to_do_it: "/founder/project/{project_id}/status",
      copy_paste_block: null,
      evidence_to_save: [],
      fail_signal: "SESSION_STOPPED",
    };
  }

  if (session.decision_status === "invalidate") {
    return {
      current_step: STATE_PLANS[session.pipeline_state].current_step,
      why_now:
        "The session decision_status is invalidate. PR-3 does not implement invalidation recovery or closure handlers.",
      next_surface: "founder_console",
      next_action: "no_supported_action_in_pr3",
      where_to_do_it: "/founder/project/{project_id}/status",
      copy_paste_block: null,
      evidence_to_save: [],
      fail_signal: "SESSION_INVALIDATED",
    };
  }

  if (session.decision_status === "escalate") {
    return {
      current_step: STATE_PLANS[session.pipeline_state].current_step,
      why_now:
        "The session decision_status is escalate. PR-3 keeps escalations read-only and returns the stored Worker state without adding new escalation workflows.",
      next_surface: "founder_console",
      next_action: "review_escalation_status",
      where_to_do_it: "/founder/project/{project_id}/status",
      copy_paste_block: null,
      evidence_to_save: [],
      fail_signal: "SESSION_ESCALATED",
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

export async function getProjectStatus(
  db: Env["DECISIONS_DB"],
  project_id: string
): Promise<FounderProjectStatus | null> {
  const session = await stateService.getSession(db, project_id);
  return session ? buildFounderProjectStatus(session) : null;
}

export async function getNextAction(
  db: Env["DECISIONS_DB"],
  project_id: string
): Promise<FounderNextAction | null> {
  const session = await stateService.getSession(db, project_id);
  return session ? buildFounderNextAction(session) : null;
}
