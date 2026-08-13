import type { KernelAlert, LoadProfileResponse } from "@/lib/kernel/types";

/**
 * Which model tier a turn deserves.
 *
 * The unit economics of per-student pricing don't survive running every turn on
 * a frontier model: at $5/$25 per MTok an actively-using student costs several
 * dollars a month on inference alone, against a $2 per-enrolled-student price.
 * But most turns don't need a frontier model. The default Socratic move is
 * "what have you tried so far?" — a small model does that as well as a large
 * one, and it is the majority of turns.
 *
 * So the spend follows the pedagogy. The Kernel already computes the signals
 * that say when a turn is hard; this reads the same ones `buildLearnerState`
 * reads, and nothing else. No new data, no extra call.
 *
 * ROUTING IS INERT UNTIL CONFIGURED. `resolveModel` falls back to the single
 * configured model for both tiers, so deploying this changes no behaviour until
 * the per-tier env vars are set — and unsetting them is the kill switch.
 */

export type ModelTier = "fast" | "deep";

export type Routing = {
  tier: ModelTier;
  /** Why this tier — emitted with the turn so the split is auditable, and so a
   *  cost regression can be traced to a rule rather than guessed at. */
  reason: string;
};

/** Below this average mastery the student is struggling, and the prompt asks for
 *  worked examples and goal-free prompts — the moves that most reward a stronger
 *  model, because a clumsy worked example teaches the wrong thing. */
const STRUGGLING_MASTERY = 0.4;

export function routeTier(
  profile: LoadProfileResponse | null,
  alerts: KernelAlert[] = [],
): Routing {
  // An active alert is the tutor's highest-stakes turn: the system prompt tells
  // Raya to prioritise handling it *this turn*. Retesting false mastery on a
  // held-out context, decomposing an overloaded task, reframing a fixed mindset
  // before a retry — these are the turns where a cheap wrong move costs the
  // student more than the model saved.
  const active = alerts.map((a) => a.type).filter(Boolean);
  if (active.length > 0) {
    return { tier: "deep", reason: `alert:${active.join(",")}` };
  }

  const states = profile?.concept_states ?? [];
  if (states.length > 0) {
    const avgK = states.reduce((s, c) => s + (c.k_effective ?? 0), 0) / states.length;
    if (avgK < STRUGGLING_MASTERY) {
      return { tier: "deep", reason: `low_mastery:${avgK.toFixed(2)}` };
    }
  }

  // Tracked per student rather than per concept: a learner who reads struggle as
  // proof of failure needs the careful version of every turn, not just the ones
  // that tripped an alert.
  if (profile?.mindset?.detected_mindset === "fixed") {
    return { tier: "deep", reason: "mindset:fixed" };
  }

  // The common case, and the one the pricing depends on being cheap: a student
  // holding their own, getting pumped for what they already know.
  return { tier: "fast", reason: "default" };
}
