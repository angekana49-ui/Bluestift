import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { markEmailVerified } from "@/lib/auth";
import { resolvePostAuth } from "@/lib/routing";

/**
 * PKCE callback for Supabase's DEFAULT email templates, which use
 * `{{ .ConfirmationURL }}` and redirect back here with a `?code=...`.
 * (If you later switch to custom token-hash templates, use /auth/confirm.)
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
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
