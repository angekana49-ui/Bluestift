"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { netFetch } from "@/lib/net/client-fetch";
import { useAppTheme } from "@/components/ui/theme";
import { DocumentActions } from "@/components/ui/doc-actions";
import { type AppTheme } from "@/components/ui/tokens";
import { downloadBrandedPdf, type BrandedDoc } from "@/lib/document";
import { TestPlayer, ReaderView, type TestAnswer, type TestQuestion, type TestResult } from "@/components/study/focus-player";
import { ShareLinkButton } from "@/components/study/share-button";
import { ArtifactMenu } from "@/components/ui/artifact-menu";
import { parseDoc } from "@/lib/doc-format";
import { FilePicker } from "@/components/ui/file-picker";
import { neutralButton, formActions } from "@/components/ui/forms";
import { useTranslate } from "@/components/ui/locale";
import type { MessageKey } from "@/lib/i18n";

type Challenge = {
  id: string;
  title: string | null;
  description: string | null;
  status: string;
  question_count: number | null;
  format?: string | null;
  created_by?: string | null;
  archived_at?: string | null;
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
const TEST_KINDS: { id: string; labelKey: MessageKey; hintKey: MessageKey }[] = [
  { id: "quiz", labelKey: "tools.selfTest.kind.quiz.label", hintKey: "tools.selfTest.kind.quiz.hint" },
  { id: "exam", labelKey: "tools.selfTest.kind.exam.label", hintKey: "tools.selfTest.kind.exam.hint" },
  { id: "skills", labelKey: "tools.selfTest.kind.skills.label", hintKey: "tools.selfTest.kind.skills.hint" },
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
  isRoomOwner = false,
  readOnly = false,
}: {
  roomId: string;
  roomName: string;
  subject: string | null;
  myUserId: string;
  /** The room's creator may archive/delete any member's challenge, same as
   *  they already moderate the room's visibility. */
  isRoomOwner?: boolean;
  /** When the room's timer has ended: no new challenges, no new attempts. */
  readOnly?: boolean;
}) {
  const { theme: t } = useAppTheme();
  const tr = useTranslate();
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
  // Opt-in: ground the questions in the room's recent shared chat instead of
  // (or alongside) a typed topic/goal — for when the live discussion has
  // moved on from the room's fixed subject.
  const [useRoomChat, setUseRoomChat] = useState(false);
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
      .select("id, title, description, status, question_count, format, created_by, archived_at")
      .eq("room_id", roomId)
      .order("created_at", { ascending: false });
    setChallenges(data ?? []);
  }

  async function archiveChallenge(id: string, archived: boolean) {
    const res = await netFetch("/api/challenges", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, action: archived ? "archive" : "unarchive" }),
    });
    const d = await res.json();
    // ArtifactMenu keeps its confirm dialog open and shows this rather than
    // silently doing nothing when the server refuses the action.
    if (!res.ok) throw new Error(d?.error);
    setChallenges((v) => v.map((c) => (c.id === id ? { ...c, archived_at: d.archived_at ?? null } : c)));
  }

  async function deleteChallenge(id: string) {
    const res = await netFetch(`/api/challenges?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    if (!res.ok) {
      const d = await res.json().catch(() => null);
      throw new Error(d?.error);
    }
    setChallenges((v) => v.filter((c) => c.id !== id));
  }

  useEffect(() => {
    loadChallenges();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  async function create() {
    if ((!name.trim() && !topic.trim() && !goal.trim() && !sourceFile && !useRoomChat) || busy) return;
    setBusy(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("roomId", roomId);
      fd.append("name", name);
      fd.append("topic", topic);
      fd.append("goal", goal);
      fd.append("kind", kind);
      fd.append("useRoomChat", String(useRoomChat));
      if (sourceFile) fd.append("file", sourceFile);
      // The route generates the question set with the LLM (maxDuration 60s on
      // the server) — a bare fetch never times out on its own, but netFetch's
      // 10s default would abort a legitimately-running generation, so it's
      // raised to match the server's own budget.
      const res = await netFetch("/api/challenges/create", { method: "POST", body: fd }, { timeoutMs: 65_000 });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ?? tr("room.challenges.createFailed"));
        return;
      }
      // Straight into the player — a generated challenge used to just land
      // back in the list, so starting it was a second deliberate click away
      // from what was just asked for.
      const newChallenge: Challenge = {
        id: data.id,
        // Mirrors the server's own title fallback (app/api/challenges/create).
        title: (name || topic || goal || "Challenge").slice(0, 80),
        description: goal || null,
        status: "active",
        question_count: data.questionCount ?? null,
        format: kind === "skills" ? "open" : kind === "exam" ? "exam" : "mcq",
      };
      setName("");
      setGoal("");
      setSourceFile(null);
      await loadChallenges();
      await open(newChallenge);
    } catch {
      setError(tr("room.challenges.createFailed"));
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
        setError(tr("room.challenges.noQuestionsYet"));
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
      if (!res.ok) throw new Error(data?.error ?? tr("room.challenges.analyzeFailed"));
      setAnalysis({ title: data.title, body: data.analysis });
      setView("analysis");
    } catch (e) {
      setError(e instanceof Error ? e.message : tr("room.challenges.analyzeFailed"));
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
        title={active.title ?? tr("room.challenges.fallbackTitle")}
        questions={testQuestions}
        onSubmit={submitAnswers}
        onExit={() => setView("list")}
        onAnalyze={analyze}
        analyzing={analyzing}
        resultActions={
          <>
            <DocumentActions doc={resultDoc()} compact shareable={false} personal />
            <ShareLinkButton theme={t} doc={resultDoc()} />
            <button style={ghost} onClick={() => setView("standings")} title={tr("room.challenges.standingsTitle")}>{tr("room.challenges.standingsButtonLabel")}</button>
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
        subtitle={tr("room.challenges.analysisSubtitle")}
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

  // Squad standings — the room's own twist on top of the shared player.
  if (view === "standings") {
    return (
      <div style={box}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
          <h3 style={{ margin: 0, flex: 1, fontSize: 16, fontWeight: 700, color: t.text }}>{tr("room.challenges.standingsHeading")}</h3>
          {result && (
            <span style={{ fontSize: 15, color: t.muted }}>
              {tr("room.challenges.youWord")} · {result.correct}/{result.total} · {Math.round(result.score * 100)}%
            </span>
          )}
        </div>
        <h4 style={{ color: t.text, fontSize: 15, margin: "10px 0 4px" }}>{active?.title ?? tr("room.challenges.fallbackTitle")}</h4>
        {leaderboard.length === 0 && <p style={{ color: t.muted, fontSize: 15 }}>{tr("room.challenges.noScoresYet")}</p>}
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
                  {mine ? tr("room.challenges.youWord") : r.display_name || (r.username ? `@${r.username}` : tr("room.challenges.memberFallback"))}
                </span>
                <span style={{ fontWeight: 700 }}>{Math.round((r.score ?? 0) * 100)}%</span>
              </div>
            );
          })}
        <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
          <button style={btn} onClick={() => setView("list")}>{tr("room.challenges.backToChallenges")}</button>
          <button style={ghost} onClick={() => downloadBrandedPdf(resultDoc())}>{tr("room.challenges.myResultPdf")}</button>
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
          {tr("room.challenges.readOnlyBanner")}
        </div>
      ) : (
      <div style={box}>
        <h3 style={{ marginTop: 0, marginBottom: 12, fontSize: 16, fontWeight: 700, color: t.text }}>{tr("room.challenges.newChallengeTitle")}</h3>
        <input style={field} placeholder={tr("room.challenges.namePlaceholder")} value={name} onChange={(e) => setName(e.target.value)} />
        <input style={field} placeholder={tr("room.challenges.topicPlaceholder")} value={topic} onChange={(e) => setTopic(e.target.value)} />
        <textarea
          style={{ ...field, resize: "vertical" }}
          rows={2}
          placeholder={tr("room.challenges.goalPlaceholder")}
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
        />
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 13, color: t.mutedLight, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>{tr("room.challenges.typeOfChallengeLabel")}</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {TEST_KINDS.map((k) => (
              <button key={k.id} type="button" style={chip(t, kind === k.id)} onClick={() => setKind(k.id)} title={tr(k.hintKey)}>
                {tr(k.labelKey)}
              </button>
            ))}
          </div>
        </div>
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 14, color: t.muted, marginBottom: 6 }}>{tr("room.challenges.sourceFileLabel")}</div>
          <FilePicker
            accept=".txt,.md,.markdown,.csv,.pdf,.docx,.xlsx,.mp3,.m4a,.wav,.webm,.ogg,.flac,audio/*,application/pdf,text/plain"
            onPick={(files) => setSourceFile(files?.[0] ?? null)}
            fileName={sourceFile?.name ?? null}
            buttonStyle={neutralButton(t)}
            hintStyle={{ color: t.muted }}
          />
        </div>
        {/* No document, and the room's fixed subject may no longer be what the
            group is actually discussing — this opts the generation into the
            room's own recent chat instead. */}
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, color: t.muted, marginBottom: 12, cursor: "pointer" }}>
          <input type="checkbox" checked={useRoomChat} onChange={(e) => setUseRoomChat(e.target.checked)} />
          {tr("room.challenges.useRoomChatLabel")}
        </label>
        <div style={formActions}>
          <button
            style={{ ...btn, opacity: busy || (!name.trim() && !topic.trim() && !goal.trim() && !sourceFile && !useRoomChat) ? 0.5 : 1 }}
            onClick={create}
            disabled={busy || (!name.trim() && !topic.trim() && !goal.trim() && !sourceFile && !useRoomChat)}
          >
            {busy ? tr("room.challenges.generating") : tr("room.challenges.generateButton")}
          </button>
        </div>
        {error && <p style={{ color: "#f87171", fontSize: 15 }}>{error}</p>}
      </div>
      )}

      <div style={{ marginTop: 16 }}>
        {challenges.length === 0 && <p style={{ color: t.muted, fontSize: 15 }}>{tr("room.challenges.noChallengesYet")}</p>}
        {challenges.map((ch) => {
          const label = ch.title ?? tr("room.challenges.fallbackTitle");
          const archived = !!ch.archived_at;
          const canManage = ch.created_by === myUserId || isRoomOwner;
          return (
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
                opacity: archived ? 0.62 : 1,
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, color: t.text, fontSize: 15 }}>{label}</div>
                {ch.description && <div style={{ fontSize: 14, color: t.muted }}>{ch.description}</div>}
                <div style={{ fontSize: 13, color: t.mutedLight }}>
                  {ch.question_count ?? 0} {tr("tools.selfTest.questionsWord")} · {kindLabel(ch.format, tr)} · {ch.status}
                  {archived && ` · ${tr("hist.archivedSection")}`}
                </div>
              </div>
              <button style={{ ...btn, opacity: busy || readOnly ? 0.5 : 1 }} onClick={() => open(ch)} disabled={busy || readOnly}>
                {tr("room.challenges.playButton")}
              </button>
              {canManage && (
                <ArtifactMenu
                  theme={t}
                  itemLabel={label}
                  archived={archived}
                  deleteCaveatKey="artifact.delete.caveat.roomChallenge"
                  onArchive={(next) => archiveChallenge(ch.id, next)}
                  onDelete={() => deleteChallenge(ch.id)}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Storage `format` → the friendly challenge kind shown on the list. */
function kindLabel(format: string | null | undefined, tr: (key: MessageKey) => string): string {
  if (format === "exam") return tr("tools.selfTest.kind.exam.label");
  if (format === "open") return tr("tools.selfTest.kind.skills.label");
  return tr("tools.selfTest.kind.quiz.label");
}
