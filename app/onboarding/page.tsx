import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { hasRealEmail, ensureRecoveryCode } from "@/lib/auth";
import { resolveHome } from "@/lib/routing";
import { OnboardingForm } from "@/components/onboarding-form";

export default async function OnboardingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("users")
    .select("username, display_name, account_state")
    .eq("id", user.id)
    .single();

  // Already onboarded → straight to their home (Raya or Schools, depending).
  if (profile && profile.account_state !== "onboarding_pending") {
    redirect(await resolveHome(user.id));
  }

  // The trigger seeds a default username like "user_xxxxxxxx"; don't prefill it.
  const seededDefault = (profile?.username ?? "").startsWith("user_");

  // Anonymous = no REAL linked email (the synthetic recovery address doesn't count).
  // These accounts get a dedicated onboarding page: continue-with-email + the
  // recovery key with its constraints. Make sure the key exists to show it.
  const isAnonymous = !hasRealEmail(user.email);
  const recoveryCode = isAnonymous ? await ensureRecoveryCode(user.id) : null;

  return (
    <main style={{ minHeight: "100vh", width: "100%" }}>
      <OnboardingForm
        userId={user.id}
        // "Verified" = a REAL linked email that's confirmed. The synthetic
        // recovery address is Supabase-confirmed too, but it must NOT count —
        // an email-less account recovered by key stays unverified (lower trust).
        emailVerified={hasRealEmail(user.email) && !!user.email_confirmed_at}
        isAnonymous={isAnonymous}
        recoveryCode={recoveryCode}
        initialUsername={seededDefault ? "" : (profile?.username ?? "")}
        initialDisplayName={profile?.display_name ?? ""}
      />
    </main>
  );
}
