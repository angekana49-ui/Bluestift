"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useDarkMode } from "@/components/ui/theme";
import { type AppTheme } from "@/components/ui/tokens";

type Challenge = {
  id: string;
  title: string | null;
  description: string | null;
  status: string;
  question_count: number | null;
};
type Question = { id: string; content: string | null; options: string[] };
type LeaderRow = {
  user_id: string;
  display_name: string | null;
  username: string | null;
  score: number | null;
  status: string;
};

const mkBtn = (t: AppTheme): React.CSSProperties => ({
  background: t.ctaBg,
  color: t.ctaText,
  border: "none",
  borderRadius: 99,
  padding: "9px 16px",
  fontSize: 12,
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
  fontSize: 12.5,
  fontFamily: "inherit",
  boxSizing: "border-box",
  outline: "none",
});

export function RoomChallenges({
  roomId,
  subject,
  myUserId,
  readOnly = false,
}: {
  roomId: string;
  subject: string | null;
  myUserId: string;
  /** When the room's timer has ended: no new challenges, no new attempts. */
  readOnly?: boolean;
}) {
  const { theme: t } = useDarkMode();
  const btn = mkBtn(t);
  const box = mkBox(t);
  const field = mkField(t);
  const [supabase] = useState(() => createClient());
  const [view, setView] = useState<"list" | "take" | "result">("list");
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [name, setName] = useState("");
  const [topic, setTopic] = useState(subject ?? "");
  const [goal, setGoal] = useState("");
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [active, setActive] = useState<Challenge | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [result, setResult] = useState<{ score: number; correct: number; total: number } | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderRow[]>([]);

  async function loadChallenges() {
    const { data } = await supabase
      .schema("learning")
      .from("challenges")
      .select("id, title, description, status, question_count")
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
        .select("id, content, options, order")
        .eq("challenge_id", ch.id)
        .order("order", { ascending: true });
      setActive(ch);
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
        setError(data?.error ?? "Couldn't submit.");
        return;
      }
      setResult(data);
      const { data: lb } = await supabase.rpc("challenge_leaderboard", {
        p_challenge_id: active.id,
      });
      setLeaderboard(lb ?? []);
      setView("result");
    } catch {
      setError("Couldn't submit.");
    } finally {
      setBusy(false);
    }
  }

  if (view === "take" && active) {
    const answered = Object.keys(answers).length;
    return (
      <div style={box}>
        <h3 style={{ marginTop: 0, fontSize: 14, fontWeight: 700, color: t.text }}>{active.title ?? "Challenge"}</h3>
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
        <button style={{ ...btn, opacity: busy || answered < questions.length ? 0.5 : 1 }} onClick={submit} disabled={busy || answered < questions.length}>
          Submit ({answered}/{questions.length})
        </button>
        {error && <p style={{ color: "#f87171", fontSize: 12.5 }}>{error}</p>}
      </div>
    );
  }

  if (view === "result" && result) {
    return (
      <div style={box}>
        <h3 style={{ marginTop: 0, fontSize: 14, fontWeight: 700, color: t.text }}>Result</h3>
        <p style={{ fontSize: 20, fontWeight: 700, color: t.text }}>
          {result.correct}/{result.total} · {Math.round(result.score * 100)}%
        </p>
        <h4 style={{ color: t.text, fontSize: 13 }}>Leaderboard</h4>
        {leaderboard.length === 0 && <p style={{ color: t.muted, fontSize: 12.5 }}>No scores yet.</p>}
        {leaderboard
          .slice()
          .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
          .map((r, i) => (
            <div key={r.user_id} style={{ display: "flex", gap: 8, padding: "5px 0", color: t.text, fontSize: 12.5 }}>
              <span style={{ color: t.mutedLight, width: 20 }}>{i + 1}.</span>
              <span style={{ flex: 1 }}>
                {r.user_id === myUserId ? "You" : r.display_name || `@${r.username}` || "Member"}
              </span>
              <span>{Math.round((r.score ?? 0) * 100)}%</span>
            </div>
          ))}
        <button style={{ ...btn, marginTop: 16 }} onClick={() => setView("list")}>
          Back
        </button>
      </div>
    );
  }

  // list
  return (
    <div>
      {readOnly ? (
        <div style={{ ...box, color: t.muted, fontSize: 12.5 }}>
          🔒 This session has ended — challenges are read-only. You can review past scores below.
        </div>
      ) : (
      <div style={box}>
        <h3 style={{ marginTop: 0, marginBottom: 12, fontSize: 14, fontWeight: 700, color: t.text }}>New challenge</h3>
        <input style={field} placeholder="Name (optional — e.g. Chapter 3 quiz)" value={name} onChange={(e) => setName(e.target.value)} />
        <input style={field} placeholder="Topic (e.g. Newton's laws)" value={topic} onChange={(e) => setTopic(e.target.value)} />
        <textarea
          style={{ ...field, resize: "vertical" }}
          rows={2}
          placeholder="Goal — what should this challenge test? (e.g. exam application problems)"
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
        />
        <div style={{ marginBottom: 8 }}>
          <label style={{ fontSize: 11.5, color: t.muted, marginRight: 8 }}>Source file (optional):</label>
          <input
            type="file"
            accept=".txt,.md,.markdown,.csv,.pdf,.docx,.xlsx,.mp3,.m4a,.wav,.webm,.ogg,.flac,audio/*,application/pdf,text/plain"
            onChange={(e) => setSourceFile(e.target.files?.[0] ?? null)}
            style={{ fontSize: 12, color: t.muted }}
          />
        </div>
        <button style={{ ...btn, opacity: busy || (!topic.trim() && !goal.trim() && !sourceFile) ? 0.5 : 1 }} onClick={create} disabled={busy || (!topic.trim() && !goal.trim() && !sourceFile)}>
          {busy ? "Generating…" : "Generate the challenge"}
        </button>
        {error && <p style={{ color: "#f87171", fontSize: 12.5 }}>{error}</p>}
      </div>
      )}

      <div style={{ marginTop: 16 }}>
        {challenges.length === 0 && <p style={{ color: t.muted, fontSize: 12.5 }}>No challenges — create one.</p>}
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
              <div style={{ fontWeight: 600, color: t.text, fontSize: 13 }}>{ch.title ?? "Challenge"}</div>
              {ch.description && <div style={{ fontSize: 11.5, color: t.muted }}>{ch.description}</div>}
              <div style={{ fontSize: 11, color: t.mutedLight }}>
                {ch.question_count ?? 0} questions · {ch.status}
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
