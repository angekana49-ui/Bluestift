import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { limitExpensive } from "@/lib/abuse-limits";
import { clientError } from "@/lib/observability/client-error";
import { getStaffPreferences, getStudentDetail, getStudentFollowups, type StudentDetail } from "@/lib/school-admin";
import { rayaComplete } from "@/lib/raya/llm";
import { apiT, getServerLocale } from "@/lib/i18n/server";

export const maxDuration = 60;

const LANGUAGE: Record<string, string> = { en: "English", fr: "French", es: "Spanish", de: "German" };

const SYSTEM = `You are Raya for Schools. A teacher opened one student's report and wants to know,
in under a minute, where this student stands and what to do next. Use ONLY the DATA below —
never invent results, concepts, dates or behaviour. Write Markdown, short:
**Where they stand** — 2-3 sentences with the key figures (homework done, average, trend).
**What gets in the way** — 1-3 bullets, each tied to evidence (a missed homework, a question type
they keep getting wrong, a weak concept). If the data shows nothing, say so plainly.
**Next step** — 1-2 concrete actions the teacher can take this week.
If the data is thin (e.g. no homework submitted yet), say what is missing instead of guessing,
and suggest how to get a first signal (e.g. assign a short quiz). No preamble, no sign-off.
Write formulas, if any, in LaTeX ($...$).`;

const pct = (v: number | null) => (v == null ? "n/a" : `${Math.round(v * 100)}%`);

/** The report as plain lines — the model reads this, nothing else about the student. */
function contextOf(d: StudentDetail, notes: { content: string; createdAt: string }[]): string {
  const lines: string[] = [];
  lines.push(`Student: ${d.firstName} ${d.lastName}`.trim());
  if (d.joinedAt) lines.push(`Joined the class: ${d.joinedAt.slice(0, 10)}`);
  lines.push(`Last active: ${d.lastActiveAt ? d.lastActiveAt.slice(0, 10) : "unknown"}`);
  lines.push(`Today: ${new Date().toISOString().slice(0, 10)}`);

  if (d.homework.length === 0) lines.push("Homework: none assigned to this class yet.");
  else {
    lines.push("Homework (newest first):");
    for (const h of d.homework) {
      const due = h.dueAt ? ` due ${h.dueAt.slice(0, 10)}` : "";
      const res =
        h.status === "done"
          ? `done ${h.completedAt?.slice(0, 10) ?? ""}, score ${pct(h.score)}`
          : h.status === "missing"
            ? "NOT submitted, deadline passed"
            : "not submitted yet, still open";
      lines.push(`- "${h.title}" (${h.kind}, set ${h.assignedAt.slice(0, 10)}${due}): ${res}`);
    }
  }
  if (d.missed.length) {
    lines.push("Questions answered wrong:");
    for (const m of d.missed) lines.push(`- [${m.assignment}] ${m.question}`);
  }

  if (d.hasKernelProfile) {
    lines.push(`Understanding profile (Kernel): average mastery ${pct(d.avgMastery)}, confidence ${pct(d.mindsetScore)}`);
    if (d.statusLabel) lines.push(`Kernel status: ${d.statusLabel}`);
    if (d.detectedMindset) lines.push(`Detected mindset: ${d.detectedMindset}`);
    const kcs = [...d.kcs].filter((k) => k.mastery != null).sort((a, b) => (a.mastery ?? 0) - (b.mastery ?? 0));
    if (kcs.length) lines.push(`Concepts, weakest first: ${kcs.slice(0, 12).map((k) => `${k.label} ${pct(k.mastery)}`).join("; ")}`);
    if (d.insight) lines.push(`Earlier Kernel note: ${d.insight}`);
  } else {
    lines.push("Understanding profile (Kernel): none for this student yet.");
  }

  if (notes.length) {
    lines.push("Staff follow-up notes (newest first):");
    for (const n of notes.slice(0, 5)) lines.push(`- ${n.createdAt.slice(0, 10)}: ${n.content.slice(0, 300)}`);
  }
  return lines.join("\n");
}

/**
 * A short written reading of one student's report, on request.
 *
 * The Kernel used to be the only thing that could say anything in words about
 * a student, so while it has nothing — every real student, for now — the
 * report was numbers and dashes. This writes the same kind of note from what
 * the school holds: homework, the questions behind the scores, the team's
 * notes, and the Kernel profile when there is one. Same gate as the report
 * itself (getStudentDetail checks class access and enrolment), not stored.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const limited = await limitExpensive("schoolReport", user.id);
  if (limited) return limited;

  let body: { classId?: string; userId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const { classId, userId: studentId } = body;
  if (!classId || !studentId) {
    return NextResponse.json({ error: "classId and userId are required." }, { status: 400 });
  }

  const detail = await getStudentDetail(user.id, studentId, classId);
  if (!detail) return NextResponse.json({ error: await apiT("api.notFoundOrNotYours") }, { status: 404 });

  const [notes, prefs, locale] = await Promise.all([
    getStudentFollowups(user.id, classId, studentId).then((n) => n ?? [], () => []),
    getStaffPreferences(user.id),
    getServerLocale(),
  ]);
  const tone =
    prefs.reportTone && ["neutral", "encouraging", "formal", "concise"].includes(prefs.reportTone)
      ? ` Write in a ${prefs.reportTone} tone.`
      : "";

  try {
    const out = await rayaComplete([
      {
        role: "system",
        content: `${SYSTEM}\nWrite in ${LANGUAGE[locale] ?? "English"}.${tone}\n\n=== DATA ===\n${contextOf(detail, notes)}`,
      },
      { role: "user", content: `Summarise ${detail.firstName}'s report.` },
    ]);
    const summary = out.text.trim();
    if (!summary) throw new Error("empty summary");
    return NextResponse.json({ summary });
  } catch (e) {
    return NextResponse.json({ error: clientError(e, await apiT("api.generationFailed")) }, { status: 502 });
  }
}
