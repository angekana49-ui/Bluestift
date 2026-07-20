import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { extractFileText, storageSafeName } from "@/lib/extract";
import { assertRoomOpen } from "@/lib/rooms";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_CONTENT = 12000;

/**
 * Upload a file to a room: store it, extract its text, and keep the text on the
 * room_files row so RAYA can use the room's documents as context.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "invalid form" }, { status: 400 });
  }
  const roomId = form.get("roomId");
  const file = form.get("file");
  if (typeof roomId !== "string" || !(file instanceof File)) {
    return NextResponse.json({ error: "roomId and file required" }, { status: 400 });
  }

  // Authorize: caller must be a room member (RLS lets you read your own row).
  const { data: membership } = await supabase
    .schema("learning")
    .from("room_members")
    .select("id")
    .eq("room_id", roomId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!membership) {
    return NextResponse.json({ error: "You must be a room member." }, { status: 403 });
  }

  // A timed room that has ended is read-only — no new shared documents.
  const { open } = await assertRoomOpen(supabase, roomId);
  if (!open) {
    return NextResponse.json({ error: "This room has ended — it's now read-only." }, { status: 403 });
  }

  // Extract text (best-effort — a file with no text still uploads).
  let text = "";
  let kind = "other";
  try {
    const res = await extractFileText(file);
    text = res.text.slice(0, MAX_CONTENT);
    kind = res.kind;
  } catch {
    // unsupported / unreadable — keep the file, no text context
  }

  const path = `${user.id}/rooms/${roomId}/${Date.now()}-${storageSafeName(file.name)}`;
  const up = await supabase.storage.from("user-media").upload(path, file);
  if (up.error) return NextResponse.json({ error: up.error.message }, { status: 500 });

  const { data: row, error } = await supabase
    .schema("learning")
    .from("room_files")
    .insert({
      room_id: roomId,
      file_name: file.name,
      file_path: path,
      file_type: kind,
      mime_type: file.type || null,
      file_size: file.size,
      uploader_id: user.id,
      content: text || null,
    })
    .select("id, file_name, file_type, mime_type, file_size, created_at")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Livestream the upload to the room's group channel so everyone sees the new
  // document in real time (Realtime fans this INSERT out). Flagged with
  // has_media so the client renders it as an attachment, not chat. `content`
  // keeps the file name as a fallback if the file row ever goes missing.
  // Best-effort — never fail the upload if the notice can't be posted.
  const { data: notice } = await supabase
    .schema("learning")
    .from("room_messages")
    .insert({
      room_id: roomId,
      user_id: user.id,
      role: "user",
      has_media: true,
      content: file.name,
    })
    .select("id")
    .maybeSingle();

  // Tie the file to its notice so the group channel can render it in place.
  // Service role: room_files has no RLS UPDATE policy, by design.
  if (notice) {
    await createAdminClient()
      .schema("learning")
      .from("room_files")
      .update({ message_id: notice.id })
      .eq("id", row.id);
  }

  return NextResponse.json({
    file: { ...row, message_id: notice?.id ?? null },
    hasText: text.length > 0,
  });
}
