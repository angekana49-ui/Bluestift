"use client";

import { useCallback, useEffect, useState } from "react";
import { useAppTheme } from "@/components/ui/theme";
import { netFetch, getJsonCached } from "@/lib/net/client-fetch";
import { panelCard, ctaButton, formActions } from "@/components/ui/forms";
import { TestPlayer, type TestAnswer, type TestQuestion, type TestResult } from "@/components/study/focus-player";
import { useTranslate } from "@/components/ui/locale";
import type { MessageKey } from "@/lib/i18n";

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

const KIND_LABEL_KEY: Record<string, MessageKey> = {
  exam: "tools.selfTest.kind.exam.label",
  exercise: "school.prepare.kindExerciseSet",
  worksheet: "school.prepare.kindWorksheet",
  quiz: "tools.pretty.quiz",
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
  const tr = useTranslate();
  const box = panelCard(t);
  const btn = ctaButton(t);

  const [items, setItems] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState<Assignment | null>(null);
  const [questions, setQuestions] = useState<TestQuestion[]>([]);
  const [starting, setStarting] = useState(false);

  const load = useCallback(async () => {
    // Cached first: reopening Assignments renders the known list instantly
    // instead of a spinner every time.
    const { data } = await getJsonCached<{ assignments?: Assignment[] }>("/api/assignments", {
      cacheKey: "assignments:list",
      onUpdate: (fresh) => setItems(fresh.assignments ?? []),
    });
    if (!data) {
      setError(tr("assignments.loadFailed"));
      setLoading(false);
      return;
    }
    setItems(data.assignments ?? []);
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function start(a: Assignment) {
    if (starting) return;
    setStarting(true);
    setError(null);
    try {
      const res = await netFetch(
        `/api/assignments?challengeId=${encodeURIComponent(a.challengeId)}`,
        {},
        { timeoutMs: 15_000 },
      );
      const d = await res.json();
      if (!res.ok) throw new Error(d?.error ?? tr("assignments.openFailed"));
      const qs = (d.questions ?? []) as TestQuestion[];
      if (qs.length === 0) throw new Error(tr("assignments.noQuestions"));
      setActive(a);
      setQuestions(qs);
    } catch (e) {
      setError(e instanceof Error ? e.message : tr("assignments.openFailed"));
    } finally {
      setStarting(false);
    }
  }

  async function submit(answers: TestAnswer[]): Promise<TestResult> {
    if (!active) throw new Error("no active assignment");
    // Open answers are graded by the LLM server-side (maxDuration 60s).
    const res = await netFetch(
      "/api/assignments/submit",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ challengeId: active.challengeId, answers }),
      },
      { timeoutMs: 65_000 },
    );
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error ?? tr("tools.selfTest.submitFailed"));
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
        <h1 style={{ fontSize: "1.25rem", margin: 0 }}>{tr("nav.assignments")}</h1>
        <p style={{ opacity: 0.6, fontSize: "0.9rem", margin: "6px 0 0" }}>{tr("assignments.intro")}</p>
      </div>

      {error && <p style={{ color: "#f87171" }}>{error}</p>}
      {loading ? (
        <p style={{ opacity: 0.6 }}>{tr("school.loading")}</p>
      ) : items.length === 0 ? (
        <div style={box}>
          <p style={{ margin: 0, opacity: 0.65 }}>{tr("assignments.nothingAssignedYet")}</p>
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
                  {a.kind in KIND_LABEL_KEY ? tr(KIND_LABEL_KEY[a.kind]) : a.kind} · {a.className}
                  {a.questionCount ? ` · ${a.questionCount} ${tr("tools.selfTest.questionsWord")}` : ""}
                  {due ? ` · ${tr("school.prepare.dueSuffix")} ${due}` : ""}
                </div>
              </div>
              {status === "done" ? (
                <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "#22c55e" }}>
                  {tr("assignments.doneStatus")} · {pct(a.score)}
                </span>
              ) : status === "closed" ? (
                <span style={{ fontSize: "0.82rem", opacity: 0.55 }}>{tr("assignments.closedStatus")}</span>
              ) : (
                <button style={btn} onClick={() => start(a)} disabled={starting}>
                  {starting ? tr("assignments.opening") : tr("tools.selfTest.startButton")}
                </button>
              )}
            </div>
          );
        })
      )}
      <div style={{ ...formActions, marginTop: 8 }}>
        <button style={btn} onClick={() => void load()}>
          {tr("assignments.refresh")}
        </button>
      </div>
    </div>
  );
}
