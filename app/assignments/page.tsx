import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { needsAgeGate } from "@/lib/compliance/guard";
import { RayaScaffold } from "@/components/raya/raya-scaffold";
import { PageBody } from "@/components/ui/shell";
import { AssignmentsView } from "@/components/assignments-view";
import { getPlanLabel } from "@/lib/billing";
import { softValue } from "@/lib/page-data";
import { initialsOf } from "@/lib/name";

export default async function AssignmentsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: profile }, studentPlan] = await Promise.all([
    supabase
      .from("users")
      .select("account_state, display_name, username, profile_picture_url, birth_year, minor_consent_source, school_id")
      .eq("id", user.id)
      .single(),
    softValue(getPlanLabel({ userId: user.id }), "User — Free"),
  ]);
  // Onboarding covers both first-run setup and the age question, so an
  // account that predates the age gate is sent back for it too.
  if (!profile || profile.account_state === "onboarding_pending" || needsAgeGate(profile)) {
    redirect("/onboarding");
  }
  const studentName = profile.display_name || profile.username || "";

  return (
    <RayaScaffold
      active="assignments"
      studentName={studentName}
      studentInitials={initialsOf(studentName)}
      studentAvatarUrl={profile.profile_picture_url}
      studentPlan={studentPlan}
    >
      <PageBody>
        <AssignmentsView />
      </PageBody>
    </RayaScaffold>
  );
}
