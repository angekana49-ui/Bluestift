import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  RoomView,
  type PrivateFileRow,
  type RoomFileRow,
} from "@/components/room-view";
import { initialsOf } from "@/lib/name";
import { getPlanLabel } from "@/lib/billing";
import { softValue } from "@/lib/page-data";

export default async function RoomPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const roomCols = "id, name, subject, ai_mode, visibility, timer_ends_at";

  // Wave 1: the profile gate, the chrome plan label, the room shell and this
  // user's membership — four round trips that used to run one after another.
  const [{ data: profile }, studentPlan, roomRes, { data: membership }] = await Promise.all([
    supabase
      .from("users")
      .select("account_state, display_name, username, profile_picture_url")
      .eq("id", user.id)
      .single(),
    softValue(getPlanLabel({ userId: user.id }), "User — Free"),
    supabase.schema("learning").from("rooms").select(roomCols).eq("id", id).maybeSingle(),
    supabase
      .schema("learning")
      .from("room_members")
      .select("id")
      .eq("room_id", id)
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);
  if (!profile || profile.account_state === "onboarding_pending") {
    redirect("/onboarding");
  }
  const studentName = profile.display_name || profile.username || "";
  let room = roomRes.data;
  // Invite-link access: a private room may be hidden from non-members by RLS.
  // Knowing the room's id (an unguessable UUID) IS the invitation, so fall back
  // to a service-role read for the shell — content stays gated on membership.
  if (!room) {
    const admin = createAdminClient();
    ({ data: room } = await admin
      .schema("learning")
      .from("rooms")
      .select(roomCols)
      .eq("id", id)
      .maybeSingle());
  }
  if (!room) redirect("/rooms");

  const isMember = !!membership;

  let messages: {
    id: string;
    user_id: string | null;
    role: string;
    content: string | null;
    has_media?: boolean;
  }[] = [];
  let memberCount = 0;
  let roomFiles: RoomFileRow[] = [];
  let privateConvId: string | null = null;
  let privateMessages: { id: string; role: string; content: string | null }[] = [];
  let privateFiles: PrivateFileRow[] = [];
  let roomReport: {
    id: string;
    summary: string | null;
    key_learnings: string | null;
    highlights: unknown;
    recommendations: string | null;
    squad_score: number | null;
    created_at: string;
  } | null = null;
  if (isMember) {
    const [{ data: msgs }, { count }, { data: priv }, { data: rf }] = await Promise.all([
      supabase
        .schema("learning")
        .from("room_messages")
        // created_at is the client's backfill watermark after a dropped socket.
        .select("id, user_id, role, content, has_media, created_at")
        .eq("room_id", id)
        .order("created_at", { ascending: true })
        .limit(200),
      supabase
        .schema("learning")
        .from("room_members")
        .select("id", { count: "exact", head: true })
        .eq("room_id", id),
      supabase
        .schema("learning")
        .from("conversations")
        .select("id")
        .eq("user_id", user.id)
        .eq("room_id", id)
        .eq("is_private_room_channel", true)
        .maybeSingle(),
      // Shared documents, so the group channel paints its cards on first render.
      supabase
        .schema("learning")
        .from("room_files")
        .select("id, message_id, file_name, file_type, mime_type, file_size")
        .eq("room_id", id),
    ]);
    messages = msgs ?? [];
    memberCount = count ?? 0;
    roomFiles = rf ?? [];
    privateConvId = priv?.id ?? null;
    if (privateConvId) {
      const [{ data: pm }, { data: pf }] = await Promise.all([
        supabase
          .schema("learning")
          .from("messages")
          .select("id, role, content")
          .eq("conversation_id", privateConvId)
          .order("created_at", { ascending: true })
          .limit(100),
        supabase
          .schema("learning")
          .from("conversation_files")
          .select("id, message_id, file_name, file_type, mime_type, file_size")
          .eq("conversation_id", privateConvId)
          .order("created_at", { ascending: true }),
      ]);
      privateMessages = pm ?? [];
      privateFiles = pf ?? [];
    }

    const { data: rep } = await supabase
      .schema("learning")
      .from("room_reports")
      .select("id, summary, key_learnings, highlights, recommendations, squad_score, created_at")
      .eq("room_id", id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    roomReport = rep ?? null;
  }

  return (
    <RoomView
      roomId={room.id}
      roomName={room.name}
      subject={room.subject}
      visibility={room.visibility}
      timerEndsAt={room.timer_ends_at ?? null}
      isMember={isMember}
      memberCount={memberCount}
      myUserId={user.id}
      studentName={studentName}
      studentInitials={initialsOf(studentName)}
      studentAvatarUrl={profile.profile_picture_url}
      studentPlan={studentPlan}
      initialMessages={messages}
      initialRoomFiles={roomFiles}
      privateConvId={privateConvId}
      privateMessages={privateMessages}
      privateFiles={privateFiles}
      initialReport={roomReport}
    />
  );
}
