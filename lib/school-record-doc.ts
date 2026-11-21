import type { BrandedDoc } from "@/lib/document";
import type { MessageKey } from "@/lib/i18n";

type Tr = (key: MessageKey, vars?: Record<string, string | number>) => string;

const asRows = (v: unknown): Record<string, unknown>[] =>
  Array.isArray(v) ? v.filter((r): r is Record<string, unknown> => !!r && typeof r === "object") : [];

const asStrings = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((s): s is string => typeof s === "string" && s.trim().length > 0) : [];

/** First non-blank string among candidate columns — the record is `select *`, so read it defensively. */
const str = (row: Record<string, unknown>, ...keys: string[]): string | null => {
  for (const k of keys) {
    const v = row[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
};

const num = (row: Record<string, unknown>, ...keys: string[]): number | null => {
  for (const k of keys) {
    const v = row[k];
    if (typeof v === "number" && Number.isFinite(v)) return v;
  }
  return null;
};

const pct = (v: number) => `${Math.round(v * 100)}%`;

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString();
}

/**
 * One student's education record (GET /api/school/student/record) as the
 * branded document a school hands to a parent — TXT/PDF through the shared
 * exporter, logo and footer included.
 *
 * The JSON stays the complete, machine-readable original; this is its
 * human-readable rendering. Same sections, nothing invented: identity from the
 * caller's header (the record's own identity row is raw enrolment data),
 * assessment attempts oldest-first, per-concept mastery weakest-first, staff
 * notes as written, and the scope note that says what is NOT in here (the
 * student's own Raya conversations stay with the student).
 *
 * Defensive throughout: every column is picked by candidate names because the
 * builder reads `select *`, and a row missing everything readable is skipped
 * rather than printed as a blank line.
 */
export function studentRecordToDoc(
  record: Record<string, unknown>,
  opts: { studentName: string; className?: string; schoolName?: string; tr: Tr },
): BrandedDoc {
  const { studentName, className, schoolName, tr } = opts;
  const body: string[] = [];

  // ── Assessment results ──
  body.push(`## ${tr("school.record.results")}`);
  const attempts = asRows(record.assessment_results)
    .map((a) => ({ iso: str(a, "completed_at", "created_at") ?? "", score: num(a, "score") }))
    .filter((a) => a.iso !== "" || a.score != null)
    .sort((x, y) => (x.iso < y.iso ? -1 : x.iso > y.iso ? 1 : 0));
  if (attempts.length === 0) {
    body.push(tr("school.record.empty"));
  } else {
    for (const a of attempts) body.push(a.score == null ? `- ${fmtDate(a.iso || null)}` : `- ${fmtDate(a.iso || null)} — ${pct(a.score)}`);
    const scored = attempts.map((a) => a.score).filter((s): s is number => s != null);
    if (scored.length > 0) {
      body.push("", tr("school.record.average", { avg: pct(scored.reduce((x, y) => x + y, 0) / scored.length), n: scored.length }));
    }
  }

  // ── Inferred understanding ──
  body.push("", `## ${tr("school.record.understanding")}`);
  const cognitive = (record.cognitive_profile ?? {}) as Record<string, unknown>;
  const concepts = asRows(cognitive.student_concept_state)
    .map((c) => {
      const label = str(c, "concept_label", "concept", "label") ?? shortId(str(c, "concept_id"));
      return { label, ke: num(c, "mastery_score_effective", "k_effective", "k_raw") };
    })
    .filter((c) => c.label !== null) as { label: string; ke: number | null }[];
  concepts.sort((a, b) => (a.ke ?? 2) - (b.ke ?? 2));
  const m = asRows(cognitive.student_mindset_state).length;
  const r = asRows(cognitive.student_risk_assessments).length;
  const t = asRows(cognitive.learning_trajectories).length;
  if (concepts.length === 0 && m + r + t === 0) {
    body.push(tr("school.record.empty"));
  } else {
    for (const c of concepts) body.push(c.ke == null ? `- ${c.label}` : `- ${c.label} — ${pct(c.ke)}`);
    body.push(tr("school.record.more", { m, r, t }));
    body.push("", tr("kernel.dataNote.figures"));
  }

  // ── Staff notes ──
  body.push("", `## ${tr("school.record.notes")}`);
  const notes = asRows(record.staff_followups);
  if (notes.length === 0) {
    body.push(tr("school.record.empty"));
  } else {
    for (const n of notes) {
      const content = str(n, "content", "note", "text");
      if (!content) continue;
      const date = str(n, "created_at", "updated_at");
      body.push(date ? `- ${fmtDate(date)} — ${content}` : `- ${content}`);
    }
  }

  // ── About ──
  body.push("", `## ${tr("school.record.about")}`);
  body.push(tr("school.record.scope"));
  body.push(tr("school.record.excludes"));
  const errors = asStrings(record._errors);
  if (errors.length > 0) body.push(tr("school.record.partial", { list: errors.join(", ") }));

  return {
    brand: "bluestift",
    title: studentName,
    meta: [className, new Date().toLocaleDateString()].filter(Boolean).join(" · "),
    audience: schoolName,
    body: body.join("\n"),
  };
}

/** A concept row with no readable label still gets a stable, short identity. */
function shortId(id: string | null): string | null {
  if (!id) return null;
  return id.length > 12 ? `…${id.slice(-6)}` : id;
}
