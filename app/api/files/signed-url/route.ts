import { NextResponse } from "next/server";
import { clientError } from "@/lib/observability/client-error";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isOwnedStoragePath } from "@/lib/storage-path";

/**
 * Return a short-lived signed URL for a file in the private `user-media` bucket.
 *
 * TWO NETS, and both have to pass. The row is still read through the
 * RLS-scoped client, so a policy failure alone cannot hand anything over — and
 * the route now states the predicate itself rather than inferring it from "a
 * row came back".
 *
 * That inference was sound and is not why it changed. It made this the only
 * place in the codebase where the database was the whole boundary, and it sat
 * three lines above `createAdminClient()`, whose signature no policy can refuse.
 * Everywhere else here checks in the route precisely because the service role
 * bypasses RLS; this file is no longer the exception.
 *
 * Authorization, per branch:
 *  - `roomFileId`: the caller must have a `room_members` row for the file's
 *    room. Membership, NOT authorship — a room document belongs to the room and
 *    every member may open it, which is the entire point of sharing one. And not
 *    `assertRoomOpen` either: a timed room that has ended is read-only, not
 *    unreadable.
 *  - `conversationFileId`: the caller must own the parent conversation. Checked
 *    against `conversations.user_id` rather than against the file's own
 *    `uploader_id`, which is only a proxy for it — that column is nullable and
 *    would refuse a legitimate open on any row where the two ever diverge.
 *  - `path`: must sit under the caller's own folder (`isOwnedStoragePath`).
 *    This branch always carried its own check and is unchanged.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: { roomFileId?: string; conversationFileId?: string; path?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  let path: string | null = null;
  // `typeof` rather than truthiness: a non-string id used to select this branch
  // and then fail closed further down, which is safe but silently made the
  // `path` branch unreachable for that request.
  if (typeof body.roomFileId === "string" && body.roomFileId) {
    const { data: rf } = await supabase
      .schema("learning")
      .from("room_files")
      .select("file_path, room_id")
      .eq("id", body.roomFileId)
      .maybeSingle();
    if (rf?.room_id) {
      const { data: membership } = await supabase
        .schema("learning")
        .from("room_members")
        .select("id")
        .eq("room_id", rf.room_id)
        .eq("user_id", user.id)
        .maybeSingle();
      if (membership) path = rf.file_path ?? null;
    }
  } else if (typeof body.conversationFileId === "string" && body.conversationFileId) {
    const { data: cf } = await supabase
      .schema("learning")
      .from("conversation_files")
      .select("file_path, conversation_id")
      .eq("id", body.conversationFileId)
      .maybeSingle();
    if (cf?.conversation_id) {
      const { data: conv } = await supabase
        .schema("learning")
        .from("conversations")
        .select("id")
        .eq("id", cf.conversation_id)
        .eq("user_id", user.id)
        .maybeSingle();
      if (conv) path = cf.file_path ?? null;
    }
  } else if (typeof body.path === "string" && isOwnedStoragePath(body.path, user.id)) {
    path = body.path;
  }

  if (!path) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const admin = createAdminClient();
  const { data, error } = await admin.storage
    .from("user-media")
    .createSignedUrl(path, 3600);
  if (error || !data) {
    return NextResponse.json({ error: clientError(error) }, { status: 500 });
  }
  return NextResponse.json({ url: data.signedUrl });
}
