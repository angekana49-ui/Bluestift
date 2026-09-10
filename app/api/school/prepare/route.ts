import { NextResponse } from "next/server";
import { clientError } from "@/lib/observability/client-error";
import { createClient } from "@/lib/supabase/server";
import { createSchoolsAdminClient } from "@/lib/supabase/admin";
import {
  assertClassAccess,
  buildClassContext,
  buildSubjectContext,
  getAdminMembership,
  getStaffPreferences,
  getTeacherResources,
} from "@/lib/school-admin";
import { generateJson } from "@/lib/raya/llm";
import { resolveSchoolEntitlements, gateQuota, startOfMonthIso } from "@/lib/entitlements";

export const runtime = "nodejs";
export const maxDuration = 30;

const KINDS = ["exam", "exercise", "worksheet", "quiz"] as const;
type Kind = (typeof KINDS)[number];

type GenQuestion = {
  prompt: string;
  choices?: string[];
  answer?: string;
  concept?: string;
};

/**
 * Prepare mode: Raya + Kernel help a teacher build an exam / exercise / worksheet
 * grounded in the class's REAL cognitive gaps (buildClassContext / buildSubjectContext,
 * which already surface weakest concepts). One JSON generation yields the structured
 * questions; the markdown document is composed deterministically from them so the
 * downloadable doc and the (future-assignable) `questions` jsonb can never diverge.
 */

/** GET → the caller's exam/exercise library. */
export async function GET() {
  const { user, error } = await authStaff();
  if (error) return error;
  const resources = await getTeacherResources(user.id);
  return NextResponse.json({ resources: resources ?? [] });
}

/** POST { classId?, subjectId?, kind, topic?, count? } → generate + persist a resource. */
export async function POST(request: Request) {
  const { user, membership, error } = await authStaff();
  if (error) return error;

  // Prepare is quota-metered per prof per month (Standard 30 / Plus 150 / Custom ∞).
  // Counted from teacher_resources authored by this staff member this month.
  const { ent, tier } = await resolveSchoolEntitlements(membership.schoolId);
  const { count: prepUsed } = await createSchoolsAdminClient()
    .from("teacher_resources")
    .select("id", { count: "exact", head: true })
    .eq("created_by", membership.adminId)
    .gte("created_at", startOfMonthIso());
  const overPrep = gateQuota(prepUsed ?? 0, ent.preparePerMonthPerProf, {
    metric: "Prepare generations",
    period: "month",
    upgradeTo: "Plus",
    scope: "school",
    userId: membership.adminId,
    tier,
  });
  if (overPrep) return overPrep;

  let body: { classId?: string; subjectId?: string; kind?: string; topic?: string; count?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const kind: Kind = (KINDS as readonly string[]).includes(body.kind ?? "") ? (body.kind as Kind) : "exercise";
  const classId = body.classId?.trim() || null;
  const subjectId = body.subjectId?.trim() || null;
  const topic = (body.topic ?? "").trim().slice(0, 200);
  const count = Math.min(Math.max(Number(body.count) || 8, 1), 20);

  if (classId && !(await assertClassAccess(user.id, classId))) {
    return NextResponse.json({ error: "Not your class." }, { status: 403 });
  }

  // Ground on real cognitive data: class snapshot and/or subject mastery.
  const prefs = await getStaffPreferences(user.id);
  const parts: string[] = [];
  let className: string | null = null;
  let subjectName: string | null = null;
  if (classId) {
    const cc = await buildClassContext(user.id, classId);
    if (cc) {
      className = cc.className;
      parts.push(`Class snapshot —\n${cc.context}`);
    }
  }
  if (subjectId) {
    const sc = await buildSubjectContext(user.id, subjectId);
    if (sc) {
      subjectName = sc.subjectName;
      parts.push(`Subject snapshot —\n${sc.context}`);
    } else {
      return NextResponse.json({ error: "Subject not found or not yours." }, { status: 404 });
    }
  }
  const grounding = parts.join("\n\n") || "No cognitive data available yet — write a solid general set.";

  const focusLine =
    prefs.examFocusWeakConcepts && parts.length
      ? "Prioritise the WEAKEST concepts named in the data — this material should shore up real gaps. "
      : "";

  const label = [subjectName, className].filter(Boolean).join(" · ");
  const system =
    `You are Raya for Schools, helping a teacher build a ${kind}. Return STRICT JSON ` +
    `{"title":"...","instructions":"...","questions":[{"prompt":"...","choices":["..."]?,"answer":"...","concept":"..."?}]}. ` +
    `Produce exactly ${count} questions in the teacher's language. ${focusLine}` +
    (kind === "quiz" || kind === "exam"
      ? "Prefer multiple-choice where natural: 3-4 `choices` and the correct `answer`. "
      : "Open-response items: give a concise model `answer`/solution, omit `choices`. ") +
    "Set `concept` to the skill each item targets when the data names one. Ground every item in the DATA " +
    "below — never invent student names or fake statistics. No markdown, JSON only.";
  const userMsg =
    `Build a ${kind}${label ? ` for ${label}` : ""}${topic ? ` on: ${topic}` : ""}.\n\n=== DATA ===\n${grounding}`;

  let parsed: { title?: string; instructions?: string; questions?: unknown };
  try {
    const raw = await generateJson(system, userMsg);
    parsed = JSON.parse(raw) as { title?: string; instructions?: string; questions?: unknown };
  } catch (e) {
    return NextResponse.json({ error: clientError(e, "generation failed") }, { status: 502 });
  }

  const questions: GenQuestion[] = Array.isArray(parsed.questions)
    ? (parsed.questions as unknown[])
        .map((q) => normalizeQuestion(q))
        .filter((q): q is GenQuestion => q !== null)
    : [];
  if (questions.length === 0) {
    return NextResponse.json({ error: "The model returned no usable questions." }, { status: 502 });
  }

  const title =
    (typeof parsed.title === "string" && parsed.title.trim()) ||
    `${label || topic || "Class"} — ${kind}`;
  const instructions = typeof parsed.instructions === "string" ? parsed.instructions.trim() : "";
  const content = composeMarkdown(title, instructions, questions);

  // Persist to the library (best-effort — the resource is still returned on failure).
  let id: string | null = null;
  try {
    const schools = createSchoolsAdminClient();
    const { data, error } = await schools
      .from("teacher_resources")
      .insert({
        school_id: membership.schoolId,
        created_by: membership.adminId,
        class_id: classId,
        subject_id: subjectId,
        kind,
        title: title.slice(0, 200),
        content,
        questions,
        parameters: { topic, count, focusWeakConcepts: prefs.examFocusWeakConcepts },
        status: "ready",
      })
      .select("id")
      .single();
    if (error) console.warn(`[prepare] persistence failed (usage under-counted): ${error.message}`);
    id = (data as { id: string } | null)?.id ?? null;
  } catch (e) {
    console.warn(`[prepare] persistence threw (usage under-counted): ${e instanceof Error ? e.message : e}`);
  }

  return NextResponse.json({
    id,
    kind,
    title,
    content,
    questions,
    classId,
    subjectId,
    createdAt: new Date().toISOString(),
    archivedAt: null,
    // Whoever just generated it is always its author.
    canManage: true,
  });
}

/** Coerce one model item into a safe question (drops anything without a prompt). */
function normalizeQuestion(q: unknown): GenQuestion | null {
  if (!q || typeof q !== "object") return null;
  const o = q as Record<string, unknown>;
  const prompt = typeof o.prompt === "string" ? o.prompt.trim() : "";
  if (!prompt) return null;
  const choices = Array.isArray(o.choices)
    ? o.choices.filter((c): c is string => typeof c === "string" && c.trim().length > 0).map((c) => c.trim())
    : undefined;
  const answer = typeof o.answer === "string" ? o.answer.trim() : undefined;
  const concept = typeof o.concept === "string" ? o.concept.trim() : undefined;
  return {
    prompt: prompt.slice(0, 1000),
    ...(choices && choices.length ? { choices: choices.slice(0, 6) } : {}),
    ...(answer ? { answer: answer.slice(0, 1000) } : {}),
    ...(concept ? { concept: concept.slice(0, 120) } : {}),
  };
}

/** Deterministic markdown: questions section + a separate answer key. */
function composeMarkdown(title: string, instructions: string, questions: GenQuestion[]): string {
  const letters = ["A", "B", "C", "D", "E", "F"];
  const lines: string[] = [`# ${title}`];
  if (instructions) lines.push("", instructions);
  lines.push("", "## Questions");
  questions.forEach((q, i) => {
    lines.push("", `${i + 1}. ${q.prompt}`);
    if (q.choices) q.choices.forEach((c, j) => lines.push(`   - ${letters[j] ?? "?"}. ${c}`));
  });
  const withAnswers = questions.filter((q) => q.answer);
  if (withAnswers.length) {
    lines.push("", "## Answer key");
    questions.forEach((q, i) => {
      if (q.answer) lines.push(`${i + 1}. ${q.answer}`);
    });
  }
  return lines.join("\n");
}

async function authStaff() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "unauthorized" }, { status: 401 }) } as const;
  const membership = await getAdminMembership(user.id);
  if (!membership) return { error: NextResponse.json({ error: "School staff only." }, { status: 403 }) } as const;
  return { user, membership, error: null } as const;
}

/**
 * Archive / delete for one Prepare resource. Its author, or an admin_master of
 * the same school, may act on it — same tier as the rest of school-admin.ts
 * (an admin_master can already see and reassign every prof's resources).
 *
 * Deleting only removes the template from the library: any class it was
 * already assigned to (schools.resource_assignments -> its own
 * learning.challenges row) is untouched, so nobody's in-progress or graded
 * work disappears with it.
 *
 * PATCH  { id, action: "archive" | "unarchive" } -> flip archived_at
 * DELETE ?id=<id>                                 -> remove the resource
 */
export async function PATCH(request: Request) {
  const { membership, error } = await authStaff();
  if (error) return error;

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

  const schools = createSchoolsAdminClient();
  const { data: resource } = await schools
    .from("teacher_resources")
    .select("id, school_id, created_by")
    .eq("id", id)
    .maybeSingle();
  const row = resource as { school_id: string; created_by: string } | null;
  if (!row || row.school_id !== membership.schoolId) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  // created_by is the school_admins row id (membership.adminId), NOT the auth
  // user id — same identifier the insert in POST above writes.
  if (row.created_by !== membership.adminId && membership.role !== "admin_master") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const archived_at = body.action === "archive" ? new Date().toISOString() : null;
  const { error: updErr } = await schools.from("teacher_resources").update({ archived_at }).eq("id", id);
  if (updErr) return NextResponse.json({ error: clientError(updErr) }, { status: 500 });

  return NextResponse.json({ ok: true, archivedAt: archived_at });
}

export async function DELETE(request: Request) {
  const { membership, error } = await authStaff();
  if (error) return error;

  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 });

  const schools = createSchoolsAdminClient();
  const { data: resource } = await schools
    .from("teacher_resources")
    .select("id, school_id, created_by, class_id")
    .eq("id", id)
    .maybeSingle();
  const row = resource as { school_id: string; created_by: string; class_id: string | null } | null;
  if (!row || row.school_id !== membership.schoolId) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  if (row.created_by !== membership.adminId && membership.role !== "admin_master") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  // getYearArchive (lib/school-admin.ts) reads teacher_resources straight by
  // class_id to build the school's official year-end record — an admin_master
  // reads that later expecting it to be complete ("what did we do in maths in
  // 3e B last year"). A class-linked resource is part of that record, so a
  // hard delete here would silently thin it out from under them. Archiving
  // gets it out of the Prepare library without touching the row at all, which
  // is why only class-less (general/ungrouped) resources are deletable.
  if (row.class_id) {
    return NextResponse.json(
      { error: "This resource is tied to a class and part of the year record — archive it instead of deleting it." },
      { status: 409 },
    );
  }

  const { error: delErr } = await schools.from("teacher_resources").delete().eq("id", id);
  if (delErr) return NextResponse.json({ error: clientError(delErr) }, { status: 500 });

  return NextResponse.json({ ok: true });
}
