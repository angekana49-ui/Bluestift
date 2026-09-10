import { NextResponse } from "next/server";
import { clientError } from "@/lib/observability/client-error";
import { createClient } from "@/lib/supabase/server";

/**
 * Archive / delete for one Tools Studio generation (summary, quiz, flashcards,
 * mind map). Owner-only in both directions — a tool_output is always personal,
 * never shared — so unlike challenges there is no "or the room/class owner"
 * branch to check.
 *
 * PATCH  { id, action: "archive" | "unarchive" } -> flip archived_at
 * DELETE ?id=<id>                                 -> remove the row for good
 */

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

  const archived_at = body.action === "archive" ? new Date().toISOString() : null;
  const { data, error } = await supabase
    .schema("learning")
    .from("tool_outputs")
    .update({ archived_at })
    .eq("id", id)
    .eq("user_id", user.id)
    .select("id")
    .maybeSingle();
  if (error) return NextResponse.json({ error: clientError(error) }, { status: 500 });
  if (!data) return NextResponse.json({ error: "not found" }, { status: 404 });

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

  const { data, error } = await supabase
    .schema("learning")
    .from("tool_outputs")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id)
    .select("id")
    .maybeSingle();
  if (error) return NextResponse.json({ error: clientError(error) }, { status: 500 });
  if (!data) return NextResponse.json({ error: "not found" }, { status: 404 });

  return NextResponse.json({ ok: true });
}
