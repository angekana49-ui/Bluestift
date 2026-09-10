import { NextResponse } from "next/server";
import { clientError } from "@/lib/observability/client-error";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Archive / delete for one challenge — a solo self-test (`room_id` null) or a
 * room challenge (`room_id` set). Reads and writes go through the admin client
 * because `challenges/create` already does (correct_answer must stay out of
 * regular-client reach), so authorization is checked here in code rather than
 * leaned on RLS.
 *
 * Who may act on a challenge:
 *   solo self-test   its creator only (nobody else can even see one — the
 *                     library list is scoped to the caller).
 *   room challenge    its creator, OR the room's owner (created_by on
 *                     learning.rooms) — a room lead can clear challenges other
 *                     members made, same as they already moderate the room.
 *
 * PATCH  { id, action: "archive" | "unarchive" } -> flip archived_at
 * DELETE ?id=<id>                                 -> remove the challenge, its
 *                                                    questions and every
 *                                                    member's attempts
 */

async function authorize(admin: ReturnType<typeof createAdminClient>, userId: string, id: string) {
  const { data: challenge } = await admin
    .schema("learning")
    .from("challenges")
    .select("id, room_id, created_by, scope")
    .eq("id", id)
    .maybeSingle();
  if (!challenge) return { challenge: null, allowed: false };

  if (challenge.created_by === userId) return { challenge, allowed: true };
  if (!challenge.room_id) return { challenge, allowed: false };

  const { data: room } = await admin
    .schema("learning")
    .from("rooms")
    .select("created_by")
    .eq("id", challenge.room_id)
    .maybeSingle();
  const allowed = !!room && room.created_by === userId;
  return { challenge, allowed };
}

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: { id?: string; action?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const id = body.id;
  if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 });
  if (body.action !== "archive" && body.action !== "unarchive") {
    return NextResponse.json({ error: "unknown action" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { challenge, allowed } = await authorize(admin, user.id, id);
  if (!challenge) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (!allowed) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const archived_at = body.action === "archive" ? new Date().toISOString() : null;
  const { error } = await admin.schema("learning").from("challenges").update({ archived_at }).eq("id", id);
  if (error) return NextResponse.json({ error: clientError(error) }, { status: 500 });

  return NextResponse.json({ ok: true, archived_at });
}

export async function DELETE(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 });

  const admin = createAdminClient();
  const { challenge, allowed } = await authorize(admin, user.id, id);
  if (!challenge) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (!allowed) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  // A Schools "Prepare" assignment materializes as one of these (scope
  // "assignment", room_id null — created_by is the prof, so it can otherwise
  // look exactly like their own personal self-test). It's a class's homework
  // record — deleting it here, from the personal Tools surface, would pull a
  // class's assignment and grading history out from under its students.
  // Archiving still works; only the hard delete is blocked.
  if (challenge.scope === "assignment") {
    return NextResponse.json(
      { error: "This is a class assignment, not a personal test — archive it instead of deleting it." },
      { status: 409 },
    );
  }

  // Children first, in case a FK isn't ON DELETE CASCADE — same defensive
  // order as the conversation delete route.
  await admin.schema("learning").from("challenge_attempts").delete().eq("challenge_id", id);
  await admin.schema("learning").from("challenge_questions").delete().eq("challenge_id", id);
  const { error } = await admin.schema("learning").from("challenges").delete().eq("id", id);
  if (error) return NextResponse.json({ error: clientError(error) }, { status: 500 });

  return NextResponse.json({ ok: true });
}
