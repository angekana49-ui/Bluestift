import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Conversation history for the solo /chat surface.
 * GET  ?id=<convId>  -> its messages + attachments (RLS enforces ownership)
 * DELETE ?id=<convId> -> remove the conversation and its messages (owner only)
 *
 * Attachments come back flat. The client groups them by `message_id`; the ones
 * with a null `message_id` were uploaded but never sent, so they go back into
 * the composer where the student left them.
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 });

  const [{ data, error }, { data: files }] = await Promise.all([
    supabase
      .schema("learning")
      .from("messages")
      .select("id, role, content")
      .eq("conversation_id", id)
      .order("created_at", { ascending: true }),
    supabase
      .schema("learning")
      .from("conversation_files")
      .select("id, message_id, file_name, file_type, mime_type, file_size")
      .eq("conversation_id", id)
      .order("created_at", { ascending: true }),
  ]);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ messages: data ?? [], files: files ?? [] });
}

export async function DELETE(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 });

  // Delete messages first in case the FK is not ON DELETE CASCADE.
  await supabase.schema("learning").from("messages").delete().eq("conversation_id", id);
  const { error } = await supabase
    .schema("learning")
    .from("conversations")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
