/**
 * Recovery keys — the only way back into an email-less account.
 *
 * The people most likely to hold one are children, and the way a child saves a
 * credential is by writing it on paper and typing it back weeks later. So the
 * format is built around transcription, not around the clipboard:
 *
 * - NEVER STORED. Only a SHA-256 of the normalised key lives in
 *   `users.recovery_code_hash`, so a key can be shown once and then only
 *   replaced, never re-read (see lib/recovery-key-server.ts).
 * - SHOWN in groups of four — 7KFM-9QRT-2XBH-4DWP — because an ungrouped
 *   16-character run gets copied wrong.
 * - MATCHED after normalisation, so the dashes, spaces and lowercase that a
 *   user reasonably types are all accepted. Every entry point must normalise
 *   before comparing; the grouped display above would otherwise be rejected by
 *   the very input it teaches people to write.
 *
 * The alphabet excludes 0/O and 1/I in both cases, so there is no ambiguous
 * character to map back — a typed O or 1 is simply not a valid key character.
 */

/** Unambiguous alphabet — must stay in sync with the DB trigger and lib/auth.ts. */
export const RECOVERY_KEY_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const RECOVERY_KEY_LENGTH = 16;
/** Characters per display group. 16 / 4 = four groups. */
export const RECOVERY_KEY_GROUP = 4;

const VALID_KEY = /^[A-HJ-NP-Z2-9]{16}$/;

/**
 * Reduce anything a human typed to the stored form: upper-case, and strip every
 * separator (dashes, spaces, non-breaking spaces, tabs) they may have copied
 * along with the key.
 */
export function normalizeRecoveryKey(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/** True when the input normalises to a well-formed key. */
export function isValidRecoveryKey(input: string): boolean {
  return VALID_KEY.test(normalizeRecoveryKey(input));
}

/** Group into fours for display: 7KFM-9QRT-2XBH-4DWP. */
export function formatRecoveryKey(code: string): string {
  const clean = normalizeRecoveryKey(code);
  const groups: string[] = [];
  for (let i = 0; i < clean.length; i += RECOVERY_KEY_GROUP) {
    groups.push(clean.slice(i, i + RECOVERY_KEY_GROUP));
  }
  return groups.join("-");
}

/**
 * The last group — what we ask the user to retype as evidence they actually
 * kept the key, in place of an honour-system checkbox.
 */
export function recoveryKeyTail(code: string): string {
  return normalizeRecoveryKey(code).slice(-RECOVERY_KEY_GROUP);
}

/** Mask for the hidden state, sized to the grouped form so layout doesn't jump. */
export function maskedRecoveryKey(code: string | null): string {
  const clean = code ? normalizeRecoveryKey(code) : "";
  const len = clean.length || RECOVERY_KEY_LENGTH;
  const groups: string[] = [];
  for (let i = 0; i < len; i += RECOVERY_KEY_GROUP) {
    groups.push("•".repeat(Math.min(RECOVERY_KEY_GROUP, len - i)));
  }
  return groups.join("-");
}

/**
 * Save the key as a small text file.
 *
 * Deliberately NOT routed through lib/document.ts: those exports run through
 * `exportGate()`, which can withhold a download from a free account. A billing
 * tier must never stand between a child and their own credential, so this write
 * is plain, ungated and dependency-free.
 *
 * Browser-only — call it from an event handler.
 */
export function downloadRecoveryKey(code: string): void {
  if (typeof window === "undefined") return;
  const formatted = formatRecoveryKey(code);
  const savedOn = new Date().toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const body = [
    "Bluestift — your recovery key",
    "",
    `    ${formatted}`,
    "",
    "This key is how you get back into your account.",
    "Keep this file somewhere you won't lose it.",
    "Anyone who has this key can open your account, so keep it to yourself.",
    "",
    `Sign back in at: ${window.location.origin}/login`,
    `Saved on ${savedOn}`,
    "",
  ].join("\n");

  const url = URL.createObjectURL(new Blob([body], { type: "text/plain;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = "bluestift-recovery-key.txt";
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoke on the next tick — Safari cancels an in-flight download otherwise.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
