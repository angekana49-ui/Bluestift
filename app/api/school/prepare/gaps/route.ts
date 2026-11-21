import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createSchoolsAdminClient, createKernelAdminClient } from "@/lib/supabase/admin";
import { assertClassAccess, assertSubjectAccess, getAdminMembership, getClassRoster } from "@/lib/school-admin";
import { readerConceptNamer } from "@/lib/kernel/concept-names-server";
import { apiT } from "@/lib/i18n/server";

/**
 * GET ?classId=&subjectId= → the weakest concepts for that scope, as chips.
 *
 * The Prepare tab's "what to shore up" row: same aggregation as the subject
 * grounding (per-concept average mastery across the scope's students), but
 * structured instead of prompt text, so the tab can offer each concept as a
 * one-click topic. No LLM, no quota — pure reads.
 *
 * A failure (or an empty scope) answers `{ concepts: [] }`, never an error:
 * the chips are a bonus over the form, and the generation runs fine without
 * them. Only the class/subject gates can refuse (403/404), like the Prepare
 * route itself.
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const membership = await getAdminMembership(user.id);
  if (!membership) return NextResponse.json({ error: await apiT("api.staffOnly") }, { status: 403 });

  const q = new URL(request.url).searchParams;
  const classId = q.get("classId");
  const subjectId = q.get("subjectId");
  const empty = { concepts: [] as { label: string; mastery: number }[] };

  try {
    const schools = createSchoolsAdminClient();
    let memberIds: string[] = [];
    if (classId) {
      const access = await assertClassAccess(user.id, classId);
      if (!access) return NextResponse.json({ error: await apiT("api.notYourClass") }, { status: 403 });
      const roster = await getClassRoster(user.id, classId);
      memberIds = (roster?.students ?? []).map((s) => s.userId);
    } else {
      const { data: idData } = await schools.from("student_identities").select("user_id").eq("school_id", membership.schoolId);
      memberIds = ((idData as { user_id: string }[] | null) ?? []).map((i) => i.user_id);
    }
    if (memberIds.length === 0) return NextResponse.json(empty);

    let wanted: string[] | null = null;
    if (subjectId) {
      const { data: subjData } = await schools
        .from("subjects")
        .select("name, code, is_global, school_id")
        .eq("id", subjectId)
        .maybeSingle();
      const subject = subjData as { name: string; code: string | null; is_global: boolean; school_id: string | null } | null;
      if (!subject || (subject.school_id !== membership.schoolId && !subject.is_global)) {
        return NextResponse.json({ error: await apiT("api.notFound") }, { status: 404 });
      }
      if (!(await assertSubjectAccess(user.id, subjectId))) {
        return NextResponse.json({ error: await apiT("api.notYourSubject") }, { status: 403 });
      }
      wanted = [subject.code, subject.name].filter(Boolean).map((v) => v!.toLowerCase());
    }

    const kernel = createKernelAdminClient();
    const { data: stateData } = await kernel
      .from("student_concept_state")
      .select("concept_id, mastery_score_effective")
      .in("user_id", memberIds);
    const states = (stateData as { concept_id: string; mastery_score_effective: number | null }[] | null) ?? [];
    if (states.length === 0) return NextResponse.json(empty);

    const { data: nodeData } = await kernel
      .from("concept_nodes")
      .select("id, label, subject")
      .in("id", [...new Set(states.map((s) => s.concept_id))]);
    const nodes = (nodeData as { id: string; label: string; subject: string | null }[] | null) ?? [];
    const namer = await readerConceptNamer();
    const inScope = new Map<string, string>();
    for (const n of nodes) {
      if (wanted && !(n.subject && wanted.includes(n.subject.toLowerCase()))) continue;
      inScope.set(n.id, namer(n.label));
    }
    const agg = new Map<string, { sum: number; n: number }>();
    for (const s of states) {
      if (!inScope.has(s.concept_id) || s.mastery_score_effective == null) continue;
      const e = agg.get(s.concept_id) ?? { sum: 0, n: 0 };
      e.sum += s.mastery_score_effective;
      e.n += 1;
      agg.set(s.concept_id, e);
    }
    const concepts = [...agg.entries()]
      .map(([id, e]) => ({ label: inScope.get(id) ?? "concept", mastery: Math.round((e.sum / e.n) * 1000) / 1000 }))
      .sort((a, b) => a.mastery - b.mastery)
      .slice(0, 6);
    return NextResponse.json({ concepts });
  } catch {
    return NextResponse.json(empty);
  }
}
