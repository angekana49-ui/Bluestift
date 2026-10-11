import type { CSSProperties, ReactNode } from "react";
import { Img } from "remotion";
import { RAYA_FONT } from "@/components/ui/brand";
import { FONTS } from "./brand";
import { MARKS } from "./generated/marks";
import { clamp01, mix } from "./motion";

/**
 * The screens the product grew after the film was first cut, drawn for it the
 * way screens.tsx draws the control passage — each traced from the real one,
 * with its real words:
 *
 *  - MathsScreen   → a Raya reply that cites Wikipedia (lib/raya live tools),
 *                    beside the Maths panel (components/raya/maths-dock.tsx):
 *                    the graph drawn, then the calculator's working
 *  - PrepareScreen → Schools › Prepare (components/school/prof-prepare.tsx):
 *                    a quiz built from the class's weak concepts, assigned
 *  - ReportScreen  → Schools › a student's report (StudentDetailView in
 *                    components/school-admin.tsx): homework, the questions
 *                    missed, and Raya's written reading
 *
 * Every moving part is a number between 0 and 1 the scene passes in; the
 * screen is a still picture of that moment.
 */

const INK = {
  text: "#0b1220",
  muted: "#44546a",
  faint: "#64748b",
  border: "#dde5ee",
  field: "#f3f6fa",
  blue: "#2f7fe0",
  blueSoft: "rgba(47,127,224,0.1)",
  green: "#16a34a",
  red: "#dc2626",
  amber: "#d97706",
  violet: "#6d28d9",
  page: "#f5f8fc",
};
const ui = (size: number, weight = 500, color: string = INK.text): CSSProperties => ({ fontFamily: FONTS.display, fontSize: size, fontWeight: weight, color, lineHeight: 1.4 });
const math = (size: number): CSSProperties => ({ fontFamily: FONTS.serif, fontStyle: "italic", fontSize: size, color: INK.text });

/** Text written out as it is "typed": the first `p` of its characters. */
const typed = (s: string, p: number) => s.slice(0, Math.round(s.length * clamp01(p)));
/** In over a short rise. */
const rise = (p: number): CSSProperties => ({ opacity: clamp01(p), transform: `translateY(${((1 - clamp01(p)) * 12).toFixed(2)}px)` });

function RayaAvatar({ size = 40 }: { size?: number }) {
  return (
    <span style={{ width: size, height: size, borderRadius: "50%", background: "#eef4fd", display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
      <Img src={MARKS["raya-mark.png"]} style={{ width: size * 0.7, height: size * 0.7 }} />
    </span>
  );
}

function Pressable({ children, pressed = 0, style }: { children: ReactNode; pressed?: number; style?: CSSProperties }) {
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 999,
        padding: "13px 24px",
        background: INK.blue,
        color: "#fff",
        fontFamily: FONTS.display,
        fontWeight: 650,
        fontSize: 21,
        transform: `scale(${(1 - 0.05 * Math.sin(clamp01(pressed) * Math.PI)).toFixed(4)})`,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/* ───────────────────────────── Raya: facts, graphs, maths ───────────────────────────── */

export const MATHS = { w: 1500, h: 780, chatW: 880, panel: { x: 880, w: 620 } };

/** The curve on the graph: y = x² − 2x − 3, on x ∈ [−3, 5], y ∈ [−5, 7]. */
const G = { w: 560, h: 380, x0: -3, x1: 5, y0: -5, y1: 7 };
const gx = (x: number) => ((x - G.x0) / (G.x1 - G.x0)) * G.w;
const gy = (y: number) => G.h - ((y - G.y0) / (G.y1 - G.y0)) * G.h;
const CURVE = (() => {
  const pts: string[] = [];
  for (let i = 0; i <= 80; i++) {
    const x = G.x0 + ((G.x1 - G.x0) * i) / 80;
    pts.push(`${i ? "L" : "M"}${gx(x).toFixed(1)},${gy(x * x - 2 * x - 3).toFixed(1)}`);
  }
  return pts.join(" ");
})();

export function MathsScreen({ wiki, graph, steps }: { wiki: number; graph: number; steps: number }) {
  const law = "Newton's second law says the net force on a body equals its mass times its acceleration:";
  const next = "Now your curve. Set y = 0 and factor:";
  const stepLines: [string, string][] = [
    ["x² − 2x − 3 = 0", ""],
    ["(x − 3)(x + 1) = 0", ""],
    ["x = 3", "or  x = −1"],
  ];
  const lineIn = (k: number) => span01(steps, 0.12 + k * 0.26, 0.34 + k * 0.26);
  return (
    <div style={{ width: MATHS.w, height: MATHS.h, background: INK.page, display: "flex" }}>
      {/* the conversation */}
      <div style={{ width: MATHS.chatW, padding: "34px 44px", boxSizing: "border-box", display: "flex", flexDirection: "column", gap: 22 }}>
        <div style={{ alignSelf: "flex-end", maxWidth: 600, background: INK.blue, color: "#fff", borderRadius: "22px 22px 6px 22px", padding: "14px 22px", ...ui(22, 500, "#fff") }}>
          What does Newton's second law say? And where does y = x² − 2x − 3 cross the x-axis?
        </div>
        <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
          <RayaAvatar />
          <div style={{ flex: 1, background: "#fff", border: `1px solid ${INK.border}`, borderRadius: "6px 22px 22px 22px", padding: "18px 24px", boxShadow: "0 1px 2px rgba(15,23,42,0.05)" }}>
            <div style={ui(22, 450)}>{typed(law, wiki * 1.6)}</div>
            <div style={{ ...rise(span01(wiki, 0.55, 0.8)), textAlign: "center", margin: "14px 0 6px" }}>
              <span style={math(36)}>F</span>
              <span style={{ ...math(36), fontStyle: "normal" }}> = </span>
              <span style={math(36)}>m a</span>
            </div>
            {/* The source, cited — the part the voice is saying. */}
            <div
              style={{
                ...rise(span01(wiki, 0.6, 0.85)),
                display: "inline-flex",
                alignItems: "center",
                gap: 10,
                marginTop: 8,
                borderRadius: 999,
                padding: "7px 16px",
                background: wiki > 0.7 ? INK.blueSoft : INK.field,
                border: `1px solid ${wiki > 0.7 ? "rgba(47,127,224,0.35)" : INK.border}`,
                ...ui(17, 600, INK.blue),
              }}
            >
              <span style={{ fontFamily: FONTS.serif, fontWeight: 700, fontSize: 19 }}>W</span>
              Source: Wikipedia · Newton's laws of motion
            </div>
            {steps > 0 && (
              <div style={{ marginTop: 20, borderTop: `1px solid ${INK.border}`, paddingTop: 16 }}>
                <div style={ui(22, 450)}>{typed(next, steps * 4)}</div>
                <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8, paddingLeft: 24 }}>
                  {stepLines.map(([a, b], k) => (
                    <div key={a} style={{ ...rise(lineIn(k)), display: "flex", gap: 18, alignItems: "baseline" }}>
                      <span style={math(28)}>{a}</span>
                      {b && <span style={math(28)}>{b}</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* the Maths panel: the graph, then the calculator's working */}
      <div style={{ width: MATHS.panel.w, background: "#fff", borderLeft: `1px solid ${INK.border}`, padding: "26px 30px", boxSizing: "border-box" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
          <span style={ui(24, 700)}>Maths</span>
          <span style={{ flex: 1 }} />
          {["Graph", "Calculator"].map((tab, i) => {
            const on = i === 0 ? steps < 0.15 : steps >= 0.15;
            return (
              <span key={tab} style={{ ...ui(17, 600, on ? INK.text : INK.faint), padding: "6px 14px", borderRadius: 999, background: on ? INK.field : "transparent", border: `1px solid ${on ? INK.border : "transparent"}` }}>
                {tab}
              </span>
            );
          })}
        </div>
        <div style={{ borderRadius: 14, border: `1px solid ${INK.border}`, padding: "14px 14px 8px", background: "#fbfdff" }}>
          <svg width={G.w} height={G.h} style={{ display: "block", overflow: "hidden" }}>
            {Array.from({ length: G.x1 - G.x0 + 1 }, (_, i) => G.x0 + i).map((x) => (
              <line key={`v${x}`} x1={gx(x)} x2={gx(x)} y1={0} y2={G.h} stroke="#e9eef5" strokeWidth={1} />
            ))}
            {Array.from({ length: G.y1 - G.y0 + 1 }, (_, i) => G.y0 + i).map((y) => (
              <line key={`h${y}`} x1={0} x2={G.w} y1={gy(y)} y2={gy(y)} stroke="#e9eef5" strokeWidth={1} />
            ))}
            <line x1={0} x2={G.w} y1={gy(0)} y2={gy(0)} stroke="#94a3b8" strokeWidth={1.5} />
            <line x1={gx(0)} x2={gx(0)} y1={0} y2={G.h} stroke="#94a3b8" strokeWidth={1.5} />
            <path d={CURVE} fill="none" stroke={INK.blue} strokeWidth={4} strokeLinecap="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - clamp01(graph)} />
            {/* The roots the working finds, marked where the curve crosses. */}
            {[-1, 3].map((x, k) => {
              const p = lineIn(2) * (k === 0 ? 1 : span01(steps, 0.8, 0.95));
              return p > 0 ? <circle key={x} cx={gx(x)} cy={gy(0)} r={mix(2, 9, p)} fill="#fff" stroke={INK.red} strokeWidth={4} opacity={p} /> : null;
            })}
          </svg>
          <div style={{ ...math(22), marginTop: 6, opacity: clamp01(graph * 3) }}>y = x² − 2x − 3</div>
        </div>
        <div style={{ marginTop: 18, borderRadius: 14, border: `1px solid ${INK.border}`, padding: "14px 18px", ...rise(span01(steps, 0.05, 0.25)) }}>
          <div style={{ ...ui(16, 600, INK.faint), marginBottom: 6 }}>Calculator</div>
          <div style={{ fontFamily: "ui-monospace, Menlo, Consolas, monospace", fontSize: 21, color: INK.text }}>solve(x² − 2x − 3 = 0, x)</div>
          <div style={{ ...math(26), marginTop: 6, color: INK.blue, opacity: lineIn(2) }}>x = −1,  x = 3</div>
        </div>
      </div>
    </div>
  );
}

/** 0 → 1 as `p` goes from a to b. */
function span01(p: number, a: number, b: number) {
  return clamp01((p - a) / (b - a));
}

/* ───────────────────────────── Schools: homework in minutes ───────────────────────────── */

export const PREPARE = { w: 1200, h: 700 };

export function PrepareScreen({ build, pressed, assigned }: { build: number; pressed: number; assigned: number }) {
  const questions = [
    "A car goes from 0 to 20 m/s in 4 s. What is its acceleration?",
    "Which force makes a cyclist slow down when they stop pedalling?",
    "A 2 kg trolley is pushed with 6 N. How fast does it speed up?",
  ];
  return (
    <div style={{ width: PREPARE.w, height: PREPARE.h, background: INK.page, padding: "34px 44px", boxSizing: "border-box" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 14 }}>
        <span style={ui(32, 700)}>Prepare</span>
        <span style={ui(20, 500, INK.faint)}>Year 10 · Physics</span>
      </div>
      <div style={{ marginTop: 22, background: "#fff", border: `1px solid ${INK.border}`, borderRadius: 20, padding: "24px 28px", boxShadow: "0 1px 2px rgba(15,23,42,0.05)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ ...ui(15, 700, INK.blue), padding: "4px 12px", borderRadius: 999, background: INK.blueSoft }}>QUIZ</span>
          <span style={ui(26, 700)}>Acceleration and forces</span>
        </div>
        <div style={{ ...ui(18, 500, INK.muted), marginTop: 6 }}>8 questions · built on what your class gets wrong most</div>
        <div style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: 10 }}>
          {questions.map((q, i) => (
            <div key={q} style={{ ...rise(span01(build, i * 0.25, i * 0.25 + 0.35)), display: "flex", gap: 14, alignItems: "center", padding: "12px 16px", borderRadius: 14, background: INK.field }}>
              <span style={{ ...ui(17, 700, INK.faint), width: 26 }}>{i + 1}</span>
              <span style={ui(20, 500)}>{q}</span>
            </div>
          ))}
          <div style={{ ...ui(17, 500, INK.faint), paddingLeft: 56, opacity: span01(build, 0.75, 1) }}>+ 5 more</div>
        </div>
        <div style={{ marginTop: 20, display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ ...ui(18, 600, INK.muted), padding: "11px 18px", borderRadius: 12, border: `1.5px solid ${INK.border}` }}>Due Friday</div>
          <span style={{ flex: 1 }} />
          <Pressable pressed={pressed}>Assign to the class</Pressable>
        </div>
      </div>
      <div
        style={{
          ...rise(assigned),
          marginTop: 18,
          display: "inline-flex",
          alignItems: "center",
          gap: 10,
          borderRadius: 999,
          padding: "10px 20px",
          background: "rgba(22,163,74,0.1)",
          ...ui(19, 650, INK.green),
        }}
      >
        ✓ Assigned to 24 students
      </div>
    </div>
  );
}

/* ───────────────────────────── Schools: one student's report ───────────────────────────── */

export const REPORT = { w: 1200, h: 820, summary: { x: 600, y: 330 } };

export function ReportScreen({ summary, rows }: { summary: number; rows: number }) {
  const stats: [string, string, string?][] = [
    ["4/5", "Homework done"],
    ["72%", "Homework average"],
    ["1", "Not submitted", INK.red],
    ["Today", "Last active"],
  ];
  const reading: [string, string][] = [
    ["Where they stand", "Maya has handed in 4 of 5 homeworks, averaging 72%, and her last two scores are her best."],
    ["What gets in the way", "Units: she sets up acceleration correctly, then loses marks converting km/h to m/s."],
    ["Next step", "A short quiz on unit conversions before Friday's test."],
  ];
  const homework: [string, string, string][] = [
    ["Acceleration and forces", "81%", INK.green],
    ["Speed and velocity", "64%", INK.text],
    ["Energy transfers", "Not submitted", INK.red],
  ];
  return (
    <div style={{ width: REPORT.w, height: REPORT.h, background: INK.page, padding: "30px 44px", boxSizing: "border-box" }}>
      <div style={ui(17, 600, INK.faint)}>← Back to class</div>
      <div style={{ marginTop: 12, background: "#fff", border: `1px solid ${INK.border}`, borderRadius: 20, padding: "22px 28px" }}>
        <div style={ui(32, 700)}>Maya Rossi</div>
        <div style={ui(17, 500, INK.faint)}>In this class since 8 Sep</div>
        <div style={{ display: "flex", gap: 44, marginTop: 16 }}>
          {stats.map(([v, l, c]) => (
            <div key={l}>
              <div style={ui(28, 700, c ?? INK.text)}>{v}</div>
              <div style={ui(16, 500, INK.faint)}>{l}</div>
            </div>
          ))}
        </div>
      </div>
      <div style={{ marginTop: 14, background: "#fff", border: "1.5px solid rgba(139,92,246,0.35)", borderRadius: 20, padding: "18px 28px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ ...ui(17, 650, INK.violet), flex: 1 }}>
            <span style={{ fontFamily: RAYA_FONT, fontWeight: 700 }}>Raya</span> analysis
          </span>
          <Pressable pressed={span01(summary, 0, 0.12)} style={{ padding: "9px 18px", fontSize: 17 }}>
            {summary > 0.12 ? "Rewrite" : "Write a summary"}
          </Pressable>
        </div>
        <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
          {reading.map(([title, body], i) => {
            const p = span01(summary, 0.12 + i * 0.29, 0.12 + (i + 1) * 0.29);
            return p > 0 ? (
              <div key={title} style={ui(19, 450)}>
                <b style={{ fontWeight: 700 }}>{title}</b> — {typed(body, p * 1.15)}
              </div>
            ) : null;
          })}
        </div>
      </div>
      <div style={{ marginTop: 14, background: "#fff", border: `1px solid ${INK.border}`, borderRadius: 20, padding: "14px 28px" }}>
        <div style={{ ...ui(14, 700, INK.faint), letterSpacing: "0.06em", textTransform: "uppercase", margin: "4px 0 6px" }}>Homework</div>
        {homework.map(([title, score, color], i) => (
          <div key={title} style={{ ...rise(span01(rows, i * 0.3, i * 0.3 + 0.4)), display: "flex", alignItems: "center", padding: "9px 0", borderTop: i ? `1px solid ${INK.border}` : undefined }}>
            <span style={{ ...ui(19, 600), flex: 1 }}>{title}</span>
            <span style={ui(19, 700, color)}>{score}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ───────────────────────────── Raya: no account needed ───────────────────────────── */

/** The landing's call to try Raya, as a pill — pressed on "now". */
export function TryRayaPill({ pressed }: { pressed: number }) {
  return (
    <Pressable pressed={pressed} style={{ padding: "18px 34px", fontSize: 30, boxShadow: "0 12px 30px rgba(47,127,224,0.32)" }}>
      Try <span style={{ fontFamily: RAYA_FONT, fontWeight: 700, margin: "0 9px" }}>Raya</span> now — no account needed
    </Pressable>
  );
}
