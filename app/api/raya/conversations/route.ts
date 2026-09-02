import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rayaComplete } from "@/lib/raya/llm";
import { kernel, clampHistory } from "@/lib/kernel/client";
import { setLatestAnalysis, invalidateProfile } from "@/lib/kernel/profile-cache";
import type { KernelMessage } from "@/lib/kernel/types";

/**
 * Conversation history for the solo /chat surface.
 * GET  ?id=<convId>  -> its messages + attachments (RLS enforces ownership)
 * POST {conversationId} -> auto-name it: Raya distils the exchange into a
 *                          one-sentence title (called around the 2nd exchange).
 * PATCH {conversationId, action} -> archive | unarchive | memorize (see below)
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

  let body: { conversationId?: string };
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

  let title: string;
  try {
    const { text } = await rayaComplete([
      {
        role: "system",
        content:
          "You title tutoring conversations. Read the exchange and reply with a single, " +
          "short sentence that captures what it is about — max 8 words, in the student's " +
          "own language. Plain text only: no quotes, no trailing period, no preamble.",
      },
      { role: "user", content: transcript },
      // Titling is an eight-word summary, not tutoring — it has no business on
      // the expensive tier.
    ], "fast");
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

/**
 * The three verbs the history list offers, beyond opening a thread.
 *
 *   archive / unarchive  a pure state flip. Cheap, instant, reversible — the
 *                        messages are never touched.
 *
 *   memorize             the expensive one: the Kernel reads the WHOLE thread
 *                        and folds it into the learner's cognitive profile,
 *                        then the thread is stamped as deliberately anchored.
 *
 *   forget               drops the anchor: the thread leaves the Memory list on
 *                        the Kernel page and stops being one of the threads the
 *                        learner has designated. It is NOT an unlearn, and the
 *                        UI says so — the mastery the Kernel already derived
 *                        lives in the profile, not in this stamp, and pretending
 *                        otherwise would be the one lie this whole menu exists
 *                        to avoid.
 *
 * Memorize is deliberately synchronous, unlike the every-3rd-turn analysis in
 * the chat route, which is fire-and-forget. That one is ambient and nobody is
 * waiting on it; this one is a button someone pressed after reading a dialog
 * that promised their profile would be updated. Telling them "done" before
 * knowing it worked would make that promise a guess.
 */
export async function PATCH(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: { conversationId?: string; action?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const id = body.conversationId;
  const action = body.action;
  if (!id) return NextResponse.json({ error: "missing conversationId" }, { status: 400 });
  if (
    action !== "archive" &&
    action !== "unarchive" &&
    action !== "memorize" &&
    action !== "forget"
  ) {
    return NextResponse.json({ error: "unknown action" }, { status: 400 });
  }

  // Owner + kind gate, same as the auto-title path: a private room channel is
  // the room's, not the learner's, so it is not theirs to file or absorb.
  const { data: conv } = await supabase
    .schema("learning")
    .from("conversations")
    .select("id, user_id, is_private_room_channel")
    .eq("id", id)
    .maybeSingle();
  if (!conv || conv.user_id !== user.id || conv.is_private_room_channel) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  if (action === "archive" || action === "unarchive") {
    const archived_at = action === "archive" ? new Date().toISOString() : null;
    const { error } = await supabase
      .schema("learning")
      .from("conversations")
      .update({ archived_at })
      .eq("id", id)
      .eq("user_id", user.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, archived_at });
  }

  // ── forget ──────────────────────────────────────────────────
  // Clearing the stamp only. `kernel_triggered` is deliberately left alone: it
  // records that an analysis DID run on this thread, which stays true.
  if (action === "forget") {
    const { error } = await supabase
      .schema("learning")
      .from("conversations")
      .update({ memorized_at: null })
      .eq("id", id)
      .eq("user_id", user.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, memorized_at: null });
  }

  // ── memorize ────────────────────────────────────────────────
  const { data: msgs } = await supabase
    .schema("learning")
    .from("messages")
    .select("role, content")
    .eq("conversation_id", id)
    .order("created_at", { ascending: true });

  const history: KernelMessage[] = (msgs ?? [])
    .map((m) => ({
      role: m.role === "assistant" ? ("assistant" as const) : ("user" as const),
      content: m.content ?? "",
    }))
    .filter((m) => m.content.trim().length > 0);
  // Nothing was said, so there is nothing to learn. Refused rather than stamped:
  // an empty thread marked "memorized" would be a lie the profile page repeats.
  if (history.length === 0) {
    return NextResponse.json({ error: "empty" }, { status: 400 });
  }

  // About one student, who is the caller: send their token, not the skeleton key.
  const {
    data: { session },
  } = await supabase.auth.getSession();

  let analysis;
  try {
    analysis = await kernel.analyze(
      {
        user_id: user.id,
        conversation_history: clampHistory(history),
        trigger: "post_conversation",
      },
      // Someone is watching a spinner, and the container may be cold.
      { accessToken: session?.access_token, timeoutMs: 25_000 },
    );
  } catch {
    // The stamp is NOT written on failure. A conversation marked memorized whose
    // analysis never landed is the worst of both: the learner stops asking, and
    // the profile never got the thread.
    return NextResponse.json({ error: "kernel_unreachable" }, { status: 502 });
  }

  // `anchored`: this one was asked for, so it goes to the durable slot as well
  // as the ambient one. Without that flag the next automatic pass — three turns
  // later — overwrites it, and it expires in thirty minutes regardless, which
  // is what made this button's promise false at the tutor's end.
  setLatestAnalysis(user.id, analysis, { anchored: true });
  invalidateProfile(user.id);

  const memorized_at = new Date().toISOString();
  const { error } = await supabase
    .schema("learning")
    .from("conversations")
    .update({ memorized_at, kernel_triggered: true })
    .eq("id", id)
    .eq("user_id", user.id);
  // The Kernel already absorbed it — the profile IS updated. Failing the whole
  // call over the stamp would tell the learner nothing happened, which is false.
  if (error) {
    return NextResponse.json({ ok: true, memorized_at: null, root_gap: analysis.root_gap ?? null });
  }

  return NextResponse.json({
    ok: true,
    memorized_at,
    root_gap: analysis.root_gap ?? null,
    summary: analysis.summary ?? null,
    concepts: Object.keys(analysis.mastery_map ?? {}).length,
  });
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
