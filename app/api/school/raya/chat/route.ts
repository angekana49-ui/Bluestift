import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, createSchoolsAdminClient } from "@/lib/supabase/admin";
import { buildProfContext, buildSchoolContext, getAdminMembership } from "@/lib/school-admin";
import { rayaStream, type ChatMsg } from "@/lib/raya/llm";
import { checkStrictUserRateLimit } from "@/lib/rate-limit";
import { persistAndGather, linkAttachments, replayReply } from "@/lib/raya/chat-context";
import { FORMATTING_RULES } from "@/lib/raya/prompt";

export const runtime = "nodejs";
export const maxDuration = 60;

const SYSTEM = `You are Raya for Schools, an analytics assistant for a school staff member.
Answer ONLY from the DATA SNAPSHOT and any attached documents below — never invent
students, classes, or numbers. Be concise and cite the actual figures. If the data lacks
the information, say so plainly and suggest what would surface it (e.g. students using
Raya more). Honour any STANDING INSTRUCTIONS from the school. Reply in the user's language.

${FORMATTING_RULES}`;

/**
 * One Raya-for-Schools turn, STREAMED — the staff-side mirror of /api/raya/chat.
 * Persists to learning.conversations (context_type='school_analytics' + school_id)
 * so the staff member keeps a real, reloadable history. Grounded in the school
 * data snapshot + active directives + any documents attached to the conversation.
 * No Kernel loop (this is analytics, not a per-student tutoring session).
 *
 * The pre-LLM Supabase work runs in two parallel waves (this was the app's
 * worst hot path: ~8 serial round trips before the first token).
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: {
    conversationId?: string | null;
    content?: string;
    fileIds?: string[];
    clientMsgId?: string | null;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const content = (body.content ?? "").trim().slice(0, 2000);
  if (!content) return NextResponse.json({ error: "empty message" }, { status: 400 });

  const fileIds = Array.isArray(body.fileIds)
    ? body.fileIds.filter((id): id is string => typeof id === "string").slice(0, 10)
    : [];

  let convId = body.conversationId ?? null;
  const requestedConvId = convId;

  // ── Wave 1: rate limit, membership, conversation ownership, and the
  // membership-dependent grounding (data snapshot + directives), in parallel ──
  const membershipPromise = getAdminMembership(user.id);
  const [allowed, membership, convOk, context, directives] = await Promise.all([
    // Anti-abuse rate-limit only — staff chat is never quota-metered. Keyed by
    // user id so a school behind one shared NAT is never collectively throttled.
    checkStrictUserRateLimit("school_raya_chat", user.id, 30, "1 minute"),
    membershipPromise,
    // Only this user's own school-analytics conversations are writable here.
    requestedConvId
      ? membershipPromise.then(async (m) => {
          if (!m) return false;
          const { data } = await supabase
            .schema("learning")
            .from("conversations")
            .select("id")
            .eq("id", requestedConvId)
            .eq("user_id", user.id)
            .eq("context_type", "school_analytics")
            .eq("school_id", m.schoolId)
            .maybeSingle();
          return data != null;
        })
      : Promise.resolve(true),
    membershipPromise.then((m) =>
      m ? (m.role === "admin_master" ? buildSchoolContext(user.id) : buildProfContext(user.id)) : null,
    ),
    membershipPromise.then((m) => (m ? activeDirectives(m.schoolId, m.role) : "")),
  ]);
  if (!allowed) {
    return NextResponse.json(
      { error: "You're sending messages very fast — give it a second." },
      { status: 429 },
    );
  }
  if (!membership) {
    return NextResponse.json({ error: "School staff only." }, { status: 403 });
  }
  if (!convOk) return NextResponse.json({ error: "conversation not found" }, { status: 403 });
  if (context == null) {
    return NextResponse.json({ error: "No school data available for you yet." }, { status: 403 });
  }

  // Ensure a conversation scoped to this staff member + school (new chats only).
  if (!convId) {
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

  // ── Wave 2: store the staff message + gather history/documents, in parallel ──
  const turn = await persistAndGather(supabase, {
    conversationId: convId,
    userId: user.id,
    content,
    fileIds,
    clientMsgId: typeof body.clientMsgId === "string" ? body.clientMsgId : null,
  });
  if (turn.error !== undefined) {
    return NextResponse.json({ error: turn.error }, { status: 500 });
  }
  const { userMsgId, hist, docs, existingReply } = turn;

  // Already answered (retry after a lost response): replay, don't regenerate.
  if (existingReply != null) {
    return replayReply(existingReply, convId, userMsgId);
  }

  const history: ChatMsg[] = hist.map((m) => ({
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

  // Link staged documents — overlapped with the LLM start, awaited pre-response.
  const linkPromise = linkAttachments(createAdminClient(), convId, userMsgId, fileIds);

  // Start the stream (provider chosen here so we can't set headers later).
  let model: string;
  let deltas: AsyncGenerator<string>;
  try {
    const out = await rayaStream(messages);
    model = out.model;
    deltas = out.stream;
  } catch (e) {
    await linkPromise;
    return NextResponse.json({ error: e instanceof Error ? e.message : "llm error" }, { status: 502 });
  }
  await linkPromise;

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
      "x-message-id": userMsgId,
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
