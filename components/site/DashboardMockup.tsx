import type { CSSProperties } from "react";
import type { Theme } from "./theme";
import { RayaName } from "@/components/ui/brand";

/**
 * Stagger, as an inline custom property the stylesheet reads as an
 * animation-delay (see .pub-hero-* in globals.css). Same device as the product
 * shots use, so one sequence can be written as numbers at the call site and
 * read as a score, rather than as a pile of nth-child rules in the stylesheet.
 */
const at = (ms: number) => ({ "--d": `${ms}ms` }) as CSSProperties;

type Bar = { sessions: number; quizzes: number; mastery: number };

const MONTHS: { label: string; bars: Bar; current?: boolean }[] = [
  { label: "Jan", bars: { sessions: 41, quizzes: 27, mastery: 12 } },
  { label: "Feb", bars: { sessions: 53, quizzes: 34, mastery: 17 } },
  { label: "Mar", bars: { sessions: 46, quizzes: 37, mastery: 22 } },
  { label: "Apr", bars: { sessions: 67, quizzes: 40, mastery: 28 } },
  { label: "May", bars: { sessions: 88, quizzes: 50, mastery: 40 } },
  { label: "Jun", bars: { sessions: 108, quizzes: 67, mastery: 55 }, current: true },
];

const PASTEL = {
  sessions: "linear-gradient(180deg,#b7bdf7,#9aa1ef)",
  quizzes: "linear-gradient(180deg,#fdc48a,#fbab5c)",
  mastery: "linear-gradient(180deg,#a7ecc3,#7fe0a3)",
};
const VIVID = {
  sessions: "linear-gradient(180deg,#8b5cf6,#4f46e5)",
  quizzes: "linear-gradient(180deg,#fb923c,#f97316)",
  mastery: "linear-gradient(180deg,#4ade80,#22c55e)",
};

/** The floating product dashboard card inside the Home hero. */
export default function DashboardMockup({ theme: t }: { theme: Theme }) {
  const bar = (h: number, bg: string, delay: number) => (
    <div className="pub-hero-bar" style={{ ...at(delay), flex: 1, height: h, background: bg, borderRadius: "3px 3px 0 0" }} />
  );

  // One tile used to carry an infinite `shine` sweep. It drew the eye to the
  // tile with the least to say, forever, and made a static dashboard look like
  // a loading skeleton. The tiles are now plain — the numbers are the content.
  const statTile = (label: string, value: string, sub: string, subColor: string, delay: number) => (
    <div
      className="pub-hero-tile"
      style={{
        ...at(delay),
        position: "relative",
        overflow: "hidden",
        border: `1px solid ${t.cardBorder}`,
        borderRadius: 16,
        background: t.inputFieldBg,
        padding: 14,
      }}
    >
      <div style={{ fontSize: 13, color: t.muted }}>{label}</div>
      <div style={{ fontSize: 23, fontWeight: 600 }}>{value}</div>
      <div style={{ fontSize: 13, color: subColor }}>{sub}</div>
    </div>
  );

  return (
    // Edge, elevation and radius belong to the BrowserFrame this is rendered
    // inside (see HeroSection) — carrying its own as well drew two borders a
    // pixel apart and stacked two shadows, which is the tell that a mockup was
    // assembled rather than captured.
    <div style={{ background: t.cardBg, textAlign: "left" }}>
      {/* Tab bar */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, borderBottom: `1px solid ${t.cardBorder}`, padding: "12px 16px" }}>
        <span style={{ background: t.ctaBg, color: t.ctaText, borderRadius: 999, padding: "7px 14px", fontSize: 13, fontWeight: 500 }}>Overview</span>
        <span style={{ color: t.mutedLight, padding: "7px 14px", fontSize: 13 }}>Sessions</span>
        <span style={{ color: t.mutedLight, padding: "7px 14px", fontSize: 13 }}>Students</span>
        <span style={{ color: t.mutedLight, padding: "7px 14px", fontSize: 13 }}>Kernel</span>
        <span
          className="pub-hide-sm"
          style={{ marginLeft: "auto", color: t.mutedLight, fontSize: 13, border: `1px solid ${t.inputBorder}`, borderRadius: 999, padding: "6px 12px", background: t.inputFieldBg }}
        >
          Search students, classes…
        </span>
      </div>

      <div className="dash-grid" style={{ display: "grid", gridTemplateColumns: "1.75fr 1fr", gap: 16, padding: 20 }}>
        {/* Left column */}
        <div style={{ border: `1px solid ${t.cardBorder}`, borderRadius: 20, padding: 18 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 18, fontWeight: 600 }}>Teaching overview</div>
              <div style={{ fontSize: 13, color: t.muted, marginTop: 2 }}>Real-time signals across every class you track.</div>
            </div>
            <span style={{ background: t.ctaBg, color: t.ctaText, borderRadius: 999, padding: "6px 12px", fontSize: 13, alignSelf: "flex-start" }}>Share</span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
            {/* The score starts at 700ms — while the frame's own rise (which
                settles at 860ms) is still finishing, so the two read as one
                arrival rather than as two waits. */}
            {statTile("Sessions today", "482", "+21% vs last month", "#10b981", 700)}
            {statTile("Students stuck", "6", "-2 since this morning", t.mutedLight, 760)}
            {statTile("Average mastery", "83%", "+12 points this month", t.mutedLight, 820)}
            {statTile("Active students", "1,204", "+340 this week", "#10b981", 880)}
          </div>

          {/* Bar chart */}
          <div style={{ border: `1px solid ${t.cardBorder}`, borderRadius: 18, padding: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
              <span style={{ fontSize: 14, fontWeight: 600 }}>Sessions vs. mastery</span>
              <div style={{ display: "flex", gap: 10, fontSize: 13, color: t.mutedLight }}>
                <span>
                  <span style={{ display: "inline-block", width: 8, height: 8, background: "#4f46e5", borderRadius: 2, marginRight: 4 }} />
                  Sessions
                </span>
                <span className="pub-hide-sm">
                  <span style={{ display: "inline-block", width: 8, height: 8, background: "#f97316", borderRadius: 2, marginRight: 4 }} />
                  Quizzes
                </span>
                <span className="pub-hide-sm">
                  <span style={{ display: "inline-block", width: 8, height: 8, background: "#22c55e", borderRadius: 2, marginRight: 4 }} />
                  Mastery
                </span>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 8 }}>
              {MONTHS.map((m, mi) => {
                const c = m.current ? VIVID : PASTEL;
                // Staggered by month, not by individual bar: eighteen separately
                // timed bars is fussiness the eye reads as noise, where six
                // groups read as the chart being drawn left to right.
                const d = 900 + mi * 70;
                return (
                  <div key={m.label} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5, flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "flex-end", gap: 2, width: "100%", height: 116 }}>
                      {bar(m.bars.sessions, c.sessions, d)}
                      {bar(m.bars.quizzes, c.quizzes, d)}
                      {bar(m.bars.mastery, c.mastery, d)}
                    </div>
                    <span style={{ fontSize: 13, fontWeight: m.current ? 700 : 400, color: m.current ? t.text : t.mutedLight }}>{m.label}</span>
                  </div>
                );
              })}
            </div>
            <div style={{ textAlign: "center", marginTop: 8 }}>
              <span style={{ background: t.ctaBg, color: t.ctaText, borderRadius: 999, padding: "6px 12px", fontSize: 13 }}>June 2026 — Mastery climbing</span>
            </div>
          </div>
        </div>

        {/* Right column */}
        <div className="pub-hide-sm" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ border: `1px solid ${t.cardBorder}`, borderRadius: 18, padding: 14 }}>
            <div style={{ background: t.inputFieldBg, borderRadius: 14, padding: 10 }}>
              <div style={{ fontSize: 13, color: t.muted }}>Still stuck on fractions?</div>
              <div style={{ fontSize: 13, fontWeight: 600, marginTop: 3 }}>Let&apos;s try a different way.</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10 }}>
              <span style={{ width: 26, height: 26, borderRadius: "50%", background: "#6366f1", color: "white", fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>AI</span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}><RayaName />&apos;s suggestions</div>
                <div style={{ fontSize: 13, color: t.muted }}>Tailored explanation in seconds.</div>
              </div>
            </div>
          </div>

          <div style={{ border: `1px solid ${t.cardBorder}`, borderRadius: 18, padding: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
              <span style={{ fontSize: 14, fontWeight: 600 }}>Kernel mastery</span>
              <span style={{ fontSize: 13, color: t.mutedLight }}>Updated just now</span>
            </div>
            <svg viewBox="0 0 160 96" style={{ width: "100%", display: "block" }}>
              <defs>
                <linearGradient id="kernelGaugeFill" x1="0" x2="1" y1="0" y2="0">
                  <stop offset="0%" stopColor="#f97316" />
                  <stop offset="45%" stopColor="#fbbf24" />
                  <stop offset="75%" stopColor="#84cc16" />
                  <stop offset="100%" stopColor="#22c55e" />
                </linearGradient>
              </defs>
              <path d="M 20 84 A 60 60 0 0 1 140 84" fill="none" stroke="#e2e8f0" strokeWidth="12" strokeLinecap="round" />
              <path className="pub-hero-gauge" d="M 20 84 A 60 60 0 0 1 140 84" fill="none" stroke="url(#kernelGaugeFill)" strokeWidth="12" strokeLinecap="round" strokeDasharray="188" strokeDashoffset="50" />
              <text x="80" y="64" textAnchor="middle" fontSize="22" fontWeight="700" fill={t.text}>1,204</text>
              <text x="80" y="79" textAnchor="middle" fontSize="8" fill={t.mutedLight}>students tracked</text>
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}
