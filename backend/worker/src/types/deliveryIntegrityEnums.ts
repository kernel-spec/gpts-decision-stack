export const replacementReasons = {
  QUALITY_ISSUE: "QUALITY_ISSUE",
  MISSING_REQUIRED_SECTION: "MISSING_REQUIRED_SECTION",
  INVALID_SCHEMA: "INVALID_SCHEMA",
  HANDOFF_REJECTED: "HANDOFF_REJECTED",
  REVIEW_BLOCK: "REVIEW_BLOCK",
  SCOPE_CHANGE: "SCOPE_CHANGE",
  STAGE_MISMATCH: "STAGE_MISMATCH",
  UNKNOWN: "UNKNOWN",
} as const;

export type ReplacementReason =
  (typeof replacementReasons)[keyof typeof replacementReasons];

export const handoffFailureReasons = {
  INVALID_INPUT: "INVALID_INPUT",
  MISSING_FIELDS: "MISSING_FIELDS",
  AMBIGUOUS_OWNER: "AMBIGUOUS_OWNER",
  SCHEMA_MISMATCH: "SCHEMA_MISMATCH",
  REVIEW_REJECTED: "REVIEW_REJECTED",
  REENTRY_NOT_READY: "REENTRY_NOT_READY",
  UNKNOWN: "UNKNOWN",
} as const;

export type HandoffFailureReason =
  (typeof handoffFailureReasons)[keyof typeof handoffFailureReasons];

export const loopTypes = {
  SAME_STAGE_REPEAT: "SAME_STAGE_REPEAT",
  TWO_NODE_LOOP: "TWO_NODE_LOOP",
} as const;

export type LoopType =
  (typeof loopTypes)[keyof typeof loopTypes];

export const nextActionCodes = {
  REPAIR_SAME_STAGE: "REPAIR_SAME_STAGE",
  RETURN_TO_PREVIOUS_STAGE: "RETURN_TO_PREVIOUS_STAGE",
  REVIEW_REQUIRED: "REVIEW_REQUIRED",
  MANUAL_OVERRIDE_REQUIRED: "MANUAL_OVERRIDE_REQUIRED",
  READY_FOR_NEXT_STAGE: "READY_FOR_NEXT_STAGE",
} as const;

export type NextActionCode =
  (typeof nextActionCodes)[keyof typeof nextActionCodes];