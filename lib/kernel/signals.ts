import type { KCStatus, LoadProfileResponse } from "./types";

/**
 * Derived learner signals — the ONE place a Kernel profile is turned into
 * something the app reasons about.
 *
 * Why this module exists
 * ----------------------
 * The Kernel measures mastery concept by concept. Everything downstream used to
 * collapse that into a single mean `k_effective` — once in the Raya prompt, once
 * again in the model router — and a mean is exactly the wrong summary. A learner
 * at 0.78 average with a prerequisite at 0.20 is the case mastery learning
 * exists to catch, and averaging is what hides it: they read as "high mastery,
 * encourage productive struggle" while sitting on a hole.
 *
 * So the teaching target is the WEAKEST ACTIVE concept, not the average, and the
 * consumers read the same derivation from here so they cannot drift apart again.
 *
 * See docs/kernel-handoff.md §5 — the contract already asked for per-KC K/V/P.
 */

/** At or above this, a concept counts as mastered and stops being a target. */
export const MASTERY_THRESHOLD = 0.8;

/** How many weak concepts reach the prompt. Enough to see a pattern, few enough
 *  that Raya still has one clear next move. */
const MAX_FOCUS = 5;

/** Mastered concepts are context, not instructions — a short list is plenty. */
const MAX_MASTERED = 8;

export type ConceptSignal = {
  label: string;
  /** k_effective — mastery corrected for slip. */
  k: number;
  /** v_score — learning rate p(T). How fast this one moves when taught. */
  v: number;
  /** p_score — resistance to slipping back, modulated by mindset. */
  p: number;
  status: KCStatus;
};

export type LearnerSignals = {
  /** Weakest active concepts, worst first. `focus[0]` is the teaching target. */
  focus: ConceptSignal[];
  /** Labels of concepts past the mastery bar — what can be built on. */
  mastered: string[];
  /** k_effective of the weakest active concept, or null with no profile.
   *  This — not a mean — is what sets the entry level and the model tier. */
  weakestK: number | null;
  /** p_score of that same concept: low K *and* low P is the fragile case. */
  weakestP: number | null;
  mindset: string | null;
  mScore: number | null;
  /** True when the Kernel has told us something about at least one concept. */
  hasProfile: boolean;
};

/** Control characters. Built from escapes rather than written as a literal so
 *  the source file itself stays plain ASCII. */
const CONTROL_CHARS = new RegExp("[\\u0000-\\u001f\\u007f]+", "g");

/**
 * Concept labels are Kernel-authored but derived from student conversations —
 * KCs are created dynamically by `get_or_create_kc()`. They land inside a system
 * prompt, so they are data crossing into an instruction channel: strip the
 * characters that could close a tag or start a new line of "instructions", and
 * clamp the length so one pathological label can't crowd out the rest.
 */
export function sanitizeConceptLabel(raw: string | null | undefined): string {
  const cleaned = (raw ?? "")
    .replace(CONTROL_CHARS, " ")
    .replace(/[<>]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned.length > 60 ? `${cleaned.slice(0, 60)}…` : cleaned;
}

function clamp01(n: number | null | undefined): number {
  if (typeof n !== "number" || Number.isNaN(n)) return 0;
  return n < 0 ? 0 : n > 1 ? 1 : n;
}

export function learnerSignals(profile: LoadProfileResponse | null): LearnerSignals {
  const states = profile?.concept_states ?? [];

  const base = {
    mindset: profile?.mindset?.detected_mindset ?? null,
    mScore: profile?.mindset?.m_score ?? null,
  };

  if (states.length === 0) {
    return { focus: [], mastered: [], weakestK: null, weakestP: null, hasProfile: false, ...base };
  }

  const active: ConceptSignal[] = [];
  const mastered: string[] = [];

  for (const state of states) {
    const label = sanitizeConceptLabel(state.label);
    if (!label) continue;
    const k = clamp01(state.k_effective);
    // The status the Kernel assigns wins, but the threshold is also checked: a
    // concept only counts as done when BOTH agree. Erring toward "still a
    // target" is the safe direction — re-teaching something known costs a turn,
    // skipping a hole costs the next three weeks.
    if (state.status === "mastered" && k >= MASTERY_THRESHOLD) {
      if (mastered.length < MAX_MASTERED) mastered.push(label);
      continue;
    }
    active.push({
      label,
      k,
      v: clamp01(state.v_score),
      p: clamp01(state.p_score),
      status: state.status,
    });
  }

  active.sort((a, b) => a.k - b.k);
  const focus = active.slice(0, MAX_FOCUS);

  return {
    focus,
    mastered,
    weakestK: focus[0]?.k ?? null,
    weakestP: focus[0]?.p ?? null,
    hasProfile: true,
    ...base,
  };
}
