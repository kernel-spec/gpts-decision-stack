// Cloudflare Workers environment bindings
export interface Env {
  DECISIONS_DB: D1Database;
  ARTIFACTS_BUCKET: R2Bucket;
  POLICY_STORE: KVNamespace;
  API_KEY_SECRET: string;
}

// ---------- Session / Pipeline ----------

export type PipelineState =
  | "intake"
  | "problem_framing"
  | "primitive_selection"
  | "architecture_validation"
  | "claims_validation"
  | "risk_governance_validation"
  | "commercial_packaging"
  | "release_decision";

export type DecisionStatus =
  | "proceed"
  | "revise"
  | "invalidate"
  | "escalate"
  | "stop"
  | "unresolved"
  | "blocked";

export type RequestorType =
  | "founder-led"
  | "enterprise"
  | "regulated"
  | "enablement";

export const VALID_REQUESTOR_TYPES: readonly RequestorType[] = [
  "founder-led",
  "enterprise",
  "regulated",
  "enablement",
];

export interface Session {
  session_id: string;
  requestor_type: RequestorType;
  pipeline_state: PipelineState;
  decision_status: DecisionStatus;
  veto_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateSessionRequest {
  requestor_type: RequestorType;
  external_ref?: string | null;
}

export interface ReentryRequest {
  from_state: PipelineState;
  to_state: PipelineState;
  reason: string;
  agent_id: string;
}

// ---------- Artifacts ----------

export type ArtifactType =
  | "ProblemBrief"
  | "FramingAssessment"
  | "OfferDecision"
  | "ArchitectureSpec"
  | "ClaimsDecision"
  | "RiskDecision"
  | "CommercialSpec"
  | "ReviewTopologyPlan"
  | "StateDecisionPacket"
  | "ReleaseDecision";

export type ReplacementReason =
  | "INVALID_SCHEMA"
  | "MISSING_REQUIRED_SECTION"
  | "STAGE_MISMATCH"
  | "REVIEW_BLOCK"
  | "HANDOFF_REJECTED"
  | "SCOPE_CHANGE"
  | "QUALITY_ISSUE";

export const REPLACEMENT_REASONS: readonly ReplacementReason[] = [
  "INVALID_SCHEMA",
  "MISSING_REQUIRED_SECTION",
  "STAGE_MISMATCH",
  "REVIEW_BLOCK",
  "HANDOFF_REJECTED",
  "SCOPE_CHANGE",
  "QUALITY_ISSUE",
];

export type HandoffFailureReason =
  | "SCHEMA_MISMATCH"
  | "MISSING_FIELDS"
  | "AMBIGUOUS_OWNER"
  | "REVIEW_REJECTED"
  | "REENTRY_NOT_READY"
  | "INVALID_INPUT";

export const HANDOFF_FAILURE_REASONS: readonly HandoffFailureReason[] = [
  "SCHEMA_MISMATCH",
  "MISSING_FIELDS",
  "AMBIGUOUS_OWNER",
  "REVIEW_REJECTED",
  "REENTRY_NOT_READY",
  "INVALID_INPUT",
];

export type DeliveryHandoffStatus = "pending" | "completed" | "failed";

export const DELIVERY_HANDOFF_STATUSES: readonly DeliveryHandoffStatus[] = [
  "pending",
  "completed",
  "failed",
];

export interface DeliveryIntegrityInput {
  attempt?: number | null;
  supersedes_artifact_id?: string | null;
  replacement_reason?: ReplacementReason | null;
  handoff_status?: DeliveryHandoffStatus | null;
  handoff_failure_reason?: HandoffFailureReason | null;
}

// ---------- Delivery Integrity — Artifact Attempt ----------

export interface ParserVerdict {
  schema_valid: boolean;
  required_sections_present: boolean;
  stage_matches_expected: boolean;
  reentry_ready: boolean;
}

export interface ReviewVerdict {
  status: "APPROVED" | "REJECTED" | "NOT_REQUIRED" | "PENDING";
  blocking?: boolean | null;
}

export interface TransitionContext {
  handoff_rejected?: boolean | null;
}

export interface ArtifactAttemptInput {
  run_id: string;
  stage: string;
  artifact_id: string;
  artifact_type: string;
  created_by_role: string;
  parser_verdict: ParserVerdict;
  review_verdict: ReviewVerdict;
  scope_fingerprint_changed?: boolean | null;
  transition_context?: TransitionContext | null;
  override_flag?: boolean | null;
}

export interface ArtifactLineageRecord {
  lineage_id: string;
  run_id: string;
  artifact_id: string;
  artifact_type: string;
  stage: string;
  attempt: number;
  supersedes_artifact_id: string | null;
  created_at: string;
  created_by_role: string;
  classified_by: "orchestration";
  replacement_reason: ReplacementReason | null;
  replacement_reason_source: string | null;
  is_repair_attempt: boolean;
  is_first_attempt_in_stage: boolean;
  override_flag: boolean;
}

export type DeliveryEvent =
  | {
      type: "artifact_attempt_created";
      lineage_id: string;
      artifact_id: string;
      run_id: string;
      stage: string;
      attempt: number;
    }
  | {
      type: "artifact_superseded";
      lineage_id: string;
      artifact_id: string;
      supersedes_artifact_id: string;
      replacement_reason: ReplacementReason;
      run_id: string;
      stage: string;
    };

export interface Artifact {
  id: string;
  session_id: string;
  artifact_type: ArtifactType;
  payload: unknown;
  submitted_at: string;
}

export interface SubmitArtifactRequest {
  artifact_type: ArtifactType;
  payload: unknown;
  delivery?: DeliveryIntegrityInput | null;
  parser_verdict?: ParserVerdict | null;
  review_verdict?: ReviewVerdict | null;
  scope_fingerprint_changed?: boolean | null;
  transition_context?: TransitionContext | null;
}

// ---------- Decision Log ----------

export interface DecisionLogEntry {
  id: string;
  session_id: string;
  agent_id: string;
  action: string;
  pipeline_state: PipelineState;
  decision_status: DecisionStatus;
  notes?: string;
  logged_at: string;
}

export interface AppendDecisionLogRequest {
  agent_id: string;
  action: string;
  pipeline_state: PipelineState;
  decision_status: DecisionStatus;
  notes?: string;
}

// ---------- Veto ----------

export interface VetoRecord {
  session_id: string;
  is_active: boolean;
  activated_by?: string;
  activated_at?: string;
  reason?: string;
  released_by?: string;
  released_at?: string;
}

export interface ActivateVetoRequest {
  activated_by: string;
  reason: string;
}

export interface ReleaseVetoRequest {
  released_by: string;
  release_reason: string;
}

// ---------- Approvals ----------

export type ApprovalDecision = "approved" | "rejected" | "conditional";

export interface Approval {
  id: string;
  session_id: string;
  approval_type: string;
  submitted_by: string;
  decision: ApprovalDecision;
  notes?: string;
  submitted_at: string;
}

export interface SubmitApprovalRequest {
  approval_type: string;
  submitted_by: string;
  decision: ApprovalDecision;
  notes?: string;
}

// ---------- Founder surface ----------

export interface FounderProjectStatus {
  project_id: string;
  current_phase: string;
  current_step: string;
  closed: boolean;
  open: boolean;
  main_blocker: string | null;
  next_surface: string;
  next_action: string;
  founder_decision_required: boolean;
}

export interface FounderNextAction {
  why_now: string;
  next_surface: string;
  next_action: string;
  where_to_do_it: string;
  copy_paste_block: string | null;
  evidence_to_save: string[];
  fail_signal: string | null;
  founder_decision_required: boolean;
}

export interface FounderArtifactMetadataInput {
  run_id: string;
  source_surface?: string | null;
  source_role?: string | null;
  status?: string | null;
  delivery?: DeliveryIntegrityInput | null;
}

export interface FounderArtifactSaveRequest {
  artifact_type: string;
  metadata: FounderArtifactMetadataInput;
  content: unknown;
  submitted_by: string;
  linked_decision_id?: string | null;
}

export interface FounderArtifactSaveResult {
  artifact_id: string;
  status: string;
  version: number;
  storage_path: string;
  linked_decision_id: string | null;
}

export interface FounderArtifactRecord {
  artifact_id: string;
  project_id: string;
  run_id: string;
  artifact_type: string;
  source_surface: string;
  source_role: string;
  status: string;
  version: number;
  created_at: string;
  storage_path: string;
  linked_decision_id: string | null;
}

export interface FounderModelOutputRecordRequest {
  run_id: string;
  role_name: string;
  output_type: string;
  raw_output: unknown;
  operator_notes?: string | null;
}

export interface FounderModelOutputRecordResult {
  record_id: string;
  status: string;
  linked_run_id: string | null;
  suggested_artifact_update: string | null;
  founder_decision_required: boolean;
}

export type FounderClosureGoNoGo = "go" | "no_go" | "incomplete";

export interface FounderSellReadyStatus {
  closure_type: "sell_ready";
  go_no_go: FounderClosureGoNoGo;
  confirmed: string[];
  missing: string[];
  biggest_blocker: string | null;
  founder_decision_required: boolean;
}

export interface FounderProductionClosureStatus {
  closure_type: "production_closure";
  go_no_go: FounderClosureGoNoGo;
  confirmed: string[];
  missing: string[];
  biggest_blocker: string | null;
  founder_decision_required: boolean;
  decision_type: string | null;
}

export interface FounderDecisionRequest {
  decision_type: string;
  decision_context?: string | null;
  requested_by?: string | null;
}

export interface FounderDecisionResponse {
  decision_needed: boolean;
  why_it_cannot_be_skipped: string;
  option_a: string;
  option_b: string;
  recommended_option: string;
  founder_response_required: boolean;
}

// ---------- API responses ----------

export interface ApiSuccess<T> {
  ok: true;
  data: T;
}

export interface ApiError {
  ok: false;
  error: string;
  code: string;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;
