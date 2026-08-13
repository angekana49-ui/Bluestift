import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { issueRecoveryKey, mintSessionFor, rotateSyntheticPassword } from "@/lib/auth";
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
 * Two writes, and the order matters:
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
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

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
