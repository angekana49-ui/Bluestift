"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { downloadBrandedPdf, downloadBrandedText, type BrandedDoc } from "@/lib/document";
import { TestPlayer, ReaderView, type TestAnswer, type TestQuestion, type TestResult } from "@/components/study/focus-player";
import { ShareLinkButton } from "@/components/study/share-button";
import { parseDoc } from "@/lib/doc-format";
import { useAppTheme } from "@/components/ui/theme";
import { type AppTheme } from "@/components/ui/tokens";

type Question = { id: string; type: "mcq" | "open"; content: string | null; options: string[] };

// Test kinds — a quick MCQ quiz, a full mixed exam, or open competency questions.
const TEST_KINDS = [
  { id: "quiz", label: "Quiz", hint: "Quick multiple-choice" },
  { id: "exam", label: "Exam", hint: "Mixed MCQ + open" },
  { id: "skills", label: "Skills", hint: "Open competency" },
];
type SoloItem = {
  id: string;
  title: string | null;
  description: string | null;
  question_count: number | null;
  score: number | null;
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
  fontSize: 12,
  fontWeight: 600,
  cursor: "pointer",
});
const ghost = (t: AppTheme): React.CSSProperties => ({
  background: t.cardBg2,
  color: t.text,
  border: `1.5px solid ${t.dark ? "rgba(255,255,255,0.22)" : "rgba(15,23,42,0.20)"}`,
  borderRadius: 99,
  padding: "6px 13px",
  fontSize: 11.5,
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
  fontSize: 12.5,
  boxSizing: "border-box",
  outline: "none",
});
const chip = (t: AppTheme, on: boolean): React.CSSProperties => ({
  background: on ? t.ctaBg : "transparent",
  color: on ? t.ctaText : t.muted,
  border: `1px solid ${on ? t.ctaBg : t.cardBorder}`,
  borderRadius: 99,
  padding: "6px 12px",
  fontSize: 11.5,
  fontWeight: 600,
  cursor: "pointer",
});

// Smart defaults: one-tap common topics + a pre-filled goal so the form is never
// blank (decision-fatigue killer). The user overrides either at will.
const TOPIC_SUGGESTIONS = ["Maths", "Physics", "Chemistry", "Biology", "History", "Languages"];
const DEFAULT_GOAL = "Review the key ideas and check I really understand them.";

export function SoloChallenge({ myUserId, studentName }: { myUserId: string; studentName?: string }) {
  const { theme: t } = useAppTheme();
  const [supabase] = useState(() => createClient());
  const [view, setView] = useState<"list" | "take" | "analysis">("list");
  const [items, setItems] = useState<SoloItem[]>([]);
  const [name, setName] = useState("");
  const [topic, setTopic] = useState("");
  const [goal, setGoal] = useState(DEFAULT_GOAL);
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
        .select("id, title, description, question_count")
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
    if ((!topic.trim() && !goal.trim() && !file) || busy) return;
    setBusy(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("name", name);
      fd.append("topic", topic);
      fd.append("goal", goal);
      fd.append("kind", kind);
      if (file) fd.append("file", file);
      const res = await fetch("/api/challenges/create", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ?? "Couldn't create the self-test.");
        return;
      }
      setName("");
      setTopic("");
      setGoal(DEFAULT_GOAL);
      setFile(null);
      await load();
    } catch {
      setError("Couldn't create the self-test.");
    } finally {
      setBusy(false);
    }
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
        setError("This test has no questions yet.");
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
    const res = await fetch("/api/challenges/submit", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ challengeId: active.id, answers }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error ?? "Could not submit.");
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
      const res = await fetch("/api/challenges/analyze", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ challengeId: active.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Could not analyse.");
      setAnalysis({ title: data.title, body: data.analysis });
      setView("analysis");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not analyse.");
    } finally {
      setAnalyzing(false);
    }
  }

  function analysisDoc(): BrandedDoc {
    return {
      brand: "raya",
      title: analysis?.title ?? "Analysis",
      meta: new Date().toLocaleDateString(),
      audience: studentName || undefined,
      body: analysis?.body ?? "",
    };
  }

  function resultDoc(): BrandedDoc {
    const body = [
      active?.description ? `${active.description}\n` : "",
      `## Score`,
      `${result?.correct ?? 0}/${result?.total ?? 0} · ${Math.round((result?.score ?? 0) * 100)}%`,
    ]
      .filter(Boolean)
      .join("\n");
    return {
      brand: "raya",
      title: active?.title ? `${active.title} — result` : "Self-test result",
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
      "# My progress",
      avg != null ? `Average score: ${avg}% across ${done.length} completed test${done.length > 1 ? "s" : ""}.` : "No completed tests yet.",
      "## Tests",
      ...(items.length ? items.map((i) => `- ${i.title ?? "Self-test"} — ${i.score != null ? Math.round(i.score * 100) + "%" : "not taken"}`) : ["No tests yet."]),
    ].join("\n");
    return {
      brand: "raya",
      title: studentName ? `${studentName} — progress` : "My progress",
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
        title={active.title ?? "Self-test"}
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
            <button style={ghost(t)} onClick={() => downloadBrandedText(resultDoc())}>TXT</button>
            <button style={ghost(t)} onClick={() => downloadBrandedPdf(resultDoc())}>PDF</button>
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
        subtitle="Analysis"
        blocks={parseDoc(analysis.body)}
        onExit={() => setView("list")}
        actions={
          <>
            <button style={ghost(t)} onClick={() => downloadBrandedText(analysisDoc())}>TXT</button>
            <button style={ghost(t)} onClick={() => downloadBrandedPdf(analysisDoc())}>PDF</button>
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
        <h3 style={{ marginTop: 0, marginBottom: 12, fontSize: 14, fontWeight: 700, color: t.text }}>New self-test</h3>
        <input style={field(t)} placeholder="Name (optional — e.g. Chapter 3 quiz)" value={name} onChange={(e) => setName(e.target.value)} />
        <input style={field(t)} placeholder="Topic (optional)" value={topic} onChange={(e) => setTopic(e.target.value)} />
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
          {TOPIC_SUGGESTIONS.map((s) => (
            <button key={s} type="button" style={chip(t, topic === s)} onClick={() => setTopic(topic === s ? "" : s)}>
              {s}
            </button>
          ))}
        </div>
        <textarea
          style={{ ...field(t), resize: "vertical" }}
          rows={2}
          placeholder="Goal — what do you want to test yourself on?"
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
        />
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 11, color: t.mutedLight, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Type of test</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {TEST_KINDS.map((k) => (
              <button key={k.id} type="button" style={chip(t, kind === k.id)} onClick={() => setKind(k.id)} title={k.hint}>
                {k.label}
              </button>
            ))}
          </div>
        </div>
        <div style={{ marginBottom: 8 }}>
          <label style={{ fontSize: 11.5, color: t.muted, marginRight: 8 }}>Source file (optional):</label>
          <input
            type="file"
            accept=".txt,.md,.markdown,.csv,.pdf,.docx,.xlsx,.mp3,.m4a,.wav,.webm,.ogg,.flac,audio/*,application/pdf,text/plain"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            style={{ fontSize: 12, color: t.muted }}
          />
        </div>
        <button style={{ ...cta(t), opacity: busy || (!topic.trim() && !goal.trim() && !file) ? 0.5 : 1 }} onClick={create} disabled={busy || (!topic.trim() && !goal.trim() && !file)}>
          {busy ? "Generating…" : "Create the self-test"}
        </button>
        {error && <p style={{ color: "#f87171", fontSize: 12.5 }}>{error}</p>}
      </div>

      <div style={{ marginTop: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ flex: 1, fontSize: 10.5, color: t.mutedLight, textTransform: "uppercase", letterSpacing: "0.06em" }}>Your progress</div>
          {items.length > 0 && (
            <>
              <button style={ghost(t)} onClick={() => downloadBrandedPdf(progressionDoc())} title="Download your progress">PDF</button>
              <ShareLinkButton theme={t} doc={progressionDoc()} />
            </>
          )}
        </div>
        {items.length === 0 && <p style={{ color: t.muted, marginTop: 8, fontSize: 12.5 }}>No self-tests yet.</p>}
        {items.map((it) => (
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
            }}
          >
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, color: t.text, fontSize: 13 }}>{it.title ?? "Self-test"}</div>
              <div style={{ fontSize: 11, color: t.mutedLight }}>
                {it.question_count ?? 0} questions
                {it.score != null && ` · last score ${Math.round(it.score * 100)}%`}
              </div>
            </div>
            <button style={{ ...cta(t), opacity: busy ? 0.5 : 1 }} onClick={() => open(it)} disabled={busy}>
              {it.score != null ? "Retry" : "Start"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
