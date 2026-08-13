import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { hasRealEmail, ensureRecoveryCode } from "@/lib/auth";
import { resolveHome } from "@/lib/routing";
import { needsAgeGate } from "@/lib/compliance/guard";
import { evaluateAccess } from "@/lib/compliance/age";
import { OnboardingForm } from "@/components/onboarding-form";

export default async function OnboardingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("users")
    .select(
      "username, display_name, account_state, birth_year, minor_consent_source, school_id",
    )
    .eq("id", user.id)
    .single();

  const onboarded = Boolean(profile && profile.account_state !== "onboarding_pending");
  const gated = needsAgeGate(profile);

  // Already onboarded and past the age gate → straight to their home.
  if (onboarded && !gated) redirect(await resolveHome(user.id));

  // Already onboarded but with no age on file — an account created before the
  // gate existed. Don't make them redo five setup screens they've done: ask the
  // one question that's missing.
  const ageOnly = onboarded && gated;

  // Under-13 with nobody authorised to act for them: the form opens straight on
  // the blocked screen rather than re-asking a question already answered.
  const decision = evaluateAccess({
    birthYear: profile?.birth_year ?? null,
    schoolId: profile?.school_id ?? null,
    minorConsentSource: profile?.minor_consent_source ?? null,
  });
  const blocked = !decision.allowed && decision.reason === "needs_school_or_parent";

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
        ageOnly={ageOnly}
        startBlocked={blocked}
      />
    </main>
  );
}
