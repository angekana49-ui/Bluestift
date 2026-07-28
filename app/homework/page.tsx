import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { RayaScaffold } from "@/components/raya/raya-scaffold";
import { AssignmentsView } from "@/components/assignments-view";
import { getPlanLabel } from "@/lib/billing";
import { softValue } from "@/lib/page-data";
import { initialsOf } from "@/lib/name";

export default async function HomeworkPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: profile }, studentPlan] = await Promise.all([
    supabase
      .from("users")
      .select("account_state, display_name, username, profile_picture_url")
      .eq("id", user.id)
      .single(),
    softValue(getPlanLabel({ userId: user.id }), "User — Free"),
  ]);
  if (!profile || profile.account_state === "onboarding_pending") {
    redirect("/onboarding");
  }
  const studentName = profile.display_name || profile.username || "";

  return (
    <RayaScaffold
      active="homework"
      studentName={studentName}
      studentInitials={initialsOf(studentName)}
      studentAvatarUrl={profile.profile_picture_url}
      studentPlan={studentPlan}
    >
      <div style={{ flex: 1, overflow: "auto", padding: "32px 40px", minWidth: 0 }}>
        <AssignmentsView />
      </div>
    </RayaScaffold>
  );
}
