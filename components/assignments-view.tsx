"use client";

import { useCallback, useEffect, useState } from "react";
import { useAppTheme } from "@/components/ui/theme";
import { panelCard, ctaButton, ghostButton } from "@/components/ui/forms";
import { TestPlayer, type TestAnswer, type TestQuestion, type TestResult } from "@/components/study/focus-player";

type Assignment = {
  assignmentId: string;
  challengeId: string;
  title: string;
  kind: string;
  className: string;
  dueAt: string | null;
  questionCount: number | null;
  pastDue: boolean;
  done: boolean;
  score: number | null;
  completedAt: string | null;
};

const KIND_LABEL: Record<string, string> = {
  exam: "Exam",
  exercise: "Exercise set",
  worksheet: "Worksheet",
  quiz: "Quiz",
};
const pct = (v: number | null) => (v == null ? "—" : `${Math.round(v * 100)}%`);
const fmt = (d: string | null) => (d ? new Date(d).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : null);

/**
 * Student "Assignments" surface: exams/exercises a teacher assigned to the student's
 * class. One attempt each (an optional deadline closes it); taking reuses the shared
 * TestPlayer + the assignment grading route, so it behaves like every other test.
 */
export function AssignmentsView() {
  const { theme: t } = useAppTheme();
  const box = panelCard(t);
  const btn = ctaButton(t);
  const ghost = ghostButton(t);

  const [items, setItems] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState<Assignment | null>(null);
  const [questions, setQuestions] = useState<TestQuestion[]>([]);
  const [starting, setStarting] = useState(false);

  const load = useCallback(async () => {
    try {
      const d = await (await fetch("/api/assignments")).json();
      setItems((d.assignments ?? []) as Assignment[]);
    } catch {
      setError("Could not load your assignments.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function start(a: Assignment) {
    if (starting) return;
    setStarting(true);
    setError(null);
    try {
      const res = await fetch(`/api/assignments?challengeId=${encodeURIComponent(a.challengeId)}`);
      const d = await res.json();
      if (!res.ok) throw new Error(d?.error ?? "Could not open this assignment.");
      const qs = (d.questions ?? []) as TestQuestion[];
      if (qs.length === 0) throw new Error("This assignment has no questions.");
      setActive(a);
      setQuestions(qs);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not open this assignment.");
    } finally {
      setStarting(false);
    }
  }

  async function submit(answers: TestAnswer[]): Promise<TestResult> {
    if (!active) throw new Error("no active assignment");
    const res = await fetch("/api/assignments/submit", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ challengeId: active.challengeId, answers }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error ?? "Could not submit.");
    await load();
    return data as TestResult;
  }

  if (active) {
    return (
      <TestPlayer
        title={active.title}
        questions={questions}
        onSubmit={submit}
        onExit={() => {
          setActive(null);
          setQuestions([]);
        }}
      />
    );
  }

  return (
    <div>
      <div style={{ ...box, marginTop: 0 }}>
        <h1 style={{ fontSize: "1.25rem", margin: 0 }}>Assignments</h1>
        <p style={{ opacity: 0.6, fontSize: "0.9rem", margin: "6px 0 0" }}>
          Exams and exercises your teacher assigned to your class. Each one is a single attempt.
        </p>
      </div>

      {error && <p style={{ color: "#f87171" }}>{error}</p>}
      {loading ? (
        <p style={{ opacity: 0.6 }}>Loading…</p>
      ) : items.length === 0 ? (
        <div style={box}>
          <p style={{ margin: 0, opacity: 0.65 }}>
            Nothing assigned yet. When your teacher sends an exam or exercise, it shows up here.
          </p>
        </div>
      ) : (
        items.map((a) => {
          const due = fmt(a.dueAt);
          const status = a.done ? "done" : a.pastDue ? "closed" : "todo";
          return (
            <div key={a.assignmentId} style={{ ...box, display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600 }}>{a.title}</div>
                <div style={{ opacity: 0.55, fontSize: "0.82rem", marginTop: 2 }}>
                  {KIND_LABEL[a.kind] ?? a.kind} · {a.className}
                  {a.questionCount ? ` · ${a.questionCount} questions` : ""}
                  {due ? ` · due ${due}` : ""}
                </div>
              </div>
              {status === "done" ? (
                <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "#22c55e" }}>Done · {pct(a.score)}</span>
              ) : status === "closed" ? (
                <span style={{ fontSize: "0.82rem", opacity: 0.55 }}>Closed</span>
              ) : (
                <button style={btn} onClick={() => start(a)} disabled={starting}>
                  {starting ? "Opening…" : "Start"}
                </button>
              )}
            </div>
          );
        })
      )}
      <div style={{ marginTop: 8 }}>
        <button style={ghost} onClick={() => void load()}>
          Refresh
        </button>
      </div>
    </div>
  );
}
