import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateJson } from "@/lib/raya/llm";

export const runtime = "nodejs";
export const maxDuration = 15;

/**
 * HYBRID new-conversation hooks for the solo /chat surface. Reads lightweight
 * metadata (the learner's recent conversation + self-test topics); if there IS
 * some, an LLM turns it into a short personalized greeting + quick-start chips.
 * If there's no metadata, or the model/timeout fails, it returns {} and the
 * client falls back to its static hooks. Never throws — worst case is {}.
 */
export async function GET() {
  const empty = NextResponse.json({});
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return empty;

    const [{ data: prof }, { data: convs }, { data: chals }] = await Promise.all([
      supabase.from("users").select("display_name, username").eq("id", user.id).maybeSingle(),
      supabase
        .schema("learning")
        .from("conversations")
        .select("title")
        .eq("user_id", user.id)
        .is("room_id", null)
        .not("title", "is", null)
        .order("updated_at", { ascending: false })
        .limit(5),
      supabase
        .schema("learning")
        .from("challenges")
        .select("title")
        .eq("created_by", user.id)
        .is("room_id", null)
        .order("created_at", { ascending: false })
        .limit(5),
    ]);

    const firstName =
      ((prof as { display_name: string | null; username: string | null } | null)?.display_name ||
        (prof as { username: string | null } | null)?.username ||
        "")
        .trim()
        .split(/\s+/)[0] || "";

    const topics = [
      ...((convs as { title: string | null }[] | null) ?? []).map((c) => c.title),
      ...((chals as { title: string | null }[] | null) ?? []).map((c) => c.title),
    ]
      .filter((t): t is string => !!t && t.trim().length > 0)
      .slice(0, 8);

    // No metadata → let the client stay on its static hooks (the hybrid fallback).
    if (topics.length === 0) return empty;

    const system =
      "You write micro-copy for the empty 'new chat' screen of RAYA, a Socratic AI tutor. " +
      "From the learner's recent topics, return STRICT JSON " +
      '{"greeting":"...","suggestions":["...","...","..."]}. ' +
      `greeting: one short warm line (max 7 words)${firstName ? `, addressed to "${firstName}"` : ""}. ` +
      "suggestions: 3 or 4 quick-start chips, max 5 words each, " +
      "grounded in the topics (e.g. resume, revisit, or self-test them) but natural and inviting. " +
      "Write in the language of the topics. No emojis, no markdown, JSON only.";
    const userMsg = `Recent topics:\n- ${topics.join("\n- ")}`;

    const raw = await Promise.race([
      generateJson(system, userMsg).catch(() => null),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 7000)),
    ]);
    if (!raw) return empty;

    const parsed = JSON.parse(raw) as { greeting?: unknown; suggestions?: unknown };
    const greeting = typeof parsed.greeting === "string" ? parsed.greeting.trim().slice(0, 80) : undefined;
    const suggestions = Array.isArray(parsed.suggestions)
      ? parsed.suggestions.filter((s): s is string => typeof s === "string" && s.trim().length > 0).map((s) => s.trim().slice(0, 40)).slice(0, 4)
      : undefined;
    if (!greeting && (!suggestions || suggestions.length === 0)) return empty;

    return NextResponse.json({ greeting, suggestions });
  } catch {
    return empty;
  }
}
