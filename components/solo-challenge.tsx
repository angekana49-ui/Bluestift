"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { netFetch } from "@/lib/net/client-fetch";
import { type BrandedDoc } from "@/lib/document";
import { TestPlayer, ReaderView, type TestAnswer, type TestQuestion, type TestResult } from "@/components/study/focus-player";
import { ShareLinkButton } from "@/components/study/share-button";
import { DocumentActions } from "@/components/ui/doc-actions";
import { ArtifactMenu } from "@/components/ui/artifact-menu";
import { parseDoc } from "@/lib/doc-format";
import { useAppTheme } from "@/components/ui/theme";
import { type AppTheme } from "@/components/ui/tokens";
import { FilePicker } from "@/components/ui/file-picker";
import { neutralButton, formActions } from "@/components/ui/forms";
import { useTranslate } from "@/components/ui/locale";
import type { MessageKey } from "@/lib/i18n";

type Question = { id: string; type: "mcq" | "open"; content: string | null; options: string[] };

// Test kinds — a quick MCQ quiz, a full mixed exam, or open competency questions.
const TEST_KINDS: { id: string; labelKey: MessageKey; hintKey: MessageKey }[] = [
  { id: "quiz", labelKey: "tools.selfTest.kind.quiz.label", hintKey: "tools.selfTest.kind.quiz.hint" },
  { id: "exam", labelKey: "tools.selfTest.kind.exam.label", hintKey: "tools.selfTest.kind.exam.hint" },
  { id: "skills", labelKey: "tools.selfTest.kind.skills.label", hintKey: "tools.selfTest.kind.skills.hint" },
];
type SoloItem = {
  id: string;
  title: string | null;
  description: string | null;
  question_count: number | null;
  score: number | null;
  archived_at?: string | null;
  scope?: string | null;
};

const panel = (t: AppTheme): React.CSSProperties => ({
  background: t.cardBg2,
  border: `1px solid ${t.cardBorder}`,
  borderRadius: 18,
  padding: 20,
  marginTop: 16,
});
const cta = (t: AppTheme): React.CSSProperties => ({
  background: t.ctaBg,
  color: t.ctaText,
  border: "none",
  borderRadius: 99,
  padding: "9px 16px",
  fontSize: 14,
  fontWeight: 600,
  cursor: "pointer",
});
const field = (t: AppTheme): React.CSSProperties => ({
  width: "100%",
  background: t.inputBg,
  color: t.text,
  border: `1px solid ${t.inputBorder}`,
  borderRadius: 10,
  padding: "10px 14px",
  marginBottom: 8,
  fontFamily: "inherit",
  fontSize: 15,
  boxSizing: "border-box",
  outline: "none",
});
const chip = (t: AppTheme, on: boolean): React.CSSProperties => ({
  background: on ? t.ctaBg : "transparent",
  color: on ? t.ctaText : t.muted,
  border: `1px solid ${on ? t.ctaBg : t.cardBorder}`,
  borderRadius: 99,
  padding: "6px 12px",
  fontSize: 14,
  fontWeight: 600,
  cursor: "pointer",
});

// One-tap common topics — a real, specific signal a click away, cheaper than
// typing. (The goal field used to also carry a pre-filled default sentence for
// the same decision-fatigue reason; that one backfired — see the `goal` state
// below.) Same six subjects as rooms-list.tsx and student-simulation.tsx.
const TOPIC_KEYS: MessageKey[] = [
  "subject.maths",
  "subject.physics",
  "subject.chemistry",
  "subject.biology",
  "subject.history",
  "subject.languages",
];

export function SoloChallenge({ myUserId, studentName }: { myUserId: string; studentName?: string }) {
  const { theme: t } = useAppTheme();
  const tr = useTranslate();
  const [supabase] = useState(() => createClient());
  const [view, setView] = useState<"list" | "take" | "analysis">("list");
  const [items, setItems] = useState<SoloItem[]>([]);
  const [name, setName] = useState("");
  const [topic, setTopic] = useState("");
  // Empty by default — not pre-filled with a generic sentence. A boilerplate
  // "review the key ideas" goal used to sit here and count as real input, so a
  // learner who only typed a name/topic (or nothing at all) could still hit
  // Create with zero actual grounding: the LLM got the boilerplate and
  // invented a topic out of thin air. Now the field's hint text carries that
  // suggestion instead of a value, so `goal` only ever holds what the learner
  // actually typed.
  const [goal, setGoal] = useState("");
  const [kind, setKind] = useState("quiz");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [active, setActive] = useState<SoloItem | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [result, setResult] = useState<{ score: number; correct: number; total: number } | null>(null);
  const [analysis, setAnalysis] = useState<{ title: string; body: string } | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

  async function load() {
    const [{ data: challenges }, { data: attempts }] = await Promise.all([
      supabase
        .schema("learning")
        .from("challenges")
        .select("id, title, description, question_count, archived_at, scope")
        .is("room_id", null)
        .order("created_at", { ascending: false })
        .limit(30),
      supabase
        .schema("learning")
        .from("challenge_attempts")
        .select("challenge_id, score")
        .eq("user_id", myUserId),
    ]);
    const scoreById = new Map((attempts ?? []).map((a) => [a.challenge_id, a.score]));
    setItems(
      (challenges ?? []).map((c) => ({ ...c, score: scoreById.get(c.id) ?? null })),
    );
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Opened from the Tools library "View" on a past self-test.
  useEffect(() => {
    function handler(e: Event) {
      const id = (e as CustomEvent<{ id: string }>).detail?.id;
      if (!id) return;
      const it =
        items.find((i) => i.id === id) ??
        ({ id, title: null, description: null, question_count: null, score: null } as SoloItem);
      open(it);
    }
    window.addEventListener("bluestift:open-selftest", handler);
    return () => window.removeEventListener("bluestift:open-selftest", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  async function create() {
    if ((!name.trim() && !topic.trim() && !goal.trim() && !file) || busy) return;
    setBusy(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("name", name);
      fd.append("topic", topic);
      fd.append("goal", goal);
      fd.append("kind", kind);
      if (file) fd.append("file", file);
      // Question generation is LLM-backed (server maxDuration 60s) — the
      // default 10s would abort a legitimately-running generation.
      const res = await netFetch("/api/challenges/create", { method: "POST", body: fd }, { timeoutMs: 65_000 });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ?? tr("tools.selfTest.createFailed"));
        return;
      }
      setName("");
      setTopic("");
      setGoal("");
      setFile(null);
      await load();
    } catch {
      setError(tr("tools.selfTest.createFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function archiveItem(id: string, archived: boolean) {
    const res = await netFetch("/api/challenges", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, action: archived ? "archive" : "unarchive" }),
    });
    const d = await res.json();
    // ArtifactMenu keeps its confirm dialog open and shows this rather than
    // silently doing nothing when the server refuses the action.
    if (!res.ok) throw new Error(d?.error);
    setItems((v) => v.map((i) => (i.id === id ? { ...i, archived_at: d.archived_at ?? null } : i)));
  }

  async function deleteItem(id: string) {
    const res = await netFetch(`/api/challenges?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    if (!res.ok) {
      const d = await res.json().catch(() => null);
      throw new Error(d?.error);
    }
    setItems((v) => v.filter((i) => i.id !== id));
  }

  async function open(it: SoloItem) {
    setBusy(true);
    setError(null);
    try {
      const { data } = await supabase
        .schema("learning")
        .from("challenge_questions")
        .select("id, content, type, options, order")
        .eq("challenge_id", it.id)
        .order("order", { ascending: true });
      const qs: Question[] = (data ?? []).map((q) => ({
        id: q.id,
        type: q.type === "open" ? "open" : "mcq",
        content: q.content,
        options: (q.options as string[]) ?? [],
      }));
      if (qs.length === 0) {
        setError(tr("tools.selfTest.noQuestions"));
        return;
      }
      setActive(it);
      setQuestions(qs);
      setResult(null);
      setAnalysis(null);
      setView("take");
    } finally {
      setBusy(false);
    }
  }

  // Submit the test for server grading (MCQ auto + open via the LLM); returns the
  // full breakdown so the player can show its result screen.
  async function submitAnswers(answers: TestAnswer[]): Promise<TestResult> {
    if (!active) throw new Error("no active self-test");
    // Open answers are graded by the LLM server-side (maxDuration 60s).
    const res = await netFetch(
      "/api/challenges/submit",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ challengeId: active.id, answers }),
      },
      { timeoutMs: 65_000 },
    );
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error ?? tr("tools.selfTest.submitFailed"));
    setResult({ score: data.score, correct: data.correct, total: data.total });
    await load();
    return data as TestResult;
  }

  // Deeper narrative analysis of the latest attempt → the branded reader.
  async function analyze() {
    if (!active || analyzing) return;
    setAnalyzing(true);
    setError(null);
    try {
      // A full narrative analysis, non-streamed (maxDuration 60s on the server).
      const res = await netFetch(
        "/api/challenges/analyze",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ challengeId: active.id }),
        },
        { timeoutMs: 65_000 },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? tr("tools.selfTest.analyzeFailed"));
      setAnalysis({ title: data.title, body: data.analysis });
      setView("analysis");
    } catch (e) {
      setError(e instanceof Error ? e.message : tr("tools.selfTest.analyzeFailed"));
    } finally {
      setAnalyzing(false);
    }
  }

  function analysisDoc(): BrandedDoc {
    return {
      brand: "raya",
      title: analysis?.title ?? tr("tools.selfTest.analysisFallback"),
      meta: new Date().toLocaleDateString(),
      audience: studentName || undefined,
      body: analysis?.body ?? "",
    };
  }

  function resultDoc(): BrandedDoc {
    const body = [
      active?.description ? `${active.description}\n` : "",
      `## ${tr("tools.selfTest.scoreHeading")}`,
      `${result?.correct ?? 0}/${result?.total ?? 0} · ${Math.round((result?.score ?? 0) * 100)}%`,
    ]
      .filter(Boolean)
      .join("\n");
    return {
      brand: "raya",
      title: active?.title ? `${active.title} — ${tr("tools.selfTest.resultSuffix")}` : tr("tools.selfTest.resultFallback"),
      meta: new Date().toLocaleDateString(),
      audience: studentName || undefined,
      body,
    };
  }

  // A shareable summary of the learner's tests + scores.
  function progressionDoc(): BrandedDoc {
    const done = items.filter((i) => i.score != null);
    const avg = done.length ? Math.round((done.reduce((a, i) => a + (i.score ?? 0), 0) / done.length) * 100) : null;
    const body = [
      `# ${tr("tools.selfTest.myProgress")}`,
      avg != null
        ? `${tr("tools.selfTest.avgScorePrefix")} ${avg}% ${tr("tools.selfTest.acrossWord")} ${done.length} ${tr(done.length > 1 ? "tools.selfTest.completedTestOther" : "tools.selfTest.completedTestOne")}.`
        : tr("tools.selfTest.noCompletedYet"),
      `## ${tr("tools.selfTest.testsHeading")}`,
      ...(items.length
        ? items.map(
            (i) =>
              `- ${i.title ?? tr("tools.selfTest.fallbackTitle")} — ${i.score != null ? Math.round(i.score * 100) + "%" : tr("tools.selfTest.notTaken")}`,
          )
        : [tr("tools.selfTest.noTestsYet")]),
    ].join("\n");
    return {
      brand: "raya",
      title: studentName ? `${studentName} — ${tr("tools.selfTest.progressWord")}` : tr("tools.selfTest.myProgress"),
      meta: new Date().toLocaleDateString(),
      audience: studentName || undefined,
      body,
    };
  }

  // Focused, one-question-at-a-time exam player (server-graded, MCQ + open).
  if (view === "take" && active) {
    const testQuestions: TestQuestion[] = questions.map((q) => ({
      id: q.id,
      type: q.type,
      question: q.content ?? "",
      options: q.options,
    }));
    return (
      <TestPlayer
        title={active.title ?? tr("tools.selfTest.fallbackTitle")}
        questions={testQuestions}
        onSubmit={submitAnswers}
        onExit={() => {
          setResult(null);
          setView("list");
        }}
        onAnalyze={analyze}
        analyzing={analyzing}
        resultActions={
          <>
            <DocumentActions doc={resultDoc()} compact shareable={false} personal />
            <ShareLinkButton theme={t} doc={resultDoc()} />
          </>
        }
      />
    );
  }

  // Narrative analysis of the attempt, in the branded reader.
  if (view === "analysis" && analysis) {
    return (
      <ReaderView
        title={analysis.title}
        subtitle={tr("tools.selfTest.analysisSubtitle")}
        blocks={parseDoc(analysis.body)}
        onExit={() => setView("list")}
        actions={
          <>
            <DocumentActions doc={analysisDoc()} compact shareable={false} personal />
            <ShareLinkButton theme={t} doc={analysisDoc()} />
          </>
        }
      />
    );
  }

  // list
  return (
    <div>
      <div style={panel(t)}>
        <h3 style={{ marginTop: 0, marginBottom: 12, fontSize: 16, fontWeight: 700, color: t.text }}>{tr("tools.selfTest.newTitle")}</h3>
        <input style={field(t)} placeholder={tr("tools.selfTest.namePlaceholder")} value={name} onChange={(e) => setName(e.target.value)} />
        <input style={field(t)} placeholder={tr("tools.selfTest.topicPlaceholder")} value={topic} onChange={(e) => setTopic(e.target.value)} />
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
          {TOPIC_KEYS.map((key) => {
            const s = tr(key);
            return (
              <button key={key} type="button" style={chip(t, topic === s)} onClick={() => setTopic(topic === s ? "" : s)}>
                {s}
              </button>
            );
          })}
        </div>
        <textarea
          style={{ ...field(t), resize: "vertical" }}
          rows={2}
          placeholder={tr("tools.selfTest.goalPlaceholder")}
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
        />
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 13, color: t.mutedLight, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>{tr("tools.selfTest.typeLabel")}</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {TEST_KINDS.map((k) => (
              <button key={k.id} type="button" style={chip(t, kind === k.id)} onClick={() => setKind(k.id)} title={tr(k.hintKey)}>
                {tr(k.labelKey)}
              </button>
            ))}
          </div>
        </div>
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 14, color: t.muted, marginBottom: 6 }}>{tr("tools.selfTest.sourceFileLabel")}</div>
          <FilePicker
            accept=".txt,.md,.markdown,.csv,.pdf,.docx,.xlsx,.mp3,.m4a,.wav,.webm,.ogg,.flac,audio/*,application/pdf,text/plain"
            onPick={(files) => setFile(files?.[0] ?? null)}
            fileName={file?.name ?? null}
            buttonStyle={neutralButton(t)}
            hintStyle={{ color: t.muted }}
          />
        </div>
        <div style={formActions}>
          <button
            style={{ ...cta(t), opacity: busy || (!name.trim() && !topic.trim() && !goal.trim() && !file) ? 0.5 : 1 }}
            onClick={create}
            disabled={busy || (!name.trim() && !topic.trim() && !goal.trim() && !file)}
          >
            {busy ? tr("tools.generating") : tr("tools.selfTest.createButton")}
          </button>
        </div>
        {error && <p style={{ color: "#f87171", fontSize: 15 }}>{error}</p>}
      </div>

      <div style={{ marginTop: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ flex: 1, fontSize: 13, color: t.mutedLight, textTransform: "uppercase", letterSpacing: "0.06em" }}>{tr("tools.selfTest.yourProgress")}</div>
          {items.length > 0 && (
            <>
              <DocumentActions doc={progressionDoc()} compact personal />
            </>
          )}
        </div>
        {items.length === 0 && <p style={{ color: t.muted, marginTop: 8, fontSize: 15 }}>{tr("tools.selfTest.noneYet")}</p>}
        {items.map((it) => {
          const label = it.title ?? tr("tools.selfTest.fallbackTitle");
          const archived = !!it.archived_at;
          return (
            <div
              key={it.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                background: t.cardBg2,
                border: `1px solid ${t.cardBorder}`,
                borderRadius: 14,
                padding: "12px 16px",
                marginTop: 8,
                opacity: archived ? 0.62 : 1,
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, color: t.text, fontSize: 15 }}>{label}</div>
                <div style={{ fontSize: 13, color: t.mutedLight }}>
                  {it.question_count ?? 0} {tr("tools.selfTest.questionsWord")}
                  {it.score != null && ` · ${tr("tools.selfTest.lastScore")} ${Math.round(it.score * 100)}%`}
                  {archived && ` · ${tr("hist.archivedSection")}`}
                </div>
              </div>
              <button style={{ ...cta(t), opacity: busy ? 0.5 : 1 }} onClick={() => open(it)} disabled={busy}>
                {it.score != null ? tr("tools.selfTest.retryButton") : tr("tools.selfTest.startButton")}
              </button>
              <ArtifactMenu
                theme={t}
                itemLabel={label}
                archived={archived}
                // A Schools "Prepare" assignment materializes as one of these
                // too (scope "assignment") — it's a class's homework record,
                // not a personal test, so only archiving is offered for it.
                canDelete={it.scope !== "assignment"}
                deleteCaveatKey="artifact.delete.caveat.selfTest"
                onArchive={(next) => archiveItem(it.id, next)}
                onDelete={() => deleteItem(it.id)}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
