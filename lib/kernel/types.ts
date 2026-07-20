/**
 * TypeScript mirror of the Bluestift Kernel FastAPI contract
 * (models/schemas.py). Keep in sync with the kernel repo.
 *
 * Shared contract: `user_id` == public.users.id == auth.users.id.
 * `concept_id` refers to kernel.concept_nodes.id (KCs are created dynamically).
 */

export type Role = "user" | "assistant";
export type KCStatus = "mastered" | "partial" | "gap" | "unknown";
export type BlocageType = "conceptual" | "linguistic" | "ambiguous" | "none";

export interface KernelMessage {
  role: Role;
  content: string;
}

// POST /analyze
export interface AnalyzeRequest {
  user_id: string;
  conversation_history: KernelMessage[];
  subject?: string; // default "MATH"
  level?: string; // default "unknown"
  trigger?: string; // default "post_conversation"
}

export interface MasteryEntry {
  k_raw: number;
  k_effective: number;
  status: KCStatus;
}

export type KernelAlertType =
  | "passive_dependency"
  | "false_mastery"
  | "re_emergence_error"
  | "cognitive_overload"
  | "fixed_mindset";

export interface KernelAlert {
  type: KernelAlertType | string;
  severity?: "low" | "medium" | "high" | string;
  [key: string]: unknown;
}

export interface AnalyzeResponse {
  request_id: string;
  user_id: string;
  root_gap: string | null;
  root_concept_id: string | null;
  detection_path: string[];
  mastery_map: Record<string, MasteryEntry>;
  confidence: number;
  summary: string;
  recommended_path: string[];
  alerts: KernelAlert[];
  kernel_version: string;
  llm_used: string;
}

// POST /load_profile
export interface LoadProfileRequest {
  user_id: string;
}

export interface ConceptStateOut {
  concept_id: string;
  label: string;
  k_raw: number;
  k_effective: number;
  v_score: number;
  p_score: number;
  status: KCStatus;
  last_interaction_at: string | null;
}

export interface MindsetOut {
  m_score: number;
  detected_mindset: string;
}

export interface LoadProfileResponse {
  user_id: string;
  concept_states: ConceptStateOut[];
  mindset: MindsetOut | null;
  last_kernel_update: string | null;
}

// POST /update_concept_state
export interface UpdateConceptStateRequest {
  user_id: string;
  concept_id: string;
  partial_credit_score: number; // 0..1
  is_assisted?: boolean;
  response_time_ms?: number | null;
  blocage_type?: BlocageType;
}

export interface UpdateConceptStateResponse {
  user_id: string;
  concept_id: string;
  k_raw: number;
  k_effective: number;
  p_score: number;
  status: KCStatus;
  updated: boolean;
}

// GET /health
export interface HealthResponse {
  status: string;
  version: string;
  kernel?: string;
}

// GET /ready (deep health; 503 when degraded)
export interface ReadyResponse {
  read_ok?: boolean;
  write_ok?: boolean;
  status: "ok" | "degraded" | string;
}
