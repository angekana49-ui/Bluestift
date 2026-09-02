import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { needsAgeGate } from "@/lib/compliance/guard";
import { Tools } from "@/components/tools";
import { SoloChallenge } from "@/components/solo-challenge";
import { RayaScaffold } from "@/components/raya/raya-scaffold";
import { PageBody } from "@/components/ui/shell";
import { getPlanLabel } from "@/lib/billing";
import { softValue } from "@/lib/page-data";
import { initialsOf } from "@/lib/name";

export default async function ToolsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // One wave: the profile gate, the chrome plan label and all four content
  // queries are mutually independent.
  const [
    { data: profile },
    studentPlan,
    { data: uploads },
    { data: outputs },
    { data: myChallenges },
    { data: myAttempts },
  ] = await Promise.all([
      supabase
        .from("users")
        .select("account_state, display_name, username, profile_picture_url, birth_year, minor_consent_source, school_id")
        .eq("id", user.id)
        .single(),
      softValue(getPlanLabel({ userId: user.id }), "User — Free"),
      supabase
        .schema("rag")
        .from("user_media")
        .select("id, title, url, type, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(20),
      supabase
        .schema("learning")
        .from("tool_outputs")
        .select("id, tool_type, status, output_content, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(20),
      supabase
        .schema("learning")
        .from("challenges")
        .select("id, title")
        .is("room_id", null)
        .order("created_at", { ascending: false })
        .limit(20),
      supabase
        .schema("learning")
        .from("challenge_attempts")
        .select("challenge_id, score")
        .eq("user_id", user.id),
    ]);
  // Onboarding covers both first-run setup and the age question, so an
  // account that predates the age gate is sent back for it too.
  if (!profile || profile.account_state === "onboarding_pending" || needsAgeGate(profile)) {
    redirect("/onboarding");
  }
  const studentName = profile.display_name || profile.username || "";

  const scoreById = new Map((myAttempts ?? []).map((a) => [a.challenge_id, a.score]));
  const selfTests = (myChallenges ?? []).map((c) => ({
    id: c.id,
    title: c.title,
    score: scoreById.get(c.id) ?? null,
  }));

  return (
    <RayaScaffold active="tools" studentName={studentName} studentInitials={initialsOf(studentName)} studentAvatarUrl={profile.profile_picture_url} studentPlan={studentPlan}>
      <PageBody>
        <Tools uploads={uploads ?? []} outputs={outputs ?? []} selfTests={selfTests} studentName={studentName} />
        <div id="self-test" style={{ marginTop: 8 }}>
          <SoloChallenge myUserId={user.id} studentName={studentName} />
        </div>
      </PageBody>
    </RayaScaffold>
  );
}
