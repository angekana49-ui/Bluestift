import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { needsAgeGate } from "@/lib/compliance/guard";
import { getStudentRecommendations } from "@/lib/school-admin";
import { getPlanLabel } from "@/lib/billing";
import { softValue } from "@/lib/page-data";
import { Chat, type ConversationFile } from "@/components/chat";

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
    // Full solo-chat history (room-private channels are excluded).
    supabase
      .schema("learning")
      .from("conversations")
      .select("id, title, updated_at")
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
  const conversationId = conversations[0]?.id ?? null;

  let messages: { id: string; role: string; content: string | null }[] = [];
  let files: ConversationFile[] = [];
  if (conversationId) {
    // Attachments are fetched with the thread so bubbles render complete on the
    // first paint, rather than popping in after a client round-trip.
    const [{ data: msgs }, { data: convFiles }] = await Promise.all([
      supabase
        .schema("learning")
        .from("messages")
        .select("id, role, content")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true }),
      supabase
        .schema("learning")
        .from("conversation_files")
        .select("id, message_id, file_name, file_type, mime_type, file_size")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true }),
    ]);
    messages = msgs ?? [];
    files = convFiles ?? [];
  }

  return (
    <Chat
      conversationId={conversationId}
      initialMessages={messages}
      initialFiles={files}
      conversations={conversations}
      recommendations={recommendations}
      studentName={studentName}
      studentAvatarUrl={profile.profile_picture_url}
      studentPlan={planLabel}
    />
  );
}
