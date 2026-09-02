import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { needsAgeGate } from "@/lib/compliance/guard";
import { CognitiveProfile } from "@/components/cognitive-profile";
import { KernelMemory } from "@/components/kernel-memory";
import { StudentSimulation } from "@/components/student-simulation";
import { ProgressCurve, type ProgressPoint } from "@/components/progress-curve";
import { SchoolLink } from "@/components/school-link";
import { TeacherLink } from "@/components/teacher-link";
import { getStudentSchoolLink } from "@/lib/school";
import { getAdminMembership } from "@/lib/school-admin";
import { getPlanLabel } from "@/lib/billing";
import { softValue } from "@/lib/page-data";
import { hasRealEmail } from "@/lib/auth";
import { RayaScaffold } from "@/components/raya/raya-scaffold";
import { PageBody } from "@/components/ui/shell";
import { SectionHeader } from "@/components/raya/section-header";
import { initialsOf } from "@/lib/name";

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ intent?: string }>;
}) {
  const { intent } = await searchParams;
  const startCreateSchool = intent === "create";
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // One wave — none of these depend on each other.
  const [{ data: profile }, { data: attempts }, { data: memorized }, schoolLink, membership, studentPlan] =
    await Promise.all([
      supabase
        .from("users")
        .select("account_state, display_name, username, profile_picture_url, birth_year, minor_consent_source, school_id")
        .eq("id", user.id)
        .single(),
      // Graded performance over time — app-owned signal (self-tests + room challenges).
      supabase
        .schema("learning")
        .from("challenge_attempts")
        .select("score, completed_at")
        .eq("user_id", user.id)
        .eq("status", "completed")
        .not("completed_at", "is", null)
        .not("score", "is", null)
        .order("completed_at", { ascending: true }),
      // The threads the learner deliberately anchored. Archived ones are still
      // memorized — filing a conversation away does not take back the decision
      // to have Raya build on it — so this deliberately does not filter them.
      supabase
        .schema("learning")
        .from("conversations")
        .select("id, title, memorized_at")
        .eq("user_id", user.id)
        .is("room_id", null)
        .not("memorized_at", "is", null)
        .order("memorized_at", { ascending: false }),
      getStudentSchoolLink(user.id),
      getAdminMembership(user.id),
      softValue(getPlanLabel({ userId: user.id }), "User — Free"),
    ]);
  // Onboarding covers both first-run setup and the age question, so an
  // account that predates the age gate is sent back for it too.
  if (!profile || profile.account_state === "onboarding_pending" || needsAgeGate(profile)) {
    redirect("/onboarding");
  }
  const studentName = profile.display_name || profile.username || "";

  const points: ProgressPoint[] = (attempts ?? [])
    .filter((a): a is { score: number; completed_at: string } => a.score != null && a.completed_at != null)
    .map((a) => ({ t: a.completed_at, score: a.score }));

  const staff = membership
    ? { schoolName: membership.schoolName, role: membership.role }
    : null;

  return (
    <RayaScaffold active="kernel" studentName={studentName} studentInitials={initialsOf(studentName)} studentAvatarUrl={profile.profile_picture_url} studentPlan={studentPlan}>
      <PageBody>
        <SectionHeader title="My Kernel" subtitle="Your mastery, concept by concept — not a single grade." />
        <SchoolLink initial={schoolLink} />
        <TeacherLink initial={staff} startCreate={startCreateSchool} hasEmail={hasRealEmail(user.email)} />
        <ProgressCurve points={points} />
        <KernelMemory
          initial={(memorized ?? [])
            .filter((c): c is { id: string; title: string | null; memorized_at: string } =>
              c.memorized_at != null,
            )
            .map((c) => ({ id: c.id, title: c.title, memorized_at: c.memorized_at }))}
        />
        <CognitiveProfile />
        <StudentSimulation />
      </PageBody>
    </RayaScaffold>
  );
}
