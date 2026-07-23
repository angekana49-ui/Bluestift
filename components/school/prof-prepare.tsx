"use client";

import { useEffect, useState } from "react";
import { useAppTheme } from "@/components/ui/theme";
import { panelCard, textInput, ctaButton, ghostButton } from "@/components/ui/forms";
import { DocumentView } from "@/components/ui/document";
import { downloadBrandedPdf, downloadBrandedText, type BrandedDoc } from "@/lib/document";

type ClassOpt = { id: string; name: string };
type SubjectOpt = { id: string; name: string };
type Kind = "exam" | "exercise" | "worksheet" | "quiz";

type Resource = {
  id: string | null;
  kind: string;
  title: string;
  content: string;
  questions: unknown[];
  classId: string | null;
  className?: string | null;
  subjectId: string | null;
  createdAt: string;
};

type Assignment = {
  assignmentId: string;
  challengeId: string;
  title: string;
  kind: string;
  className: string;
  dueAt: string | null;
  assigned: number;
  done: number;
};

const KIND_LABEL: Record<string, string> = {
  exam: "Exam",
  exercise: "Exercise set",
  worksheet: "Worksheet",
  quiz: "Quiz",
};
const pctScore = (v: number | null) => (v == null ? "—" : `${Math.round(v * 100)}%`);

/**
 * Prepare mode: RAYA + the Kernel help a teacher build an exam / exercise set /
 * worksheet / quiz grounded in the class's REAL cognitive gaps. The result is a
 * downloadable branded document AND can be assigned to a class — the students take
 * it in their Homework tab through the shared challenge/grading engine, results
 * roll back up here.
 */
export function PrepareView({
  classes,
  schoolName,
  defaultClassId,
  defaultSubjectId,
}: {
  classes: ClassOpt[];
  schoolName?: string;
  defaultClassId?: string | null;
  defaultSubjectId?: string | null;
}) {
  const { theme: t } = useAppTheme();
  const box = panelCard(t);
  const input = textInput(t);
  const btn = ctaButton(t);

  const [subjects, setSubjects] = useState<SubjectOpt[]>([]);
  const [kind, setKind] = useState<Kind>("exercise");
  const [classId, setClassId] = useState(defaultClassId ?? classes[0]?.id ?? "");
  const [subjectId, setSubjectId] = useState(defaultSubjectId ?? "");
  const [topic, setTopic] = useState("");
  const [count, setCount] = useState(8);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [current, setCurrent] = useState<Resource | null>(null);
  const [library, setLibrary] = useState<Resource[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);

  async function loadAssignments() {
    try {
      const d = await (await fetch("/api/school/prepare/assignments")).json();
      if (Array.isArray(d.assignments)) setAssignments(d.assignments as Assignment[]);
    } catch {
      // best-effort
    }
  }

  useEffect(() => {
    (async () => {
      try {
        const [lib, subs, prefsRes] = await Promise.all([
          fetch("/api/school/prepare").then((r) => r.json()),
          fetch("/api/school/subjects").then((r) => r.json()),
          fetch("/api/school/preferences").then((r) => r.json()),
        ]);
        if (Array.isArray(lib.resources)) setLibrary(lib.resources as Resource[]);
        if (Array.isArray(subs.subjects)) setSubjects(subs.subjects as SubjectOpt[]);
        // Seed the pickers from the teacher's saved defaults (unless a prop already fixed them).
        const prefs = prefsRes?.prefs as { defaultClassId?: string | null; defaultSubjectId?: string | null } | undefined;
        if (prefs) {
          if (!defaultClassId && prefs.defaultClassId && classes.some((c) => c.id === prefs.defaultClassId)) {
            setClassId(prefs.defaultClassId);
          }
          if (!defaultSubjectId && prefs.defaultSubjectId) setSubjectId(prefs.defaultSubjectId);
        }
      } catch {
        // best-effort
      }
    })();
    void loadAssignments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function generate() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const d = await (
        await fetch("/api/school/prepare", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            kind,
            classId: classId || undefined,
            subjectId: subjectId || undefined,
            topic: topic || undefined,
            count,
          }),
        })
      ).json();
      if (d.error) {
        setError(d.error);
        return;
      }
      const item = d as Resource;
      setCurrent(item);
      setLibrary((v) => [item, ...v]);
    } catch {
      setError("Could not generate. The tutoring engine may be busy — try again.");
    } finally {
      setBusy(false);
    }
  }

  const docFor = (r: Resource): BrandedDoc => ({
    brand: "bluestift",
    title: r.title,
    meta: [KIND_LABEL[r.kind] ?? r.kind, new Date(r.createdAt).toLocaleDateString()].filter(Boolean).join(" · "),
    audience: schoolName,
    body: r.content,
  });

  return (
    <div>
      <div style={box}>
        <h2 style={{ fontSize: "1.1rem", margin: "0 0 0.25rem" }}>Prepare with RAYA</h2>
        <p style={{ opacity: 0.6, fontSize: "0.85rem", margin: "0 0 0.85rem" }}>
          Generate a {KIND_LABEL[kind]?.toLowerCase()} grounded in your class&apos;s real gaps — the
          Kernel points RAYA at the weakest concepts so the material shores them up.
        </p>
        <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap", alignItems: "center" }}>
          <select style={input} value={kind} onChange={(e) => setKind(e.target.value as Kind)} disabled={busy}>
            <option value="exercise">Exercise set</option>
            <option value="worksheet">Worksheet</option>
            <option value="quiz">Quiz (MCQ)</option>
            <option value="exam">Exam</option>
          </select>
          <select style={input} value={classId} onChange={(e) => setClassId(e.target.value)} disabled={busy}>
            <option value="">No class (general)</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <select style={input} value={subjectId} onChange={(e) => setSubjectId(e.target.value)} disabled={busy}>
            <option value="">Any subject</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <input
            style={{ ...input, width: 90 }}
            type="number"
            min={1}
            max={20}
            value={count}
            onChange={(e) => setCount(Number(e.target.value))}
            title="Number of questions"
            disabled={busy}
          />
        </div>
        <input
          style={{ ...input, width: "100%", marginTop: "0.6rem" }}
          placeholder="Topic or focus (optional) — e.g. fractions, the water cycle…"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          maxLength={200}
          disabled={busy}
        />
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginTop: "0.75rem" }}>
          <button style={{ ...btn, opacity: busy ? 0.7 : 1 }} onClick={generate} disabled={busy}>
            {busy ? "Generating…" : "Generate"}
          </button>
          <span style={{ opacity: 0.5, fontSize: "0.78rem" }}>
            Download &amp; print, or assign it to a class from your library below.
          </span>
        </div>
        {error && <p style={{ color: "#f87171", margin: "0.75rem 0 0" }}>{error}</p>}
      </div>

      {current && (
        <div style={{ marginTop: "1rem" }}>
          <DocumentView
            {...docFor(current)}
            onTxt={() => downloadBrandedText(docFor(current))}
            onPdf={() => downloadBrandedPdf(docFor(current))}
            onClose={() => setCurrent(null)}
          />
        </div>
      )}

      {library.length > 0 && (
        <div style={box}>
          <h3 style={{ marginTop: 0 }}>Your library</h3>
          {library.map((r, i) => (
            <LibraryRow
              key={r.id ?? i}
              r={r}
              classes={classes}
              onView={() => setCurrent(r)}
              onAssigned={loadAssignments}
            />
          ))}
        </div>
      )}

      {assignments.length > 0 && (
        <div style={box}>
          <h3 style={{ marginTop: 0 }}>Assigned to classes</h3>
          {assignments.map((a) => (
            <AssignmentRow key={a.assignmentId} a={a} />
          ))}
        </div>
      )}
    </div>
  );
}

/** One library resource: view it, or assign it to a class with an optional deadline. */
function LibraryRow({
  r,
  classes,
  onView,
  onAssigned,
}: {
  r: Resource;
  classes: ClassOpt[];
  onView: () => void;
  onAssigned: () => void;
}) {
  const { theme: t } = useAppTheme();
  const input = textInput(t);
  const btn = ctaButton(t);
  const ghost = ghostButton(t);

  const [open, setOpen] = useState(false);
  const [classId, setClassId] = useState(r.classId ?? classes[0]?.id ?? "");
  const [due, setDue] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const assignable = r.id != null && Array.isArray(r.questions) && r.questions.length > 0;

  async function assign() {
    if (busy || !classId) return;
    setBusy(true);
    setError(null);
    setMsg(null);
    try {
      const res = await fetch("/api/school/prepare/assign", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ resourceId: r.id, classId, dueAt: due ? new Date(due).toISOString() : null }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d?.error ?? "Could not assign.");
      setMsg("Assigned ✓");
      setOpen(false);
      onAssigned();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not assign.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ padding: "0.4rem 0", borderTop: `1px solid ${t.cardBorder}` }}>
      <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
        <span style={{ flex: 1, minWidth: 0 }}>
          {r.title}
          <span style={{ opacity: 0.5, fontSize: "0.78rem" }}>
            {" "}
            · {KIND_LABEL[r.kind] ?? r.kind}
            {r.className ? ` · ${r.className}` : ""}
          </span>
        </span>
        <span style={{ opacity: 0.5, fontSize: "0.8rem" }}>{new Date(r.createdAt).toLocaleDateString()}</span>
        <button style={ghost} onClick={onView}>
          View
        </button>
        {assignable && (
          <button style={ghost} onClick={() => setOpen((v) => !v)}>
            {open ? "Cancel" : "Assign"}
          </button>
        )}
      </div>
      {msg && <p style={{ color: "#22c55e", fontSize: "0.8rem", margin: "0.3rem 0 0" }}>{msg}</p>}
      {open && (
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center", marginTop: "0.5rem" }}>
          <select style={input} value={classId} onChange={(e) => setClassId(e.target.value)} disabled={busy}>
            {classes.length === 0 && <option value="">No classes</option>}
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <input
            style={input}
            type="datetime-local"
            value={due}
            onChange={(e) => setDue(e.target.value)}
            title="Deadline (optional)"
            disabled={busy}
          />
          <button style={{ ...btn, opacity: busy || !classId ? 0.6 : 1 }} onClick={assign} disabled={busy || !classId}>
            {busy ? "Assigning…" : "Assign to class"}
          </button>
          {error && <span style={{ color: "#f87171", fontSize: "0.8rem" }}>{error}</span>}
        </div>
      )}
    </div>
  );
}

/** One assignment row with an expandable per-student results table. */
function AssignmentRow({ a }: { a: Assignment }) {
  const { theme: t } = useAppTheme();
  const ghost = ghostButton(t);
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<{ name: string; done: boolean; score: number | null }[] | null>(null);
  const [avg, setAvg] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const due = a.dueAt ? new Date(a.dueAt).toLocaleDateString() : null;

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next && !results) {
      setLoading(true);
      try {
        const d = await (await fetch(`/api/school/prepare/results?assignmentId=${encodeURIComponent(a.assignmentId)}`)).json();
        setResults((d.students ?? []) as { name: string; done: boolean; score: number | null }[]);
        setAvg(d.summary?.avgScore ?? null);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }
  }

  return (
    <div style={{ padding: "0.4rem 0", borderTop: `1px solid ${t.cardBorder}` }}>
      <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
        <span style={{ flex: 1, minWidth: 0 }}>
          {a.title}
          <span style={{ opacity: 0.5, fontSize: "0.78rem" }}>
            {" "}
            · {KIND_LABEL[a.kind] ?? a.kind} · {a.className}
            {due ? ` · due ${due}` : ""}
          </span>
        </span>
        <span style={{ fontSize: "0.82rem", opacity: 0.75 }}>
          {a.done}/{a.assigned} done
        </span>
        <button style={ghost} onClick={toggle}>
          {open ? "Hide" : "Results"}
        </button>
      </div>
      {open && (
        <div style={{ marginTop: "0.5rem" }}>
          {loading ? (
            <p style={{ opacity: 0.55, fontSize: "0.82rem", margin: 0 }}>Loading…</p>
          ) : !results || results.length === 0 ? (
            <p style={{ opacity: 0.55, fontSize: "0.82rem", margin: 0 }}>No students in this class yet.</p>
          ) : (
            <>
              {avg != null && (
                <p style={{ fontSize: "0.82rem", margin: "0 0 0.35rem", opacity: 0.7 }}>Class average: {pctScore(avg)}</p>
              )}
              {results.map((s, i) => (
                <div key={i} style={{ display: "flex", gap: "0.5rem", padding: "0.2rem 0", fontSize: "0.85rem" }}>
                  <span style={{ flex: 1 }}>{s.name}</span>
                  <span style={{ opacity: s.done ? 1 : 0.5, color: s.done ? "#22c55e" : undefined }}>
                    {s.done ? pctScore(s.score) : "Not done"}
                  </span>
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
