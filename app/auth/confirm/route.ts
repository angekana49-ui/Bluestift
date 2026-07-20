import { type EmailOtpType } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { markEmailVerified } from "@/lib/auth";
import { resolvePostAuth } from "@/lib/routing";

/**
 * Verifies email OTP links (magic-link login and anonymous->email linking).
 * Supabase sends the user here with `token_hash` and `type` query params.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? "/";

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
