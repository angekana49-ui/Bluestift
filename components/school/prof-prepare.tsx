"use client";

import { useEffect, useState } from "react";
import { useAppTheme } from "@/components/ui/theme";
import { panelCard, textInput, ctaButton, ghostButton, formActions } from "@/components/ui/forms";
import { DocumentView } from "@/components/ui/document";
import { Modal } from "@/components/ui/modal";
import { type BrandedDoc } from "@/lib/document";
import { RayaName } from "@/components/ui/brand";
import { netFetch, getJsonCached, invalidateCached } from "@/lib/net/client-fetch";
import { useTranslate } from "@/components/ui/locale";
import type { MessageKey } from "@/lib/i18n";

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

const KIND_LABEL_KEY: Record<string, MessageKey> = {
  exam: "tools.selfTest.kind.exam.label",
  exercise: "school.prepare.kindExerciseSet",
  worksheet: "school.prepare.kindWorksheet",
  quiz: "tools.pretty.quiz",
};
const pctScore = (v: number | null) => (v == null ? "—" : `${Math.round(v * 100)}%`);

/**
 * Prepare mode: Raya + the Kernel help a teacher build an exam / exercise set /
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
  const tr = useTranslate();
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
    const { data } = await getJsonCached<{ assignments?: Assignment[] }>(
      "/api/school/prepare/assignments",
      {
        cacheKey: "school:prepareAssignments",
        onUpdate: (fresh) => {
          if (Array.isArray(fresh.assignments)) setAssignments(fresh.assignments);
        },
      },
    );
    if (Array.isArray(data?.assignments)) setAssignments(data.assignments);
  }

  useEffect(() => {
    (async () => {
      // Cached-first: re-entering the tab renders the library and pickers from
      // the last known data instead of three cold round trips every time.
      const [lib, subs, prefsRes] = await Promise.all([
        getJsonCached<{ resources?: Resource[] }>("/api/school/prepare", {
          cacheKey: "school:prepare",
          onUpdate: (fresh) => {
            if (Array.isArray(fresh.resources)) setLibrary(fresh.resources);
          },
        }),
        getJsonCached<{ subjects?: SubjectOpt[] }>("/api/school/subjects", {
          cacheKey: "school:subjects",
        }),
        getJsonCached<{ prefs?: { defaultClassId?: string | null; defaultSubjectId?: string | null } }>(
          "/api/school/preferences",
          { cacheKey: "school:preferences" },
        ),
      ]);
      if (Array.isArray(lib.data?.resources)) setLibrary(lib.data.resources);
      if (Array.isArray(subs.data?.subjects)) setSubjects(subs.data.subjects);
      // Seed the pickers from the teacher's saved defaults (unless a prop already fixed them).
      const prefs = prefsRes.data?.prefs;
      if (prefs) {
        if (!defaultClassId && prefs.defaultClassId && classes.some((c) => c.id === prefs.defaultClassId)) {
          setClassId(prefs.defaultClassId);
        }
        if (!defaultSubjectId && prefs.defaultSubjectId) setSubjectId(prefs.defaultSubjectId);
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
        await netFetch(
          "/api/school/prepare",
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              kind,
              classId: classId || undefined,
              subjectId: subjectId || undefined,
              topic: topic || undefined,
              count,
            }),
          },
          { timeoutMs: 45_000 }, // a full LLM generation, not a plain query
        )
      ).json();
      if (d.error) {
        setError(d.error);
        return;
      }
      const item = d as Resource;
      setCurrent(item);
      setLibrary((v) => [item, ...v]);
      invalidateCached("school:prepare");
    } catch {
      setError(tr("school.prepare.generateFailed"));
    } finally {
      setBusy(false);
    }
  }

  const docFor = (r: Resource): BrandedDoc => ({
    brand: "bluestift",
    title: r.title,
    meta: [KIND_LABEL_KEY[r.kind] ? tr(KIND_LABEL_KEY[r.kind]) : r.kind, new Date(r.createdAt).toLocaleDateString()].filter(Boolean).join(" · "),
    audience: schoolName,
    body: r.content,
  });

  return (
    <div>
      <div style={box}>
        <h2 style={{ fontSize: "1.1rem", margin: "0 0 0.25rem" }}>{tr("school.prepare.titleA")} <RayaName /></h2>
        <p style={{ opacity: 0.6, fontSize: "0.85rem", margin: "0 0 0.85rem" }}>
          {tr("school.prepare.introA")} {tr(KIND_LABEL_KEY[kind]).toLowerCase()} {tr("school.prepare.introB")} <RayaName /> {tr("school.prepare.introC")}
        </p>
        <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap", alignItems: "center" }}>
          <select style={input} value={kind} onChange={(e) => setKind(e.target.value as Kind)} disabled={busy}>
            <option value="exercise">{tr("school.prepare.kindExerciseSet")}</option>
            <option value="worksheet">{tr("school.prepare.kindWorksheet")}</option>
            <option value="quiz">{tr("tools.tool.quiz")}</option>
            <option value="exam">{tr("tools.selfTest.kind.exam.label")}</option>
          </select>
          <select style={input} value={classId} onChange={(e) => setClassId(e.target.value)} disabled={busy}>
            <option value="">{tr("school.prepare.noClassGeneral")}</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <select style={input} value={subjectId} onChange={(e) => setSubjectId(e.target.value)} disabled={busy}>
            <option value="">{tr("school.prepare.anySubject")}</option>
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
            title={tr("school.prepare.numberOfQuestionsTitle")}
            disabled={busy}
          />
        </div>
        <input
          style={{ ...input, width: "100%", marginTop: "0.6rem" }}
          placeholder={tr("school.prepare.topicPlaceholder")}
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          maxLength={200}
          disabled={busy}
        />
        <div style={formActions}>
          <span style={{ opacity: 0.6, fontSize: "0.78rem", marginRight: "auto" }}>
            {tr("school.prepare.downloadAssignHint")}
          </span>
          <button style={{ ...btn, opacity: busy ? 0.7 : 1 }} onClick={generate} disabled={busy}>
            {busy ? tr("tools.generating") : tr("tools.generate")}
          </button>
        </div>
        {error && <p style={{ color: "#f87171", margin: "0.75rem 0 0" }}>{error}</p>}
      </div>

      {/* Portalled modal — see school-reports: escapes the shell, centres over
          the viewport, TXT/PDF/close visible in the header. */}
      {current && (
        <Modal onClose={() => setCurrent(null)} label={current.title}>
          <DocumentView
            {...docFor(current)}
            doc={docFor(current)}
            onClose={() => setCurrent(null)}
          />
        </Modal>
      )}

      {library.length > 0 && (
        <div style={box}>
          <h3 style={{ marginTop: 0 }}>{tr("school.prepare.yourLibrary")}</h3>
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
          <h3 style={{ marginTop: 0 }}>{tr("school.prepare.assignedToClasses")}</h3>
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
  const tr = useTranslate();
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
      const res = await netFetch(
        "/api/school/prepare/assign",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ resourceId: r.id, classId, dueAt: due ? new Date(due).toISOString() : null }),
        },
        { timeoutMs: 15_000 },
      );
      const d = await res.json();
      if (!res.ok) throw new Error(d?.error ?? tr("school.prepare.assignFailed"));
      setMsg(tr("school.prepare.assignedCheck"));
      setOpen(false);
      onAssigned();
    } catch (e) {
      setError(e instanceof Error ? e.message : tr("school.prepare.assignFailed"));
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
            · {KIND_LABEL_KEY[r.kind] ? tr(KIND_LABEL_KEY[r.kind]) : r.kind}
            {r.className ? ` · ${r.className}` : ""}
          </span>
        </span>
        <span style={{ opacity: 0.5, fontSize: "0.8rem" }}>{new Date(r.createdAt).toLocaleDateString()}</span>
        <button style={ghost} onClick={onView}>
          {tr("school.roster.view")}
        </button>
        {assignable && (
          <button style={ghost} onClick={() => setOpen((v) => !v)}>
            {open ? tr("school.class.cancel") : tr("school.team.assignButton")}
          </button>
        )}
      </div>
      {msg && <p style={{ color: "#22c55e", fontSize: "0.8rem", margin: "0.3rem 0 0" }}>{msg}</p>}
      {open && (
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center", marginTop: "0.5rem" }}>
          <select style={input} value={classId} onChange={(e) => setClassId(e.target.value)} disabled={busy}>
            {classes.length === 0 && <option value="">{tr("school.team.noClassesOption")}</option>}
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
            title={tr("school.prepare.deadlineOptional")}
            disabled={busy}
          />
          {/* A select and a date field are both fixed-width, so the row's slack
              pooled AFTER the button and it sat hard left with empty space to
              its right — the same shape as the Assignments row in school-team.
              The error takes a full row of its own rather than sitting past the
              button and pushing it back off the edge. */}
          <button
            style={{ ...btn, marginLeft: "auto", opacity: busy || !classId ? 0.6 : 1 }}
            onClick={assign}
            disabled={busy || !classId}
          >
            {busy ? tr("school.prepare.assigning") : tr("school.prepare.assignToClass")}
          </button>
          {error && (
            <span style={{ color: "#f87171", fontSize: "0.8rem", flexBasis: "100%" }}>{error}</span>
          )}
        </div>
      )}
    </div>
  );
}

/** One assignment row with an expandable per-student results table. */
function AssignmentRow({ a }: { a: Assignment }) {
  const { theme: t } = useAppTheme();
  const tr = useTranslate();
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
        const d = await (
          await netFetch(
            `/api/school/prepare/results?assignmentId=${encodeURIComponent(a.assignmentId)}`,
            {},
            { retries: 1 },
          )
        ).json();
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
            · {KIND_LABEL_KEY[a.kind] ? tr(KIND_LABEL_KEY[a.kind]) : a.kind} · {a.className}
            {due ? ` · ${tr("school.prepare.dueSuffix")} ${due}` : ""}
          </span>
        </span>
        <span style={{ fontSize: "0.82rem", opacity: 0.75 }}>
          {a.done}/{a.assigned} {tr("school.prepare.doneSuffix")}
        </span>
        <button style={ghost} onClick={toggle}>
          {open ? tr("school.archive.hide") : tr("school.prepare.results")}
        </button>
      </div>
      {open && (
        <div style={{ marginTop: "0.5rem" }}>
          {loading ? (
            <p style={{ opacity: 0.55, fontSize: "0.82rem", margin: 0 }}>{tr("school.loading")}</p>
          ) : !results || results.length === 0 ? (
            <p style={{ opacity: 0.55, fontSize: "0.82rem", margin: 0 }}>{tr("school.prepare.noStudentsInClassYet")}</p>
          ) : (
            <>
              {avg != null && (
                <p style={{ fontSize: "0.82rem", margin: "0 0 0.35rem", opacity: 0.7 }}>{tr("school.prepare.classAverage")} {pctScore(avg)}</p>
              )}
              {results.map((s, i) => (
                <div key={i} style={{ display: "flex", gap: "0.5rem", padding: "0.2rem 0", fontSize: "0.85rem" }}>
                  <span style={{ flex: 1 }}>{s.name}</span>
                  <span style={{ opacity: s.done ? 1 : 0.5, color: s.done ? "#22c55e" : undefined }}>
                    {s.done ? pctScore(s.score) : tr("school.prepare.notDone")}
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
