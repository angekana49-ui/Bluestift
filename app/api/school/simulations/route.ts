import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createSchoolsAdminClient } from "@/lib/supabase/admin";
import { assertClassAccess, buildInsightsBaseline, getAdminMembership, getSimulations } from "@/lib/school-admin";
import { generateJson } from "@/lib/raya/llm";

/**
 * NOTE: the Kernel has no simulation endpoint yet, so the projection is computed
 * app-side by a grounded LLM from the certified `class_insights` baseline and
 * clearly labelled an estimate. Swap for a Kernel call when one exists.
 */
const SYSTEM = `You are RAYA for Schools running a what-if projection for a school admin.
From the certified BASELINE and the LEVER, estimate the plausible effect. Never fabricate
data — if the baseline is empty, say confidence is low. Return JSON exactly as:
{"projected_mastery_pct": <int 0-100 or null>, "confidence": "low"|"medium"|"high",
 "summary": "<2-3 sentences>", "assumptions": ["..."], "risks": ["..."]}`;

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const simulations = await getSimulations(user.id);
  if (simulations == null) return NextResponse.json({ error: "Admin only." }, { status: 403 });
  return NextResponse.json({ simulations });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const membership = await getAdminMembership(user.id);
  if (!membership || membership.role !== "admin_master") {
    return NextResponse.json({ error: "Admin only." }, { status: 403 });
  }

  let body: { subjectId?: string; classId?: string | null; addHours?: number; focus?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  if (!body.subjectId) return NextResponse.json({ error: "subjectId is required." }, { status: 400 });
  const addHours = Number.isFinite(body.addHours) ? Math.min(Math.max(Number(body.addHours), 0), 20) : 0;
  const focus = (body.focus ?? "").trim().slice(0, 200);

  // Optional class scope — must be a class the admin can access.
  const classId = body.classId || null;
  if (classId && !(await assertClassAccess(user.id, classId))) {
    return NextResponse.json({ error: "No access to that class." }, { status: 403 });
  }

  const { subjectName, className, baseline } = await buildInsightsBaseline(
    user.id,
    body.subjectId,
    classId,
  );
  const scope = className ? `${subjectName} in ${className}` : subjectName;
  const lever = `Add ${addHours} extra hour(s) per week of ${scope}${focus ? `, focused on: ${focus}` : ""}.`;

  let result: Record<string, unknown>;
  try {
    const raw = await generateJson(SYSTEM, `LEVER: ${lever}\n\nBASELINE:\n${baseline}`);
    result = JSON.parse(
      raw.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim(),
    ) as Record<string, unknown>;
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "projection failed" }, { status: 502 });
  }

  const parameters = {
    subjectId: body.subjectId,
    subjectName,
    classId,
    className,
    addHours,
    focus: focus || null,
    lever,
  };

  // Persist (best-effort). simulations.status per schema: pending|running|done|failed.
  let id: string | null = null;
  try {
    const schools = createSchoolsAdminClient();
    const { data } = await schools
      .from("simulations")
      .insert({
        school_id: membership.schoolId,
        created_by: membership.adminId,
        parameters,
        result,
        status: "done",
        created_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    id = (data as { id: string } | null)?.id ?? null;
  } catch {
    // not persisted — still return the projection
  }

  return NextResponse.json({ id, parameters, result, status: "done", createdAt: new Date().toISOString() });
}
