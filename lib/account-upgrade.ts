import "server-only";
import { createHash, randomBytes } from "node:crypto";
import type { User } from "@supabase/supabase-js";
import { createAdminClient, adminRpc } from "@/lib/supabase/admin";
import { ensureRecoverable, hasRealEmail, mintSessionFor, syncAccountStatus } from "@/lib/auth";
import { passwordProblem } from "@/lib/password";
import { sendBrandedEmail } from "@/lib/email";
import { checkStrictUserRateLimit } from "@/lib/rate-limit";
import type { MessageKey } from "@/lib/i18n";
import {
  UPGRADE_TOKEN_PATTERN,
  UPGRADE_TTL_HOURS,
  isPlausibleEmail,
  normalizeEmail,
  type UpgradeConfirmError,
  type UpgradeRequestError,
} from "@/lib/account-upgrade-shared";

/**
 * Anonymous → verified, keeping everything (owner decision, 2026-09-13).
 *
 * Teenagers barely use email, so an account starts anonymous and is recovered
 * with a key. Paying needs an address, so the same account can later gain an
 * email and a password — same user id, so every conversation, test and profile
 * stays attached. Nothing is copied; nothing moves.
 *
 * Why this is ours and not `supabase.auth.updateUser({ email })`: the account
 * carries a confirmed synthetic address (lib/auth.ts) so its recovery key can
 * mint sessions, and Secure email change asks the CURRENT address to confirm
 * too. That address receives nothing, so the change could never finish
 * (probed 2026-09-13). Here the swap happens admin-side, once the new address
 * has proven itself through a link, and works from any device.
 *
 * The recovery key is untouched from start to finish, and keeps working after
 * the upgrade (/api/auth/recover signs in with it directly).
 *
 * Two steps:
 *   1. request — the password is set on the account now (so the link cannot
 *      finish an account without one), the session that rotation revokes is
 *      re-minted, and one email goes out. The synthetic address stays: until the
 *      link is used, the account is exactly as recoverable as before.
 *   2. confirm — the address replaces the synthetic one, confirmed, and the
 *      device that opened the link is signed in. The status trigger
 *      (sync_account_status) turns the account verified.
 */

type SessionClient = Parameters<typeof mintSessionFor>[0];
type Translate = (key: MessageKey) => string;

export function hashUpgradeToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function newUpgradeToken(): string {
  return randomBytes(32).toString("base64url");
}

export type UpgradeRequestResult =
  | { ok: true; email: string; signedIn: boolean }
  | { ok: false; status: number; code: UpgradeRequestError; problem?: MessageKey };

export async function requestAccountUpgrade(opts: {
  supabase: SessionClient;
  user: Pick<User, "id" | "email">;
  email: string;
  password: string;
  origin: string;
  tr: Translate;
}): Promise<UpgradeRequestResult> {
  const { supabase, user, origin, tr } = opts;
  if (hasRealEmail(user.email)) return { ok: false, status: 409, code: "already_verified" };

  const email = normalizeEmail(opts.email);
  if (!isPlausibleEmail(email)) return { ok: false, status: 400, code: "email_invalid" };
  const problem = passwordProblem(opts.password, email);
  if (problem) return { ok: false, status: 400, code: "password", problem };

  // Each request sends an email, and the free sending quota is shared by the
  // whole product. Five a day is plenty for typos and a lost message.
  if (!(await checkStrictUserRateLimit("account_upgrade", user.id, 5, "24 hours"))) {
    return { ok: false, status: 429, code: "rate_limited" };
  }

  const admin = createAdminClient();
  const { data: taken, error: takenErr } = await adminRpc<boolean>(admin, "auth_email_taken", {
    p_email: email,
    p_user_id: user.id,
  });
  if (takenErr) return { ok: false, status: 503, code: "unavailable" };
  if (taken) return { ok: false, status: 409, code: "email_taken" };

  // The account's sign-in identity until the link is used. Normally already
  // attached at signup; a legacy account without one gets it now.
  const { email: synthetic } = await ensureRecoverable(user.id);
  if (!synthetic) return { ok: false, status: 503, code: "unavailable" };

  const { error: pwErr } = await admin.auth.admin.updateUserById(user.id, { password: opts.password });
  if (pwErr) {
    // Supabase applies its own policy too; ours is meant to match it.
    if ((pwErr as { code?: string }).code === "weak_password") {
      return { ok: false, status: 400, code: "password", problem: "pw.err.mix" };
    }
    return { ok: false, status: 503, code: "unavailable" };
  }
  // Setting a password revokes every session of the account (probed): put this
  // browser's back, on this response, as /api/account/recovery-key does.
  const signedIn = await mintSessionFor(supabase, synthetic);

  const token = newUpgradeToken();
  const { error: rowErr } = await admin.from("account_upgrades").upsert(
    {
      user_id: user.id,
      email,
      token_hash: hashUpgradeToken(token),
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + UPGRADE_TTL_HOURS * 3600_000).toISOString(),
    },
    { onConflict: "user_id" },
  );
  if (rowErr) return { ok: false, status: 503, code: "unavailable" };

  const sent = await sendBrandedEmail({
    brand: "bluestift",
    to: email,
    subject: tr("email.upgrade.subject"),
    heading: tr("email.upgrade.heading"),
    lines: [tr("email.upgrade.line1"), tr("email.upgrade.line2"), tr("email.upgrade.line3")],
    cta: { label: tr("email.upgrade.cta"), url: `${origin}/upgrade/confirm?token=${token}` },
  });
  if (!sent.ok) {
    // A link nobody received must not stay usable.
    await admin.from("account_upgrades").delete().eq("user_id", user.id);
    return { ok: false, status: sent.skipped ? 503 : 502, code: sent.skipped ? "unavailable" : "email_failed" };
  }

  return { ok: true, email, signedIn };
}

type UpgradeRow = { user_id: string; email: string; expires_at: string };

/** Read-only: what a link leads to. Used to render the confirmation page. */
export async function peekAccountUpgrade(
  token: string,
): Promise<{ ok: true; email: string } | { ok: false; code: "invalid" | "expired" | "unavailable" }> {
  if (!UPGRADE_TOKEN_PATTERN.test(token)) return { ok: false, code: "invalid" };
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("account_upgrades")
      .select("user_id, email, expires_at")
      .eq("token_hash", hashUpgradeToken(token))
      .maybeSingle();
    if (error) return { ok: false, code: "unavailable" };
    const row = data as UpgradeRow | null;
    if (!row) return { ok: false, code: "invalid" };
    if (new Date(row.expires_at).getTime() < Date.now()) return { ok: false, code: "expired" };
    return { ok: true, email: row.email };
  } catch {
    return { ok: false, code: "unavailable" };
  }
}

export type UpgradeConfirmResult =
  | { ok: true; userId: string; email: string; signedIn: boolean }
  | { ok: false; status: number; code: UpgradeConfirmError };

/**
 * Use a link. Deliberately a POST behind a button on the page the link opens,
 * never the GET itself: mail scanners open links to inspect them, and a GET
 * that swapped the address would be used up by a robot before its owner saw it.
 */
export async function confirmAccountUpgrade(opts: {
  supabase: SessionClient;
  token: string;
}): Promise<UpgradeConfirmResult> {
  if (!UPGRADE_TOKEN_PATTERN.test(opts.token)) return { ok: false, status: 404, code: "invalid" };
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("account_upgrades")
    .select("user_id, email, expires_at")
    .eq("token_hash", hashUpgradeToken(opts.token))
    .maybeSingle();
  if (error) return { ok: false, status: 503, code: "unavailable" };
  const row = data as UpgradeRow | null;
  if (!row) return { ok: false, status: 404, code: "invalid" };

  const drop = () => admin.from("account_upgrades").delete().eq("user_id", row.user_id);

  if (new Date(row.expires_at).getTime() < Date.now()) {
    await drop();
    return { ok: false, status: 410, code: "expired" };
  }

  const { data: authData, error: authErr } = await admin.auth.admin.getUserById(row.user_id);
  if (authErr || !authData?.user) {
    await drop();
    return { ok: false, status: 404, code: "invalid" };
  }
  const current = authData.user.email ?? null;

  if (hasRealEmail(current)) {
    await drop();
    // Opened twice: the first click already did it. Sign this device in too.
    if (normalizeEmail(current!) === row.email) {
      const signedIn = await mintSessionFor(opts.supabase, row.email);
      return { ok: true, userId: row.user_id, email: row.email, signedIn };
    }
    return { ok: false, status: 409, code: "already_verified" };
  }

  // Someone else may have taken the address since the request.
  const { data: taken, error: takenErr } = await adminRpc<boolean>(admin, "auth_email_taken", {
    p_email: row.email,
    p_user_id: row.user_id,
  });
  if (takenErr) return { ok: false, status: 503, code: "unavailable" };
  if (taken) {
    await drop();
    return { ok: false, status: 409, code: "email_taken" };
  }

  // The swap. Admin-side, confirmed: the link was the proof. Does not revoke
  // the account's sessions (probed), so the tab that asked stays signed in and
  // sees the new address on its next refresh.
  const { error: swapErr } = await admin.auth.admin.updateUserById(row.user_id, {
    email: row.email,
    email_confirm: true,
  });
  if (swapErr) return { ok: false, status: 503, code: "unavailable" };
  await drop();

  // The trigger on auth.users has already run this; calling it is a no-op then,
  // and the repair if the trigger is ever missing.
  await syncAccountStatus({ id: row.user_id, email: row.email, email_confirmed_at: new Date().toISOString() });

  const signedIn = await mintSessionFor(opts.supabase, row.email);
  return { ok: true, userId: row.user_id, email: row.email, signedIn };
}
