import type { CSSProperties } from "react";
import { Img } from "remotion";
import { RAYA_FONT } from "@/components/ui/brand";
import { FONTS } from "./brand";
import { MARKS } from "./generated/marks";
import { clamp01, mix } from "./motion";

/**
 * Two more screens the site has no shot of, traced from the app the same way
 * the control screens in screens.tsx are:
 *
 *  - QuizScreen      → components/study/focus-player.tsx `QuizPlayer` in
 *                      "reveal" mode (its immersive shell, its progress dots,
 *                      its green/red tints and its "Why:" note)
 *  - ChallengeScreen → components/room-challenges.tsx, the standings view,
 *                      inside the room's own Challenges tab
 *
 * They exist for one line of the script — "students learn, fail, challenge
 * themselves" — which used to be three drawings of the same conversation.
 */

const T = {
  text: "#0b1220",
  muted: "#44546a",
  mutedLight: "#58687d",
  card: "#ffffff",
  card2: "#eaeff7",
  border: "rgba(15,23,42,0.15)",
  cta: "#1f66c2",
  indigo: "#6366f1",
  green: { bg: "rgba(34,197,94,0.15)", border: "rgba(22,163,74,0.50)", fg: "#15803d" },
  red: { bg: "rgba(239,68,68,0.13)", border: "rgba(220,38,38,0.48)", fg: "#dc2626" },
  rowActive: "#e3eaf5",
  gaugeTrack: "#e2e8f0",
};

/** The pale-blue wash the players and the chat share (.chat-welcome-bg). */
const WASH: CSSProperties = {
  backgroundColor: "#eef4fb",
  backgroundImage:
    "radial-gradient(60% 55% at 22% 30%, rgba(148,190,240,0.55), transparent 70%),radial-gradient(55% 50% at 82% 72%, rgba(180,210,245,0.5), transparent 70%)",
  backgroundRepeat: "no-repeat",
};

const ui = (size: number, weight = 500, color: string = T.text): CSSProperties => ({
  fontFamily: FONTS.display,
  fontSize: size,
  fontWeight: weight,
  color,
  lineHeight: 1.35,
});

/* ───────────────────────────── the quiz, failed ───────────────────────────── */

export const QUIZ = { w: 1200, h: 700 };

const OPTIONS = [
  "To build the sugar straight out of sunlight",
  "To split water and power the reactions",
  "To keep the leaf warm enough to work",
  "To open the stomata so CO₂ can get in",
];
const PICKED = 0;
const CORRECT = 1;

/**
 * Question three of five, answered wrong and revealed — the "fail" the script
 * names, which in this product is a moment that produces something rather than
 * a dead end.
 */
export function QuizScreen({ reveal }: { reveal: number }) {
  const r = clamp01(reveal);
  const option = (i: number): CSSProperties => {
    const picked = i === PICKED;
    const correct = i === CORRECT;
    const bg = correct ? mixColor(T.card, T.green.bg, r) : picked ? mixColor(T.card, T.red.bg, r) : T.card;
    const border = correct ? blend(T.border, T.green.border, r) : picked ? blend(T.border, T.red.border, r) : T.border;
    return {
      display: "flex",
      alignItems: "center",
      gap: 16,
      background: bg,
      border: `2px solid ${border}`,
      borderRadius: 20,
      padding: "20px 22px",
      ...ui(25, 500),
    };
  };

  return (
    <div style={{ position: "relative", width: QUIZ.w, height: QUIZ.h, ...WASH, overflow: "hidden" }}>
      {/* The shell's header: close, title, actions. */}
      <div style={{ display: "flex", alignItems: "center", gap: 18, padding: "18px 26px", background: T.card, borderBottom: `1px solid ${T.border}` }}>
        <span style={{ width: 46, height: 46, flex: "none", borderRadius: 14, border: `2px solid rgba(15,23,42,0.22)`, background: T.card2, display: "flex", alignItems: "center", justifyContent: "center", ...ui(23, 500, T.text) }}>✕</span>
        <span style={{ flex: 1, minWidth: 0, ...ui(25, 700) }}>Quiz — Photosynthesis, lesson 4</span>
        <span style={{ width: 46, height: 46, flex: "none", borderRadius: 14, border: `2px solid rgba(15,23,42,0.22)`, background: T.card2, display: "flex", alignItems: "center", justifyContent: "center", ...ui(23, 500, T.text) }}>⋯</span>
      </div>

      <div style={{ padding: "22px 120px 0" }}>
        {/* Progress: one bar per question, and the count. */}
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ flex: 1, display: "flex", gap: 6 }}>
            {[0, 1, 2, 3, 4].map((i) => (
              <span key={i} style={{ flex: 1, height: 6, borderRadius: 3, background: i <= 2 ? T.indigo : T.gaugeTrack, opacity: i <= 2 ? 1 : 0.5 }} />
            ))}
          </div>
          <span style={ui(21, 500, T.muted)}>3 / 5</span>
        </div>

        <div style={{ ...ui(21, 500, T.mutedLight), marginTop: 26 }}>Question 3</div>
        <div style={{ ...ui(34, 700), lineHeight: 1.35, marginTop: 8, marginBottom: 26 }}>
          In photosynthesis, what is the light actually used for?
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {OPTIONS.map((label, i) => (
            <div key={label} style={option(i)}>
              <span style={{ width: 36, height: 36, flex: "none", borderRadius: 10, background: T.card2, border: `1px solid ${T.border}`, display: "flex", alignItems: "center", justifyContent: "center", ...ui(21, 700, T.muted) }}>
                {String.fromCharCode(65 + i)}
              </span>
              <span style={{ flex: 1 }}>{label}</span>
              {i === CORRECT && <span style={{ ...ui(27, 800, T.green.fg), opacity: r }}>✓</span>}
              {i === PICKED && <span style={{ ...ui(27, 800, T.red.fg), opacity: r }}>✗</span>}
            </div>
          ))}
        </div>

        <div style={{ marginTop: 22, padding: "18px 22px", background: T.card2, border: `1px solid ${T.border}`, borderRadius: 18, ...ui(23, 450, T.muted), lineHeight: 1.5, opacity: clamp01(r * 2 - 1) }}>
          <b style={{ color: T.text, fontWeight: 700 }}>Why: </b>
          the light drives the reactions that split water. The sugar is built afterwards, out of CO₂.
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────── the challenge, in a room ───────────────────────── */

export const CHALLENGE = { w: 1200, h: 700 };

const TABS = ["Group chat", "Raya (private)", "Challenges", "Files", "Report"];
const STANDINGS = [
  { name: "Amira S.", score: 92 },
  { name: "You", score: 80, mine: true },
  { name: "Noah K.", score: 74 },
  { name: "Léa D.", score: 68 },
];
const MEDAL = ["🥇", "🥈", "🥉", "4."];

/** The squad standings after a challenge — the room's own twist on the player. */
export function ChallengeScreen({ rows }: { rows: number }) {
  return (
    <div style={{ position: "relative", width: CHALLENGE.w, height: CHALLENGE.h, ...WASH, overflow: "hidden" }}>
      <div style={{ background: T.card, borderBottom: `1px solid ${T.border}`, padding: "20px 28px 16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <span style={ui(30, 800)}>Trigonometry</span>
          <span style={ui(20, 500, T.muted)}>Mathematics · 5 members</span>
          <span style={{ width: 12, height: 12, borderRadius: 999, background: "#10b981" }} />
          <span style={ui(20, 600)}>4 online</span>
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
          {TABS.map((tab) => {
            const on = tab === "Challenges";
            return (
              <span
                key={tab}
                style={{
                  ...ui(19, 600, on ? "#ffffff" : T.text),
                  background: on ? T.text : T.card,
                  border: `1px solid ${on ? "transparent" : T.border}`,
                  borderRadius: 999,
                  padding: "8px 18px",
                  whiteSpace: "nowrap",
                }}
              >
                {tab === "Raya (private)" ? <><span style={{ fontFamily: RAYA_FONT, fontWeight: 700 }}>Raya</span> (private)</> : tab}
              </span>
            );
          })}
        </div>
      </div>

      <div style={{ padding: "26px 60px" }}>
        <div style={{ background: T.card2, border: `1px solid ${T.border}`, borderRadius: 22, padding: "24px 26px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <span style={{ flex: 1, ...ui(27, 700) }}>🏆 Squad standings</span>
            <span style={ui(21, 500, T.muted)}>You · 4/5 · 80%</span>
          </div>
          <div style={{ ...ui(22, 600), marginTop: 12, marginBottom: 6 }}>The unit circle — 5 questions · Quiz</div>

          {STANDINGS.map((row, i) => {
            const k = clamp01(rows * STANDINGS.length - i);
            return (
              <div
                key={row.name}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  padding: "13px 16px",
                  borderRadius: 14,
                  marginTop: 8,
                  background: row.mine ? T.rowActive : "transparent",
                  opacity: k,
                  transform: `translateY(${((1 - k) * 12).toFixed(1)}px)`,
                }}
              >
                <span style={{ width: 40, flex: "none", ...ui(23, 700, T.mutedLight) }}>{MEDAL[i]}</span>
                <span style={{ flex: "none", ...ui(23, row.mine ? 700 : 500) }}>{row.name}</span>
                <span style={{ flex: 1, height: 10, borderRadius: 5, background: T.gaugeTrack, overflow: "hidden" }}>
                  <span style={{ display: "block", height: "100%", width: `${(row.score * k).toFixed(1)}%`, borderRadius: 5, background: row.mine ? T.cta : "#94a3b8" }} />
                </span>
                <span style={{ width: 84, textAlign: "right", flex: "none", ...ui(23, 700) }}>{Math.round(row.score * k)}%</span>
              </div>
            );
          })}

          <div style={{ display: "flex", gap: 12, marginTop: 22 }}>
            <span style={{ ...ui(20, 600, "#ffffff"), background: T.cta, borderRadius: 999, padding: "11px 20px" }}>Back to challenges</span>
            <span style={{ ...ui(20, 600), background: T.card, border: `2px solid rgba(15,23,42,0.20)`, borderRadius: 999, padding: "9px 18px" }}>My result (PDF)</span>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 20, ...ui(20, 450, T.muted) }}>
          <Img src={MARKS["raya-mark.png"]} style={{ width: 30, height: 30 }} />
          Every attempt lands in the same Kernel profile.
        </div>
      </div>
    </div>
  );
}

/* ── two colour helpers, for tints that arrive rather than appear ── */

function parse(c: string) {
  const m = c.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
  if (m) return [Number(m[1]), Number(m[2]), Number(m[3]), m[4] ? Number(m[4]) : 1] as const;
  const h = c.replace("#", "");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16), 1] as const;
}
/** `b` laid over `a` at `p`, both flattened onto `a`. */
function mixColor(a: string, b: string, p: number) {
  const [ar, ag, ab] = parse(a);
  const [br, bg, bb, balpha] = parse(b);
  const k = clamp01(p) * balpha;
  return `rgb(${Math.round(mix(ar, br, k))},${Math.round(mix(ag, bg, k))},${Math.round(mix(ab, bb, k))})`;
}
function blend(a: string, b: string, p: number) {
  const [ar, ag, ab, aa] = parse(a);
  const [br, bg, bb, ba] = parse(b);
  const k = clamp01(p);
  return `rgba(${Math.round(mix(ar, br, k))},${Math.round(mix(ag, bg, k))},${Math.round(mix(ab, bb, k))},${mix(aa, ba, k).toFixed(3)})`;
}
