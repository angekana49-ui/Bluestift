import { NextResponse } from "next/server";
import { clientError } from "@/lib/observability/client-error";
import { createClient } from "@/lib/supabase/server";
import { ageGateResponse } from "@/lib/compliance/api-gate";
import { checkStrictUserRateLimit } from "@/lib/rate-limit";
import { cleanGuestMessages, guestTurns } from "@/lib/raya/guest";

/**
 * POST {messages} → {conversation}: the thread a visitor had with Raya before
 * signing up (lib/raya/guest.ts), filed as an ordinary solo conversation of the
 * account they just made, so creating it kept what they had said.
 *
 * The messages come from the browser, assistant turns included — they are the
 * learner's own history in their own thread, no more trusted than anything
 * else they could type into it. Capped to the size a trial can produce, and
 * a handful of imports a day so it cannot be used to bulk-write history.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const gated = await ageGateResponse(user.id);
  if (gated) return gated;

  let body: { messages?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const messages = cleanGuestMessages(body.messages);
  if (guestTurns(messages) === 0) return NextResponse.json({ error: "empty" }, { status: 400 });

  const allowed = await checkStrictUserRateLimit("raya_guest_import", user.id, 3, "24 hours");
  if (!allowed) return NextResponse.json({ error: "rate_limited" }, { status: 429 });

  const first = messages.find((m) => m.role === "user")!.content;
  const title = first.length > 60 ? `${first.slice(0, 57)}…` : first;
  const { data: conv, error } = await supabase
    .schema("learning")
    .from("conversations")
    .insert({ user_id: user.id, context_type: "solo", room_id: null, is_private_room_channel: false, title })
    .select("id, title, updated_at")
    .single();
  if (error || !conv) return NextResponse.json({ error: clientError(error) }, { status: 500 });

  // One insert shares one transaction timestamp, and the thread is read back
  // ordered by created_at — so each turn is stamped a millisecond apart, ending
  // now, to keep the order it was had in.
  const end = Date.now();
  const { error: msgErr } = await supabase
    .schema("learning")
    .from("messages")
    .insert(
      messages.map((m, i) => ({
        conversation_id: conv.id,
        user_id: m.role === "user" ? user.id : null,
        role: m.role,
        content: m.content,
        created_at: new Date(end - (messages.length - 1 - i)).toISOString(),
      })),
    );
  if (msgErr) {
    // A conversation with no messages is worse than none.
    await supabase.schema("learning").from("conversations").delete().eq("id", conv.id);
    return NextResponse.json({ error: clientError(msgErr) }, { status: 500 });
  }

  return NextResponse.json({ conversation: conv });
}
