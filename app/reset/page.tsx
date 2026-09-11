import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { hasRealEmail } from "@/lib/auth";
import { ResetPasswordView } from "@/components/reset-password-view";

/**
 * Where a password-reset link lands (…/auth/callback?next=/reset).
 *
 * The session is the proof. By the time this renders, the link has already been
 * exchanged for one, so a visitor WITHOUT a session is someone whose link
 * expired, was used twice, or who typed the URL — none of whom may set a
 * password on anybody's account. They go back to the door, where
 * `?error=auth` says the link didn't work rather than leaving them guessing.
 *
 * The address is passed down only to be shown, and only when it is a real one:
 * an email-less account's synthetic recovery address (lib/auth.ts) is never
 * surfaced to its owner.
 */
export default async function ResetPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login?error=auth");

  return (
    <main style={{ minHeight: "100vh", width: "100%" }}>
      <ResetPasswordView email={hasRealEmail(user.email) ? user.email ?? null : null} />
    </main>
  );
}
