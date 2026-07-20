import { NextResponse } from "next/server";
import { createContentAdminClient } from "@/lib/supabase/admin";

const TYPES = new Set(["resonates", "important"]);

/** React to a wall post ("resonates" / "important"). */
export async function POST(req: Request) {
  let body: { post_id?: string; type?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const postId = (body.post_id ?? "").trim();
  if (!/^[0-9a-f-]{36}$/i.test(postId) || !TYPES.has(body.type ?? "")) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }

  const admin = createContentAdminClient();
  const { error } = await admin
    .from("survey_post_reactions")
    .insert({ post_id: postId, type: body.type });
  if (error) return NextResponse.json({ error: "insert_failed" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
