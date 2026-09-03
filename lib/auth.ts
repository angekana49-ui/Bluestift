import "server-only";
import { randomBytes } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateRecoveryKey, hashRecoveryKey } from "@/lib/recovery-key-server";
import { isValidRecoveryKey } from "@/lib/recovery-key";

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

/**
 * The synthetic account's password is a throwaway secret the user never sees and
 * never needs. It used to BE the recovery key, which is what made storing that
 * key in cleartext so costly: one read of a column was a working credential.
 * They are now decoupled — the key identifies the account, and the session is
 * minted admin-side (see `/api/auth/recover`), so the password authenticates
 * nothing a user ever types.
 */
function syntheticPassword(): string {
  return randomBytes(36).toString("base64url");
}

/** Columns of the users row that describe the key, without ever exposing it. */
type RecoveryKeyState = { hasKey: boolean; issuedAt: string | null; hasKeyword: boolean };

export async function recoveryKeyState(userId: string): Promise<RecoveryKeyState> {
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("users")
      .select("recovery_code_hash, recovery_code_issued_at, recovery_keyword_set_at")
      .eq("id", userId)
      .maybeSingle();
    return {
      hasKey: Boolean(data?.recovery_code_issued_at),
      issuedAt: data?.recovery_code_issued_at ?? null,
      // Whether a word EXISTS, never the word or its hash — that is the only
      // fact the client needs, and the only one it is allowed (the column's
      // SELECT is revoked for authenticated roles).
      hasKeyword: Boolean(data?.recovery_keyword_set_at),
    };
  } catch {
    return { hasKey: false, issuedAt: null, hasKeyword: false };
  }
}

/**
 * Mint a NEW recovery key, store only its hash, and return the cleartext — the
 * single moment it exists anywhere. Any previous key stops working immediately.
 *
 * SESSION-SAFE on its own: it writes two columns and touches no auth credential.
 * The caller is responsible for rotating the synthetic password when it replaces
 * a key on a legacy account (see `/api/account/recovery-key`), because THAT is
 * what revokes the session.
 */
export async function issueRecoveryKey(userId: string): Promise<string | null> {
  try {
    const admin = createAdminClient();
    const code = generateRecoveryKey();
    const { error } = await admin
      .from("users")
      .update({
        recovery_code_hash: hashRecoveryKey(code),
        recovery_code_issued_at: new Date().toISOString(),
      })
      .eq("id", userId);
    if (error) return null;
    return code;
  } catch {
    return null;
  }
}

/**
 * Give the owner a key the first time, and only the first time.
 *
 * Idempotent and session-safe, so it stays callable from a page render. Returns
 * the cleartext ONLY on the render that issues it; afterwards it returns null
 * forever, because the key is not stored and cannot be shown again. A user who
 * loses it regenerates from /account rather than re-reading it.
 *
 * `handle_new_user` still writes a generated key at signup, which the DB trigger
 * turns into a hash nobody has seen — so `recovery_code_issued_at`, not the
 * presence of a hash, is what marks a key as actually delivered.
 */
export async function ensureRecoveryKeyIssued(userId: string): Promise<string | null> {
  const { hasKey } = await recoveryKeyState(userId);
  if (hasKey) return null;
  return issueRecoveryKey(userId);
}

/**
 * Resolve an account from a key its owner typed. Returns null for anything
 * malformed without touching the database, so a junk-key flood costs no query.
 */
export async function findUserIdByRecoveryKey(code: string): Promise<string | null> {
  if (!isValidRecoveryKey(code)) return null;
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("users")
      .select("id")
      .eq("recovery_code_hash", hashRecoveryKey(code))
      .maybeSingle();
    return data?.id ?? null;
  } catch {
    return null;
  }
}

/**
 * Point the synthetic credential at a fresh password, killing any older key that
 * still happens to double as one. Legacy accounts were provisioned with
 * `password = recovery key`, and Supabase's password sign-in is reachable
 * straight from the browser with the anon key — so rotating the key WITHOUT
 * rotating the password would leave the old key working. Returns the account's
 * email so the caller can re-mint the session this revokes.
 */
export async function rotateSyntheticPassword(userId: string): Promise<string | null> {
  try {
    const admin = createAdminClient();
    const { data } = await admin.auth.admin.getUserById(userId);
    const email = data?.user?.email ?? null;
    if (!email || hasRealEmail(email)) return null; // real email: nothing synthetic to rotate
    await admin.auth.admin.updateUserById(userId, { password: syntheticPassword() });
    return email;
  } catch {
    return null;
  }
}

export type RecoverableState = {
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
 * Give an email-less anonymous account an identity Supabase can mint a session
 * against: a synthetic address plus a throwaway password. Idempotent,
 * best-effort. Flips Supabase's `is_anonymous` to false — the UI still treats
 * the account as anonymous until a *real* email is linked (`hasRealEmail`).
 *
 * It no longer touches the recovery key. The key used to be installed here as
 * the password, which forced signup to be the moment the key was minted and made
 * the two impossible to rotate separately. Now the key is issued where it is
 * actually shown (`ensureRecoveryKeyIssued`, from the onboarding render) and
 * recovery mints its session admin-side, so nothing here needs to know it.
 *
 * WARNING: when `attached` is true the account's current session was revoked by
 * Supabase. Only call this where that's acceptable (recovery, which has no live
 * session) or where you immediately re-mint one.
 */
export async function ensureRecoverable(userId: string): Promise<RecoverableState> {
  try {
    const admin = createAdminClient();
    const { data: authData } = await admin.auth.admin.getUserById(userId);
    const authUser = authData?.user;
    let email = authUser?.email ?? null;
    let attached = false;

    if (authUser && !email) {
      email = `anon-${userId}@${SYNTHETIC_EMAIL_DOMAIN}`;
      await admin.auth.admin.updateUserById(userId, {
        email,
        password: syntheticPassword(),
        email_confirm: true,
      });
      attached = true;
    }

    return { email, attached };
  } catch {
    return { email: null, attached: false };
  }
}

/**
 * Mint session cookies for an account without a password or an inbox: generate a
 * magic link admin-side and immediately consume it. This is how recovery signs a
 * key-holder back in, and how a credential rotation re-establishes the session it
 * just revoked. The SSR client writes the cookies onto the response the caller
 * returns, so the caller MUST return that response for the session to stick.
 */
export async function mintSessionFor(
  supabase: { auth: { verifyOtp: (a: { type: "magiclink"; token_hash: string }) => Promise<{ error: unknown }> } },
  email: string,
): Promise<boolean> {
  try {
    const admin = createAdminClient();
    const { data: link, error: linkErr } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email,
    });
    const tokenHash = link?.properties?.hashed_token;
    if (linkErr || !tokenHash) return false;
    const { error } = await supabase.auth.verifyOtp({ type: "magiclink", token_hash: tokenHash });
    return !error;
  } catch {
    return false;
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
