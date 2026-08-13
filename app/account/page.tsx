import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { needsAgeGate } from "@/lib/compliance/guard";
import { recoveryKeyState, hasRealEmail } from "@/lib/auth";
import { getPlanLabel } from "@/lib/billing";
import { softValue } from "@/lib/page-data";
import { AuthPanel } from "@/components/auth-panel";
import { RayaScaffold } from "@/components/raya/raya-scaffold";
import { SectionHeader } from "@/components/raya/section-header";
import { SettingsThemeCard } from "@/components/raya/settings-theme-card";
import { SettingsLanguageCard } from "@/components/raya/settings-language-card";
import { SettingsDataCard } from "@/components/raya/settings-data-card";
import { SettingsSharesCard } from "@/components/raya/settings-shares-card";
import { StudentBillingCard } from "@/components/raya/settings-billing-card";
import { initialsOf } from "@/lib/name";
import { ageBand } from "@/lib/compliance/age";

export default async function AccountPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // One wave. The recovery key itself is NOT read: only its hash is stored, so
  // there is nothing to display. All this page needs to know is whether a key has
  // ever been issued, which decides between "you have one" and "generate one".
  const [keyState, { data: profileRow }, planLabel] = await Promise.all([
    recoveryKeyState(user.id),
    supabase
      .from("users")
      .select("username, display_name, account_type, account_state, profile_picture_url, birth_year, minor_consent_source, school_id, training_consent")
      .eq("id", user.id)
      .single(),
    softValue(getPlanLabel({ userId: user.id }), "User — Free"),
  ]);

  // Force first-run onboarding before anything else — which now includes the
  // age question, so accounts that predate the gate are sent back for it.
  if (profileRow && (profileRow.account_state === "onboarding_pending" || needsAgeGate(profileRow))) {
    redirect("/onboarding");
  }

  const profile = profileRow;

  // Treat the account as anonymous in the UI until a *real* email is linked —
  // the synthetic recovery address must never surface as the user's email.
  const realEmail = hasRealEmail(user.email);
  const studentName = profile?.display_name || profile?.username || "";
  const studentPlan = planLabel;

  return (
    <RayaScaffold active="settings" studentName={studentName} studentInitials={initialsOf(studentName)} studentAvatarUrl={profile?.profile_picture_url} studentPlan={studentPlan}>
      <div style={{ flex: 1, overflow: "auto", padding: "32px 40px", minWidth: 0 }}>
        <div style={{ width: "100%", maxWidth: 700, margin: "0 auto" }}>
          <SectionHeader title="Settings" />
          <SettingsThemeCard />
          <SettingsLanguageCard />
          <AuthPanel
            user={{
              id: user.id,
              email: realEmail ? user.email ?? null : null,
              isAnonymous: !realEmail,
            }}
            profile={profile}
            recoveryKey={keyState}
            maxWidth={700}
          />
          <StudentBillingCard />
          {/* Sits next to the data-rights card on purpose: both answer "what of
              mine is out there, and how do I take it back". */}
          <SettingsSharesCard />
          <SettingsDataCard
            band={ageBand(profileRow?.birth_year ?? null)}
            trainingConsent={Boolean(profileRow?.training_consent)}
            schoolLinked={Boolean(profileRow?.school_id)}
          />
        </div>
      </div>
    </RayaScaffold>
  );
}
