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

  const { data: profile } = await supabase
    .from("users")
    .select("account_state, profile_picture_url, display_name, username")
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

  // The teacher's own identity for the prof dashboard (profile chip + framing):
  // the dashboard is an extension of RAYA for a user who also teaches, so we show
  // *them*, not "My classes".
  const teacherName = profile.display_name || profile.username || "Teacher";

  return (
    <SchoolAdmin
      role={role}
      dashboard={dashboard}
      profClasses={profClasses}
      teacherName={teacherName}
      profSubjects={profContext?.subjects ?? []}
      profSchoolName={profContext?.schoolName ?? null}
      userAvatarUrl={profile.profile_picture_url}
      memberships={memberships}
      activeSchoolId={resolvedActiveSchoolId}
      initialTab={tab ?? null}
      initialJoinCode={join ?? null}
    />
  );
}
