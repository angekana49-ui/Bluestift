import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  ensureCurrentSchoolYear,
  getAdminMembership,
  getMemberships,
  getProfClasses,
  getProfContext,
  getSchoolDashboard,
} from "@/lib/school-admin";
import { getActiveSchoolId } from "@/lib/school-active";
import { getPlanLabel } from "@/lib/billing";
import { softValue } from "@/lib/page-data";
import { ensureRecoveryCode, hasRealEmail } from "@/lib/auth";
import type { AdminClass, ProfContext, SchoolDashboard } from "@/lib/school-admin";
import { SchoolAdmin } from "@/components/school-admin";

export default async function SchoolPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; join?: string }>;
}) {
  const { tab, join } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Wave 1: five independent lookups that used to run in sequence — this page
  // was the app's worst blocking path. `ensureRecoveryCode` (idempotent,
  // session-safe) may CREATE the code the profile select reads, so we take its
  // return value rather than serialising the two; it gives the in-dashboard
  // Settings panel the same guarantee /account gives.
  const [recoveryCode, { data: profileRow }, membership, memberships, activeSchoolId] =
    await Promise.all([
      ensureRecoveryCode(user.id),
      supabase
        .from("users")
        .select("account_state, profile_picture_url, display_name, username, account_type, recovery_code")
        .eq("id", user.id)
        .single(),
      getAdminMembership(user.id),
      getMemberships(user.id),
      getActiveSchoolId(),
    ]);
  if (!profileRow || profileRow.account_state === "onboarding_pending") {
    redirect("/onboarding");
  }
  const profile = { ...profileRow, recovery_code: profileRow.recovery_code ?? recoveryCode };
  // The resolved active school (may differ from the cookie when stale/absent).
  const resolvedActiveSchoolId = membership?.schoolId ?? activeSchoolId ?? null;
  const role = membership?.role ?? null;

  let dashboard: SchoolDashboard | null = null;
  let profClasses: AdminClass[] = [];
  let profContext: ProfContext | null = null;
  if (role === "admin_master") {
    // Roll the active school year forward if the previous one has ended.
    // Deliberately NOT parallelised with the dashboard read: the dashboard
    // scopes classes to the school's currentYearId, which this may repoint —
    // racing them would show last year's classes on roll-over day.
    if (membership) await ensureCurrentSchoolYear(membership.schoolId);
    dashboard = await getSchoolDashboard(user.id);
  } else if (role === "prof") {
    [profClasses, profContext] = await Promise.all([
      getProfClasses(user.id),
      getProfContext(user.id),
    ]);
  }

  // The signed-in user's own identity for the sidebar profile chip (name + photo,
  // like Raya) — the dashboard is an extension of Raya for staff, so we show
  // *them*, not the school name / "My classes".
  const userName = profile.display_name || profile.username || "";
  const teacherName = userName || "Teacher";

  // The plan/forfait line under the name in the profile chip: the active school's
  // subscription (same for admin and teacher — they share the school's plan).
  const planLabel = resolvedActiveSchoolId
    ? await softValue(getPlanLabel({ schoolId: resolvedActiveSchoolId }), "Free")
    : null;

  // The signed-in user's own account, so the prof dashboard can open Settings
  // in-place (profile chip → in-dashboard panel) instead of bouncing to the
  // Raya-scaffolded /account page. Anonymous until a real email is linked.
  const realEmail = hasRealEmail(user.email);
  const account = {
    user: { id: user.id, email: realEmail ? user.email ?? null : null, isAnonymous: !realEmail },
    profile: {
      username: profile.username,
      display_name: profile.display_name,
      account_type: profile.account_type,
      account_state: profile.account_state,
      recovery_code: profile.recovery_code,
      profile_picture_url: profile.profile_picture_url,
    },
  };

  return (
    <SchoolAdmin
      role={role}
      dashboard={dashboard}
      profClasses={profClasses}
      teacherName={teacherName}
      userName={userName}
      planLabel={planLabel}
      profSubjects={profContext?.subjects ?? []}
      profSchoolName={profContext?.schoolName ?? null}
      profSchoolLogoUrl={profContext?.schoolLogoUrl ?? null}
      userAvatarUrl={profile.profile_picture_url}
      memberships={memberships}
      activeSchoolId={resolvedActiveSchoolId}
      account={account}
      initialTab={tab ?? null}
      initialJoinCode={join ?? null}
    />
  );
}
