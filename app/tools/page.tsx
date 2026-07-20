import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Tools } from "@/components/tools";
import { SoloChallenge } from "@/components/solo-challenge";
import { RayaScaffold } from "@/components/raya/raya-scaffold";
import { initialsOf } from "@/lib/name";

export default async function ToolsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("users")
    .select("account_state, display_name, username, profile_picture_url")
    .eq("id", user.id)
    .single();
  if (!profile || profile.account_state === "onboarding_pending") {
    redirect("/onboarding");
  }
  const studentName = profile.display_name || profile.username || "";

  const [{ data: uploads }, { data: outputs }, { data: myChallenges }, { data: myAttempts }] =
    await Promise.all([
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
  const scoreById = new Map((myAttempts ?? []).map((a) => [a.challenge_id, a.score]));
  const selfTests = (myChallenges ?? []).map((c) => ({
    id: c.id,
    title: c.title,
    score: scoreById.get(c.id) ?? null,
  }));

  return (
    <RayaScaffold active="tools" studentName={studentName} studentInitials={initialsOf(studentName)} studentAvatarUrl={profile.profile_picture_url}>
      <div style={{ flex: 1, overflow: "auto", padding: "32px 40px", minWidth: 0 }}>
        <Tools uploads={uploads ?? []} outputs={outputs ?? []} selfTests={selfTests} />
        <div id="self-test" style={{ marginTop: 8 }}>
          <SoloChallenge myUserId={user.id} />
        </div>
      </div>
    </RayaScaffold>
  );
}
