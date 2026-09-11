import type { MessageKey } from "@/lib/i18n";

/**
 * One password policy, checked in the browser before the request goes out.
 *
 * It is a COURTESY, not a control: Supabase enforces its own minimum server-side
 * and that is the boundary that matters. What this buys is a specific sentence
 * instead of a round trip that comes back saying "Password should be at least 6
 * characters" in English, untranslated, under a form the person has to retype.
 *
 * Deliberately short of the usual ceremony — no required symbol, no digit quota.
 * Those rules push people towards `Password1!` and towards writing it down, and
 * this product's users include twelve-year-olds on a school machine. Length,
 * plus a refusal of the three genuinely guessable shapes, is the honest trade.
 */

/** Supabase's own default floor is 6; 8 is ours, and it is the one users see. */
export const MIN_PASSWORD_LENGTH = 8;

/**
 * The passwords an attacker tries first. Not a dictionary — a dictionary belongs
 * server-side where it can be updated without a deploy. These are the ones this
 * product will actually receive: the keyboard runs, the classics, and its own
 * name, which is always over-represented in a new product's sign-ups.
 */
const TOO_OBVIOUS = new Set([
  "password",
  "password1",
  "passw0rd",
  "12345678",
  "123456789",
  "1234567890",
  "qwertyui",
  "qwerty123",
  "azertyui",
  "iloveyou",
  "bluestift",
  "letmein1",
  "welcome1",
]);

/** The local part of an address — `ada@school.org` → `ada`. */
function localPart(email: string): string {
  return email.split("@")[0] ?? "";
}

/**
 * What is wrong with this password, as a message key — or null if nothing is.
 * The key is returned rather than a string so the caller translates it in the
 * locale the user is actually reading.
 */
export function passwordProblem(password: string, email?: string): MessageKey | null {
  if (password.length < MIN_PASSWORD_LENGTH) return "pw.err.short";

  const low = password.toLowerCase();
  if (TOO_OBVIOUS.has(low)) return "pw.err.common";
  // "aaaaaaaa", "11111111" — long enough to pass the length rule, worth nothing.
  if (new Set(low).size === 1) return "pw.err.common";

  if (email) {
    const e = email.trim().toLowerCase();
    if (low === e || (localPart(e).length >= 3 && low === localPart(e))) return "pw.err.sameAsEmail";
  }

  return null;
}

/** Convenience for disabling a submit button without formatting a message. */
export function isAcceptablePassword(password: string, email?: string): boolean {
  return passwordProblem(password, email) === null;
}
