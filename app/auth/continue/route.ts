import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolvePostAuth } from "@/lib/routing";

/**
 * "I signed in somewhere else — take me where that tab went."
 *
 * The magic link opens wherever the mail client decides, which is rarely the
 * window that asked for it. That window watches for the session and, when it
 * arrives, comes here (components/ui/link-sent-dialog.tsx). Its job is to land
 * on the SAME destination /auth/callback chose for the tab that did the
 * exchange — otherwise the two windows end up in two different places, which is
 * the confusion this whole path exists to remove.
 *
 * So it answers the question exactly once, with resolvePostAuth, rather than
 * letting the caller guess: /login would show a half-finished account the
 * "resume setup" door instead of sending it to onboarding, and /account would
 * drop a returning user in Settings rather than at home.
 *
 * There is deliberately no `next` parameter. Nothing here is supplied by the
 * caller, so there is no redirect to validate (contrast the safeNext guard the
 * two callbacks need, test/auth-redirect-safety.ts) — the destination is
 * computed from the session and nothing else.
 */
export async function GET(request: Request) {
  const { origin } = new URL(request.url);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // No session after all: the cookie the watching tab saw has since gone, or
  // this was opened by hand. The door, not an error.
  if (!user) return NextResponse.redirect(`${origin}/login`);

  return NextResponse.redirect(`${origin}${await resolvePostAuth(supabase, user.id)}`);
}
