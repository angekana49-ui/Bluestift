/**
 * Raya's tutoring personas — what the star button in the composer switches.
 *
 * Deliberately just three: this file is imported from BOTH the client (the
 * picker in chat-composer.tsx) and the server (lib/raya/prompt.ts,
 * app/api/raya/chat/route.ts), so it carries no "use client"/"server-only"
 * marker and no other import — only literal data, safe in either bundle.
 *
 * `encouraging` is the one every tier gets (RAYA_ENTITLEMENTS.*.aiModes gates
 * the other two — see lib/entitlements.ts) and it is also the persona the
 * static system prompt already describes on its own (warm feedback, gradual
 * EMT escalation), so it carries no prompt overlay of its own — see
 * MODE_OVERLAY in prompt.ts.
 */
export type AiMode = "encouraging" | "direct" | "challenging";

export const DEFAULT_AI_MODE: AiMode = "encouraging";

export type AiModeInfo = {
  id: AiMode;
  label: string;
  /** One line shown under the label in the picker. */
  blurb: string;
};

export const AI_MODES: readonly AiModeInfo[] = [
  { id: "encouraging", label: "Encouraging", blurb: "Warm and patient — the default." },
  { id: "direct", label: "Direct", blurb: "Less back-and-forth, gets to the point." },
  { id: "challenging", label: "Challenging", blurb: "Fewer hints, pushes you to go further." },
];

/** Narrows unknown input (a request body, a stored preference) to a real mode. */
export function isAiMode(v: unknown): v is AiMode {
  return typeof v === "string" && AI_MODES.some((m) => m.id === v);
}
