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
