import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { kernel } from "@/lib/kernel/client";
import { generateJson } from "@/lib/raya/llm";
import type { LoadProfileResponse } from "@/lib/kernel/types";
import type { Json } from "@/types/database.types";

/**
 * Student-facing what-if simulation — the learner's own mirror of the Schools
 * admin projection. Grounded on the student's Kernel profile (K/V/P per concept +
 * mindset); the projection itself is a grounded-LLM ESTIMATE (the Kernel has no
 * simulation endpoint yet), clearly labelled. Runs are persisted to
 * `learning.student_simulations` (RLS: owner-only) so the student keeps a history.
 */
const SYSTEM = `You are RAYA running a personal what-if projection for a student.
From the student's cognitive BASELINE (their mastery per concept — Knowledge K,
Retention V, Application P — plus mindset) and the LEVER (extra weekly study time
on a focus), estimate the plausible effect on their overall mastery over ~6 weeks.
Be encouraging and growth-oriented, honest, and NEVER fabricate progress: if the
baseline is empty or thin, set confidence "low" and say so. Speak to the student
("you"). Return JSON exactly as:
{"projected_mastery_pct": <int 0-100 or null>, "current_mastery_pct": <int 0-100 or null>,
 "confidence": "low"|"medium"|"high", "summary": "<2-3 sentences>",
 "assumptions": ["..."], "risks": ["..."], "next_steps": ["..."]}`;

/** Compact, grounded baseline string from the student's cognitive profile. */
function buildStudentBaseline(profile: LoadProfileResponse | null): {
  baseline: string;
  currentPct: number | null;
} {
  const concepts = profile?.concept_states ?? [];
  if (concepts.length === 0) {
    return { baseline: "No concepts tracked yet — the student is just getting started.", currentPct: null };
  }
  const clamp = (v: number) => Math.max(0, Math.min(1, v));
  const overall = concepts.reduce((s, c) => s + clamp(c.k_effective), 0) / concepts.length;
  const lines = concepts
    .slice(0, 30)
    .map(
      (c) =>
        `- ${c.label || c.concept_id}: K ${Math.round(clamp(c.k_effective) * 100)}%, ` +
        `V ${Math.round(clamp(c.v_score) * 100)}%, P ${Math.round(clamp(c.p_score) * 100)}% (${c.status})`,
    )
    .join("\n");
  const mindset = profile?.mindset
    ? `\nMindset: ${profile.mindset.detected_mindset} (growth score ${Math.round(clamp(profile.mindset.m_score) * 100)}%).`
    : "";
  return {
    baseline: `Overall mastery: ${Math.round(overall * 100)}% across ${concepts.length} concept(s).\nPer concept:\n${lines}${mindset}`,
    currentPct: Math.round(overall * 100),
  };
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: { focus?: string; addHours?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const focus = (body.focus ?? "").trim().slice(0, 200);
  const addHours = Number.isFinite(body.addHours)
    ? Math.min(Math.max(Number(body.addHours), 1), 20)
    : 3;

  // Baseline = the student's own cognitive profile. Kernel down → thin baseline,
  // low confidence (never blocks — the projection still runs and says so).
  let profile: LoadProfileResponse | null = null;
  try {
    profile = await kernel.loadProfile({ user_id: user.id });
  } catch {
    profile = null;
  }
  const { baseline, currentPct } = buildStudentBaseline(profile);

  const lever = `Add ${addHours} extra hour(s) per week of focused study${
    focus ? ` on: ${focus}` : " across your weakest concepts"
  }.`;

  let result: Record<string, unknown>;
  try {
    const raw = await generateJson(SYSTEM, `LEVER: ${lever}\n\nBASELINE:\n${baseline}`);
    result = JSON.parse(
      raw.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim(),
    ) as Record<string, unknown>;
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "projection failed" },
      { status: 502 },
    );
  }
  // Ground the "current" figure server-side so it can't drift from the real profile.
  if (currentPct != null) result.current_mastery_pct = currentPct;

  // Persist the run (best-effort — never fail the response if the write hiccups).
  let id: string | null = null;
  let createdAt = new Date().toISOString();
  const { data: saved } = await supabase
    .schema("learning")
    .from("student_simulations")
    .insert({ user_id: user.id, focus: focus || null, add_hours: addHours, result: result as Json })
    .select("id, created_at")
    .maybeSingle();
  if (saved) {
    id = saved.id;
    createdAt = saved.created_at;
  }

  return NextResponse.json({
    id,
    createdAt,
    parameters: { focus: focus || null, addHours, lever },
    result,
  });
}

/** The student's past simulation runs (most recent first). */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data } = await supabase
    .schema("learning")
    .from("student_simulations")
    .select("id, focus, add_hours, result, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(20);

  return NextResponse.json({ simulations: data ?? [] });
}
