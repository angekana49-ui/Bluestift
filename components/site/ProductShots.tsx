"use client";

import { createContext, useContext, useEffect, useRef, useState, type CSSProperties } from "react";
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

/* ───────────────────────── Choreography ───────────────────────── */

/**
 * Stagger helper: an inline `--d` the stylesheet reads as an animation-delay.
 * Writing the sequence as numbers at the call site keeps each shot's timing
 * readable as a score — you can see the beats without cross-referencing CSS.
 */
const at = (ms: number) => ({ "--d": `${ms}ms` }) as CSSProperties;

/** True once the surrounding shot has started playing. Only ever true when
 *  motion is allowed, so consumers can treat it as "animate now". */
const ShotLive = createContext(false);

/**
 * Drives one shot's entrance.
 *
 * Returns the ref to attach and whether the sequence is running. The contract
 * mirrors site/Reveal.tsx deliberately: the animated start state is opt-IN, so
 * a visitor with reduced motion, without IntersectionObserver, or looking at a
 * shot that was already on screen at mount sees the finished composition —
 * never a frame of hidden content waiting for an observer that will not fire.
 */
function useShotSequence() {
  const ref = useRef<HTMLDivElement>(null);
  const [live, setLive] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    // Already on screen: playing an entrance now would be a flash, not a reveal.
    if (el.getBoundingClientRect().top < window.innerHeight * 0.92) return;

    el.classList.add("pub-shot-anim");
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        el.classList.add("is-live");
        setLive(true);
        // One-shot: replaying on every scroll-by is what makes this cheap.
        io.disconnect();
      },
      { threshold: 0.35 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return { ref, live };
}

/**
 * A number that counts to its value as the shot plays — the detail that reads
 * as live data rather than a screenshot of it. Renders the final value
 * immediately when the sequence isn't running, so the static shot is correct.
 */
function CountUp({ to, suffix = "", delay = 0 }: { to: number; suffix?: string; delay?: number }) {
  const live = useContext(ShotLive);
  const [n, setN] = useState<number | null>(null);

  useEffect(() => {
    if (!live) return;
    let raf = 0;
    let start = 0;
    const DUR = 620;
    const tick = (now: number) => {
      if (!start) start = now;
      const p = Math.min(1, (now - start) / DUR);
      // Matches --ease-out closely enough that the number and its bar land together.
      setN(Math.round(to * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    const timer = window.setTimeout(() => {
      raf = requestAnimationFrame(tick);
    }, delay);
    return () => {
      window.clearTimeout(timer);
      cancelAnimationFrame(raf);
    };
  }, [live, to, delay]);

  return (
    <>
      {live && n !== null ? n : to}
      {suffix}
    </>
  );
}

/**
 * The aspect-ratio box every shot is drawn into. Owns the container context
 * that `u()`/`uw()` resolve against, so a shot is never rendered outside one,
 * and owns the entrance sequence for everything inside it.
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
  const { ref, live } = useShotSequence();

  return (
    <div
      ref={ref}
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
      <ShotLive.Provider value={live}>{children}</ShotLive.Provider>
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
      {/* Score: the panel arrives, the three concepts fill in sequence, and the
          blocking prerequisite lands last — the profile assembling itself in
          the order a teacher would read it. */}
      <div style={{ position: "absolute", inset: 0, padding: u(16), display: "flex", flexDirection: "column", gap: u(10) }}>
        <div className="shot-in" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
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

        <div className="shot-in" style={{ ...panel(t, u(12), u(12)), ...at(90), display: "flex", flexDirection: "column", gap: u(10) }}>
          {CONCEPTS.map((c, i) => {
            const beat = 200 + i * 130;
            return (
              <div key={c.label}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: u(4) }}>
                  <span style={{ fontSize: u(10.5), color: t.text }}>{c.label}</span>
                  <span style={{ fontSize: u(10.5), fontWeight: 700, color: ACCENT[c.tone] }}>
                    <CountUp to={c.pct} suffix="%" delay={beat} />
                  </span>
                </div>
                <div style={{ height: u(5), borderRadius: u(999), background: t.inputFieldBg, overflow: "hidden" }}>
                  <div
                    className="shot-bar"
                    style={{ ...at(beat), width: `${c.pct}%`, height: "100%", borderRadius: u(999), background: ACCENT[c.tone] }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        <div
          className="shot-in"
          style={{
            ...at(700),
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
      {/* Score: the room header, then the shared document, then the exchange —
          the student asking before Raya answers, which is the whole claim. */}
      <div style={{ position: "absolute", inset: 0, padding: u(16), display: "flex", flexDirection: "column", gap: u(10) }}>
        <div className="shot-in" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: u(6) }}>
            <span className="pub-shot-live-dot" style={{ width: u(6), height: u(6), borderRadius: u(999), background: ACCENT.green }} />
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
          className="shot-in"
          style={{
            ...at(110),
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
          <div className="shot-in" style={{ ...at(260), ...bubble(true) }}>
            Why is sin(150°) positive if 150° isn&apos;t in the first quadrant?
          </div>
          <div className="shot-in" style={{ ...at(560), display: "flex", gap: u(7), alignItems: "flex-end" }}>
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
          className="shot-in"
          style={{
            ...at(760),
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
      {/* Score: the source file, the question it produced, then the options —
          with the correct one landing last, on the sequence's one emphasised
          beat. Generation, shown in the order it happens. */}
      <div style={{ position: "absolute", inset: 0, padding: u(16), display: "flex", flexDirection: "column", gap: u(9) }}>
        <div className="shot-in" style={{ display: "flex", alignItems: "center", gap: u(7) }}>
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

        <div className="shot-in" style={{ ...at(110), ...panel(t, u(12), u(12)), display: "flex", flexDirection: "column", gap: u(7) }}>
          <div className="shot-in" style={{ ...at(220), fontSize: u(8.5), fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: t.muted }}>
            Question 3 of 8
          </div>
          <div className="shot-in" style={{ ...at(300), fontSize: u(11), fontWeight: 600, color: t.text, lineHeight: 1.4 }}>
            What happens to oxygen during photosynthesis?
          </div>
          {OPTIONS.map((o, i) => {
            const right = o.state === "right";
            // The wrong options arrive first; the answer resolves after them.
            const beat = right ? 420 + OPTIONS.length * 90 : 420 + i * 90;
            return (
              <div
                key={o.label}
                className={right ? "shot-pick" : "shot-in"}
                style={{
                  ...at(beat),
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
              className="shot-in"
              style={{
                ...at(880 + i * 70),
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

/**
 * When turn `i` lands. Slow enough to read as a conversation replaying rather
 * than a list appearing — this sequence IS the argument the section makes, so
 * it's the one place on the site worth spending a second and a half.
 */
const turnBeat = (i: number) => 140 + i * 340;
/** A rung ticks just after the turn that used it, never before. */
const rungBeat = (turnIndex: number) => turnBeat(turnIndex) + 200;

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
          <div className="shot-in" style={{ display: "flex", alignItems: "center", gap: uw(8), marginBottom: uw(2) }}>
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

          {TURNS.map((turn, i) => {
            const own = turn.who === "student";
            return (
              <div
                key={turn.text}
                className="shot-in"
                style={{ ...at(turnBeat(i)), display: "flex", flexDirection: "column", alignItems: own ? "flex-end" : "flex-start", gap: uw(4) }}
              >
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
          <div className="shot-in" style={{ fontSize: uw(10), fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: t.muted }}>
            Escalation
          </div>
          {/* Each rung is timed to the turn that used it (TURNS index), so the
              panel ticks in step with the transcript instead of running its own
              unrelated animation next to it. */}
          {[
            { n: "01", name: "Pump", done: true, tone: ACCENT.indigo, beat: rungBeat(0) },
            { n: "02", name: "Hint", done: true, tone: ACCENT.blue, beat: rungBeat(2) },
            { n: "03", name: "Assertion", done: true, tone: ACCENT.green, beat: rungBeat(3) },
            { n: "04", name: "Summary", done: false, tone: t.muted, beat: rungBeat(3) + 180 },
          ].map((r) => (
            <div key={r.n} className="shot-in" style={{ ...at(r.beat), display: "flex", alignItems: "center", gap: uw(9) }}>
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
          <div
            className="shot-in"
            style={{ ...at(rungBeat(3) + 320), marginTop: "auto", paddingTop: uw(12), borderTop: `1px solid ${t.cardBorder}`, fontSize: uw(10.5), lineHeight: 1.5, color: t.muted }}
          >
            Never opens above rung 1. Escalates only after a real attempt.
          </div>
        </div>
      </div>
    </ShotFrame>
  );
}
