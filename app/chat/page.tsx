import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { needsAgeGate } from "@/lib/compliance/guard";
import { getStudentRecommendations } from "@/lib/school-admin";
import { getPlanLabel } from "@/lib/billing";
import { softValue } from "@/lib/page-data";
import { Chat } from "@/components/chat";

export default async function ChatPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // One wave: nothing here depends on anything else here. The two soft values
  // are chrome (sidebar plan label, teacher recommendations) — they degrade
  // rather than hold the page.
  const [{ data: profile }, { data: convs }, recommendations, planLabel] = await Promise.all([
    supabase
      .from("users")
      .select("account_state, display_name, username, profile_picture_url, birth_year, minor_consent_source, school_id")
      .eq("id", user.id)
      .single(),
    // Full solo-chat history (room-private channels are excluded). Archived
    // threads come down too — the list keeps them behind a disclosure rather
    // than pretending they are gone, so archiving stays distinct from deleting.
    supabase
      .schema("learning")
      .from("conversations")
      .select("id, title, updated_at, archived_at, memorized_at")
      .eq("user_id", user.id)
      .is("room_id", null)
      .order("updated_at", { ascending: false }),
    softValue(getStudentRecommendations(user.id), []),
    softValue(getPlanLabel({ userId: user.id }), "User — Free"),
  ]);
  // Onboarding covers both first-run setup and the age question, so an
  // account that predates the age gate is sent back for it too.
  if (!profile || profile.account_state === "onboarding_pending" || needsAgeGate(profile)) {
    redirect("/onboarding");
  }
  const studentName = profile.display_name || profile.username || "";
  const conversations = convs ?? [];

  /**
   * Raya always opens on a blank session — never on the last thread.
   *
   * Resuming the most recent conversation sounds helpful and is not: it decides
   * for the learner what today is about, and it silently reopens whatever they
   * left behind, including a thread they had just archived (which is supposed to
   * be out of the way) or, on a stale tab, one they had just deleted. The
   * history list is one click away and says what each thread is; a blank page
   * says "what are we cracking today", which is the actual question.
   *
   * It also removes two blocking queries (messages + attachments) from the
   * app's most-opened page.
   */
  return (
    <Chat
      conversationId={null}
      initialMessages={[]}
      initialFiles={[]}
      conversations={conversations}
      recommendations={recommendations}
      studentName={studentName}
      studentAvatarUrl={profile.profile_picture_url}
      studentPlan={planLabel}
    />
  );
}
