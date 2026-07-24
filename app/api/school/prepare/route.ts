import { NextResponse } from "next/server";
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
 * Prepare mode: RAYA + Kernel help a teacher build an exam / exercise / worksheet
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
  const { ent } = await resolveSchoolEntitlements(membership.schoolId);
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
    `You are RAYA for Schools, helping a teacher build a ${kind}. Return STRICT JSON ` +
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
    return NextResponse.json({ error: e instanceof Error ? e.message : "generation failed" }, { status: 502 });
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
    const { data } = await schools
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
    id = (data as { id: string } | null)?.id ?? null;
  } catch {
    // not persisted — still return the generated resource
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
