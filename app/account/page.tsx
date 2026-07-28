import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ensureRecoveryCode, hasRealEmail } from "@/lib/auth";
import { getPlanLabel } from "@/lib/billing";
import { softValue } from "@/lib/page-data";
import { AuthPanel } from "@/components/auth-panel";
import { RayaScaffold } from "@/components/raya/raya-scaffold";
import { SectionHeader } from "@/components/raya/section-header";
import { SettingsThemeCard } from "@/components/raya/settings-theme-card";
import { SettingsLanguageCard } from "@/components/raya/settings-language-card";
import { StudentBillingCard } from "@/components/raya/settings-billing-card";
import { initialsOf } from "@/lib/name";

export default async function AccountPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // One wave. `ensureRecoveryCode` (idempotent, session-safe) may CREATE the
  // code the profile select reads, so we take the value it returns rather than
  // serialising the two — a code minted right now would otherwise render blank
  // until the next load. The synthetic login credential for email-less accounts
  // is attached at sign-in time by /api/auth/anon; doing it here would revoke
  // the visitor's live session.
  const [recoveryCode, { data: profileRow }, planLabel] = await Promise.all([
    ensureRecoveryCode(user.id),
    supabase
      .from("users")
      .select("username, display_name, account_type, account_state, recovery_code, profile_picture_url")
      .eq("id", user.id)
      .single(),
    softValue(getPlanLabel({ userId: user.id }), "User — Free"),
  ]);

  // Force first-run onboarding before anything else.
  if (profileRow && profileRow.account_state === "onboarding_pending") {
    redirect("/onboarding");
  }

  const profile = profileRow
    ? { ...profileRow, recovery_code: profileRow.recovery_code ?? recoveryCode }
    : profileRow;

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
            maxWidth={700}
          />
          <StudentBillingCard />
        </div>
      </div>
    </RayaScaffold>
  );
}
