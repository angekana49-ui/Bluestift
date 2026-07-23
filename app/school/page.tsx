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

  // Guarantee a recovery code exists (idempotent, session-safe) so the in-dashboard
  // Settings panel can surface it — same guarantee /account gives.
  await ensureRecoveryCode(user.id);

  const { data: profile } = await supabase
    .from("users")
    .select("account_state, profile_picture_url, display_name, username, account_type, recovery_code")
    .eq("id", user.id)
    .single();
  if (!profile || profile.account_state === "onboarding_pending") {
    redirect("/onboarding");
  }

  const [membership, memberships, activeSchoolId] = await Promise.all([
    getAdminMembership(user.id),
    getMemberships(user.id),
    getActiveSchoolId(),
  ]);
  // The resolved active school (may differ from the cookie when stale/absent).
  const resolvedActiveSchoolId = membership?.schoolId ?? activeSchoolId ?? null;
  const role = membership?.role ?? null;

  let dashboard: SchoolDashboard | null = null;
  let profClasses: AdminClass[] = [];
  let profContext: ProfContext | null = null;
  if (role === "admin_master") {
    // Roll the active school year forward if the previous one has ended.
    if (membership) await ensureCurrentSchoolYear(membership.schoolId);
    dashboard = await getSchoolDashboard(user.id);
  } else if (role === "prof") {
    [profClasses, profContext] = await Promise.all([
      getProfClasses(user.id),
      getProfContext(user.id),
    ]);
  }

  // The signed-in user's own identity for the sidebar profile chip (name + photo,
  // like RAYA) — the dashboard is an extension of RAYA for staff, so we show
  // *them*, not the school name / "My classes".
  const userName = profile.display_name || profile.username || "";
  const teacherName = userName || "Teacher";

  // The plan/forfait line under the name in the profile chip: the active school's
  // subscription (same for admin and teacher — they share the school's plan).
  const planLabel = resolvedActiveSchoolId
    ? await getPlanLabel({ schoolId: resolvedActiveSchoolId })
    : null;

  // The signed-in user's own account, so the prof dashboard can open Settings
  // in-place (profile chip → in-dashboard panel) instead of bouncing to the
  // RAYA-scaffolded /account page. Anonymous until a real email is linked.
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
