import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { hasRealEmail, ensureProfileRow, ensureRecoveryKeyIssued } from "@/lib/auth";
import { resolveHome } from "@/lib/routing";
import { needsAgeGate } from "@/lib/compliance/guard";
import { OnboardingForm } from "@/components/onboarding-form";

export default async function OnboardingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const readProfile = () =>
    supabase
      .from("users")
      .select(
        "username, display_name, account_state, birth_year, minor_consent_source, school_id",
      )
      .eq("id", user.id)
      .maybeSingle();

  let { data: profile } = await readProfile();
  // Every route sends a profile-less account here, so this is the one place
  // that can give it a row back — otherwise the form saves into nothing and
  // the next page returns it here, forever. See ensureProfileRow.
  if (!profile) {
    await ensureProfileRow(user);
    ({ data: profile } = await readProfile());
  }

  const onboarded = Boolean(profile && profile.account_state !== "onboarding_pending");
  const gated = needsAgeGate(profile);

  // Already onboarded and past the age gate → straight to their home.
  if (onboarded && !gated) redirect(await resolveHome(user.id));

  // Already onboarded but with no age on file — an account created before the
  // gate existed. Don't make them redo five setup screens they've done: ask the
  // one question that's missing.
  const ageOnly = onboarded && gated;


  // The trigger seeds a default username like "user_xxxxxxxx"; don't prefill it.
  const seededDefault = (profile?.username ?? "").startsWith("user_");

  // Anonymous = no REAL linked email (the synthetic recovery address doesn't count).
  // These accounts get a dedicated onboarding page: continue-with-email + the
  // recovery key with its constraints.
  //
  // This render is the ONE moment the key exists in cleartext — only its hash is
  // stored, so a reload returns null and the screen sends the user to /account to
  // generate a replacement rather than showing a key it cannot know.
  const isAnonymous = !hasRealEmail(user.email);
  const recoveryCode = isAnonymous ? await ensureRecoveryKeyIssued(user.id) : null;

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
      />
    </main>
  );
}
