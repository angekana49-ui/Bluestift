"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAppTheme } from "@/components/ui/theme";
import { type AppTheme } from "@/components/ui/tokens";
import { downloadBrandedPdf, downloadBrandedText, type BrandedDoc } from "@/lib/document";
import { TestPlayer, ReaderView, type TestAnswer, type TestQuestion, type TestResult } from "@/components/study/focus-player";
import { ShareLinkButton } from "@/components/study/share-button";
import { parseDoc } from "@/lib/doc-format";
import { FilePicker } from "@/components/ui/file-picker";
import { neutralButton, formActions } from "@/components/ui/forms";

type Challenge = {
  id: string;
  title: string | null;
  description: string | null;
  status: string;
  question_count: number | null;
  format?: string | null;
};
type Question = { id: string; type: "mcq" | "open"; content: string | null; options: string[] };
type LeaderRow = {
  user_id: string;
  display_name: string | null;
  username: string | null;
  score: number | null;
  status: string;
};

// Test kinds, as in the Tools studio — chosen at creation. Rooms keep their own
// originality (the shared leaderboard) on top of the same focused player.
const TEST_KINDS = [
  { id: "quiz", label: "Quiz", hint: "Quick multiple-choice" },
  { id: "exam", label: "Exam", hint: "Mixed MCQ + open" },
  { id: "skills", label: "Skills", hint: "Open competency" },
];

const mkBtn = (t: AppTheme): React.CSSProperties => ({
  background: t.ctaBg,
  color: t.ctaText,
  border: "none",
  borderRadius: 99,
  padding: "9px 16px",
  fontSize: 14,
  fontWeight: 600,
  cursor: "pointer",
});
const mkGhost = (t: AppTheme): React.CSSProperties => ({
  background: t.cardBg2,
  color: t.text,
  border: `1.5px solid ${t.dark ? "rgba(255,255,255,0.22)" : "rgba(15,23,42,0.20)"}`,
  borderRadius: 99,
  padding: "6px 13px",
  fontSize: 14,
  fontWeight: 600,
  cursor: "pointer",
});
const mkBox = (t: AppTheme): React.CSSProperties => ({
  background: t.cardBg2,
  border: `1px solid ${t.cardBorder}`,
  borderRadius: 16,
  padding: 16,
  marginTop: 16,
});
const mkField = (t: AppTheme): React.CSSProperties => ({
  width: "100%",
  background: t.inputBg,
  color: t.text,
  border: `1px solid ${t.inputBorder}`,
  borderRadius: 10,
  padding: "10px 14px",
  marginBottom: 8,
  fontSize: 15,
  fontFamily: "inherit",
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

export function RoomChallenges({
  roomId,
  roomName,
  subject,
  myUserId,
  readOnly = false,
}: {
  roomId: string;
  roomName: string;
  subject: string | null;
  myUserId: string;
  /** When the room's timer has ended: no new challenges, no new attempts. */
  readOnly?: boolean;
}) {
  const { theme: t } = useAppTheme();
  const btn = mkBtn(t);
  const ghost = mkGhost(t);
  const box = mkBox(t);
  const field = mkField(t);
  const [supabase] = useState(() => createClient());
  const [view, setView] = useState<"list" | "take" | "standings" | "analysis">("list");
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [name, setName] = useState("");
  const [topic, setTopic] = useState(subject ?? "");
  const [goal, setGoal] = useState("");
  const [kind, setKind] = useState("quiz");
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [active, setActive] = useState<Challenge | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [result, setResult] = useState<{ score: number; correct: number; total: number } | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderRow[]>([]);
  const [analysis, setAnalysis] = useState<{ title: string; body: string } | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

  async function loadChallenges() {
    const { data } = await supabase
      .schema("learning")
      .from("challenges")
      .select("id, title, description, status, question_count, format")
      .eq("room_id", roomId)
      .order("created_at", { ascending: false });
    setChallenges(data ?? []);
  }

  useEffect(() => {
    loadChallenges();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  async function create() {
    if ((!topic.trim() && !goal.trim() && !sourceFile) || busy) return;
    setBusy(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("roomId", roomId);
      fd.append("name", name);
      fd.append("topic", topic);
      fd.append("goal", goal);
      fd.append("kind", kind);
      if (sourceFile) fd.append("file", sourceFile);
      const res = await fetch("/api/challenges/create", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ?? "Couldn't create the challenge.");
        return;
      }
      setName("");
      setGoal("");
      setSourceFile(null);
      await loadChallenges();
    } catch {
      setError("Couldn't create the challenge.");
    } finally {
      setBusy(false);
    }
  }

  async function open(ch: Challenge) {
    setBusy(true);
    setError(null);
    try {
      const { data } = await supabase
        .schema("learning")
        .from("challenge_questions")
        .select("id, content, type, options, order")
        .eq("challenge_id", ch.id)
        .order("order", { ascending: true });
      const qs: Question[] = (data ?? []).map((q) => ({
        id: q.id,
        type: q.type === "open" ? "open" : "mcq",
        content: q.content,
        options: (q.options as string[]) ?? [],
      }));
      if (qs.length === 0) {
        setError("This challenge has no questions yet.");
        return;
      }
      setActive(ch);
      setQuestions(qs);
      setResult(null);
      setAnalysis(null);
      setView("take");
    } finally {
      setBusy(false);
    }
  }

  // Server grading (MCQ auto + open via the LLM), then refresh the leaderboard so
  // the squad standings are ready the moment the player finishes.
  async function submitAnswers(answers: TestAnswer[]): Promise<TestResult> {
    if (!active) throw new Error("no active challenge");
    const res = await fetch("/api/challenges/submit", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ challengeId: active.id, answers }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error ?? "Couldn't submit.");
    setResult({ score: data.score, correct: data.correct, total: data.total });
    const { data: lb } = await supabase.rpc("challenge_leaderboard", { p_challenge_id: active.id });
    setLeaderboard(lb ?? []);
    return data as TestResult;
  }

  // Deeper narrative analysis of the attempt → the branded reader.
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

  // Branded documents — "…for <room> room" in the footer, like every room report.
  function resultDoc(): BrandedDoc {
    const body = [
      active?.description ? `${active.description}\n` : "",
      "## Score",
      `${result?.correct ?? 0}/${result?.total ?? 0} · ${Math.round((result?.score ?? 0) * 100)}%`,
    ]
      .filter(Boolean)
      .join("\n");
    return {
      brand: "raya",
      title: active?.title ? `${active.title} — result` : "Challenge result",
      meta: new Date().toLocaleDateString(),
      audience: `${roomName} room`,
      body,
    };
  }
  function analysisDoc(): BrandedDoc {
    return {
      brand: "raya",
      title: analysis?.title ?? "Analysis",
      meta: new Date().toLocaleDateString(),
      audience: `${roomName} room`,
      body: analysis?.body ?? "",
    };
  }

  // Focused, one-question-at-a-time player (server-graded, MCQ + open).
  if (view === "take" && active) {
    const testQuestions: TestQuestion[] = questions.map((q) => ({
      id: q.id,
      type: q.type,
      question: q.content ?? "",
      options: q.options,
    }));
    return (
      <TestPlayer
        title={active.title ?? "Challenge"}
        questions={testQuestions}
        onSubmit={submitAnswers}
        onExit={() => setView("list")}
        onAnalyze={analyze}
        analyzing={analyzing}
        resultActions={
          <>
            <button style={ghost} onClick={() => downloadBrandedText(resultDoc())}>TXT</button>
            <button style={ghost} onClick={() => downloadBrandedPdf(resultDoc())}>PDF</button>
            <ShareLinkButton theme={t} doc={resultDoc()} />
            <button style={ghost} onClick={() => setView("standings")} title="Squad standings">🏆 Standings</button>
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
            <button style={ghost} onClick={() => downloadBrandedText(analysisDoc())}>TXT</button>
            <button style={ghost} onClick={() => downloadBrandedPdf(analysisDoc())}>PDF</button>
            <ShareLinkButton theme={t} doc={analysisDoc()} />
          </>
        }
      />
    );
  }

  // Squad standings — the room's own twist on top of the shared player.
  if (view === "standings") {
    return (
      <div style={box}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
          <h3 style={{ margin: 0, flex: 1, fontSize: 16, fontWeight: 700, color: t.text }}>🏆 Squad standings</h3>
          {result && (
            <span style={{ fontSize: 15, color: t.muted }}>
              You · {result.correct}/{result.total} · {Math.round(result.score * 100)}%
            </span>
          )}
        </div>
        <h4 style={{ color: t.text, fontSize: 15, margin: "10px 0 4px" }}>{active?.title ?? "Challenge"}</h4>
        {leaderboard.length === 0 && <p style={{ color: t.muted, fontSize: 15 }}>No scores yet.</p>}
        {leaderboard
          .slice()
          .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
          .map((r, i) => {
            const mine = r.user_id === myUserId;
            return (
              <div
                key={r.user_id}
                style={{
                  display: "flex",
                  gap: 8,
                  alignItems: "center",
                  padding: "7px 10px",
                  borderRadius: 10,
                  marginTop: 4,
                  background: mine ? t.rowActiveBg : "transparent",
                  color: t.text,
                  fontSize: 15,
                }}
              >
                <span style={{ color: t.mutedLight, width: 22, flex: "none", fontWeight: 700 }}>
                  {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}.`}
                </span>
                <span style={{ flex: 1, minWidth: 0, fontWeight: mine ? 700 : 500 }}>
                  {mine ? "You" : r.display_name || (r.username ? `@${r.username}` : "Member")}
                </span>
                <span style={{ fontWeight: 700 }}>{Math.round((r.score ?? 0) * 100)}%</span>
              </div>
            );
          })}
        <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
          <button style={btn} onClick={() => setView("list")}>Back to challenges</button>
          <button style={ghost} onClick={() => downloadBrandedPdf(resultDoc())}>My result (PDF)</button>
          <ShareLinkButton theme={t} doc={resultDoc()} />
        </div>
      </div>
    );
  }

  // list
  return (
    <div>
      {readOnly ? (
        <div style={{ ...box, color: t.muted, fontSize: 15 }}>
          🔒 This session has ended — challenges are read-only. You can review past scores below.
        </div>
      ) : (
      <div style={box}>
        <h3 style={{ marginTop: 0, marginBottom: 12, fontSize: 16, fontWeight: 700, color: t.text }}>New challenge</h3>
        <input style={field} placeholder="Name (optional — e.g. Chapter 3 quiz)" value={name} onChange={(e) => setName(e.target.value)} />
        <input style={field} placeholder="Topic (e.g. Newton's laws)" value={topic} onChange={(e) => setTopic(e.target.value)} />
        <textarea
          style={{ ...field, resize: "vertical" }}
          rows={2}
          placeholder="Goal — what should this challenge test? (e.g. exam application problems)"
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
        />
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 13, color: t.mutedLight, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Type of challenge</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {TEST_KINDS.map((k) => (
              <button key={k.id} type="button" style={chip(t, kind === k.id)} onClick={() => setKind(k.id)} title={k.hint}>
                {k.label}
              </button>
            ))}
          </div>
        </div>
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 14, color: t.muted, marginBottom: 6 }}>Source file (optional)</div>
          <FilePicker
            accept=".txt,.md,.markdown,.csv,.pdf,.docx,.xlsx,.mp3,.m4a,.wav,.webm,.ogg,.flac,audio/*,application/pdf,text/plain"
            onPick={(files) => setSourceFile(files?.[0] ?? null)}
            fileName={sourceFile?.name ?? null}
            buttonStyle={neutralButton(t)}
            hintStyle={{ color: t.muted }}
          />
        </div>
        <div style={formActions}>
          <button style={{ ...btn, opacity: busy || (!topic.trim() && !goal.trim() && !sourceFile) ? 0.5 : 1 }} onClick={create} disabled={busy || (!topic.trim() && !goal.trim() && !sourceFile)}>
            {busy ? "Generating…" : "Generate the challenge"}
          </button>
        </div>
        {error && <p style={{ color: "#f87171", fontSize: 15 }}>{error}</p>}
      </div>
      )}

      <div style={{ marginTop: 16 }}>
        {challenges.length === 0 && <p style={{ color: t.muted, fontSize: 15 }}>No challenges — create one.</p>}
        {challenges.map((ch) => (
          <div
            key={ch.id}
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
              <div style={{ fontWeight: 600, color: t.text, fontSize: 15 }}>{ch.title ?? "Challenge"}</div>
              {ch.description && <div style={{ fontSize: 14, color: t.muted }}>{ch.description}</div>}
              <div style={{ fontSize: 13, color: t.mutedLight }}>
                {ch.question_count ?? 0} questions · {kindLabel(ch.format)} · {ch.status}
              </div>
            </div>
            <button style={{ ...btn, opacity: busy || readOnly ? 0.5 : 1 }} onClick={() => open(ch)} disabled={busy || readOnly}>
              Play
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Storage `format` → the friendly challenge kind shown on the list. */
function kindLabel(format?: string | null): string {
  if (format === "exam") return "Exam";
  if (format === "open") return "Skills";
  return "Quiz";
}
