import { describe, expect, it } from "vitest";
import type { Session } from "../types/index.js";
import {
  buildFounderDecisionResponse,
  buildFounderNextAction,
  buildFounderProductionClosureStatus,
  buildFounderProjectStatus,
  buildFounderSellReadyStatus,
} from "./founder.js";

function makeSession(overrides: Partial<Session> = {}): Session {
  return {
    session_id: "project-123",
    requestor_type: "founder-led",
    pipeline_state: "intake",
    decision_status: "unresolved",
    veto_active: false,
    created_at: "2026-03-28T00:00:00.000Z",
    updated_at: "2026-03-28T00:00:00.000Z",
    ...overrides,
  };
}

describe("founder service projections", () => {
  it("builds deterministic intake project status", () => {
    const status = buildFounderProjectStatus(makeSession());

    expect(status).toEqual({
      project_id: "project-123",
      current_phase: "intake",
      current_step: "await_problem_brief",
      closed: false,
      open: true,
      main_blocker: null,
      next_surface: "founder_console",
      next_action: "save_problem_brief",
      founder_decision_required: false,
    });
  });

  it("builds the next state-decision action from canonical pipeline state", () => {
    const action = buildFounderNextAction(
      makeSession({
        pipeline_state: "problem_framing",
        decision_status: "proceed",
      })
    );

    expect(action).toEqual({
      why_now:
        "The session is in problem_framing. Worker advances only after a StateDecisionPacket for problem_framing is stored with outcome=proceed.",
      next_surface: "founder_console",
      next_action: "save_state_decision_packet",
      where_to_do_it: "/founder/project/{project_id}/artifact",
      copy_paste_block: JSON.stringify(
        {
          artifact_type: "StateDecisionPacket",
          metadata: {
            run_id: "[REQUIRED_RUN_ID]",
          },
          content: {
            state_id: "problem_framing",
            outcome: "proceed",
          },
          submitted_by: "founder-console",
          linked_decision_id: null,
        },
        null,
        2
      ),
      evidence_to_save: ["StateDecisionPacket(problem_framing, proceed)"],
      fail_signal: null,
      founder_decision_required: false,
    });
  });

  it("builds founder-safe intake artifact routing and save payload", () => {
    const action = buildFounderNextAction(makeSession());

    expect(action).toMatchObject({
      next_surface: "founder_console",
      next_action: "save_problem_brief",
      where_to_do_it: "/founder/project/{project_id}/artifact",
      copy_paste_block: JSON.stringify(
        {
          artifact_type: "ProblemBrief",
          metadata: {
            run_id: "[REQUIRED_RUN_ID]",
          },
          content: "[TBD]",
          submitted_by: "founder-console",
          linked_decision_id: null,
        },
        null,
        2
      ),
    });
  });

  it("returns a bounded blocker action when the session is vetoed", () => {
    const status = buildFounderProjectStatus(
      makeSession({
        pipeline_state: "claims_validation",
        decision_status: "blocked",
        veto_active: true,
      })
    );
    const action = buildFounderNextAction(
      makeSession({
        pipeline_state: "claims_validation",
        decision_status: "blocked",
        veto_active: true,
      })
    );

    expect(status.main_blocker).toBe("active_veto");
    expect(status.next_surface).toBe("worker_admin");
    expect(status.next_action).toBe("resolve_active_veto");
    expect(action).toEqual({
      why_now:
        "The session has an active Worker block. Forward progress is paused until the veto is released from Worker state.",
      next_surface: "worker_admin",
      next_action: "resolve_active_veto",
      where_to_do_it: "/veto/{project_id}/release",
      copy_paste_block: JSON.stringify(
        {
          released_by: "founder-console",
        },
        null,
        2
      ),
      evidence_to_save: [],
      fail_signal: "SESSION_BLOCKED_BY_ACTIVE_VETO",
      founder_decision_required: false,
    });
  });

  it("returns an explicit bounded placeholder at release_decision", () => {
    const status = buildFounderProjectStatus(
      makeSession({
        pipeline_state: "release_decision",
        decision_status: "proceed",
      })
    );
    const action = buildFounderNextAction(
      makeSession({
        pipeline_state: "release_decision",
        decision_status: "proceed",
      })
    );

    expect(status).toMatchObject({
      current_phase: "release_decision",
      current_step: "await_future_release_decision_handler",
      main_blocker: "release_decision_handler_not_implemented_in_pr3",
      next_action: "no_supported_action_in_pr3",
    });
    expect(action.fail_signal).toBe("RELEASE_DECISION_HANDLER_NOT_IMPLEMENTED");
    expect(action.next_action).toBe("no_supported_action_in_pr3");
    expect(action.copy_paste_block).toBeNull();
  });

  it("returns incomplete sell-ready status until commercial packaging evidence exists", () => {
    const status = buildFounderSellReadyStatus(makeSession(), []);

    expect(status).toEqual({
      closure_type: "sell_ready",
      go_no_go: "incomplete",
      confirmed: [],
      missing: ["commercial_packaging_state", "OfferDecision", "CommercialSpec"],
      biggest_blocker: "commercial_packaging_state",
      founder_decision_required: false,
    });
  });

  it("raises a bounded founder sell-ready gate at commercial_packaging", () => {
    const status = buildFounderSellReadyStatus(
      makeSession({
        pipeline_state: "commercial_packaging",
        decision_status: "proceed",
      }),
      ["OfferDecision", "CommercialSpec"]
    );

    expect(status).toEqual({
      closure_type: "sell_ready",
      go_no_go: "incomplete",
      confirmed: [
        "worker_state_reached_commercial_packaging",
        "OfferDecision",
        "CommercialSpec",
      ],
      missing: [],
      biggest_blocker: "founder_sell_ready_signoff_required",
      founder_decision_required: true,
    });
  });

  it("returns go for sell-ready once worker state has advanced beyond the signoff boundary", () => {
    const status = buildFounderSellReadyStatus(
      makeSession({
        pipeline_state: "claims_validation",
        decision_status: "proceed",
      }),
      ["OfferDecision", "CommercialSpec"]
    );

    expect(status).toEqual({
      closure_type: "sell_ready",
      go_no_go: "go",
      confirmed: [
        "worker_state_reached_commercial_packaging",
        "OfferDecision",
        "CommercialSpec",
      ],
      missing: [],
      biggest_blocker: null,
      founder_decision_required: false,
    });
  });

  it("returns a bounded production closure gate at release_decision until ReleaseDecision is saved", () => {
    const status = buildFounderProductionClosureStatus(
      makeSession({
        pipeline_state: "release_decision",
        decision_status: "proceed",
      }),
      ["ClaimsDecision"]
    );

    expect(status).toEqual({
      closure_type: "production_closure",
      go_no_go: "incomplete",
      confirmed: ["worker_state_reached_release_decision", "ClaimsDecision"],
      missing: ["ReleaseDecision"],
      biggest_blocker: "founder_production_closure_signoff_required",
      founder_decision_required: true,
      decision_type: "production_closure_signoff",
    });
  });

  it("returns go for production closure when release decision evidence is stored", () => {
    const status = buildFounderProductionClosureStatus(
      makeSession({
        pipeline_state: "release_decision",
        decision_status: "proceed",
      }),
      ["ClaimsDecision", "ReleaseDecision"]
    );

    expect(status).toEqual({
      closure_type: "production_closure",
      go_no_go: "go",
      confirmed: [
        "worker_state_reached_release_decision",
        "ClaimsDecision",
        "ReleaseDecision",
      ],
      missing: [],
      biggest_blocker: null,
      founder_decision_required: false,
      decision_type: null,
    });
  });

  it("returns a bounded founder decision payload only for an active closure gate", () => {
    const sellReadyDecision = buildFounderDecisionResponse(
      makeSession({
        pipeline_state: "commercial_packaging",
        decision_status: "proceed",
      }),
      ["OfferDecision", "CommercialSpec"],
      {
        decision_type: "sell_ready_signoff",
      }
    );
    const nonDecision = buildFounderDecisionResponse(makeSession(), [], {
      decision_type: "production_closure_signoff",
    });

    expect(sellReadyDecision).toEqual({
      decision_needed: true,
      why_it_cannot_be_skipped:
        "Sell-ready cannot be declared from chat alone. Worker-backed state has reached the commercial_packaging boundary with the required sell-ready artifacts, so the founder must explicitly approve or hold the sell-ready posture.",
      option_a:
        "Approve sell-ready and continue from the current commercial packaging posture.",
      option_b:
        "Hold sell-ready and collect more evidence or revise the commercial packaging posture.",
      recommended_option:
        "Approve sell-ready and continue from the current commercial packaging posture.",
      founder_response_required: true,
    });
    expect(nonDecision).toEqual({
      decision_needed: false,
      why_it_cannot_be_skipped:
        "No active founder decision gate is justified from current Worker-backed state.",
      option_a: "Continue collecting Worker-backed evidence.",
      option_b: "Re-run the relevant closure check after canonical state changes.",
      recommended_option:
        "Re-run the relevant closure check after canonical state changes.",
      founder_response_required: false,
    });
  });
});
