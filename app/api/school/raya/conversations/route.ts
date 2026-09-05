import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAdminMembership } from "@/lib/school-admin";

/**
 * History for the Raya-for-Schools chat — the staff-side mirror of
 * /api/raya/conversations, scoped to `context_type='school_analytics'` for the
 * signed-in staff member and their active school.
 *   GET  (no id) -> the conversation list (for the in-tab history)
 *   GET  ?id     -> its messages + attachments
 *   DELETE ?id   -> remove the conversation and its messages (owner only)
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const id = new URL(request.url).searchParams.get("id");

  // No id → the history list for the active school.
  if (!id) {
    const membership = await getAdminMembership(user.id);
    if (!membership) return NextResponse.json({ error: "School staff only." }, { status: 403 });
    const { data, error } = await supabase
      .schema("learning")
      .from("conversations")
      .select("id, title, updated_at")
      .eq("user_id", user.id)
      .eq("context_type", "school_analytics")
      .eq("school_id", membership.schoolId)
      .order("updated_at", { ascending: false });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ conversations: data ?? [] });
  }

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

  /*
   * Establish ownership BEFORE deleting anything.
   *
   * The messages delete used to run first and was keyed on the conversation id
   * alone — the ownership check sat on the conversations delete underneath it,
   * which is one table too late: an id belonging to someone else survived the
   * guard and lost its messages on the way past. Whether RLS caught it is not
   * the point; the route was relying on a check it had already walked past.
   *
   * Scoped to the ACTIVE school as well, which is what the other three paths in
   * this file do (a staff member can belong to several schools, and a thread
   * belongs to the one it was held about — see the note on the chat route).
   */
  const membership = await getAdminMembership(user.id);
  if (!membership) return NextResponse.json({ error: "School staff only." }, { status: 403 });
  const { data: owned } = await supabase
    .schema("learning")
    .from("conversations")
    .select("id")
    .eq("id", id)
    .eq("user_id", user.id)
    .eq("context_type", "school_analytics")
    .eq("school_id", membership.schoolId)
    .maybeSingle();
  if (!owned) return NextResponse.json({ error: "conversation not found" }, { status: 404 });

  await supabase.schema("learning").from("messages").delete().eq("conversation_id", id);
  const { error } = await supabase
    .schema("learning")
    .from("conversations")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id)
    .eq("context_type", "school_analytics");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
