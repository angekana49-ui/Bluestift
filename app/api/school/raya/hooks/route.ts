import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateJson } from "@/lib/raya/llm";
import { getAdminMembership, buildSchoolContext, buildProfContext } from "@/lib/school-admin";

export const runtime = "nodejs";
export const maxDuration = 15;

/**
 * HYBRID new-conversation hooks for the RAYA-for-Schools surface. Grounds on the
 * same live context the chat uses (buildSchoolContext for admins / buildProfContext
 * for teachers — at-risk students, weak concepts, classes). If that context exists,
 * an LLM turns it into a short greeting + analytic quick-start chips; otherwise it
 * returns {} and the client keeps its static hooks. Never throws.
 */
export async function GET() {
  const empty = NextResponse.json({});
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return empty;

    const membership = await getAdminMembership(user.id);
    if (!membership) return empty;

    const context =
      membership.role === "admin_master" ? await buildSchoolContext(user.id) : await buildProfContext(user.id);
    if (!context || context.trim().length === 0) return empty;

    // Address by ROLE, never by name — the greeting must never carry the school
    // name (nonsensical) and a role word always reads right.
    const roleLabel = membership.role === "admin_master" ? "Admin" : "Teacher";

    const system =
      "You write micro-copy for the empty 'new chat' screen of RAYA for Schools, an analytics " +
      "assistant for teachers and admins. From the live school context, return STRICT JSON " +
      '{"greeting":"...","suggestions":["...","...","..."]}. ' +
      `greeting: one short line (max 7 words), addressed to "${roleLabel}" (never a person or school name). ` +
      "suggestions: 3 or 4 quick-start chips, max 6 words each, " +
      "pointing at what deserves attention right now (a specific at-risk class/student, a weak " +
      "concept, a summary). Natural and actionable. No emojis, no markdown, JSON only.";
    const userMsg = `School context:\n${context.slice(0, 3500)}`;

    const raw = await Promise.race([
      generateJson(system, userMsg).catch(() => null),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 7000)),
    ]);
    if (!raw) return empty;

    const parsed = JSON.parse(raw) as { greeting?: unknown; suggestions?: unknown };
    const greeting = typeof parsed.greeting === "string" ? parsed.greeting.trim().slice(0, 80) : undefined;
    const suggestions = Array.isArray(parsed.suggestions)
      ? parsed.suggestions.filter((s): s is string => typeof s === "string" && s.trim().length > 0).map((s) => s.trim().slice(0, 44)).slice(0, 4)
      : undefined;
    if (!greeting && (!suggestions || suggestions.length === 0)) return empty;

    return NextResponse.json({ greeting, suggestions });
  } catch {
    return empty;
  }
}
