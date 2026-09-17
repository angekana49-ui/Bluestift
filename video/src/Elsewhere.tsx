import type { CSSProperties } from "react";
import { FONTS } from "./brand";
import { clamp01, EASE, span } from "./motion";

/**
 * The AIs students and teachers already use, before Bluestift — for "Students
 * have their AI. Teachers have theirs. And the two never meet."
 *
 * Deliberately nobody's product: no name, no logo, no one's interface copied.
 * A film that drew a real assistant would be putting words in its mouth, and it
 * would date the day that interface changed. What makes them recognisable is
 * what they do, and the two are doing it about the same thing without knowing:
 * the student is handed 6 ÷ ½ = 12, and the teacher, that night, is writing a
 * lesson whose exit ticket asks why 6 ÷ ½ is bigger than 6.
 *
 * Both draw the same 760×470 window as the Raya shots they turn into when the
 * two worlds meet (src/scenes/Intro.tsx).
 */

export const ELSEWHERE = { w: 760, h: 470 };

const appear = (t: number, at: number): CSSProperties => {
  const p = span(t, at, at + 0.25, EASE.arrive);
  return { opacity: p, transform: `translateY(${((1 - p) * 8).toFixed(2)}px)` };
};

/** A four-point spark in a disc: the generic "this is an AI" mark. */
function Spark({ size, ground, ink }: { size: number; ground: string; ink: string }) {
  return (
    <span style={{ width: size, height: size, borderRadius: "50%", background: ground, display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
      <svg width={size * 0.58} height={size * 0.58} viewBox="0 0 24 24">
        <path d="M12 2c.6 4.9 3.1 7.4 8 8-4.9.6-7.4 3.1-8 8-.6-4.9-3.1-7.4-8-8 4.9-.6 7.4-3.1 8-8Z" fill={ink} />
      </svg>
    </span>
  );
}

function Caret({ color, t }: { color: string; t: number }) {
  return <span style={{ display: "inline-block", width: 2, height: 18, marginLeft: 2, verticalAlign: "middle", background: color, opacity: Math.sin(t * 9) > 0 ? 1 : 0.15 }} />;
}

/* ───────────────────────── the student's: answers ───────────────────────── */

/** `from` is when the window arrives; everything in it is timed from there. */
export function StudentAI({ t, from }: { t: number; from: number }) {
  const C = { ground: "#ffffff", line: "#e5e7eb", text: "#1f2328", muted: "#6b7280", bubble: "#f0f1f3" };
  const draft = "and 5 ÷ ⅓?";
  const typed = draft.slice(0, Math.round(draft.length * span(t, from + 2.5, from + 3.2, EASE.linear)));
  const sent = t >= from + 3.3;

  const user = (text: string, style?: CSSProperties) => (
    <div style={{ display: "flex", justifyContent: "flex-end", ...style }}>
      <span style={{ background: C.bubble, borderRadius: 18, padding: "9px 16px", fontSize: 17 }}>{text}</span>
    </div>
  );
  const answer = (text: string, style?: CSSProperties) => (
    <div style={{ display: "flex", alignItems: "center", gap: 10, ...style }}>
      <Spark size={26} ground="#1f2328" ink="#ffffff" />
      <span style={{ fontSize: 17, fontWeight: 600 }}>{text}</span>
    </div>
  );

  return (
    <div style={{ width: ELSEWHERE.w, height: ELSEWHERE.h, boxSizing: "border-box", display: "flex", flexDirection: "column", background: C.ground, color: C.text, fontFamily: FONTS.body }}>
      <div style={{ flex: "none", display: "flex", alignItems: "center", gap: 10, padding: "14px 22px", borderBottom: `1px solid ${C.line}` }}>
        <Spark size={28} ground="#1f2328" ink="#ffffff" />
        <span style={{ flex: 1, fontSize: 17, fontWeight: 600 }}>AI assistant</span>
        <span style={{ fontSize: 14, color: C.muted }}>New chat</span>
      </div>

      <div style={{ flex: 1, minHeight: 0, padding: "18px 24px", display: "flex", flexDirection: "column", gap: 12, overflow: "hidden" }}>
        {user("What's 6 ÷ ½? Just give me the answer.")}
        {answer("12", appear(t, from + 0.35))}
        {user("8 ÷ ¼?", appear(t, from + 1.5))}
        {answer("32", appear(t, from + 1.85))}
        {sent && user(draft, appear(t, from + 3.3))}
        {sent && answer("15", appear(t, from + 3.65))}
      </div>

      <div style={{ flex: "none", margin: "0 22px 18px", border: `1px solid ${C.line}`, borderRadius: 24, padding: "12px 18px", fontSize: 16, color: typed && !sent ? C.text : C.muted }}>
        {typed && !sent ? (
          <>
            {typed}
            <Caret color={C.text} t={t} />
          </>
        ) : (
          "Message the assistant…"
        )}
      </div>
    </div>
  );
}

/* ───────────────────────── the teacher's: a lesson ───────────────────────── */

const LESSON = [
  { text: "Lesson plan — Dividing fractions (Year 9)", strong: true },
  { text: "1. Starter: what does “÷ ½” actually mean?" },
  { text: "2. Keep, change, flip — three worked examples" },
  { text: "3. Practice: 10 questions, from 6 ÷ ½ to 3¾ ÷ 1¼" },
  { text: "4. Exit ticket: why is 6 ÷ ½ bigger than 6?" },
];

export function TeacherAI({ t, from }: { t: number; from: number }) {
  const C = { ground: "#14171c", line: "rgba(255,255,255,0.10)", text: "#e6e8eb", muted: "#8b929c", bubble: "#262a31" };
  // The lesson writes itself, a character stream, the way these tools answer.
  const total = LESSON.reduce((n, l) => n + l.text.length, 0);
  let budget = Math.round(total * clamp01((t - (from + 0.3)) / 3.2));
  const streaming = budget > 0 && budget < total;

  return (
    <div style={{ width: ELSEWHERE.w, height: ELSEWHERE.h, boxSizing: "border-box", display: "flex", flexDirection: "column", background: C.ground, color: C.text, fontFamily: FONTS.body }}>
      <div style={{ flex: "none", display: "flex", alignItems: "center", gap: 10, padding: "14px 22px", borderBottom: `1px solid ${C.line}` }}>
        <Spark size={28} ground="#e6e8eb" ink="#14171c" />
        <span style={{ flex: 1, fontSize: 17, fontWeight: 600 }}>AI assistant</span>
        <span style={{ fontSize: 14, color: C.muted }}>New chat</span>
      </div>

      <div style={{ flex: 1, minHeight: 0, padding: "18px 24px", display: "flex", flexDirection: "column", gap: 14, overflow: "hidden" }}>
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <span style={{ background: C.bubble, borderRadius: 18, padding: "9px 16px", fontSize: 17, maxWidth: 520 }}>
            Write a Year 9 lesson on dividing fractions, with 10 practice questions.
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
          <Spark size={26} ground="#e6e8eb" ink="#14171c" />
          <div style={{ display: "flex", flexDirection: "column", gap: 7, paddingTop: 2 }}>
            {LESSON.map((l, i) => {
              const shown = l.text.slice(0, Math.max(0, budget));
              const last = budget > 0 && budget <= l.text.length;
              budget -= l.text.length;
              if (!shown) return null;
              return (
                <span key={i} style={{ fontSize: l.strong ? 17 : 16, fontWeight: l.strong ? 700 : 400, color: l.strong ? C.text : "#c9ced6" }}>
                  {shown}
                  {streaming && last && <Caret color={C.text} t={t} />}
                </span>
              );
            })}
          </div>
        </div>
      </div>

      <div style={{ flex: "none", margin: "0 22px 18px", border: `1px solid ${C.line}`, borderRadius: 24, padding: "12px 18px", fontSize: 16, color: C.muted }}>
        Message the assistant…
      </div>
    </div>
  );
}
