import { limitExpensive } from "@/lib/abuse-limits";
import { NextResponse } from "next/server";
import { clientError } from "@/lib/observability/client-error";
import { createClient } from "@/lib/supabase/server";
import { createSchoolsAdminClient } from "@/lib/supabase/admin";
import {
  assertClassAccess,
  assertSubjectAccess,
  buildClassContext,
  buildSubjectContext,
  getAdminMembership,
  getStaffPreferences,
  getTeacherResources,
} from "@/lib/school-admin";
import { generateJson } from "@/lib/raya/llm";
import { resolveSchoolEntitlements, gateQuota, startOfMonthIso } from "@/lib/entitlements";
import { apiT } from "@/lib/i18n/server";
import { composePrepareMarkdown, normalizePrepareQuestion, type PrepareQuestion } from "@/lib/prepare-doc";

export const runtime = "nodejs";
export const maxDuration = 30;

const KINDS = ["exam", "exercise", "worksheet", "quiz"] as const;
type Kind = (typeof KINDS)[number];

/** Per-kind shape guidance: what each generation must look like, beyond the shared JSON schema. */
const KIND_GUIDE: Record<Kind, string> = {
  quiz: "Multiple-choice: 3-4 `choices` each with the correct `answer`. ",
  exam: "A formal exam: mix multiple-choice and open items; give EVERY item integer `points` summing to exactly 20. ",
  exercise: "Progressive open items, easiest first, no `choices`; each gets a full worked `answer`. ",
  worksheet: "Teach then drill: `instructions` recap the rule with one worked mini-example, then guided practice items with concise `answer`s, no `choices`. ",
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

/** POST { classId?, subjectId?, kind, topic?, count?, conversationId?, reportIds?, brief?, resourceIds? } → generate + persist a resource. */
export async function POST(request: Request) {
  const { user, membership, supabase, error } = await authStaff();
  if (error) return error;
  const limited = await limitExpensive("schoolPrepare", user.id);
  if (limited) return limited;

  // Prepare is quota-metered per prof per month (Standard 30 / Plus 150 / Custom ∞).
  // Counted from teacher_resources authored by this staff member this month.
  const { ent, tier } = await resolveSchoolEntitlements(membership.schoolId);
  const { count: prepUsed } = await createSchoolsAdminClient()
    .from("teacher_resources")
    .select("id", { count: "exact", head: true })
    .eq("created_by", membership.adminId)
    .gte("created_at", startOfMonthIso());
  const overPrep = await gateQuota(prepUsed ?? 0, ent.preparePerMonthPerProf, {
    metric: "Prepare generations",
    period: "month",
    upgradeTo: "Plus",
    scope: "school",
    userId: membership.adminId,
    tier,
  });
  if (overPrep) return overPrep;

  let body: { classId?: string; subjectId?: string; kind?: string; topic?: string; count?: number; conversationId?: string; reportIds?: string[]; brief?: string; resourceIds?: string[] };
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
    return NextResponse.json({ error: await apiT("api.notYourClass") }, { status: 403 });
  }

  if (subjectId && !(await assertSubjectAccess(user.id, subjectId))) {
    return NextResponse.json({ error: await apiT("api.notYourSubject") }, { status: 403 });
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
      return NextResponse.json({ error: await apiT("api.subjectNotFoundOrNotYours") }, { status: 404 });
    }
  }
  // A staff thread as extra material: the teacher's own school conversation,
  // newest part only. Same owner gate as the Tools route — a thread that is
  // not theirs (or not a thread at all) answers identically, so ids cannot
  // be probed.
  if (typeof body.conversationId === "string" && body.conversationId) {
    const { data: conv } = await supabase
      .schema("learning")
      .from("conversations")
      .select("id, user_id")
      .eq("id", body.conversationId)
      .maybeSingle();
    if (!conv || conv.user_id !== user.id) {
      return NextResponse.json({ error: await apiT("api.notFound") }, { status: 404 });
    }
    const { data: msgs } = await supabase
      .schema("learning")
      .from("messages")
      .select("role, content")
      .eq("conversation_id", conv.id)
      .order("created_at", { ascending: true });
    const transcript = (msgs ?? [])
      .filter((m) => (m.content ?? "").trim())
      .map((m) => `${m.role === "assistant" ? "Raya" : "Teacher"}: ${m.content}`)
      .join("\n\n");
    if (transcript) parts.push(`Discussion context (the teacher's own thread) —\n${transcript.slice(-3000)}`);
    // The thread's attached documents come with it: a "build from this thread"
    // that ignored the chapter the teacher uploaded would be the worse half of
    // the promise. Same owner gate — the conversation was just proven theirs.
    const { data: attachments } = await supabase
      .schema("learning")
      .from("conversation_files")
      .select("file_name, content")
      .eq("conversation_id", conv.id)
      .order("created_at", { ascending: false })
      .limit(4);
    for (const f of attachments ?? []) {
      const text = (f.content ?? "").trim();
      if (text) parts.push(`Attached document "${f.file_name ?? "document"}" —\n${text.slice(0, 3000)}`);
    }
  }

  // School reports as extra material, by explicit ids from the card's picker
  // (a title the teacher chose, never an id the model wrote). Same visibility
  // rule as the reports list: an admin reads the school's, a prof only their
  // own — enforced here, not trusted from the client.
  if (Array.isArray(body.reportIds) && body.reportIds.length > 0) {
    const ids = body.reportIds.filter((v): v is string => typeof v === "string" && v.length > 0).slice(0, 2);
    if (ids.length > 0) {
      const schools = createSchoolsAdminClient();
      let rq = schools.from("reports").select("parameters").eq("school_id", membership.schoolId).in("id", ids);
      if (membership.role !== "admin_master") rq = rq.eq("created_by", membership.adminId);
      const { data: reps } = await rq;
      for (const r of reps ?? []) {
        const content = ((r.parameters ?? {}) as { content?: string }).content ?? "";
        if (content.trim()) parts.push(`School report —\n${content.trim().slice(0, 3000)}`);
      }
    }
  }

  // Pasted or uploaded material from the tab: file extracts and anything else
  // the teacher typed in. Plain text in, grounded generation out — capped,
  // because a whole textbook would drown the gaps it should shore up.
  if (typeof body.brief === "string" && body.brief.trim()) {
    parts.push(`Teacher-provided material —\n${body.brief.trim().slice(0, 6000)}`);
  }

  // Past generations as source: "another one like my October worksheet". Own
  // rows only — the library is the teacher's, and so is this gate.
  if (Array.isArray(body.resourceIds) && body.resourceIds.length > 0) {
    const ids = body.resourceIds.filter((v): v is string => typeof v === "string" && v.length > 0).slice(0, 2);
    if (ids.length > 0) {
      const schools = createSchoolsAdminClient();
      const { data: prev } = await schools
        .from("teacher_resources")
        .select("title, content")
        .in("id", ids)
        .eq("created_by", user.id);
      for (const r of (prev as { title: string; content: string }[] | null) ?? []) {
        if (r.content?.trim()) parts.push(`Earlier material "${r.title}" —\n${r.content.trim().slice(0, 3000)}`);
      }
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
    `{"title":"...","instructions":"...","questions":[{"prompt":"...","choices":["..."]?,"answer":"...","concept":"..."?,"points":3?}]}. ` +
    `Produce exactly ${count} questions in the teacher's language. ${focusLine}` +
    KIND_GUIDE[kind] +
    "Set `concept` to the skill each item targets when the data names one. Ground every item in the DATA " +
    "Write every formula in LaTeX between $...$ (inline) or on its own $$...$$ line (display), never backslash-paren delimiters and never plain-text maths like x^2. " +
    "below — never invent student names or fake statistics. No markdown, JSON only.";
  const userMsg =
    `Build a ${kind}${label ? ` for ${label}` : ""}${topic ? ` on: ${topic}` : ""}.\n\n=== DATA ===\n${grounding}`;

  let parsed: { title?: string; instructions?: string; questions?: unknown };
  try {
    const raw = await generateJson(system, userMsg);
    parsed = JSON.parse(raw) as { title?: string; instructions?: string; questions?: unknown };
  } catch (e) {
    return NextResponse.json({ error: clientError(e, await apiT("api.generationFailed")) }, { status: 502 });
  }

  const questions: PrepareQuestion[] = Array.isArray(parsed.questions)
    ? (parsed.questions as unknown[])
        .map((q) => normalizePrepareQuestion(q))
        .filter((q): q is PrepareQuestion => q !== null)
    : [];
  if (questions.length === 0) {
    return NextResponse.json({ error: await apiT("api.theModelReturnedNoUsableQuestions") }, { status: 502 });
  }

  const title =
    (typeof parsed.title === "string" && parsed.title.trim()) ||
    `${label || topic || "Class"} — ${kind}`;
  const instructions = typeof parsed.instructions === "string" ? parsed.instructions.trim() : "";
  const content = await composePrepareMarkdown(kind, title, instructions, questions, apiT);

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

async function authStaff() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "unauthorized" }, { status: 401 }) } as const;
  const membership = await getAdminMembership(user.id);
  if (!membership) return { error: NextResponse.json({ error: await apiT("api.staffOnly") }, { status: 403 }) } as const;
  return { user, membership, supabase, error: null } as const;
}

/**
 * Archive / delete for one Prepare resource. Archiving is author-or-admin
 * (the school files things away); deleting is the prof author only — the
 * school side never hard-deletes.
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
    return NextResponse.json({ error: await apiT("api.notFound") }, { status: 404 });
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
    return NextResponse.json({ error: await apiT("api.notFound") }, { status: 404 });
  }
  if (row.created_by !== membership.adminId && membership.role !== "admin_master") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  // Delete lives in the teacher's library: the gate above already refused
  // non-author profs, and the school side archives instead of deleting.
  if (membership.role !== "prof") {
    return NextResponse.json({ error: await apiT("api.deleteProfOnly") }, { status: 403 });
  }
  // Class-linked or not, a prof author may delete: the confirm dialog
  // carries the year-record cost for class-linked rows (getYearArchive
  // reads teacher_resources by class_id), and assigned classes keep
  // their own challenge copies either way.

  // Assignment records point back at this template (resource_id) but own
  // their challenge copies — detach first so no FK action can take them
  // (or block this delete). Assigned classes keep everything.
  await schools.from("resource_assignments").update({ resource_id: null }).eq("resource_id", id);
  const { error: delErr } = await schools.from("teacher_resources").delete().eq("id", id);
  if (delErr) return NextResponse.json({ error: clientError(delErr) }, { status: 500 });

  return NextResponse.json({ ok: true });
}
