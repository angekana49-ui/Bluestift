import "server-only";
import { randomInt } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Email-less anonymous accounts get a synthetic, never-delivered address so
 * Supabase has an identity to mint a session against on recovery. The address
 * is never shown to the user and never treated as a "real" linked email.
 */
export const SYNTHETIC_EMAIL_DOMAIN = "anon.bluestift.local";

export function isSyntheticEmail(email?: string | null): boolean {
  return !!email && email.toLowerCase().endsWith(`@${SYNTHETIC_EMAIL_DOMAIN}`);
}

/** True when the account has a real, user-facing email (not the synthetic one). */
export function hasRealEmail(email?: string | null): boolean {
  return !!email && !isSyntheticEmail(email);
}

/** 16-char recovery code, unambiguous alphabet (no 0/O/1/I) — matches the trigger. */
function generateRecoveryCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 16; i++) code += alphabet[randomInt(alphabet.length)];
  return code;
}

/**
 * Ensure the account has a `recovery_code` — idempotent, best-effort, and
 * SESSION-SAFE (never touches auth credentials, so it never revokes the caller's
 * live session). Safe to call on every page render. Returns the code.
 */
export async function ensureRecoveryCode(userId: string): Promise<string | null> {
  try {
    const admin = createAdminClient();
    const { data: prof } = await admin
      .from("users")
      .select("recovery_code")
      .eq("id", userId)
      .maybeSingle();
    let code = prof?.recovery_code ?? null;
    if (!code) {
      code = generateRecoveryCode();
      await admin.from("users").update({ recovery_code: code }).eq("id", userId);
    }
    return code;
  } catch {
    return null;
  }
}

export type RecoverableState = {
  code: string | null;
  /** The account's auth email after provisioning (synthetic for anonymous accounts). */
  email: string | null;
  /**
   * True when a synthetic credential was just attached. IMPORTANT: attaching it
   * REVOKES the account's active session, so any caller acting on a live session
   * MUST re-mint a fresh one afterwards (see /api/auth/anon).
   */
  attached: boolean;
};

/**
 * Make an account recoverable by its recovery key — idempotent, best-effort.
 * - Ensures a `recovery_code` exists (backfills accounts the trigger missed).
 * - For an email-less anonymous account, attaches a synthetic email + a password
 *   equal to the recovery code so `/api/auth/recover` can sign it back in with no
 *   inbox (Supabase can't mint a session from a key alone). This flips the Supabase
 *   `is_anonymous` flag to false — the UI still treats the account as anonymous
 *   until a *real* email is linked (see `hasRealEmail`).
 *
 * WARNING: when `attached` is true the account's current session was revoked by
 * Supabase. Only call this where that's acceptable (recovery, which has no live
 * session) or where you immediately re-mint one.
 */
export async function ensureRecoverable(userId: string): Promise<RecoverableState> {
  try {
    const admin = createAdminClient();
    const code = await ensureRecoveryCode(userId);

    const { data: authData } = await admin.auth.admin.getUserById(userId);
    const authUser = authData?.user;
    let email = authUser?.email ?? null;
    let attached = false;

    if (authUser && !email && code) {
      email = `anon-${userId}@${SYNTHETIC_EMAIL_DOMAIN}`;
      await admin.auth.admin.updateUserById(userId, {
        email,
        password: code,
        email_confirm: true,
      });
      attached = true;
    }

    return { code, email, attached };
  } catch {
    return { code: null, email: null, attached: false };
  }
}

/**
 * On a successful email login/confirmation, record that the email is verified.
 * - `email_verified_at` is set once (if still null).
 * - `account_state` is bumped `active_unverified → active_verified` ONLY — a new
 *   user still on `onboarding_pending` is left alone so onboarding still runs.
 * Uses the service role (account_state is not user-writable). Best-effort.
 */
export async function markEmailVerified(user: {
  id: string;
  email?: string | null;
  is_anonymous?: boolean;
}): Promise<void> {
  // Only a REAL linked email confers verified status. The synthetic recovery
  // address (email-less accounts) is Supabase-confirmed but must never count.
  if (!hasRealEmail(user.email) || user.is_anonymous) return;
  try {
    const admin = createAdminClient();
    const { data: prof } = await admin
      .from("users")
      .select("account_state, email_verified_at")
      .eq("id", user.id)
      .maybeSingle();
    if (!prof) return;

    const patch: { email_verified_at?: string; account_state?: string } = {};
    if (!prof.email_verified_at) patch.email_verified_at = new Date().toISOString();
    if (prof.account_state === "active_unverified") patch.account_state = "active_verified";
    if (Object.keys(patch).length > 0) {
      await admin.from("users").update(patch).eq("id", user.id);
    }
  } catch {
    // non-fatal — never block the login redirect
  }
}
