import { type EmailOtpType } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { markEmailVerified } from "@/lib/auth";
import { resolvePostAuth } from "@/lib/routing";

/**
 * Where a successful sign-in is allowed to land.
 *
 * `next` is a query parameter, so it is attacker-supplied, and the redirect is
 * built by concatenating it onto our origin. That concatenation is the whole
 * problem: `next=@evil.com` produces `https://ours@evil.com`, where everything
 * before the `@` is userinfo and the browser goes to evil.com. `next=.evil.com`
 * does the same by extending the hostname. Neither starts with the `/` that
 * makes a value look like a path.
 *
 * So the rule is positive rather than a blacklist: one leading slash, not two,
 * and no backslash after it (browsers read `/\` as `//` in a URL). Anything
 * else falls back to the root rather than being repaired — a login that lands
 * on the home page is a small confusion, and a login that lands on someone
 * else's site is a credential-harvesting page wearing our domain.
 */
function safeNext(raw: string | null): string {
  if (!raw || !raw.startsWith("/")) return "/";
  if (raw.startsWith("//") || raw.startsWith("/\\")) return "/";
  return raw;
}

/**
 * Verifies email OTP links (magic-link login and anonymous->email linking).
 * Supabase sends the user here with `token_hash` and `type` query params.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = safeNext(searchParams.get("next"));

  if (token_hash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash });
    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) await markEmailVerified(user);
      // Enforce the flow order: generic landings (/, /account) resolve to
      // onboarding-or-home; an explicit deep-link `next` is honoured as-is.
      const dest = user && (next === "/" || next === "/account") ? await resolvePostAuth(supabase, user.id) : next;
      return NextResponse.redirect(`${origin}${dest}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
