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
  /**
   * Diagnose only — don't let the kernel commit its own BKT updates (default true).
   * Set false when the same attempts were already sent to /update_concept_state,
   * or the evidence counts twice and mastery inflates.
   */
  commit_state?: boolean;
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
  | "fixed_mindset"
  /** Mastery estimate oscillates instead of settling — treat K as unreliable. */
  | "inconsistency_high"
  /** Student diverges from the population the parameters were calibrated on. */
  | "ood_distribution";

export interface KernelAlert {
  type: KernelAlertType | string;
  severity?: "low" | "medium" | "high" | string;
  [key: string]: unknown;
}

export type ObjectiveStatus = "met" | "at_risk" | "overdue" | "pending" | "unknown";

/** A school objective measured against the student's real mastery. */
export interface CurriculumObjective {
  concept: string;
  target_mastery: number;
  /** null when the student has no evidence on that concept yet. */
  observed_mastery: number | null;
  due_at: string | null;
  status: ObjectiveStatus;
}

/**
 * The School → AI → Student channel. Absent (null) unless the student belongs to
 * a school that has set curriculum layers, so always treat it as optional. When
 * present, `recommended_path` has already been reordered by the school's
 * priorities.
 */
export interface CurriculumContext {
  school_id: string | null;
  layers_applied: string[];
  objectives: CurriculumObjective[];
  /** Whether the detected root gap is part of the school's program. */
  root_gap_in_program: boolean | null;
  /** School instructions for Raya's prompt. */
  rules: string[];
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
  curriculum?: CurriculumContext | null;
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
/**
 * Identify the KC either by `concept_id` (a kernel.concept_nodes UUID we already
 * hold) or by `concept_label` — a plain concept name the kernel canonicalizes and
 * creates on the fly. Grading knows the concept's name, not its UUID, so the label
 * path is the normal one; the response returns the resolved id to cache.
 */
export type UpdateConceptStateRequest = {
  user_id: string;
  partial_credit_score: number; // 0..1
  is_assisted?: boolean;
  response_time_ms?: number | null;
  blocage_type?: BlocageType;
  subject?: string;
  level?: string;
} & ({ concept_id: string; concept_label?: string } | { concept_id?: string; concept_label: string });

export interface UpdateConceptStateResponse {
  user_id: string;
  concept_id: string;
  label: string;
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

// POST /load_alerts — pedagogical-safety alerts the kernel has persisted.
export type AlertSeverity = "low" | "medium" | "high";

/**
 * Exactly one scope. `user_ids` is the teacher view: staff are assigned to
 * classes, not to establishments, so a school-wide call would show a teacher
 * children they don't teach. `school_id` is the head teacher's view. Both are
 * service-only — the kernel has no staff directory, so WE prove the caller may
 * see these students before asking.
 */
export type LoadAlertsRequest = {
  include_resolved?: boolean;
  severity?: AlertSeverity;
  since?: string;
  limit?: number;
} & (
  | { user_id: string; user_ids?: never; school_id?: never }
  | { user_ids: string[]; user_id?: never; school_id?: never }
  | { school_id: string; user_id?: never; user_ids?: never }
);

/**
 * A stored alert row. Distinct from `KernelAlert`, which is the live signal
 * inside an /analyze response: this one has an id, an author who resolved it,
 * and a history.
 */
export interface PersistedAlert {
  id: string;
  user_id: string | null;
  concept_id: string | null;
  concept_label: string;
  alert_type: string;
  alert_severity: AlertSeverity | string;
  alert_details: Record<string, unknown>;
  inconsistency_rate: number | null;
  volatility_score: number | null;
  interactions_count: number | null;
  resolved: boolean;
  resolved_by: string | null;
  resolved_at: string | null;
  created_at: string | null;
}

export interface LoadAlertsResponse {
  scope: "user" | "users" | "school";
  user_id: string | null;
  school_id: string | null;
  /** How many students the call covered — surface it: 30 expected, 2 seen is a roster bug. */
  students_in_scope: number;
  alerts: PersistedAlert[];
  counts_by_type: Record<string, number>;
  counts_by_severity: Record<string, number>;
  /** The limit cut the list short. Never render a truncated list as complete. */
  truncated: boolean;
}

// POST /resolve_alert — service-only: a student must not close the alert about them.
export interface ResolveAlertRequest {
  alert_id: string;
  resolved_by: string;
  resolved?: boolean;
}

export interface ResolveAlertResponse {
  alert_id: string;
  resolved: boolean;
  resolved_by: string | null;
  resolved_at: string | null;
}
