import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Return a short-lived signed URL for a file in the private `user-media` bucket.
 * Authorization:
 *  - `roomFileId`: allowed if RLS lets the caller read that room_files row
 *    (i.e. they are a room member).
 *  - `conversationFileId`: allowed if RLS lets the caller read that
 *    conversation_files row (i.e. they own the parent conversation).
 *  - `path`: allowed only if the path is under the caller's own folder.
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
  if (body.roomFileId) {
    const { data: rf } = await supabase
      .schema("learning")
      .from("room_files")
      .select("file_path")
      .eq("id", body.roomFileId)
      .maybeSingle();
    path = rf?.file_path ?? null; // RLS guarantees membership if a row is returned
  } else if (body.conversationFileId) {
    const { data: cf } = await supabase
      .schema("learning")
      .from("conversation_files")
      .select("file_path")
      .eq("id", body.conversationFileId)
      .maybeSingle();
    path = cf?.file_path ?? null; // RLS guarantees ownership if a row is returned
  } else if (typeof body.path === "string" && body.path.startsWith(`${user.id}/`)) {
    path = body.path;
  }

  if (!path) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const admin = createAdminClient();
  const { data, error } = await admin.storage
    .from("user-media")
    .createSignedUrl(path, 3600);
  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "failed" }, { status: 500 });
  }
  return NextResponse.json({ url: data.signedUrl });
}
