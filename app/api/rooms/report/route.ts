import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateJson } from "@/lib/raya/llm";
import type { Json } from "@/types/database.types";

/**
 * Generate a group study report for a room from its conversation. The requester
 * must be a member (enforced by RLS on the read). The report row is written with
 * the service role (room_reports has read-only RLS for members).
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: { roomId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const roomId = body.roomId;
  if (!roomId) return NextResponse.json({ error: "roomId required" }, { status: 400 });

  // Reading messages requires membership (RLS) — this also authorizes the caller.
  const { data: msgs } = await supabase
    .schema("learning")
    .from("room_messages")
    .select("role, content")
    .eq("room_id", roomId)
    .order("created_at", { ascending: true })
    .limit(200);
  if (!msgs || msgs.length === 0) {
    return NextResponse.json({ error: "Not enough activity to report on." }, { status: 400 });
  }

  const { data: files } = await supabase
    .schema("learning")
    .from("room_files")
    .select("file_name, content")
    .eq("room_id", roomId)
    .not("content", "is", null)
    .limit(10);
  const docs = (files ?? [])
    .map((f) => `# ${f.file_name}\n${f.content}`)
    .join("\n\n")
    .slice(0, 4000);

  const transcript =
    msgs
      .map((m) => `${m.role === "assistant" ? "RAYA" : "Student"}: ${m.content ?? ""}`)
      .join("\n")
      .slice(0, 6000) + (docs ? `\n\n=== Room documents ===\n${docs}` : "");

  let report: {
    summary?: string;
    key_learnings?: string;
    highlights?: string[];
    recommendations?: string;
    squad_score?: number;
  };
  try {
    const raw = await generateJson(
      "You are RAYA writing a short group study report from a room transcript, in the transcript's language. Return JSON exactly as: " +
        '{"summary":"...","key_learnings":"...","highlights":["...","..."],"recommendations":"...","squad_score":0}. ' +
        "squad_score is 0-100 reflecting engagement and progress.",
      transcript,
    );
    report = JSON.parse(raw);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "generation failed" },
      { status: 502 },
    );
  }

  const admin = createAdminClient();
  const { data: saved, error } = await admin
    .schema("learning")
    .from("room_reports")
    .insert({
      room_id: roomId,
      scope: "group",
      summary: report.summary ?? null,
      key_learnings: report.key_learnings ?? null,
      highlights: (report.highlights ?? []) as Json,
      recommendations: report.recommendations ?? null,
      squad_score:
        typeof report.squad_score === "number" ? Math.round(report.squad_score) : null,
      kernel_version: "raya-app",
    })
    .select("id, summary, key_learnings, highlights, recommendations, squad_score, created_at")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ report: saved });
}
