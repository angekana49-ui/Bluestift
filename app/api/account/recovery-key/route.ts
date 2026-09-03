import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { issueRecoveryKey, mintSessionFor, rotateSyntheticPassword } from "@/lib/auth";
import {
  KEYWORD_MIN_LENGTH,
  hashKeyword,
  isValidKeyword,
  verifyKeyword,
} from "@/lib/recovery-keyword";
import { checkStrictUserRateLimit } from "@/lib/rate-limit";
import { captureServer } from "@/lib/analytics/server";

export const runtime = "nodejs";

/**
 * Generate a fresh recovery key for the signed-in account and return it ONCE.
 *
 * This replaces the old "reveal my key" affordance, which could only exist while
 * the key was stored in cleartext. Only its hash is kept now, so there is nothing
 * to reveal — a user who lost their key gets a new one, and the old one dies.
 *
 * GATED ON A MEMORY WORD, because being signed in is not evidence of being the
 * owner. An anonymous account has no password to re-enter, so until now a
 * session was the ONLY thing standing between a borrowed browser and a permanent
 * remote backdoor: one press, write the key down, walk away with the account.
 * The word is set on the first generation and required for every one after.
 *
 * Two writes after that, and the order matters:
 *   1. the new key's hash lands first, so a failure halfway through leaves the
 *      account recoverable by the NEW key the user is about to be shown, never
 *      by neither;
 *   2. the synthetic password is rotated, which is what actually kills the old
 *      key. Legacy accounts were provisioned with `password = recovery key`, and
 *      Supabase's password sign-in is reachable straight from a browser with the
 *      anon key — so skipping this would leave the replaced key working.
 *
 * Rotating the password revokes the caller's session, so we immediately mint a
 * new one onto this response. Without that the user is silently signed out by
 * the very act of securing their account.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: { keyword?: unknown };
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const keyword = typeof body.keyword === "string" ? body.keyword : "";

  const admin = createAdminClient();
  const { data: row } = await admin
    .from("users")
    .select("recovery_keyword_hash")
    .eq("id", user.id)
    .maybeSingle();
  const stored = (row as { recovery_keyword_hash?: string | null } | null)?.recovery_keyword_hash ?? null;

  /**
   * The guess limiter, and the actual security of this feature.
   *
   * The word is chosen to be memorable, so it is guessable — "banane", "chat",
   * the family dog. What a bystander must not get is unlimited tries. Ten an
   * hour leaves a legitimate owner who mistypes plenty of room and leaves an
   * opportunist with two minutes at someone else's desk almost none.
   *
   * Checked BEFORE the scrypt verify, so a flood cannot also be a CPU attack —
   * each verify is deliberately ~50-100ms.
   *
   * It fails CLOSED (see lib/rate-limit.ts): a database outage refuses the
   * generation rather than opening the gate it exists to hold shut.
   */
  if (stored) {
    if (!(await checkStrictUserRateLimit("recovery_keyword_try", user.id, 10, "60 minutes"))) {
      return NextResponse.json(
        { error: "Too many tries. Wait an hour and try again." },
        { status: 429 },
      );
    }
    if (!(await verifyKeyword(keyword, stored))) {
      // Deliberately not "wrong word" vs "no word": both are the same refusal,
      // and there is nothing useful to tell someone who is guessing.
      return NextResponse.json(
        { error: "That's not the word on this account.", reason: "keyword" },
        { status: 403 },
      );
    }
  } else if (!isValidKeyword(keyword)) {
    // First generation: the word is being CHOSEN here, so the failure is a
    // validation message rather than a refusal.
    return NextResponse.json(
      {
        error: `Choose a word of at least ${KEYWORD_MIN_LENGTH} letters you'll remember.`,
        reason: "keyword_required",
      },
      { status: 400 },
    );
  }

  // Each call invalidates the previous key. A loop here would be a way to churn
  // an account into an unrecoverable state, and there is no legitimate reason to
  // need more than a handful a day.
  if (!(await checkStrictUserRateLimit("recovery_key_issue", user.id, 5, "24 hours"))) {
    return NextResponse.json(
      { error: "Too many new keys today — try again tomorrow." },
      { status: 429 },
    );
  }

  const code = await issueRecoveryKey(user.id);
  if (!code) {
    return NextResponse.json({ error: "Could not generate a key." }, { status: 500 });
  }

  // Persist the chosen word only once the key it guards actually exists. The
  // other order would leave an account whose generation is gated by a word its
  // owner was never shown a key for.
  if (!stored) {
    const { error } = await admin
      .from("users")
      .update({
        recovery_keyword_hash: await hashKeyword(keyword),
        recovery_keyword_set_at: new Date().toISOString(),
      })
      .eq("id", user.id);
    if (error) {
      // The key is live and the gate is not. Say so rather than fail silently:
      // the user can set the word by generating again, and must know to.
      return NextResponse.json({
        code,
        warning: "Your key is active, but we couldn't save your word — set it by generating again.",
      });
    }
  }

  const email = await rotateSyntheticPassword(user.id);
  if (email) {
    // The rotation just revoked this session; re-establish it or the user is
    // logged out holding a key they have not written down yet.
    const minted = await mintSessionFor(supabase, email);
    if (!minted) {
      // The key IS live — say so rather than imply the operation failed, or the
      // user will discard a working key and retry.
      return NextResponse.json(
        {
          code,
          warning: "Your new key is active, but you'll need to sign in again with it.",
        },
        { status: 200 },
      );
    }
  }

  void captureServer(user.id, "recovery_key_regenerated", {});
  return NextResponse.json({ code });
}
