import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAdminMembership } from "@/lib/school-admin";
import { extractFileText, storageSafeName } from "@/lib/extract";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_CONTENT = 12000;

/**
 * Attach a document to a RAYA-for-Schools conversation — the staff-side mirror
 * of /api/raya/files. Stores the file, extracts its text, and keeps it on a
 * conversation_files row so the assistant can ground on it. New conversations
 * are seeded as `context_type='school_analytics'` + `school_id`.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const membership = await getAdminMembership(user.id);
  if (!membership) return NextResponse.json({ error: "School staff only." }, { status: 403 });

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "invalid form" }, { status: 400 });
  }
  const file = form.get("file");
  let conversationId = form.get("conversationId");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file required" }, { status: 400 });
  }

  // Resolve the conversation: verify ownership, or create one.
  if (typeof conversationId === "string" && conversationId) {
    const { data: conv } = await supabase
      .schema("learning")
      .from("conversations")
      .select("id")
      .eq("id", conversationId)
      .eq("user_id", user.id)
      .eq("context_type", "school_analytics")
      .maybeSingle();
    if (!conv) return NextResponse.json({ error: "conversation not found" }, { status: 403 });
  } else {
    const { data: conv, error: convErr } = await supabase
      .schema("learning")
      .from("conversations")
      .insert({
        user_id: user.id,
        context_type: "school_analytics",
        school_id: membership.schoolId,
      })
      .select("id")
      .single();
    if (convErr) return NextResponse.json({ error: convErr.message }, { status: 500 });
    conversationId = conv.id;
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

  const path = `${user.id}/school-chat/${conversationId}/${Date.now()}-${storageSafeName(file.name)}`;
  const up = await supabase.storage.from("user-media").upload(path, file);
  if (up.error) return NextResponse.json({ error: up.error.message }, { status: 500 });

  const { data: row, error } = await supabase
    .schema("learning")
    .from("conversation_files")
    .insert({
      conversation_id: conversationId,
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

  return NextResponse.json({ file: row, conversationId, hasText: text.length > 0 });
}

/**
 * Drop a staged attachment (?id=) before it is sent. Only unattached files can
 * go: once `message_id` is set the document is part of the thread.
 */
export async function DELETE(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 });

  const { data: row, error } = await supabase
    .schema("learning")
    .from("conversation_files")
    .delete()
    .eq("id", id)
    .is("message_id", null)
    .select("file_path")
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!row) return NextResponse.json({ error: "not found" }, { status: 404 });

  if (row.file_path) {
    try {
      await createAdminClient().storage.from("user-media").remove([row.file_path]);
    } catch {
      // ignore
    }
  }

  return NextResponse.json({ ok: true });
}
