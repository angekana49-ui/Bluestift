import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rayaComplete } from "@/lib/raya/llm";
import { LANGUAGES, normalizeLang } from "@/lib/languages";

/**
 * Conversation history for the solo /chat surface.
 * GET  ?id=<convId>  -> its messages + attachments (RLS enforces ownership)
 * POST {conversationId} -> auto-name it: Raya distils the exchange into a
 *                          one-sentence title (called around the 2nd exchange).
 * DELETE ?id=<convId> -> remove the conversation and its messages (owner only)
 *
 * Attachments come back flat. The client groups them by `message_id`; the ones
 * with a null `message_id` were uploaded but never sent, so they go back into
 * the composer where the student left them.
 */

/** Tidy the model's answer into a title: first line, no quotes/period, capped. */
function cleanTitle(raw: string): string {
  let t = (raw.split("\n").find((l) => l.trim()) ?? "").trim();
  t = t.replace(/^["'“”]+|["'“”]+$/g, "").replace(/[.]+$/, "").trim();
  return t.length > 70 ? `${t.slice(0, 67)}…` : t;
}
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

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: { conversationId?: string; language?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const id = body.conversationId;
  if (!id) return NextResponse.json({ error: "missing conversationId" }, { status: 400 });

  // Owner + kind gate: private room channels keep the room's name, so they never
  // get an auto-title. RLS also scopes this read to the caller.
  const { data: conv } = await supabase
    .schema("learning")
    .from("conversations")
    .select("id, user_id, is_private_room_channel")
    .eq("id", id)
    .maybeSingle();
  if (!conv || conv.user_id !== user.id || conv.is_private_room_channel) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const { data: msgs } = await supabase
    .schema("learning")
    .from("messages")
    .select("role, content")
    .eq("conversation_id", id)
    .order("created_at", { ascending: true })
    .limit(6);
  const transcript = (msgs ?? [])
    .map((m) => `${m.role === "assistant" ? "Raya" : "Student"}: ${(m.content ?? "").slice(0, 500)}`)
    .join("\n")
    .slice(0, 2500);
  if (!transcript) return NextResponse.json({ error: "empty" }, { status: 400 });

  // Title in the picked reply language, so it matches the thread it labels.
  const lang = LANGUAGES.find((l) => l.code === normalizeLang(body.language)) ?? LANGUAGES[0];
  let title: string;
  try {
    const { text } = await rayaComplete([
      {
        role: "system",
        content:
          "You title tutoring conversations. Read the exchange and reply with a single, " +
          `short sentence that captures what it is about — max 8 words, in ${lang.englishName} ` +
          `(${lang.nativeName}). Plain text only: no quotes, no trailing period, no preamble.`,
      },
      { role: "user", content: transcript },
    ]);
    title = cleanTitle(text);
  } catch {
    return NextResponse.json({ error: "llm error" }, { status: 502 });
  }
  if (!title) return NextResponse.json({ error: "empty title" }, { status: 502 });

  const { error } = await supabase
    .schema("learning")
    .from("conversations")
    .update({ title })
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ title });
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
