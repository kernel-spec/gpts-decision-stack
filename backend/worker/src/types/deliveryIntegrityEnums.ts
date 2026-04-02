// replacementReasons and handoffFailureReasons must stay in sync with the
// canonical arrays in index.ts. The `satisfies` constraint is a compile-time
// drift guard: adding or removing a key here without updating index.ts (or
// vice-versa) will produce a type error.
export type { ReplacementReason, HandoffFailureReason } from "./index";
import type { ReplacementReason, HandoffFailureReason } from "./index";

export const replacementReasons = {
  INVALID_SCHEMA: "INVALID_SCHEMA",
  MISSING_REQUIRED_SECTION: "MISSING_REQUIRED_SECTION",
  STAGE_MISMATCH: "STAGE_MISMATCH",
  REVIEW_BLOCK: "REVIEW_BLOCK",
  HANDOFF_REJECTED: "HANDOFF_REJECTED",
  SCOPE_CHANGE: "SCOPE_CHANGE",
  QUALITY_ISSUE: "QUALITY_ISSUE",
} as const satisfies Record<ReplacementReason, ReplacementReason>;

export const handoffFailureReasons = {
  SCHEMA_MISMATCH: "SCHEMA_MISMATCH",
  MISSING_FIELDS: "MISSING_FIELDS",
  AMBIGUOUS_OWNER: "AMBIGUOUS_OWNER",
  REVIEW_REJECTED: "REVIEW_REJECTED",
  REENTRY_NOT_READY: "REENTRY_NOT_READY",
  INVALID_INPUT: "INVALID_INPUT",
} as const satisfies Record<HandoffFailureReason, HandoffFailureReason>;

export const loopTypes = {
  SAME_STAGE_REPEAT: "SAME_STAGE_REPEAT",
  TWO_NODE_LOOP: "TWO_NODE_LOOP",
} as const;

export type LoopType = (typeof loopTypes)[keyof typeof loopTypes];

export const nextActionCodes = {
  REPAIR_SAME_STAGE: "REPAIR_SAME_STAGE",
  RETURN_TO_PREVIOUS_STAGE: "RETURN_TO_PREVIOUS_STAGE",
  REVIEW_REQUIRED: "REVIEW_REQUIRED",
  MANUAL_OVERRIDE_REQUIRED: "MANUAL_OVERRIDE_REQUIRED",
  READY_FOR_NEXT_STAGE: "READY_FOR_NEXT_STAGE",
} as const;

export type NextActionCode = (typeof nextActionCodes)[keyof typeof nextActionCodes];