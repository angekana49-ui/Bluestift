import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, createSchoolsAdminClient } from "@/lib/supabase/admin";
import { buildProfContext, buildSchoolContext, getAdminMembership } from "@/lib/school-admin";
import { rayaStream, type ChatMsg } from "@/lib/raya/llm";

export const runtime = "nodejs";
export const maxDuration = 60;

const SYSTEM = `You are RAYA for Schools, an analytics assistant for a school staff member.
Answer ONLY from the DATA SNAPSHOT and any attached documents below — never invent
students, classes, or numbers. Be concise and cite the actual figures. If the data lacks
the information, say so plainly and suggest what would surface it (e.g. students using
RAYA more). Honour any STANDING INSTRUCTIONS from the school. Reply in the user's language.`;

/**
 * One RAYA-for-Schools turn, STREAMED — the staff-side mirror of /api/raya/chat.
 * Persists to learning.conversations (context_type='school_analytics' + school_id)
 * so the staff member keeps a real, reloadable history. Grounded in the school
 * data snapshot + active directives + any documents attached to the conversation.
 * No Kernel loop (this is analytics, not a per-student tutoring session).
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: { conversationId?: string | null; content?: string; fileIds?: string[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const content = (body.content ?? "").trim().slice(0, 2000);
  if (!content) return NextResponse.json({ error: "empty message" }, { status: 400 });

  const membership = await getAdminMembership(user.id);
  if (!membership) {
    return NextResponse.json({ error: "School staff only." }, { status: 403 });
  }

  const fileIds = Array.isArray(body.fileIds)
    ? body.fileIds.filter((id): id is string => typeof id === "string").slice(0, 10)
    : [];

  // Ensure a conversation scoped to this staff member + school.
  let convId = body.conversationId ?? null;
  if (convId) {
    // Only this user's own school-analytics conversations are writable here.
    const { data: conv } = await supabase
      .schema("learning")
      .from("conversations")
      .select("id")
      .eq("id", convId)
      .eq("user_id", user.id)
      .eq("context_type", "school_analytics")
      .maybeSingle();
    if (!conv) return NextResponse.json({ error: "conversation not found" }, { status: 403 });
  } else {
    const title = content.length > 60 ? `${content.slice(0, 57)}…` : content;
    const { data, error } = await supabase
      .schema("learning")
      .from("conversations")
      .insert({
        user_id: user.id,
        context_type: "school_analytics",
        school_id: membership.schoolId,
        title,
      })
      .select("id")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    convId = data.id;
  }

  // Store the staff message.
  const { data: userMsg, error: umErr } = await supabase
    .schema("learning")
    .from("messages")
    .insert({
      conversation_id: convId,
      user_id: user.id,
      role: "user",
      content,
      has_media: fileIds.length > 0,
    })
    .select("id")
    .single();
  if (umErr) return NextResponse.json({ error: umErr.message }, { status: 500 });

  // Link staged documents to this message (service role — no RLS UPDATE policy).
  if (fileIds.length > 0) {
    const { error: linkErr } = await createAdminClient()
      .schema("learning")
      .from("conversation_files")
      .update({ message_id: userMsg.id })
      .in("id", fileIds)
      .eq("conversation_id", convId)
      .is("message_id", null);
    if (linkErr) console.error("attachment link failed", linkErr.message);
  }

  // Grounding: the school/prof data snapshot + active directives + doc text.
  const [context, directives, { data: convFiles }] = await Promise.all([
    membership.role === "admin_master"
      ? buildSchoolContext(user.id)
      : buildProfContext(user.id),
    activeDirectives(membership.schoolId, membership.role),
    supabase
      .schema("learning")
      .from("conversation_files")
      .select("file_name, content")
      .eq("conversation_id", convId)
      .not("content", "is", null)
      .limit(10),
  ]);
  if (context == null) {
    return NextResponse.json({ error: "No school data available for you yet." }, { status: 403 });
  }

  const docs = (convFiles ?? [])
    .map((f) => `# ${f.file_name}\n${f.content}`)
    .join("\n\n")
    .slice(0, 8000);

  // Recent history (chronological), capped.
  const { data: hist } = await supabase
    .schema("learning")
    .from("messages")
    .select("role, content")
    .eq("conversation_id", convId)
    .order("created_at", { ascending: true })
    .limit(20);
  const history: ChatMsg[] = (hist ?? []).map((m) => ({
    role: m.role === "assistant" ? ("assistant" as const) : ("user" as const),
    content: String(m.content ?? "").slice(0, 2000),
  }));

  const systemBlocks = [
    SYSTEM,
    `=== DATA SNAPSHOT ===\n${context}`,
    directives ? `=== STANDING INSTRUCTIONS ===\n${directives}` : "",
    docs ? `=== ATTACHED DOCUMENTS ===\n${docs}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  const messages: ChatMsg[] = [{ role: "system", content: systemBlocks }, ...history];

  // Start the stream (provider chosen here so we can't set headers later).
  let model: string;
  let deltas: AsyncGenerator<string>;
  try {
    const out = await rayaStream(messages);
    model = out.model;
    deltas = out.stream;
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "llm error" }, { status: 502 });
  }

  const convIdFinal = convId;
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let full = "";
      try {
        for await (const delta of deltas) {
          full += delta;
          controller.enqueue(encoder.encode(delta));
        }
      } catch {
        // keep whatever streamed so far
      }
      try {
        await supabase.schema("learning").from("messages").insert({
          conversation_id: convIdFinal,
          user_id: null,
          role: "assistant",
          content: full,
          model_used: model,
        });
        await supabase
          .schema("learning")
          .from("conversations")
          .update({ updated_at: new Date().toISOString() })
          .eq("id", convIdFinal);
      } catch {
        // non-fatal
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "no-store",
      "x-conversation-id": convIdFinal,
      "x-message-id": userMsg.id,
      "x-raya-model": model,
    },
  });
}

/** Active school directives as a bounded prompt block, audience-filtered by role. */
async function activeDirectives(schoolId: string, role: string): Promise<string> {
  const schools = createSchoolsAdminClient();
  let q = schools
    .from("school_directives")
    .select("content, audience")
    .eq("school_id", schoolId)
    .eq("is_active", true);
  if (role !== "admin_master") q = q.in("audience", ["teachers", "both"]);
  const { data } = await q;
  return ((data as { content: string }[] | null) ?? [])
    .map((d) => `- ${d.content}`)
    .join("\n")
    .slice(0, 1500);
}
