"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { useAppTheme } from "@/components/ui/theme";
import { display, status as statusColors, type AppTheme } from "@/components/ui/tokens";

/**
 * Full-screen focused study players for the Tools studio: one thing at a time —
 * question after question, card after card — instead of the old static list on
 * the studio page. `FocusOverlay` is the shared immersive shell (covers the
 * whole app, its own close); `QuizPlayer`, `FlashcardsPlayer` and `ReaderView`
 * are the bodies. All are theme-aware and self-contained.
 */

export type PlayerQuestion = {
  question: string;
  options: string[];
  /** Known correct option (self-scored quizzes). Absent for server-scored tests. */
  correctIndex?: number;
  explanation?: string;
};
export type PlayerCard = { front: string; back: string };

// ── Shared immersive shell ────────────────────────────────────────────────

export function FocusOverlay({
  theme: t,
  title,
  subtitle,
  onClose,
  progress,
  actions,
  footer,
  wide = false,
  children,
}: {
  theme: AppTheme;
  title: string;
  subtitle?: string;
  onClose: () => void;
  /** Progress row under the header (dots + counter). */
  progress?: ReactNode;
  /** Header-right actions (e.g. download). */
  actions?: ReactNode;
  footer?: ReactNode;
  /** Wide content (e.g. a mind map) that scrolls in both axes instead of the
   *  centered 680px reading column. */
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      // Same pale-blue animated wash as the chat conversations, not a flat white.
      className={t.dark ? "chat-welcome-bg is-dark" : "chat-welcome-bg"}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 60,
        color: t.text,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          flex: "none",
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "14px 20px",
          background: t.cardBg,
          borderBottom: `1px solid ${t.cardBorder}`,
        }}
      >
        <button
          onClick={onClose}
          title="Close"
          aria-label="Close"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 34,
            height: 34,
            flex: "none",
            borderRadius: 10,
            border: `1.5px solid ${t.dark ? "rgba(255,255,255,0.24)" : "rgba(15,23,42,0.22)"}`,
            background: t.cardBg2,
            color: t.text,
            cursor: "pointer",
            fontSize: 15,
          }}
        >
          ✕
        </button>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 800, fontFamily: display, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {title}
          </div>
          {subtitle && <div style={{ fontSize: 11.5, color: t.muted }}>{subtitle}</div>}
        </div>
        {actions}
      </div>

      {progress && (
        <div style={{ flex: "none", padding: "12px 20px 0", display: "flex", justifyContent: "center" }}>
          <div style={{ width: "100%", maxWidth: 680 }}>{progress}</div>
        </div>
      )}

      {wide ? (
        // Block layout + margin:auto so wide content centers when it fits and
        // scrolls (both axes) when it doesn't — flex centering would clip it.
        <div style={{ flex: 1, overflow: "auto", padding: "24px 20px" }}>{children}</div>
      ) : (
        <div style={{ flex: 1, overflow: "auto", display: "flex", justifyContent: "center", padding: "24px 20px" }}>
          <div style={{ width: "100%", maxWidth: 680 }}>{children}</div>
        </div>
      )}

      {footer && (
        <div style={{ flex: "none", background: t.cardBg, borderTop: `1px solid ${t.cardBorder}`, padding: "14px 20px", display: "flex", justifyContent: "center" }}>
          <div style={{ width: "100%", maxWidth: 680, display: "flex", alignItems: "center", gap: 10 }}>{footer}</div>
        </div>
      )}
    </div>
  );
}

// ── shared bits ───────────────────────────────────────────────────────────

function ProgressDots({ t, total, index }: { t: AppTheme; total: number; index: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <div style={{ flex: 1, display: "flex", gap: 4 }}>
        {Array.from({ length: total }).map((_, i) => (
          <span
            key={i}
            style={{
              flex: 1,
              height: 4,
              borderRadius: 2,
              background: i < index ? statusColors.aiIndigo : i === index ? statusColors.aiIndigo : t.gaugeTrack,
              opacity: i <= index ? 1 : 0.5,
            }}
          />
        ))}
      </div>
      <span style={{ fontSize: 11.5, color: t.muted, flex: "none" }}>
        {Math.min(index + 1, total)} / {total}
      </span>
    </div>
  );
}

function primaryBtn(t: AppTheme): React.CSSProperties {
  return { background: t.ctaBg, color: t.ctaText, border: "none", borderRadius: 99, padding: "10px 24px", fontSize: 13, fontWeight: 700, cursor: "pointer" };
}
// A more visible outline button: solid fill + a clearly-drawn border + full-weight
// text, so it reads as a control (the old faint ghost was easy to miss).
function ghostBtn(t: AppTheme): React.CSSProperties {
  return {
    background: t.cardBg2,
    color: t.text,
    border: `1.5px solid ${t.dark ? "rgba(255,255,255,0.24)" : "rgba(15,23,42,0.22)"}`,
    borderRadius: 99,
    padding: "10px 18px",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
  };
}

// Translucent green/red used for the quiz answers and the flashcard faces —
// keeps the glassy, see-through feel over the blue wash.
function greenTint(t: AppTheme) {
  return {
    bg: t.dark ? "rgba(34,197,94,0.22)" : "rgba(34,197,94,0.15)",
    border: t.dark ? "rgba(74,222,128,0.60)" : "rgba(22,163,74,0.50)",
    fg: t.dark ? "#4ade80" : "#15803d",
  };
}
function redTint(t: AppTheme) {
  return {
    bg: t.dark ? "rgba(239,68,68,0.22)" : "rgba(239,68,68,0.13)",
    border: t.dark ? "rgba(248,113,113,0.60)" : "rgba(220,38,38,0.48)",
    fg: t.dark ? "#f87171" : "#dc2626",
  };
}

// ── Quiz ──────────────────────────────────────────────────────────────────

export function QuizPlayer({
  title,
  questions,
  mode,
  onExit,
  onSubmit,
  actions,
  resultActions,
}: {
  title: string;
  questions: PlayerQuestion[];
  /** reveal: self-scored, shows the answer after each pick. collect: server-scored, submits at the end. */
  mode: "reveal" | "collect";
  onExit: () => void;
  /** collect mode: submit the picked option indices, get back the score. */
  onSubmit?: (answers: number[]) => Promise<{ correct: number; total: number }>;
  /** Header-right actions during the questions (e.g. download the Q&A). */
  actions?: ReactNode;
  /** Header-right actions on the result screen only (falls back to `actions`). */
  resultActions?: ReactNode;
}) {
  const { theme: t } = useAppTheme();
  const [index, setIndex] = useState(0);
  const [picks, setPicks] = useState<Record<number, number>>({});
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [score, setScore] = useState<{ correct: number; total: number } | null>(null);

  const total = questions.length;
  const q = questions[index];
  const picked = picks[index];
  const revealed = mode === "reveal" && picked != null;

  function choose(oi: number) {
    if (picks[index] != null && mode === "reveal") return; // lock after reveal
    setPicks((p) => ({ ...p, [index]: oi }));
  }

  async function finish() {
    if (busy) return;
    if (mode === "collect" && onSubmit) {
      setBusy(true);
      try {
        const r = await onSubmit(questions.map((_, i) => picks[i] ?? -1));
        setScore(r);
      } catch {
        setScore(null);
      } finally {
        setBusy(false);
        setDone(true);
      }
    } else {
      const correct = questions.reduce((n, qq, i) => n + (picks[i] === qq.correctIndex ? 1 : 0), 0);
      setScore({ correct, total });
      setDone(true);
    }
  }

  if (done) {
    const pct = score && score.total > 0 ? Math.round((score.correct / score.total) * 100) : 0;
    return (
      <FocusOverlay theme={t} title={title} subtitle="Result" onClose={onExit} actions={resultActions ?? actions}>
        <div style={{ textAlign: "center", paddingTop: 40 }}>
          <div style={{ fontSize: 13, color: t.muted, textTransform: "uppercase", letterSpacing: "0.08em" }}>Your score</div>
          {score ? (
            <>
              <div style={{ fontSize: 54, fontWeight: 800, fontFamily: display, color: t.text, margin: "8px 0" }}>{pct}%</div>
              <div style={{ fontSize: 15, color: t.muted }}>
                {score.correct} / {score.total} correct
              </div>
            </>
          ) : (
            <div style={{ fontSize: 18, color: t.text, margin: "16px 0" }}>Submitted ✓</div>
          )}
          <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 28 }}>
            <button
              style={ghostBtn(t)}
              onClick={() => {
                setPicks({});
                setIndex(0);
                setScore(null);
                setDone(false);
              }}
            >
              Restart
            </button>
            <button style={primaryBtn(t)} onClick={onExit}>
              Done
            </button>
          </div>
        </div>
      </FocusOverlay>
    );
  }

  const isLast = index === total - 1;
  const canNext = mode === "reveal" ? revealed : picked != null;

  return (
    <FocusOverlay
      theme={t}
      title={title}
      onClose={onExit}
      actions={actions}
      progress={<ProgressDots t={t} total={total} index={index} />}
      footer={
        <>
          <button style={{ ...ghostBtn(t), opacity: index === 0 ? 0.4 : 1 }} disabled={index === 0} onClick={() => setIndex((i) => Math.max(0, i - 1))}>
            ‹ Prev
          </button>
          <span style={{ flex: 1 }} />
          {isLast ? (
            <button style={{ ...primaryBtn(t), opacity: canNext && !busy ? 1 : 0.5 }} disabled={!canNext || busy} onClick={finish}>
              {busy ? "Scoring…" : "Finish"}
            </button>
          ) : (
            <button style={{ ...primaryBtn(t), opacity: canNext ? 1 : 0.5 }} disabled={!canNext} onClick={() => setIndex((i) => Math.min(total - 1, i + 1))}>
              Next ›
            </button>
          )}
        </>
      }
    >
      <div style={{ fontSize: 12, color: t.mutedLight, marginBottom: 8 }}>Question {index + 1}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: t.text, lineHeight: 1.4, marginBottom: 22 }}>{q.question}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {q.options.map((opt, oi) => {
          const isPicked = picked === oi;
          const isCorrect = q.correctIndex === oi;
          let bg = t.cardBg;
          let border = t.cardBorder;
          if (revealed) {
            if (isCorrect) {
              const g = greenTint(t);
              bg = g.bg;
              border = g.border;
            } else if (isPicked) {
              const r = redTint(t);
              bg = r.bg;
              border = r.border;
            }
          } else if (isPicked) {
            bg = t.sidebarActiveBg;
            border = statusColors.aiIndigo;
          }
          return (
            <button
              key={oi}
              onClick={() => choose(oi)}
              style={{
                textAlign: "left",
                background: bg,
                color: t.text,
                border: `1.5px solid ${border}`,
                borderRadius: 14,
                padding: "14px 16px",
                cursor: revealed ? "default" : "pointer",
                fontSize: 14,
                display: "flex",
                alignItems: "center",
                gap: 10,
                transition: "background .12s ease, border-color .12s ease",
              }}
            >
              <span
                style={{
                  width: 24,
                  height: 24,
                  flex: "none",
                  borderRadius: 7,
                  background: t.cardBg2,
                  border: `1px solid ${t.cardBorder}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 11.5,
                  fontWeight: 700,
                  color: t.muted,
                }}
              >
                {String.fromCharCode(65 + oi)}
              </span>
              <span style={{ flex: 1 }}>{opt}</span>
              {revealed && isCorrect && <span style={{ color: greenTint(t).fg, fontWeight: 800, fontSize: 16 }}>✓</span>}
              {revealed && isPicked && !isCorrect && <span style={{ color: redTint(t).fg, fontWeight: 800, fontSize: 16 }}>✗</span>}
            </button>
          );
        })}
      </div>
      {revealed && q.explanation && (
        <div style={{ marginTop: 18, padding: "14px 16px", background: t.cardBg2, border: `1px solid ${t.cardBorder}`, borderRadius: 12, fontSize: 13, lineHeight: 1.55, color: t.muted }}>
          <span style={{ fontWeight: 700, color: t.text }}>Why: </span>
          {q.explanation}
        </div>
      )}
    </FocusOverlay>
  );
}

// ── Test / exam (mixed MCQ + open, AI-graded) ─────────────────────────────

export type TestQuestion = { id: string; type: "mcq" | "open"; question: string; options?: string[] };
export type TestAnswer = { questionId: string; choiceIndex?: number; text?: string };
export type TestQResult = { questionId: string; type: string; isCorrect: boolean; score: number | null; feedback: string; correctIndex: number | null };
export type TestResult = { score: number; correct: number; total: number; results: TestQResult[] };

/**
 * Focused exam player: one question at a time, MCQ (options) or open (textarea).
 * Server-graded on finish (MCQ auto + open by the LLM), then a result screen with
 * the score, a per-question breakdown (right/wrong + feedback) and an on-demand
 * deeper analysis.
 */
export function TestPlayer({
  title,
  questions,
  onSubmit,
  onExit,
  onAnalyze,
  analyzing,
  resultActions,
}: {
  title: string;
  questions: TestQuestion[];
  onSubmit: (answers: TestAnswer[]) => Promise<TestResult>;
  onExit: () => void;
  /** Deeper narrative analysis (opens the branded reader in the host). */
  onAnalyze?: () => void;
  analyzing?: boolean;
  resultActions?: ReactNode;
}) {
  const { theme: t } = useAppTheme();
  const [index, setIndex] = useState(0);
  const [mcq, setMcq] = useState<Record<string, number>>({});
  const [open, setOpen] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<TestResult | null>(null);

  const total = questions.length;
  const q = questions[index];
  const byId = useMemo(() => new Map(questions.map((x) => [x.id, x])), [questions]);

  const answered = (qq: TestQuestion) => (qq.type === "mcq" ? mcq[qq.id] != null : (open[qq.id] ?? "").trim().length > 0);

  async function finish() {
    if (busy) return;
    setBusy(true);
    try {
      const answers: TestAnswer[] = questions.map((qq) =>
        qq.type === "mcq" ? { questionId: qq.id, choiceIndex: mcq[qq.id] } : { questionId: qq.id, text: open[qq.id] ?? "" },
      );
      setResult(await onSubmit(answers));
    } catch {
      setResult(null);
    } finally {
      setBusy(false);
    }
  }

  if (result) {
    const pct = Math.round((result.score ?? 0) * 100);
    return (
      <FocusOverlay theme={t} title={title} subtitle="Result" onClose={onExit} actions={resultActions}>
        <div style={{ textAlign: "center", paddingTop: 20, paddingBottom: 8 }}>
          <div style={{ fontSize: 12.5, color: t.muted, textTransform: "uppercase", letterSpacing: "0.08em" }}>Your score</div>
          <div style={{ fontSize: 50, fontWeight: 800, fontFamily: display, color: t.text, margin: "6px 0" }}>{pct}%</div>
          <div style={{ fontSize: 14, color: t.muted }}>{result.correct} / {result.total} correct</div>
          <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 20, flexWrap: "wrap" }}>
            {onAnalyze && (
              <button style={{ ...primaryBtn(t), opacity: analyzing ? 0.6 : 1 }} disabled={analyzing} onClick={onAnalyze}>
                {analyzing ? "Analysing…" : "✨ Analyse my answers"}
              </button>
            )}
            <button style={ghostBtn(t)} onClick={() => { setResult(null); setIndex(0); }}>
              Review
            </button>
            <button style={ghostBtn(t)} onClick={onExit}>Done</button>
          </div>
        </div>

        {/* per-question breakdown */}
        <div style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: 10 }}>
          {result.results.map((r, i) => {
            const qq = byId.get(r.questionId);
            const tint = r.isCorrect ? greenTint(t) : redTint(t);
            return (
              <div key={i} style={{ background: tint.bg, border: `1.5px solid ${tint.border}`, borderRadius: 12, padding: "12px 14px" }}>
                <div style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
                  <span style={{ color: tint.fg, fontWeight: 800, flex: "none" }}>{r.isCorrect ? "✓" : "✗"}</span>
                  <span style={{ flex: 1, fontSize: 13.5, fontWeight: 600, color: t.text }}>{i + 1}. {qq?.question}</span>
                  {r.score != null && r.type === "open" && (
                    <span style={{ fontSize: 11.5, color: tint.fg, fontWeight: 700, flex: "none" }}>{Math.round(r.score * 100)}%</span>
                  )}
                </div>
                {r.type === "mcq" && !r.isCorrect && r.correctIndex != null && qq?.options && (
                  <div style={{ fontSize: 12.5, color: t.muted, marginTop: 6 }}>
                    Correct: <span style={{ color: greenTint(t).fg, fontWeight: 600 }}>{qq.options[r.correctIndex]}</span>
                  </div>
                )}
                {r.feedback && <div style={{ fontSize: 12.5, color: t.muted, marginTop: 6, lineHeight: 1.5 }}>{r.feedback}</div>}
              </div>
            );
          })}
        </div>
      </FocusOverlay>
    );
  }

  const isLast = index === total - 1;
  return (
    <FocusOverlay
      theme={t}
      title={title}
      onClose={onExit}
      progress={<ProgressDots t={t} total={total} index={index} />}
      footer={
        <>
          <button style={{ ...ghostBtn(t), opacity: index === 0 ? 0.4 : 1 }} disabled={index === 0} onClick={() => setIndex((i) => Math.max(0, i - 1))}>
            ‹ Prev
          </button>
          <span style={{ flex: 1 }} />
          {isLast ? (
            <button style={{ ...primaryBtn(t), opacity: busy ? 0.6 : 1 }} disabled={busy} onClick={finish}>
              {busy ? "Grading…" : "Finish"}
            </button>
          ) : (
            <button style={{ ...primaryBtn(t), opacity: answered(q) ? 1 : 0.5 }} disabled={!answered(q)} onClick={() => setIndex((i) => Math.min(total - 1, i + 1))}>
              Next ›
            </button>
          )}
        </>
      }
    >
      <div style={{ fontSize: 12, color: t.mutedLight, marginBottom: 8 }}>
        Question {index + 1} · {q.type === "open" ? "Open answer" : "Multiple choice"}
      </div>
      <div style={{ fontSize: 20, fontWeight: 700, color: t.text, lineHeight: 1.4, marginBottom: 22 }}>{q.question}</div>

      {q.type === "open" ? (
        <textarea
          value={open[q.id] ?? ""}
          onChange={(e) => setOpen((o) => ({ ...o, [q.id]: e.target.value }))}
          placeholder="Write your answer…"
          rows={7}
          style={{
            width: "100%",
            boxSizing: "border-box",
            background: t.cardBg,
            color: t.text,
            border: `1.5px solid ${t.cardBorder}`,
            borderRadius: 14,
            padding: "14px 16px",
            fontSize: 14,
            lineHeight: 1.6,
            resize: "vertical",
            outline: "none",
            fontFamily: "inherit",
          }}
        />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {(q.options ?? []).map((opt, oi) => {
            const picked = mcq[q.id] === oi;
            return (
              <button
                key={oi}
                onClick={() => setMcq((m) => ({ ...m, [q.id]: oi }))}
                style={{
                  textAlign: "left",
                  background: picked ? t.sidebarActiveBg : t.cardBg,
                  color: t.text,
                  border: `1.5px solid ${picked ? statusColors.aiIndigo : t.cardBorder}`,
                  borderRadius: 14,
                  padding: "14px 16px",
                  cursor: "pointer",
                  fontSize: 14,
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                }}
              >
                <span
                  style={{
                    width: 24,
                    height: 24,
                    flex: "none",
                    borderRadius: 7,
                    background: t.cardBg2,
                    border: `1px solid ${t.cardBorder}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 11.5,
                    fontWeight: 700,
                    color: t.muted,
                  }}
                >
                  {String.fromCharCode(65 + oi)}
                </span>
                <span style={{ flex: 1 }}>{opt}</span>
              </button>
            );
          })}
        </div>
      )}
    </FocusOverlay>
  );
}

// ── Flashcards ────────────────────────────────────────────────────────────

export function FlashcardsPlayer({ title, cards, onExit, actions }: { title: string; cards: PlayerCard[]; onExit: () => void; actions?: ReactNode }) {
  const { theme: t } = useAppTheme();
  const [order, setOrder] = useState(() => cards.map((_, i) => i));
  const [pos, setPos] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [known, setKnown] = useState<Set<number>>(new Set());

  const total = order.length;
  const cardIndex = order[pos];
  const card = cards[cardIndex];

  function go(delta: number) {
    setFlipped(false);
    setPos((p) => Math.max(0, Math.min(total - 1, p + delta)));
  }
  function shuffle() {
    const next = [...order];
    for (let i = next.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [next[i], next[j]] = [next[j], next[i]];
    }
    setOrder(next);
    setPos(0);
    setFlipped(false);
  }
  function toggleKnown() {
    setKnown((s) => {
      const next = new Set(s);
      if (next.has(cardIndex)) next.delete(cardIndex);
      else next.add(cardIndex);
      return next;
    });
  }

  const isKnown = known.has(cardIndex);
  // Question face reads red (being tested), answer face reads green (revealed) —
  // translucent so the wash shows through and the text stays legible.
  const face = flipped ? greenTint(t) : redTint(t);

  return (
    <FocusOverlay
      theme={t}
      title={title}
      subtitle={`${known.size} known`}
      onClose={onExit}
      progress={<ProgressDots t={t} total={total} index={pos} />}
      actions={
        <>
          {actions}
          <button style={ghostBtn(t)} onClick={shuffle} title="Shuffle">
            ⇄ Shuffle
          </button>
        </>
      }
      footer={
        <>
          <button style={{ ...ghostBtn(t), opacity: pos === 0 ? 0.4 : 1 }} disabled={pos === 0} onClick={() => go(-1)}>
            ‹ Prev
          </button>
          <button
            style={{
              ...ghostBtn(t),
              flex: 1,
              ...(isKnown ? { background: greenTint(t).bg, border: `1.5px solid ${greenTint(t).border}`, color: greenTint(t).fg } : {}),
            }}
            onClick={toggleKnown}
          >
            {isKnown ? "✓ Known" : "Mark known"}
          </button>
          <button style={{ ...primaryBtn(t), opacity: pos === total - 1 ? 0.4 : 1 }} disabled={pos === total - 1} onClick={() => go(1)}>
            Next ›
          </button>
        </>
      }
    >
      <button
        onClick={() => setFlipped((f) => !f)}
        style={{
          width: "100%",
          minHeight: 300,
          background: face.bg,
          border: `1.5px solid ${face.border}`,
          borderRadius: 20,
          padding: "34px 28px",
          cursor: "pointer",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 14,
          textAlign: "center",
          transition: "background .18s ease, border-color .18s ease",
        }}
      >
        <span style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700, color: face.fg }}>
          {flipped ? "Answer" : "Question"}
        </span>
        <span style={{ fontSize: 22, fontWeight: 600, lineHeight: 1.45, color: t.text }}>{flipped ? card.back : card.front}</span>
        <span style={{ fontSize: 11.5, color: t.muted, marginTop: 8 }}>Tap to flip</span>
      </button>
    </FocusOverlay>
  );
}

// ── Reader (summary / mind map) ───────────────────────────────────────────

type ReaderBlock = { type: "h1" | "h2" | "h3" | "p" | "li"; text: string };

export function ReaderView({
  title,
  subtitle,
  blocks,
  onExit,
  actions,
}: {
  title: string;
  subtitle?: string;
  blocks: ReaderBlock[];
  onExit: () => void;
  actions?: ReactNode;
}) {
  const { theme: t } = useAppTheme();
  const rendered = useMemo(() => blocks, [blocks]);
  return (
    <FocusOverlay theme={t} title={title} subtitle={subtitle} onClose={onExit} actions={actions}>
      <article style={{ paddingBottom: 40 }}>
        {rendered.map((b, i) => {
          if (b.type === "h1") return <h1 key={i} style={{ fontSize: 22, fontWeight: 800, fontFamily: display, color: t.text, margin: "22px 0 10px" }}>{b.text}</h1>;
          if (b.type === "h2") return <h2 key={i} style={{ fontSize: 17, fontWeight: 700, color: statusColors.aiIndigo, margin: "20px 0 8px" }}>{b.text}</h2>;
          if (b.type === "h3") return <h3 key={i} style={{ fontSize: 14.5, fontWeight: 700, color: t.text, margin: "16px 0 6px" }}>{b.text}</h3>;
          if (b.type === "li")
            return (
              <div key={i} style={{ display: "flex", gap: 10, margin: "6px 0", fontSize: 15, lineHeight: 1.6, color: t.text }}>
                <span style={{ color: statusColors.aiIndigo, flex: "none" }}>•</span>
                <span>{b.text}</span>
              </div>
            );
          return <p key={i} style={{ fontSize: 15, lineHeight: 1.7, color: t.text, margin: "10px 0" }}>{b.text}</p>;
        })}
      </article>
    </FocusOverlay>
  );
}

// ── Mind map ──────────────────────────────────────────────────────────────

export type MindMapBranch = { label: string; children: string[] };
export type MindMapData = { title: string; branches: MindMapBranch[] };

function hexToRgba(hex: string, a: number) {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}

// A colourful branch palette — real mind maps colour-code each branch.
const MAP_ACCENTS = ["#6366f1", "#16a34a", "#2f7fe0", "#d97706", "#db2777", "#0891b2", "#7c3aed", "#dc2626"];

type XY = { x: number; y: number };
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** Smooth curve through the checkpoints (Catmull-Rom → Bézier) — the winding path. */
function smoothPath(pts: XY[]): string {
  if (pts.length === 0) return "";
  if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`;
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2.x} ${p2.y}`;
  }
  return d;
}

type MapRole = "start" | "root" | "branch" | "end";

/**
 * Interactive mind map: not a straight line of checkpoints but a **winding,
 * multicolour path you arrange yourself** on a huge canvas. A decorative Départ
 * and Arrivée bookend the route (tap either to light its alert). Each node is a
 * draggable checkpoint; the path re-flows as you move them, so the physical act
 * of laying it out anchors the memory. The path runs BEHIND the (opaque) cards —
 * it never crosses their text. Starts as a serpentine so nothing overlaps, your
 * layout is remembered (localStorage), and there's plenty of room to stretch out.
 */
export function MindMapView({
  title,
  mindMap,
  onExit,
  actions,
}: {
  title: string;
  mindMap: MindMapData;
  onExit: () => void;
  actions?: ReactNode;
}) {
  const { theme: t } = useAppTheme();

  // The route: a decorative Départ, the theme, each branch, then Arrivée.
  const nodes = useMemo<{ role: MapRole; label: string; children: string[] }[]>(
    () => [
      { role: "start", label: "Départ", children: [] },
      { role: "root", label: mindMap.title || title, children: [] },
      ...(mindMap.branches ?? []).map((b) => ({ role: "branch" as MapRole, label: b.label, children: b.children })),
      { role: "end", label: "Arrivée", children: [] },
    ],
    [mindMap, title],
  );

  // Ultra-large canvas: plenty of terrain to stretch, compress and re-route.
  const MIN_W = 2200;
  const MIN_H = 1500;
  const SLACK = 600; // free space kept beyond the furthest node
  const COLW = 300;
  const PAD = 90;
  const CARD_W = 202;
  const maxCh = nodes.reduce((m, n) => Math.max(m, n.children.length), 0);
  const rowH = 210 + maxCh * 16;
  const cols = Math.min(3, Math.max(2, nodes.length));

  const serpentine = useCallback((): Record<number, XY> => {
    const out: Record<number, XY> = {};
    nodes.forEach((_, k) => {
      const row = Math.floor(k / cols);
      let col = k % cols;
      if (row % 2 === 1) col = cols - 1 - col; // boustrophedon → snake
      out[k] = { x: PAD + col * COLW + COLW / 2, y: PAD + row * rowH + 40 };
    });
    return out;
  }, [nodes, cols, rowH]);

  const storeKey = `bluestift:mindmap:${(mindMap.title || title).slice(0, 60)}:${nodes.length}`;
  const [pos, setPos] = useState<Record<number, XY>>(() => {
    if (typeof window !== "undefined") {
      try {
        const s = window.localStorage.getItem(storeKey);
        if (s) {
          const parsed = JSON.parse(s) as Record<number, XY>;
          if (parsed && Object.keys(parsed).length === nodes.length) return parsed;
        }
      } catch {
        // ignore — fall back to the fresh serpentine
      }
    }
    return serpentine();
  });
  // Which decorative endpoints have their alert light on.
  const [lit, setLit] = useState<Record<number, boolean>>({});

  useEffect(() => {
    try {
      window.localStorage.setItem(storeKey, JSON.stringify(pos));
    } catch {
      // best-effort persistence
    }
  }, [pos, storeKey]);

  const drag = useRef<{ id: number; sx: number; sy: number; ox: number; oy: number; moved: boolean } | null>(null);
  const onPointerDown = (id: number, e: ReactPointerEvent) => {
    e.preventDefault();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    drag.current = { id, sx: e.clientX, sy: e.clientY, ox: pos[id].x, oy: pos[id].y, moved: false };
  };
  const onPointerMove = (e: ReactPointerEvent) => {
    const d = drag.current;
    if (!d) return;
    if (Math.abs(e.clientX - d.sx) + Math.abs(e.clientY - d.sy) > 4) d.moved = true;
    setPos((p) => ({
      ...p,
      [d.id]: { x: clamp(d.ox + (e.clientX - d.sx), CARD_W / 2 + 10, 12000), y: clamp(d.oy + (e.clientY - d.sy), 24, 12000) },
    }));
  };
  const onPointerUp = () => {
    const d = drag.current;
    // A tap (no drag) on Départ/Arrivée toggles its alert light.
    if (d && !d.moved) {
      const role = nodes[d.id]?.role;
      if (role === "start" || role === "end") setLit((l) => ({ ...l, [d.id]: !l[d.id] }));
    }
    drag.current = null;
  };

  const accentFor = (k: number): string => {
    const role = nodes[k].role;
    if (role === "start") return "#16a34a";
    if (role === "end") return "#dc2626";
    if (role === "root") return statusColors.aiIndigo;
    return MAP_ACCENTS[(k - 2) % MAP_ACCENTS.length]; // branches begin at index 2
  };
  const markerGlyph = (k: number): string => {
    const role = nodes[k].role;
    if (role === "start") return "▶";
    if (role === "end") return "⚑";
    if (role === "root") return "★";
    return String(k - 1); // branch numbering: first branch (index 2) → "1"
  };

  const xs = nodes.map((_, k) => pos[k]?.x ?? 0);
  const ys = nodes.map((_, k) => pos[k]?.y ?? 0);
  const canvasW = Math.max(MIN_W, Math.max(0, ...xs) + SLACK);
  const canvasH = Math.max(MIN_H, Math.max(0, ...ys) + SLACK);
  const points: XY[] = nodes.map((_, k) => pos[k]);

  return (
    <FocusOverlay
      theme={t}
      title={title}
      subtitle="Mind map"
      onClose={onExit}
      wide
      actions={
        <>
          <button style={ghostBtn(t)} onClick={() => setPos(serpentine())} title="Reset the layout">
            ↺ Reset
          </button>
          {actions}
        </>
      }
    >
      <div style={{ textAlign: "center", fontSize: 12, color: t.muted, marginBottom: 14 }}>
        Drag the checkpoints to lay out your own path — arranging it helps you remember it. Tap Départ / Arrivée to light their alert.
      </div>
      <div style={{ position: "relative", width: canvasW, height: canvasH, margin: "0 auto", touchAction: "none" }}>
        {/* The winding path, drawn BEHIND the cards so it never touches their text. */}
        <svg width={canvasW} height={canvasH} style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
          <defs>
            <linearGradient id="mm-grad" x1="0" y1="0" x2={canvasW} y2={canvasH} gradientUnits="userSpaceOnUse">
              {MAP_ACCENTS.map((c, i) => (
                <stop key={i} offset={i / (MAP_ACCENTS.length - 1)} stopColor={c} />
              ))}
            </linearGradient>
          </defs>
          <path d={smoothPath(points)} fill="none" stroke="url(#mm-grad)" strokeWidth={4} strokeLinecap="round" opacity={t.dark ? 0.85 : 0.7} />
        </svg>

        {nodes.map((n, k) => {
          const p = pos[k];
          const accent = accentFor(k);
          const isEndpoint = n.role === "start" || n.role === "end";
          return (
            <div key={k} style={{ position: "absolute", left: p.x, top: p.y, zIndex: 1 }}>
              {/* checkpoint marker — the drag handle + path anchor */}
              <div
                onPointerDown={(e) => onPointerDown(k, e)}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                title={isEndpoint ? "Drag to move · tap to toggle alert" : "Drag to arrange"}
                style={{
                  position: "absolute",
                  left: 0,
                  top: 0,
                  transform: "translate(-50%,-50%)",
                  width: 38,
                  height: 38,
                  borderRadius: "50%",
                  background: n.role === "root" ? t.ctaBg : accent,
                  color: "#fff",
                  border: `2px solid ${t.cardBg}`,
                  boxShadow: `0 2px 10px ${hexToRgba(accent, 0.5)}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 14,
                  fontWeight: 800,
                  cursor: "grab",
                  touchAction: "none",
                  zIndex: 2,
                }}
              >
                {markerGlyph(k)}
                {/* alert light on the decorative endpoints */}
                {isEndpoint && (
                  <span
                    style={{
                      position: "absolute",
                      top: -5,
                      right: -5,
                      width: 17,
                      height: 17,
                      borderRadius: "50%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 10,
                      fontWeight: 800,
                      pointerEvents: "none",
                      background: lit[k] ? "#f59e0b" : t.cardBg2,
                      color: lit[k] ? "#fff" : t.mutedLight,
                      border: `1.5px solid ${lit[k] ? "#f59e0b" : t.cardBorder}`,
                      boxShadow: lit[k] ? "0 0 12px 3px rgba(245,158,11,0.85)" : "none",
                    }}
                  >
                    !
                  </span>
                )}
              </div>
              {/* Opaque card hangs below the marker (path passes behind it). */}
              <div
                style={{
                  position: "absolute",
                  left: -CARD_W / 2,
                  top: 26,
                  width: CARD_W,
                  background: t.cardBg,
                  border: `1.5px solid ${hexToRgba(accent, t.dark ? 0.65 : 0.55)}`,
                  borderTop: `3px solid ${accent}`,
                  borderRadius: 14,
                  padding: "10px 13px",
                  boxShadow: t.dark ? "0 4px 14px rgba(0,0,0,0.35)" : "0 4px 14px rgba(15,23,42,0.10)",
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 700, color: t.dark ? "#fff" : accent, marginBottom: n.children.length ? 7 : 0, fontFamily: n.role === "root" ? display : undefined }}>
                  {n.label}
                </div>
                {n.children.map((c, ci) => (
                  <div key={ci} style={{ display: "flex", gap: 7, alignItems: "baseline", margin: "3px 0", fontSize: 12, lineHeight: 1.45, color: t.text }}>
                    <span style={{ width: 5, height: 5, borderRadius: "50%", flex: "none", background: accent, transform: "translateY(-1px)" }} />
                    <span>{c}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </FocusOverlay>
  );
}
