"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { downloadBrandedPdf, downloadBrandedText, type BrandedDoc } from "@/lib/document";
import { useAppTheme } from "@/components/ui/theme";
import { type AppTheme } from "@/components/ui/tokens";

type Question = { id: string; content: string | null; options: string[] };
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
  color: t.mutedLight,
  border: `1px solid ${t.cardBorder}`,
  borderRadius: 99,
  padding: "5px 12px",
  fontSize: 11,
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
  const [view, setView] = useState<"list" | "take" | "result">("list");
  const [items, setItems] = useState<SoloItem[]>([]);
  const [name, setName] = useState("");
  const [topic, setTopic] = useState("");
  const [goal, setGoal] = useState(DEFAULT_GOAL);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [active, setActive] = useState<SoloItem | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [result, setResult] = useState<{ score: number; correct: number; total: number } | null>(
    null,
  );

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
        .select("id, content, options, order")
        .eq("challenge_id", it.id)
        .order("order", { ascending: true });
      setActive(it);
      setQuestions(
        (data ?? []).map((q) => ({
          id: q.id,
          content: q.content,
          options: (q.options as string[]) ?? [],
        })),
      );
      setAnswers({});
      setResult(null);
      setView("take");
    } finally {
      setBusy(false);
    }
  }

  async function submit() {
    if (!active || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/challenges/submit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          challengeId: active.id,
          answers: Object.entries(answers).map(([questionId, choiceIndex]) => ({
            questionId,
            choiceIndex,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ?? "Impossible d'envoyer.");
        return;
      }
      setResult(data);
      setView("result");
      await load();
    } catch {
      setError("Impossible d'envoyer.");
    } finally {
      setBusy(false);
    }
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

  if (view === "take" && active) {
    const answered = Object.keys(answers).length;
    return (
      <div style={panel(t)}>
        <h3 style={{ marginTop: 0, fontSize: 14, fontWeight: 700, color: t.text }}>{active.title ?? "Self-test"}</h3>
        {questions.map((q, i) => (
          <div key={q.id} style={{ marginBottom: 16 }}>
            <p style={{ fontWeight: 600, marginBottom: 8, color: t.text, fontSize: 13 }}>
              {i + 1}. {q.content}
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {q.options.map((opt, oi) => (
                <button
                  key={oi}
                  onClick={() => setAnswers((a) => ({ ...a, [q.id]: oi }))}
                  style={{
                    textAlign: "left",
                    background: answers[q.id] === oi ? t.ctaBg : t.cardBg,
                    color: answers[q.id] === oi ? t.ctaText : t.text,
                    border: `1px solid ${t.cardBorder}`,
                    borderRadius: 10,
                    padding: "9px 12px",
                    cursor: "pointer",
                    fontSize: 12.5,
                  }}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>
        ))}
        <button style={{ ...cta(t), opacity: busy || answered < questions.length ? 0.5 : 1 }} onClick={submit} disabled={busy || answered < questions.length}>
          Submit ({answered}/{questions.length})
        </button>
        {error && <p style={{ color: "#f87171", fontSize: 12.5 }}>{error}</p>}
      </div>
    );
  }

  if (view === "result" && result && active) {
    return (
      <div style={panel(t)}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <h3 style={{ margin: 0, flex: 1, fontSize: 14, fontWeight: 700, color: t.text }}>Result</h3>
          <button style={ghost(t)} onClick={() => downloadBrandedText(resultDoc())}>TXT</button>
          <button style={ghost(t)} onClick={() => downloadBrandedPdf(resultDoc())}>PDF</button>
        </div>
        <p style={{ fontSize: 22, fontWeight: 700, color: t.text }}>
          {result.correct}/{result.total} · {Math.round(result.score * 100)}%
        </p>
        <button style={{ ...cta(t), background: t.cardBg2, color: t.text, border: `1px solid ${t.cardBorder}` }} onClick={() => setView("list")}>
          Back
        </button>
      </div>
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
        <div style={{ fontSize: 10.5, color: t.mutedLight, textTransform: "uppercase", letterSpacing: "0.06em" }}>Your progress</div>
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
