import { describe, expect, it } from "vitest";
import type { Session } from "../types/index.js";
import {
  buildFounderNextAction,
  buildFounderProjectStatus,
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
});
