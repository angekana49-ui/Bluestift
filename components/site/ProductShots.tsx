import type { Theme } from "./theme";
import { RayaName } from "@/components/ui/brand";

/**
 * The product shots that sit at the top of the landing sections.
 *
 * These replaced a set of generic AI-generated clips (glowing node graphs, a
 * blue tree sprouting question marks). Stock abstraction is the fastest way to
 * make a real product look like a pitch deck: it says nothing specific, and a
 * teacher reading the page can't tell whether anything has been built. Each
 * shot below draws the actual surface the copy next to it is describing —
 * concept-level mastery, a live room, generated material, an escalating
 * transcript — so the section's claim and its illustration are the same claim.
 *
 * They're real DOM, not images: they re-theme with the page, stay sharp at any
 * density, cost a few kilobytes instead of a few hundred, and never 404.
 *
 * ── How the scaling works ────────────────────────────────────────────────
 * Each shot is drawn against a fixed nominal width (`BASE`) and every length
 * inside is expressed with `u()`, which converts nominal pixels into `cqw` —
 * percentages of the frame's own inline size. `ShotFrame` declares
 * `container-type: inline-size`, so the entire composition scales
 * proportionally with its card instead of reflowing: one layout that is right
 * in a 340px feature card and in a 900px wide plate alike. Never mix raw `px`
 * into a shot — it will drift out of proportion at other card widths.
 */

/** Nominal design width of the three 16/10 feature shots. Those cards are
 *  roughly this wide on desktop and go full-bleed on mobile, so one fixed
 *  nominal width is right at every size. */
const BASE = 400;
/** Nominal px → container-relative units for the feature shots. */
const u = (n: number) => `${(n * 100) / BASE}cqw`;

/**
 * The wide transcript plate is the one shot whose container width changes by
 * more than 2× between layouts (a ~860px desktop plate, a ~350px phone). Held
 * to a single nominal width it would render phone text at 40% scale — legible
 * to a screenshot, not to a person — so its design width is a CSS variable the
 * stylesheet narrows at the mobile breakpoint (`--shot-base-wide`, set on
 * `.pub-shot-wide` in globals.css). Dividing in `calc` rather than in JS is what
 * lets that switch happen in CSS at all.
 */
const BASE_WIDE = 900;
const uw = (n: number) => `calc(${n} * 100cqw / var(--shot-base-wide, ${BASE_WIDE}))`;

const ACCENT = {
  indigo: "#4f46e5",
  blue: "#2f7fe0",
  green: "#22c55e",
  amber: "#f59e0b",
  orange: "#f97316",
};

/**
 * The aspect-ratio box every shot is drawn into. Owns the container context
 * that `u()`/`uw()` resolve against, so a shot is never rendered outside one.
 */
function ShotFrame({
  theme: t,
  ratio,
  className,
  children,
}: {
  theme: Theme;
  ratio: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={className ? `pub-shot ${className}` : "pub-shot"}
      style={{
        containerType: "inline-size",
        position: "relative",
        aspectRatio: ratio,
        overflow: "hidden",
        // A shot is a window onto the app, so it carries the app's own page
        // tint rather than the marketing card's white.
        background: t.dark
          ? "linear-gradient(160deg,#0f1930 0%,#0b1324 100%)"
          : "linear-gradient(160deg,#f7fafd 0%,#eef3f9 100%)",
        borderBottom: `1px solid ${t.cardBorder}`,
      }}
    >
      {children}
    </div>
  );
}

/** Shared inner panel: the white/à-plat surface the app's own cards use. */
function panel(t: Theme, radius: string, pad: string): React.CSSProperties {
  return {
    background: t.cardBg,
    border: `1px solid ${t.cardBorder}`,
    borderRadius: radius,
    padding: pad,
  };
}

/* ───────────────────────── Cognitive Kernel ───────────────────────── */

const CONCEPTS: { label: string; pct: number; tone: keyof typeof ACCENT }[] = [
  { label: "Linear equations", pct: 88, tone: "green" },
  { label: "Proportionality", pct: 71, tone: "blue" },
  { label: "Fractions — division", pct: 34, tone: "amber" },
];

/**
 * Concept-by-concept mastery, with the prerequisite that's holding the rest
 * back called out underneath — the one thing a single grade can never show,
 * and the section's whole argument.
 */
export function KernelShot({ theme: t }: { theme: Theme }) {
  return (
    <ShotFrame theme={t} ratio="16 / 10">
      <div style={{ position: "absolute", inset: 0, padding: u(16), display: "flex", flexDirection: "column", gap: u(10) }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: u(13), fontWeight: 700, color: t.text, letterSpacing: "-0.01em" }}>Kernel profile</div>
            <div style={{ fontSize: u(10), color: t.muted, marginTop: u(2) }}>Maya · 9th grade</div>
          </div>
          <span
            style={{
              fontSize: u(9),
              fontWeight: 600,
              color: t.greenText,
              background: t.greenBg,
              border: `1px solid ${t.greenBorder}`,
              borderRadius: u(999),
              padding: `${u(3)} ${u(8)}`,
            }}
          >
            Live
          </span>
        </div>

        <div style={{ ...panel(t, u(12), u(12)), display: "flex", flexDirection: "column", gap: u(10) }}>
          {CONCEPTS.map((c) => (
            <div key={c.label}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: u(4) }}>
                <span style={{ fontSize: u(10.5), color: t.text }}>{c.label}</span>
                <span style={{ fontSize: u(10.5), fontWeight: 700, color: ACCENT[c.tone] }}>{c.pct}%</span>
              </div>
              <div style={{ height: u(5), borderRadius: u(999), background: t.inputFieldBg, overflow: "hidden" }}>
                <div style={{ width: `${c.pct}%`, height: "100%", borderRadius: u(999), background: ACCENT[c.tone] }} />
              </div>
            </div>
          ))}
        </div>

        <div
          style={{
            marginTop: "auto",
            display: "flex",
            alignItems: "center",
            gap: u(8),
            background: t.orangeBg,
            border: `1px solid ${t.orangeBorder}`,
            borderRadius: u(12),
            padding: `${u(9)} ${u(11)}`,
          }}
        >
          <span
            style={{
              flex: "none",
              width: u(18),
              height: u(18),
              borderRadius: u(999),
              background: ACCENT.orange,
              color: "#fff",
              fontSize: u(11),
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            !
          </span>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: u(10.5), fontWeight: 600, color: t.orangeText }}>Blocking prerequisite</div>
            <div style={{ fontSize: u(9.5), color: t.muted }}>Dividing fractions gates 3 later concepts.</div>
          </div>
        </div>
      </div>
    </ShotFrame>
  );
}

/* ───────────────────────── Study Rooms ───────────────────────── */

const MEMBERS = [
  { initials: "MR", bg: "#4f46e5" },
  { initials: "JT", bg: "#0ea5e9" },
  { initials: "AO", bg: "#10b981" },
];

/** A room mid-session: who's in it, what they're working from, and Raya
 *  answering the group rather than one student in a private corner. */
export function RoomShot({ theme: t }: { theme: Theme }) {
  const bubble = (own: boolean): React.CSSProperties => ({
    maxWidth: "78%",
    alignSelf: own ? "flex-end" : "flex-start",
    background: own ? t.ctaBg : t.cardBg,
    color: own ? t.ctaText : t.text,
    border: own ? "none" : `1px solid ${t.cardBorder}`,
    borderRadius: u(12),
    padding: `${u(7)} ${u(10)}`,
    fontSize: u(10),
    lineHeight: 1.5,
  });

  return (
    <ShotFrame theme={t} ratio="16 / 10">
      <div style={{ position: "absolute", inset: 0, padding: u(16), display: "flex", flexDirection: "column", gap: u(10) }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: u(6) }}>
            <span style={{ width: u(6), height: u(6), borderRadius: u(999), background: ACCENT.green }} />
            <span style={{ fontSize: u(12), fontWeight: 700, color: t.text, letterSpacing: "-0.01em" }}>Trigonometry · live</span>
          </div>
          <div style={{ display: "flex" }}>
            {MEMBERS.map((m, i) => (
              <span
                key={m.initials}
                style={{
                  width: u(20),
                  height: u(20),
                  borderRadius: u(999),
                  background: m.bg,
                  color: "#fff",
                  fontSize: u(8),
                  fontWeight: 700,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  border: `${u(1.5)} solid ${t.cardBg}`,
                  marginLeft: i === 0 ? 0 : u(-6),
                }}
              >
                {m.initials}
              </span>
            ))}
            <span
              style={{
                width: u(20),
                height: u(20),
                borderRadius: u(999),
                background: t.inputFieldBg,
                color: t.muted,
                fontSize: u(8),
                fontWeight: 700,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                border: `${u(1.5)} solid ${t.cardBg}`,
                marginLeft: u(-6),
              }}
            >
              +2
            </span>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: u(7),
            background: t.inputFieldBg,
            border: `1px solid ${t.cardBorder}`,
            borderRadius: u(10),
            padding: `${u(6)} ${u(9)}`,
          }}
        >
          <span style={{ width: u(14), height: u(16), borderRadius: u(3), background: ACCENT.blue, flex: "none" }} />
          <span style={{ fontSize: u(9.5), color: t.text, fontWeight: 500 }}>Chapter 6 — The unit circle.pdf</span>
          <span style={{ marginLeft: "auto", fontSize: u(8.5), color: t.muted }}>shared</span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: u(7) }}>
          <div style={bubble(true)}>Why is sin(150°) positive if 150° isn&apos;t in the first quadrant?</div>
          <div style={{ display: "flex", gap: u(7), alignItems: "flex-end" }}>
            <span
              style={{
                flex: "none",
                width: u(20),
                height: u(20),
                borderRadius: u(999),
                background: ACCENT.indigo,
                color: "#fff",
                fontSize: u(8),
                fontWeight: 700,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              R
            </span>
            <div style={bubble(false)}>
              Before I answer — which quadrant is 150° in, and what does that tell you about the sign of <em>y</em>?
            </div>
          </div>
        </div>

        <div
          style={{
            marginTop: "auto",
            display: "flex",
            alignItems: "center",
            gap: u(8),
            background: t.cardBg,
            border: `1px solid ${t.inputBorder}`,
            borderRadius: u(999),
            padding: `${u(7)} ${u(10)}`,
          }}
        >
          <span style={{ fontSize: u(9.5), color: t.inputPlaceholder }}>Ask the room…</span>
          <span style={{ marginLeft: "auto", width: u(18), height: u(18), borderRadius: u(999), background: t.ctaBg, flex: "none" }} />
        </div>
      </div>
    </ShotFrame>
  );
}

/* ───────────────────────── Challenges & Tools ───────────────────────── */

const OPTIONS: { label: string; state: "right" | "idle" }[] = [
  { label: "It releases oxygen as a by-product", state: "right" },
  { label: "It consumes oxygen and stores it", state: "idle" },
  { label: "It produces neither", state: "idle" },
];

const FORMATS = ["Quiz", "Summary", "Flashcards", "Mind map"];

/** A quiz generated from an uploaded lesson, plus the other formats the same
 *  file yields — the section's claim, drawn as its output. */
export function ToolsShot({ theme: t }: { theme: Theme }) {
  return (
    <ShotFrame theme={t} ratio="16 / 10">
      <div style={{ position: "absolute", inset: 0, padding: u(16), display: "flex", flexDirection: "column", gap: u(9) }}>
        <div style={{ display: "flex", alignItems: "center", gap: u(7) }}>
          <span style={{ width: u(14), height: u(16), borderRadius: u(3), background: ACCENT.green, flex: "none" }} />
          <span style={{ fontSize: u(10), color: t.text, fontWeight: 600 }}>Photosynthesis — lesson 4.pdf</span>
          <span
            style={{
              marginLeft: "auto",
              fontSize: u(8.5),
              fontWeight: 600,
              color: t.greenText,
              background: t.greenBg,
              border: `1px solid ${t.greenBorder}`,
              borderRadius: u(999),
              padding: `${u(2.5)} ${u(7)}`,
            }}
          >
            Generated
          </span>
        </div>

        <div style={{ ...panel(t, u(12), u(12)), display: "flex", flexDirection: "column", gap: u(7) }}>
          <div style={{ fontSize: u(8.5), fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: t.muted }}>
            Question 3 of 8
          </div>
          <div style={{ fontSize: u(11), fontWeight: 600, color: t.text, lineHeight: 1.4 }}>
            What happens to oxygen during photosynthesis?
          </div>
          {OPTIONS.map((o) => {
            const right = o.state === "right";
            return (
              <div
                key={o.label}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: u(7),
                  borderRadius: u(9),
                  padding: `${u(6)} ${u(8)}`,
                  fontSize: u(9.5),
                  color: right ? t.greenText : t.muted,
                  background: right ? t.greenBg : t.inputFieldBg,
                  border: `1px solid ${right ? t.greenBorder : "transparent"}`,
                }}
              >
                <span
                  style={{
                    flex: "none",
                    width: u(12),
                    height: u(12),
                    borderRadius: u(999),
                    border: `${u(1.5)} solid ${right ? ACCENT.green : t.inputBorder}`,
                    background: right ? ACCENT.green : "transparent",
                  }}
                />
                {o.label}
              </div>
            );
          })}
        </div>

        <div style={{ marginTop: "auto", display: "flex", gap: u(5), flexWrap: "wrap" }}>
          {FORMATS.map((f, i) => (
            <span
              key={f}
              style={{
                fontSize: u(9),
                fontWeight: 500,
                borderRadius: u(999),
                padding: `${u(4)} ${u(9)}`,
                color: i === 0 ? t.ctaText : t.muted,
                background: i === 0 ? t.ctaBg : t.cardBg,
                border: `1px solid ${i === 0 ? "transparent" : t.cardBorder}`,
              }}
            >
              {f}
            </span>
          ))}
        </div>
      </div>
    </ShotFrame>
  );
}

/* ───────────────────────── The Socratic ladder ───────────────────────── */

const TURNS: { rung: string; who: "raya" | "student"; text: string; tone: string }[] = [
  { rung: "Pump", who: "raya", text: "Before anything else — what do you already know about how limits behave near a hole?", tone: ACCENT.indigo },
  { rung: "Student", who: "student", text: "I tried factoring but I still get 0/0.", tone: "" },
  { rung: "Hint", who: "raya", text: "That 0/0 is the clue, not the dead end. What does it tell you about a shared factor?", tone: ACCENT.blue },
  { rung: "Assertion", who: "raya", text: "The missing piece: cancel (x − 3) first, then substitute. Now try it.", tone: ACCENT.green },
];

/**
 * The escalation policy as an actual transcript. The rungs a visitor just read
 * about are labelled on the turns that use them, so the claim "it never opens
 * with the answer" is visible rather than asserted.
 */
export function SocraticShot({ theme: t }: { theme: Theme }) {
  return (
    <ShotFrame theme={t} ratio="21 / 9" className="pub-shot-wide">
      <div
        className="pub-shot-grid"
        style={{ position: "absolute", inset: 0, display: "grid", gridTemplateColumns: "1.55fr 1fr", gap: uw(18), padding: uw(22) }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: uw(9), minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: uw(8), marginBottom: uw(2) }}>
            <span
              style={{
                width: uw(26),
                height: uw(26),
                borderRadius: uw(999),
                background: ACCENT.indigo,
                color: "#fff",
                fontSize: uw(11),
                fontWeight: 700,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flex: "none",
              }}
            >
              R
            </span>
            <span style={{ fontSize: uw(15), fontWeight: 700, color: t.text, letterSpacing: "-0.01em" }}>
              <RayaName /> · limits of a rational function
            </span>
          </div>

          {TURNS.map((turn) => {
            const own = turn.who === "student";
            return (
              <div key={turn.text} style={{ display: "flex", flexDirection: "column", alignItems: own ? "flex-end" : "flex-start", gap: uw(4) }}>
                <span
                  style={{
                    fontSize: uw(9),
                    fontWeight: 700,
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                    color: own ? t.muted : turn.tone,
                  }}
                >
                  {turn.rung}
                </span>
                <div
                  style={{
                    maxWidth: "84%",
                    background: own ? t.ctaBg : t.cardBg,
                    color: own ? t.ctaText : t.text,
                    border: own ? "none" : `1px solid ${t.cardBorder}`,
                    borderLeft: own ? "none" : `${uw(3)} solid ${turn.tone}`,
                    borderRadius: uw(12),
                    padding: `${uw(9)} ${uw(13)}`,
                    fontSize: uw(12),
                    lineHeight: 1.55,
                  }}
                >
                  {turn.text}
                </div>
              </div>
            );
          })}
        </div>

        <div className="pub-shot-aside" style={{ ...panel(t, uw(16), uw(16)), display: "flex", flexDirection: "column", gap: uw(12), minWidth: 0 }}>
          <div style={{ fontSize: uw(10), fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: t.muted }}>
            Escalation
          </div>
          {[
            { n: "01", name: "Pump", done: true, tone: ACCENT.indigo },
            { n: "02", name: "Hint", done: true, tone: ACCENT.blue },
            { n: "03", name: "Assertion", done: true, tone: ACCENT.green },
            { n: "04", name: "Summary", done: false, tone: t.muted },
          ].map((r) => (
            <div key={r.n} style={{ display: "flex", alignItems: "center", gap: uw(9) }}>
              <span
                style={{
                  flex: "none",
                  width: uw(22),
                  height: uw(22),
                  borderRadius: uw(999),
                  fontSize: uw(9),
                  fontWeight: 700,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: r.done ? "#fff" : t.muted,
                  background: r.done ? r.tone : "transparent",
                  border: r.done ? "none" : `${uw(1.5)} dashed ${t.inputBorder}`,
                }}
              >
                {r.n}
              </span>
              <span style={{ fontSize: uw(12), fontWeight: r.done ? 600 : 400, color: r.done ? t.text : t.muted }}>{r.name}</span>
              {r.done && <span style={{ marginLeft: "auto", fontSize: uw(11), color: r.tone }}>✓</span>}
            </div>
          ))}
          {/* Pinned to the bottom, with a rule above it so the slack between
              the rungs and the footnote reads as a panel foot rather than as a
              gap someone forgot to close. */}
          <div style={{ marginTop: "auto", paddingTop: uw(12), borderTop: `1px solid ${t.cardBorder}`, fontSize: uw(10.5), lineHeight: 1.5, color: t.muted }}>
            Never opens above rung 1. Escalates only after a real attempt.
          </div>
        </div>
      </div>
    </ShotFrame>
  );
}
