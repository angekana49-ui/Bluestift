/**
 * The parts of the anonymous → verified upgrade that the browser and the server
 * both need: the shape of an address, the shape of a link token, and the
 * reasons a request can come back refused. No secrets, no I/O.
 */

/** 32 random bytes, base64url: 43 characters, no padding. */
export const UPGRADE_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

/** How long the emailed link stays valid. Said in the email, so kept in one place. */
export const UPGRADE_TTL_HOURS = 24;

/** Addresses are compared and stored lowercased and trimmed, as Supabase does. */
export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

/**
 * A plausibility check, not validation: the confirmation link is the only real
 * proof an address works. This catches typos the eye misses (a missing @, a
 * space, no dot after the @) before an email is spent on them.
 */
export function isPlausibleEmail(email: string): boolean {
  return email.length >= 6 && email.length <= 320 && /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/.test(email);
}

/** Why a request to upgrade was refused. */
export type UpgradeRequestError =
  | "unauthorized"
  | "already_verified"
  | "email_invalid"
  | "email_taken"
  | "password"
  | "rate_limited"
  | "email_failed"
  | "unavailable";

/** Why a confirmation link could not be used. */
export type UpgradeConfirmError =
  | "invalid"
  | "expired"
  | "email_taken"
  | "already_verified"
  | "rate_limited"
  | "unavailable";
