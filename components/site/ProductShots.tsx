"use client";

import { createContext, useContext, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import type { Theme } from "./theme";
import { RayaName } from "@/components/ui/brand";
// The app's own icons, not a second set drawn for the site. They take a `style`
// that lands after the `width`/`height` attributes, which is what lets a shot
// size them in `u()` like everything else instead of pinning them to raw px.
import {
  IconAiMode,
  IconAttach,
  IconChat,
  IconChevron,
  IconFile,
  IconFlashcards,
  IconKernel,
  IconMic,
  IconPanel,
  IconQuiz,
  IconRooms,
  IconSettings,
  IconSummary,
  IconTools,
} from "@/components/ui/icons";

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

/** Either scale. The shared helpers below take one so a wide-plate shot can
 *  use them without falling back to the 400-wide scale and rendering at 2×. */
type Unit = (n: number) => string;

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
 *
 * `loopMs` replays the whole sequence on that cycle, and exists for one case:
 * a shot the page holds on screen far longer than the sequence lasts. The
 * ladder pins each rung card for most of a scroll, so a two-second exchange
 * played once is over before the card is even read — a still is what the
 * visitor gets. Looping there is the session running, not decoration, and it
 * stops the moment the shot leaves the viewport rather than burning frames
 * behind the fold.
 */
function useShotSequence(loopMs?: number) {
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
    let timer = 0;
    const io = new IntersectionObserver(
      (entries) => {
        const onScreen = entries.some((e) => e.isIntersecting);
        if (!onScreen) {
          // Out of view: hold the finished state and stop the clock.
          window.clearInterval(timer);
          timer = 0;
          return;
        }
        el.classList.add("is-live");
        setLive(true);
        if (!loopMs) {
          // One-shot: replaying on every scroll-by is what makes this cheap.
          io.disconnect();
          return;
        }
        if (timer) return;
        timer = window.setInterval(() => {
          // Every animation inside is scoped to `.is-live`, so dropping the
          // class rewinds all of them at once. The offsetWidth read between
          // the two writes is load-bearing: without it the browser coalesces
          // them into no change at all and nothing restarts.
          el.classList.remove("is-live");
          void el.offsetWidth;
          el.classList.add("is-live");
        }, loopMs);
      },
      { threshold: 0.35 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      window.clearInterval(timer);
    };
  }, [loopMs]);

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
  loopMs,
  children,
}: {
  theme: Theme;
  ratio: string;
  className?: string;
  /** Replay the sequence on this cycle while on screen. See useShotSequence. */
  loopMs?: number;
  children: React.ReactNode;
}) {
  const { ref, live } = useShotSequence(loopMs);

  return (
    <div
      ref={ref}
      className={className ? `pub-shot ${className}` : "pub-shot"}
      style={{
        containerType: "inline-size",
        position: "relative",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        // A shot is a window onto the app, so it carries the app's own page
        // tint rather than the marketing card's white.
        background: t.dark
          ? "linear-gradient(160deg,#0f1930 0%,#0b1324 100%)"
          : "linear-gradient(160deg,#f7fafd 0%,#eef3f9 100%)",
        borderBottom: `1px solid ${t.cardBorder}`,
      }}
    >
      {/* The window rail. Everything else in this file scales with the card via
          u()/uw(); this deliberately does not, and is the one place raw px is
          correct here. Chrome is not part of the composition — a real window's
          title bar is the same height whether the window is wide or narrow, and
          a rail that grew with the card would immediately read as drawn.
          It costs no composition, either: `ratio` is declared on the screen
          below rather than on this frame, so the rail ADDS its 24px to the
          shot's height instead of taking them out of the drawing. Putting the
          ratio on the frame is the obvious version and it is wrong — every
          length inside a shot is width-derived, so the composition's height is
          intrinsic, and a frame 24px shorter simply clips the last row off. */}
      <div
        aria-hidden
        style={{
          display: "flex",
          alignItems: "center",
          gap: 5,
          height: 24,
          flex: "none",
          padding: "0 9px",
          borderTop: "none",
          borderRight: "none",
          borderLeft: "none",
          borderBottom: `1px solid ${t.dark ? "rgba(255,255,255,0.06)" : "rgba(15,23,42,0.05)"}`,
        }}
      >
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: t.dark ? "rgba(255,255,255,0.16)" : "rgba(15,23,42,0.12)",
            }}
          />
        ))}
      </div>

      <div className="pub-shot-screen" style={{ position: "relative", aspectRatio: ratio }}>
        <ShotLive.Provider value={live}>{children}</ShotLive.Provider>
      </div>
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

/** The ghost button the app's rows use for a secondary action. */
const ghostPill = (t: Theme): React.CSSProperties => ({
  flex: "none",
  fontSize: u(8.5),
  fontWeight: 600,
  color: t.muted,
  background: "transparent",
  border: `1px solid ${t.inputBorder}`,
  borderRadius: u(999),
  padding: `${u(2.5)} ${u(8)}`,
});

/**
 * A status pill in one of the app's three tones.
 *
 * Every side is set individually rather than `border` plus a `borderColor`
 * override: React warns when a shorthand and a longhand for the same property
 * both change across a rerender — which the theme toggle does — and which of
 * the two lands is not guaranteed.
 */
function tonePill(t: Theme, tone: "green" | "orange" | "neutral"): React.CSSProperties {
  const face =
    tone === "green"
      ? { color: t.greenText, background: t.greenBg, edge: t.greenBorder }
      : tone === "orange"
        ? { color: t.orangeText, background: t.orangeBg, edge: t.orangeBorder }
        : { color: t.muted, background: "transparent", edge: t.inputBorder };
  return {
    flex: "none",
    fontSize: u(8.5),
    fontWeight: 600,
    color: face.color,
    background: face.background,
    borderTop: `1px solid ${face.edge}`,
    borderRight: `1px solid ${face.edge}`,
    borderBottom: `1px solid ${face.edge}`,
    borderLeft: `1px solid ${face.edge}`,
    borderRadius: u(999),
    padding: `${u(2.5)} ${u(8)}`,
  };
}

/**
 * A placeholder bar, for the frame or two before its row resolves.
 * Only ever rendered inside `<Resolving>`, i.e. only while a sequence runs.
 */
function Skel({ theme: t, w, h = 8, unit = u }: { theme: Theme; w: string; h?: number; unit?: Unit }) {
  return (
    <span
      style={{
        display: "block",
        width: w,
        height: unit(h),
        borderRadius: unit(999),
        background: t.dark ? "rgba(255,255,255,0.09)" : "rgba(15,23,42,0.07)",
      }}
    />
  );
}

/**
 * Loading, then loaded — the two states stacked in one grid cell so the second
 * replaces the first in place, with no reflow and no gap opening under it.
 *
 * Both children share the same beat: the placeholder fades out exactly as the
 * content fades in. `placeholder` disappears entirely outside a running
 * sequence (see `.shot-out` in globals.css), so the resting composition is the
 * finished one — a skeleton is never the thing a visitor is left looking at.
 */
function Resolving({ delay, placeholder, children }: { delay: number; placeholder: ReactNode; children: ReactNode }) {
  return (
    <div style={{ display: "grid" }}>
      <div className="shot-out" style={{ ...at(delay), gridArea: "1 / 1", alignSelf: "center" }}>
        {placeholder}
      </div>
      <div className="shot-in" style={{ ...at(delay), gridArea: "1 / 1" }}>
        {children}
      </div>
    </div>
  );
}

/** Raya's composing dots — the beat that makes a transcript read as a session
 *  running rather than a screenshot of one. */
function Composing({ theme: t, unit = u }: { theme: Theme; unit?: Unit }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: unit(3),
        background: t.cardBg,
        border: `1px solid ${t.cardBorder}`,
        borderRadius: unit(999),
        padding: `${unit(6)} ${unit(9)}`,
      }}
    >
      {[0, 1, 2].map((d) => (
        <span
          key={d}
          className="shot-dot"
          style={{ width: unit(4), height: unit(4), borderRadius: unit(999), background: t.mutedLight, animationDelay: `${d * 180}ms` }}
        />
      ))}
    </span>
  );
}

/** Milliseconds between two streamed words. Slow enough to be read as arriving,
 *  fast enough that a long reply doesn't outlast the pause after it. */
const WORD_STEP = 34;

/** How long a reply of this text takes to finish streaming. */
const streamMs = (text: string) => text.trim().split(/\s+/).length * WORD_STEP;

/**
 * Raya's reply painting itself in, one word at a time, from `from`.
 *
 * The app streams her tokens and renders them as they land, so a bubble that
 * appears whole is the one part of this surface a screenshot gets wrong. The
 * student's messages deliberately don't use this: theirs is typed and sent
 * complete, and that asymmetry is what makes the exchange read as a session
 * between two parties rather than as text being replayed.
 */
function Streamed({ text, from }: { text: string; from: number }) {
  return (
    <>
      {text.split(" ").map((w, i) => (
        // The space rides inside the span so it fades with the word it belongs
        // to; a bare space between two spans would sit there ahead of both.
        <span key={`${i}-${w}`} className="shot-word" style={at(from + i * WORD_STEP)}>
          {i > 0 ? " " : ""}
          {w}
        </span>
      ))}
    </>
  );
}

/* ───────────────────────── Cognitive Kernel ───────────────────────── */

/**
 * `KCStatus` → its label and colour, verbatim from components/cognitive-profile.tsx.
 * (`unknown` / "New" exists too; a shot showing three tracked concepts has no
 * untouched one to put it on.)
 */
const KC_STATUS = {
  mastered: { label: "Mastered", color: "#22c55e" },
  partial: { label: "In progress", color: "#f59e0b" },
  gap: { label: "To work on", color: "#ef4444" },
} as const;

/**
 * The Kernel's three axes. A concept is never one number in this product —
 * knowing it, retaining it and applying it are measured apart, and the gap
 * between them is the diagnosis. Colours are the app's.
 */
const AXES: { key: "k" | "v" | "p"; label: string; color: string }[] = [
  { key: "k", label: "Knowledge (K)", color: "#2f7fe0" },
  { key: "v", label: "Retention (V)", color: "#8b5cf6" },
  { key: "p", label: "Application (P)", color: "#06b6d4" },
];

const CONCEPTS: { label: string; status: keyof typeof KC_STATUS; last: string; k: number; v: number; p: number }[] = [
  { label: "The unit circle", status: "mastered", last: "2 days ago", k: 91, v: 84, p: 88 },
  { label: "Photosynthesis", status: "partial", last: "yesterday", k: 72, v: 55, p: 61 },
  // The one that matters: known on paper, gone a week later, unusable in a
  // problem. A single grade averages those three into one reassuring number.
  { label: "Dividing fractions", status: "gap", last: "today", k: 34, v: 21, p: 29 },
];

const OVERALL = 68;
const MINDSET_M = 74;

/**
 * The learner's own profile page (components/cognitive-profile.tsx), drawn as
 * it renders: the overall-mastery gauge and the mindset panel across the top,
 * then one card per concept carrying K, V and P and the status the Kernel
 * assigned it. The gauge is the app's `MasteryGauge` geometry — the same
 * 160×96 arc, the same 188-unit dash, the same four-stop gradient.
 */
export function KernelShot({ theme: t }: { theme: Theme }) {
  const axisRow = (label: string, value: number, color: string, beat: number) => (
    <div key={label} style={{ display: "flex", alignItems: "center", gap: u(5) }}>
      <span style={{ flex: "none", width: u(48), fontSize: u(7.5), color: t.muted }}>{label}</span>
      <span style={{ flex: 1, height: u(3.5), borderRadius: u(999), background: t.inputFieldBg, overflow: "hidden" }}>
        <span className="shot-bar" style={{ ...at(beat), display: "block", width: `${value}%`, height: "100%", background: color }} />
      </span>
      <span style={{ flex: "none", width: u(18), textAlign: "right", fontSize: u(7.5), color: t.muted }}>
        <CountUp to={value} suffix="%" delay={beat} />
      </span>
    </div>
  );

  return (
    <ShotFrame theme={t} ratio="4 / 3">
      {/* Score: the gauge and the mindset land first, then each concept card
          resolves out of its placeholder and fills its three axes — the profile
          assembling itself the way it actually loads. */}
      <div style={{ position: "absolute", inset: 0, padding: u(11), display: "flex", flexDirection: "column", gap: u(5) }}>
        <div className="shot-in" style={{ display: "flex", alignItems: "center", gap: u(8) }}>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: "block", fontSize: u(11.5), fontWeight: 700, color: t.text, letterSpacing: "-0.01em" }}>
              Your profile
            </span>
            <span style={{ display: "block", fontSize: u(8), color: t.muted }}>14 concepts · 4 subjects</span>
          </span>
          <span style={tonePill(t, "green")}>Live</span>
        </div>

        {/* The two panels the profile opens with: overall mastery, and mindset. */}
        <div style={{ display: "grid", gridTemplateColumns: `${u(70)} 1fr`, gap: u(5) }}>
          <div className="shot-in" style={{ ...at(90), ...panel(t, u(9), u(6)) }}>
            <div style={{ fontSize: u(8), fontWeight: 700, color: t.text, marginBottom: u(2) }}>Overall mastery</div>
            {/* viewBox-scaled, so it needs no u() — it tracks its own box. */}
            <svg viewBox="0 0 160 96" style={{ width: "100%", display: "block" }} aria-hidden>
              <defs>
                <linearGradient id="pubKernelGauge" x1="0" x2="1">
                  <stop offset="0%" stopColor="#f97316" />
                  <stop offset="45%" stopColor="#fbbf24" />
                  <stop offset="75%" stopColor="#84cc16" />
                  <stop offset="100%" stopColor="#22c55e" />
                </linearGradient>
              </defs>
              <path d="M 20 84 A 60 60 0 0 1 140 84" fill="none" stroke={t.inputFieldBg} strokeWidth="12" strokeLinecap="round" />
              <path
                d="M 20 84 A 60 60 0 0 1 140 84"
                fill="none"
                stroke="url(#pubKernelGauge)"
                strokeWidth="12"
                strokeLinecap="round"
                strokeDasharray="188"
                strokeDashoffset={Math.round(188 * (1 - OVERALL / 100))}
              />
              <text x="80" y="66" textAnchor="middle" fontSize="20" fontWeight="700" fill={t.text}>
                {OVERALL}%
              </text>
              <text x="80" y="80" textAnchor="middle" fontSize="8" fill={t.mutedLight}>
                all concepts
              </text>
            </svg>
          </div>

          <div className="shot-in" style={{ ...at(150), ...panel(t, u(9), u(7)), display: "flex", flexDirection: "column", gap: u(5) }}>
            <div style={{ display: "flex", alignItems: "center", gap: u(6) }}>
              <span style={{ flex: 1, fontSize: u(9), fontWeight: 700, color: t.text }}>Mindset (M)</span>
              <span style={{ fontSize: u(8.5), color: t.muted }}>Growth</span>
            </div>
            {axisRow("Growth", MINDSET_M, ACCENT.green, 260)}
            <div style={{ fontSize: u(7.5), color: t.mutedLight }}>Keeps going after a wrong answer.</div>
          </div>
        </div>

        {/* One card per tracked concept — the body of the page. */}
        {CONCEPTS.map((c, i) => {
          const st = KC_STATUS[c.status];
          const beat = 360 + i * 190;
          return (
            <Resolving
              key={c.label}
              delay={beat}
              placeholder={
                <div style={{ ...panel(t, u(9), u(6)), display: "flex", flexDirection: "column", gap: u(4) }}>
                  <Skel theme={t} w={`${52 - i * 6}%`} h={7} />
                  <Skel theme={t} w="100%" h={3.5} />
                  <Skel theme={t} w="100%" h={3.5} />
                  <Skel theme={t} w="100%" h={3.5} />
                </div>
              }
            >
              <div style={{ ...panel(t, u(9), u(6)), display: "flex", flexDirection: "column", gap: u(3) }}>
                <div style={{ display: "flex", alignItems: "center", gap: u(6) }}>
                  <span style={{ flex: 1, minWidth: 0, fontSize: u(9.5), fontWeight: 700, color: t.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {c.label}
                  </span>
                  <span style={{ fontSize: u(7.5), color: t.mutedLight }}>practised {c.last}</span>
                  <span
                    style={{
                      flex: "none",
                      background: st.color,
                      color: "#0b1020",
                      borderRadius: u(999),
                      padding: `${u(1.5)} ${u(7)}`,
                      fontSize: u(7.5),
                      fontWeight: 600,
                    }}
                  >
                    {st.label}
                  </span>
                </div>
                {AXES.map((a, j) => axisRow(a.label, c[a.key], a.color, beat + 90 + j * 70))}
              </div>
            </Resolving>
          );
        })}
      </div>
    </ShotFrame>
  );
}

/* ───────────────────────── Study Rooms ───────────────────────── */

/** The room's five channels, in the app's own order. */
const ROOM_TABS = ["Group chat", "Raya (private)", "Challenges", "Files", "Report"];

/** The roster, as the right panel lists it — Raya first, then the members. */
const ROOM_MEMBERS = [
  { initials: "AS", name: "Amira S.", bg: "#4f46e5", online: true },
  { initials: "LD", name: "Léa D.", bg: "#0ea5e9", online: true },
  { initials: "NK", name: "Noah K.", bg: "#10b981", online: true },
  { initials: "YO", name: "You", bg: "#f97316", online: true },
  { initials: "TB", name: "Tomás B.", bg: "#8b5cf6", online: false },
];

/**
 * The group channel, five people deep. Three members, Raya and a shared
 * document — the point being that nobody here is alone with a private AI, so
 * the drawing has to have more than one student in it.
 */
const ROOM_TURNS: { who: "other" | "me" | "raya"; name: string; text: string }[] = [
  { who: "other", name: "Léa D.", text: "I get sin(150°) = 0.5 but I can't say why it's positive." },
  { who: "me", name: "You", text: "Second quadrant, right?" },
  { who: "raya", name: "Raya", text: "It is — so you have the hard part. What's the sign of y there, and which ratio uses y?" },
  { who: "other", name: "Noah K.", text: "y is above the axis, so sine stays positive." },
];

const roomBeat = (i: number) => 420 + i * 340;

/**
 * A room mid-session (components/room-view.tsx + rooms/room-group-chat.tsx):
 * the real chrome — title, subject, member count, session timer — the five
 * channels, and the group thread with per-sender name labels and Raya
 * answering the room rather than one student in a private corner.
 */
export function RoomShot({ theme: t }: { theme: Theme }) {
  // The three bubble tones the room uses — mine, another member's, Raya's —
  // with the app's asymmetric corner radii.
  const bubble = (kind: "me" | "other" | "raya"): CSSProperties => ({
    minWidth: 0,
    maxWidth: "100%",
    background: kind === "me" ? t.ctaBg : kind === "raya" ? t.cardBg : t.inputFieldBg,
    color: kind === "me" ? t.ctaText : t.text,
    borderTop: kind === "raya" ? `1px solid ${t.cardBorder}` : "none",
    borderRight: kind === "raya" ? `1px solid ${t.cardBorder}` : "none",
    borderBottom: kind === "raya" ? `1px solid ${t.cardBorder}` : "none",
    borderLeft: kind === "raya" ? `1px solid ${t.cardBorder}` : "none",
    borderRadius: kind === "me" ? `${u(11)} ${u(11)} ${u(3)} ${u(11)}` : `${u(11)} ${u(11)} ${u(11)} ${u(3)}`,
    padding: `${u(6)} ${u(9)}`,
    fontSize: u(9),
    lineHeight: 1.5,
  });

  const avatar = (initials: string, bg: string) => (
    <span
      style={{
        flex: "none",
        width: u(17),
        height: u(17),
        borderRadius: u(999),
        background: bg,
        color: "#fff",
        fontSize: u(7),
        fontWeight: 700,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {initials}
    </span>
  );

  return (
    <ShotFrame theme={t} ratio="4 / 3">
      {/* Score: the chrome and the channels settle, the shared document lands,
          then the four turns play in order — with Raya composing before hers,
          so the room reads as running rather than transcribed. */}
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column" }}>
        {/* The room chrome: a solid strip pinned above the thread, exactly as
            RoomView draws it. */}
        <div
          className="shot-in"
          style={{
            flex: "none",
            background: t.cardBg,
            borderBottom: `1px solid ${t.cardBorder}`,
            padding: `${u(8)} ${u(11)} ${u(6)}`,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: u(6) }}>
            <span style={{ fontSize: u(12.5), fontWeight: 800, color: t.text, letterSpacing: "-0.01em" }}>Trigonometry</span>
            <span style={{ flex: 1, minWidth: 0, fontSize: u(8.5), color: t.muted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              Mathematics · 5 members
            </span>
            <span
              className="shot-in"
              style={{
                ...at(140),
                flex: "none",
                fontSize: u(8),
                fontWeight: 700,
                fontVariantNumeric: "tabular-nums",
                color: t.text,
                background: t.inputFieldBg,
                border: `1px solid ${t.cardBorder}`,
                borderRadius: u(999),
                padding: `${u(2)} ${u(7)}`,
              }}
            >
              ⏱ 24:31 left
            </span>
          </div>

          <div style={{ display: "flex", gap: u(4), marginTop: u(6), flexWrap: "nowrap" }}>
            {ROOM_TABS.map((c, i) => (
              <span
                key={c}
                className="shot-in"
                style={{
                  ...at(180 + i * 45),
                  flex: "none",
                  fontSize: u(7.5),
                  fontWeight: 600,
                  whiteSpace: "nowrap",
                  borderRadius: u(999),
                  padding: `${u(3)} ${u(7)}`,
                  color: i === 0 ? t.ctaText : t.text,
                  background: i === 0 ? t.ctaBg : t.cardBg,
                  border: `1px solid ${i === 0 ? "transparent" : t.cardBorder}`,
                }}
              >
                {c === "Raya (private)" ? <><RayaName /> (private)</> : c}
              </span>
            ))}
          </div>
        </div>

        {/* The thread. */}
        <div style={{ flex: 1, minHeight: 0, padding: `${u(8)} ${u(11)}`, display: "flex", flexDirection: "column", gap: u(5) }}>
          {/* A shared-document notice, livestreamed when someone uploads. */}
          <Resolving
            delay={380}
            placeholder={<div style={{ display: "flex", justifyContent: "center" }}><Skel theme={t} w="62%" h={11} /></div>}
          >
            <div style={{ display: "flex", justifyContent: "center" }}>
              <span
                style={{
                  fontSize: u(7.5),
                  color: t.muted,
                  background: t.cardBg,
                  border: `1px solid ${t.cardBorder}`,
                  borderRadius: u(999),
                  padding: `${u(3)} ${u(9)}`,
                }}
              >
                📄 Amira S. shared a document: <strong style={{ color: t.text }}>Chapter 6 — The unit circle.pdf</strong>
              </span>
            </div>
          </Resolving>

          {ROOM_TURNS.map((m, i) => {
            const mine = m.who === "me";
            const who = ROOM_MEMBERS.find((x) => x.name === m.name);
            const row = (
              <div
                style={{
                  display: "flex",
                  gap: u(5),
                  alignItems: "flex-end",
                  alignSelf: mine ? "flex-end" : "flex-start",
                  flexDirection: mine ? "row-reverse" : "row",
                  maxWidth: "88%",
                }}
              >
                {m.who === "raya" ? avatar("R", ACCENT.indigo) : avatar(who?.initials ?? "", who?.bg ?? t.muted)}
                <div style={{ display: "flex", flexDirection: "column", alignItems: mine ? "flex-end" : "flex-start", gap: u(2), minWidth: 0 }}>
                  <span style={{ fontSize: u(7), color: t.mutedLight }}>
                    {m.who === "raya" ? <RayaName /> : m.name}
                  </span>
                  <div style={bubble(m.who)}>{m.text}</div>
                </div>
              </div>
            );
            return m.who === "raya" ? (
              <Resolving
                key={m.text}
                delay={roomBeat(i)}
                placeholder={
                  <div style={{ display: "flex", gap: u(5), alignItems: "flex-end" }}>
                    {avatar("R", ACCENT.indigo)}
                    <Composing theme={t} />
                  </div>
                }
              >
                {row}
              </Resolving>
            ) : (
              <div key={m.text} className="shot-in" style={{ ...at(roomBeat(i)), display: "flex" , flexDirection: "column" }}>
                {row}
              </div>
            );
          })}

          {/* The composer, with the action that makes this a room and not a
              chat: bringing Raya in is something a member does on purpose. */}
          <div className="shot-in" style={{ ...at(roomBeat(4)), marginTop: "auto", display: "flex", alignItems: "center", gap: u(5) }}>
            <span
              style={{
                flex: 1,
                minWidth: 0,
                background: t.cardBg,
                border: `1px solid ${t.inputBorder}`,
                borderRadius: u(999),
                padding: `${u(6)} ${u(10)}`,
                fontSize: u(8.5),
                color: t.inputPlaceholder,
              }}
            >
              Message the room…
            </span>
            <span style={{ ...ghostPill(t), color: t.text, padding: `${u(5)} ${u(9)}` }}>
              Ask <RayaName />
            </span>
          </div>
        </div>
      </div>
    </ShotFrame>
  );
}

/* ───────────────────────── Challenges & Tools ───────────────────────── */

/**
 * The four ready tools, in the app's own order. `mind_map` has no icon of its
 * own in components/ui/icons — the real picker falls back to IconSummary for
 * it, so this does too rather than inventing a glyph the app doesn't have.
 */
const TOOLS: { id: string; label: string; Icon: typeof IconSummary }[] = [
  { id: "summary", label: "Summary", Icon: IconSummary },
  { id: "quiz", label: "Quiz (MCQ)", Icon: IconQuiz },
  { id: "flashcards", label: "Flashcards", Icon: IconFlashcards },
  { id: "mind_map", label: "Mind map", Icon: IconSummary },
];

/** The packet being generated from: several files combine into one source. */
const SOURCES = ["Photosynthesis — lesson 4.pdf", "Cell respiration.docx", "Lab notes 12 Mar.m4a"];

/**
 * The library underneath. `label` is the tool name and `meta` is the date —
 * or the status, while a row is still generating, which is exactly what the
 * real `LibraryRow` shows and what lets one row here resolve on its own beat.
 */
const LIBRARY: { label: string; meta: string; pending?: boolean }[] = [
  { label: "Quiz — Newton's laws", meta: "12 questions · 88%" },
  { label: "Flashcards — The unit circle", meta: "24 cards · 4 Mar" },
  { label: "Mind map — Le passé composé", meta: "9 branches · 2 Mar" },
  { label: "Summary — Photosynthesis, lesson 4", meta: "generating", pending: true },
];

/**
 * The Tools Studio (components/tools.tsx), drawn as it renders: pick a tool,
 * drop a lesson in, and study what comes back — with everything already made
 * sitting in the library underneath. Every attempt on any of it lands in the
 * same Kernel profile the first shot draws, which is the section's claim.
 */
export function ToolsShot({ theme: t }: { theme: Theme }) {
  return (
    <ShotFrame theme={t} ratio="4 / 3">
      {/* Score: the picker, the dropzone and its three sources, then Generate —
          and the library resolves row by row underneath, the last one arriving
          out of "generating" as the packet finishes. */}
      <div style={{ position: "absolute", inset: 0, padding: u(11), display: "flex", flexDirection: "column", gap: u(5) }}>
        <div className="shot-in">
          <div style={{ fontSize: u(12.5), fontWeight: 800, color: t.text, letterSpacing: "-0.01em" }}>Tools Studio</div>
          <div style={{ fontSize: u(8), color: t.muted, marginTop: u(1) }}>
            Generate quizzes, summaries and flashcards from any lesson.
          </div>
        </div>

        {/* The tool picker — four cards, the selected one ringed in indigo. */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: u(5) }}>
          {TOOLS.map((tool, i) => {
            const on = i === 1;
            return (
              <div
                key={tool.id}
                className="shot-in"
                style={{
                  ...at(120 + i * 70),
                  background: t.cardBg,
                  borderTop: `1px solid ${on ? ACCENT.indigo : t.cardBorder}`,
                  borderRight: `1px solid ${on ? ACCENT.indigo : t.cardBorder}`,
                  borderBottom: `1px solid ${on ? ACCENT.indigo : t.cardBorder}`,
                  borderLeft: `1px solid ${on ? ACCENT.indigo : t.cardBorder}`,
                  boxShadow: on ? `0 0 0 ${u(1)} ${ACCENT.indigo}` : "none",
                  borderRadius: u(9),
                  padding: u(7),
                }}
              >
                <span
                  style={{
                    display: "flex",
                    width: u(18),
                    height: u(18),
                    borderRadius: u(6),
                    background: t.ctaBg,
                    color: t.ctaText,
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: u(5),
                  }}
                >
                  <tool.Icon size={10} style={{ width: u(10), height: u(10) }} />
                </span>
                <span style={{ display: "block", fontSize: u(8), fontWeight: 700, color: t.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {tool.label}
                </span>
              </div>
            );
          })}
        </div>

        {/* The dropzone — multi-file, and they combine into one packet. */}
        <div
          className="shot-in"
          style={{
            ...at(410),
            borderTop: `1px dashed ${t.cardBorder}`,
            borderRight: `1px dashed ${t.cardBorder}`,
            borderBottom: `1px dashed ${t.cardBorder}`,
            borderLeft: `1px dashed ${t.cardBorder}`,
            borderRadius: u(10),
            background: t.cardBg,
            padding: `${u(6)} ${u(8)}`,
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: u(8), color: t.mutedLight, lineHeight: 1.4 }}>
            Drop one or more files (PDF, notes, Word, Excel, audio) — they combine into one packet
          </div>
          <div style={{ fontSize: u(7), color: t.mutedLight, marginTop: u(2) }}>Up to 40 MB total · 6.2 MB used</div>
        </div>

        {/* The picked sources, each removable. */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: u(4) }}>
          {SOURCES.map((s, i) => (
            <span
              key={s}
              className="shot-in"
              style={{
                ...at(500 + i * 110),
                display: "inline-flex",
                alignItems: "center",
                gap: u(5),
                background: t.cardBg,
                border: `1px solid ${t.cardBorder}`,
                borderRadius: u(999),
                padding: `${u(2.5)} ${u(3)} ${u(2.5)} ${u(8)}`,
                fontSize: u(7.5),
                color: t.text,
                maxWidth: "100%",
              }}
            >
              <span style={{ maxWidth: u(78), overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s}</span>
              <span
                style={{
                  flex: "none",
                  width: u(11),
                  height: u(11),
                  borderRadius: u(999),
                  background: t.inputFieldBg,
                  border: `1px solid ${t.cardBorder}`,
                  color: t.mutedLight,
                  fontSize: u(7),
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                ✕
              </span>
            </span>
          ))}
        </div>

        <div className="shot-in" style={{ ...at(840), display: "flex", alignItems: "center", gap: u(7) }}>
          <span
            className="shot-pick"
            style={{
              ...at(840),
              flex: "none",
              background: t.ctaBg,
              color: t.ctaText,
              borderRadius: u(999),
              padding: `${u(5)} ${u(12)}`,
              fontSize: u(8.5),
              fontWeight: 600,
            }}
          >
            Generate
          </span>
          <span style={{ fontSize: u(7.5), color: t.muted }}>Reading 3 sources…</span>
        </div>

        {/* The library. Everything already made from every lesson — and every
            attempt on it lands in the same Kernel profile. */}
        <div style={{ ...panel(t, u(10), u(7)), marginTop: "auto", display: "flex", flexDirection: "column" }}>
          <div className="shot-in" style={{ ...at(920), display: "flex", alignItems: "baseline", gap: u(5) }}>
            <span style={{ fontSize: u(9), fontWeight: 700, color: t.text }}>Generated</span>
            <span style={{ fontSize: u(7.5), fontWeight: 600, color: t.mutedLight }}>18</span>
          </div>
          {LIBRARY.map((row, i) => (
            <Resolving
              key={row.label}
              delay={980 + i * 130}
              placeholder={
                <div style={{ display: "flex", alignItems: "center", gap: u(6), padding: `${u(3)} 0`, borderTop: `1px solid ${t.cardBorder}` }}>
                  <Skel theme={t} w={`${58 - i * 6}%`} h={6} />
                  <span style={{ flex: 1 }} />
                  <Skel theme={t} w={u(28)} h={6} />
                </div>
              }
            >
              <div style={{ display: "flex", alignItems: "center", gap: u(6), padding: `${u(3)} 0`, borderTop: `1px solid ${t.cardBorder}` }}>
                <span style={{ flex: 1, minWidth: 0, fontSize: u(8.5), color: t.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {row.label}
                </span>
                <span style={{ flex: "none", fontSize: u(7.5), color: t.mutedLight }}>{row.meta}</span>
                <span style={{ ...ghostPill(t), fontSize: u(7.5), padding: `${u(2)} ${u(7)}`, opacity: row.pending ? 0.4 : 1 }}>Study</span>
              </div>
            </Resolving>
          ))}
        </div>
      </div>
    </ShotFrame>
  );
}

/* ───────────────────────── The shared loop, step by step ───────────────────────── */

/**
 * One shot per step of the thesis band — the teacher's surface, the student's,
 * then the teacher's again. Three separate drawings rather than one wide plate
 * on purpose: the section's claim is that intent travels between two people who
 * never see each other's screen, and the only honest way to show that is to
 * show BOTH screens, each in its own frame.
 *
 * Every surface below is traced from the real one:
 *  - FocusShot  → `InstructionsPanel` (components/school/class-instructions.tsx)
 *  - GuidedShot → the student's Raya turn, plus the Tools formats a lesson
 *                 yields (`FORMATS`, and the same generator ToolsShot draws)
 *  - ReturnShot → "Students to focus on" (components/school/prof-overview.tsx),
 *                 whose rows are `name · class · statusLabel · mastery`
 *
 * NOTE the student is deliberately never shown a "your teacher asked for X"
 * banner. The app has no such surface: guidance enters Raya's system prompt as
 * an ADVISORY block ("Treat these as recommendations, not commands… Integrate
 * them naturally" — lib/raya/prompt.ts), so it surfaces in what Raya ASKS.
 * Drawing the banner would be inventing a screen.
 */

/* ── Step 1 · the teacher states a focus ── */

/** The teacher's standing guidance, across their subjects. */
const INSTRUCTIONS: { text: string; subject: string; on: boolean }[] = [
  { text: "Revise the unit circle before Friday", subject: "Mathematics · Year 10", on: true },
  { text: "Push them on essay structure, not spelling", subject: "French · Year 8", on: true },
  { text: "Ask for the reasoning before the formula", subject: "Physics · Year 11", on: true },
  { text: "Go slower on molar mass", subject: "Chemistry · Year 11", on: false },
];

export function FocusShot({ theme: t }: { theme: Theme }) {
  return (
    <ShotFrame theme={t} ratio="4 / 3">
      {/* Score: the panel's rows resolve one after another out of their
          placeholders — the class's standing guidance loading — and only then
          is the new instruction composed and added. */}
      <div style={{ position: "absolute", inset: 0, padding: u(15), display: "flex", flexDirection: "column", gap: u(9) }}>
        <div className="shot-in" style={{ display: "flex", alignItems: "flex-start", gap: u(8) }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: u(12.5), fontWeight: 700, color: t.text, letterSpacing: "-0.01em" }}>
              Instructions to <RayaName />
            </div>
            <div style={{ fontSize: u(9), color: t.muted, marginTop: u(2) }}>
              Guidance only — it never gives answers away.
            </div>
          </div>
          <span style={tonePill(t, "green")}>3 active</span>
        </div>

        <div style={{ ...panel(t, u(11), u(10)), display: "flex", flexDirection: "column", gap: u(7) }}>
          {INSTRUCTIONS.map((ins, i) => (
            <Resolving
              key={ins.text}
              delay={140 + i * 150}
              placeholder={
                <div style={{ display: "flex", flexDirection: "column", gap: u(4), padding: `${u(2)} 0` }}>
                  <Skel theme={t} w={`${72 - i * 6}%`} h={7} />
                  <Skel theme={t} w="38%" h={5} />
                </div>
              }
            >
              <div style={{ display: "flex", alignItems: "center", gap: u(7), opacity: ins.on ? 1 : 0.45 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: u(9.5), color: t.text, lineHeight: 1.35 }}>{ins.text}</div>
                  <div style={{ fontSize: u(8), color: t.mutedLight, marginTop: u(1.5) }}>{ins.subject}</div>
                </div>
                <span style={ghostPill(t)}>{ins.on ? "Disable" : "Enable"}</span>
              </div>
            </Resolving>
          ))}
        </div>

        {/* The new instruction being written. The composer is the real one:
            a free-text field, a subject selector, and Add. */}
        <div className="shot-in" style={{ ...at(860), display: "flex", alignItems: "center", gap: u(6) }}>
          <span
            style={{
              flex: 1,
              minWidth: 0,
              background: t.inputFieldBg,
              border: `1px solid ${t.inputBorder}`,
              borderRadius: u(8),
              padding: `${u(6.5)} ${u(9)}`,
              fontSize: u(9.5),
              color: t.text,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            <span className="shot-in" style={{ ...at(1010), display: "inline-block" }}>
              Focus Maya on dividing fractions
            </span>
          </span>
          <span
            style={{
              flex: "none",
              background: t.inputFieldBg,
              border: `1px solid ${t.inputBorder}`,
              borderRadius: u(8),
              padding: `${u(6.5)} ${u(8)}`,
              fontSize: u(9),
              color: t.muted,
            }}
          >
            Maths ▾
          </span>
          <span
            className="shot-pick"
            style={{
              ...at(1260),
              flex: "none",
              background: t.ctaBg,
              color: t.ctaText,
              borderRadius: u(8),
              padding: `${u(6.5)} ${u(11)}`,
              fontSize: u(9),
              fontWeight: 600,
            }}
          >
            Add
          </span>
        </div>

        <div
          className="shot-in"
          style={{ ...at(1440), marginTop: "auto", paddingTop: u(8), borderTop: `1px solid ${t.cardBorder}`, fontSize: u(9), color: t.muted, lineHeight: 1.5 }}
        >
          Reaches <RayaName /> before the student&apos;s next session.
        </div>
      </div>
    </ShotFrame>
  );
}

/* ── Step 2 · the student works, and the focus is woven in ── */

const NEXT_MATERIAL: { title: string; meta: string; kind: string; tone: keyof typeof ACCENT }[] = [
  { title: "Dividing fractions", meta: "6 questions · from your lesson", kind: "Quiz", tone: "green" },
  { title: "Reciprocals & unit fractions", meta: "12 cards · spaced review", kind: "Flashcards", tone: "blue" },
];

const NEXT_FORMATS = ["Summary", "Mind map", "Practice set"];

/**
 * The exchange, four turns of it — long enough that the escalation is visible
 * rather than asserted. Raya opens by asking, the student is wrong, Raya still
 * doesn't hand over the answer, and the student gets there themselves.
 */
const TURNS_GUIDED: { who: "raya" | "student"; text: string }[] = [
  { who: "raya", text: "Before we start — when you divide by a fraction, does the answer get bigger or smaller?" },
  { who: "student", text: "Smaller… I think?" },
  { who: "raya", text: "Let's test it. 6 ÷ ½ — how many halves fit inside 6?" },
  { who: "student", text: "Twelve. Oh — it got bigger." },
];

/** When turn `i` lands, and when Raya starts composing the one after it. */
const guidedBeat = (i: number) => 200 + i * 420;

export function GuidedShot({ theme: t }: { theme: Theme }) {
  const bubble = (own: boolean): CSSProperties =>
    own
      ? {
          alignSelf: "flex-end",
          maxWidth: "78%",
          background: t.ctaBg,
          color: t.ctaText,
          borderRadius: u(10),
          padding: `${u(6.5)} ${u(10)}`,
          fontSize: u(9.5),
          lineHeight: 1.5,
        }
      : {
          alignSelf: "flex-start",
          maxWidth: "92%",
          background: t.cardBg,
          color: t.text,
          // Sides one by one rather than `border` plus a `borderLeft`
          // override: React warns when a shorthand and a longhand for the
          // same property both change across a rerender (the theme toggle
          // does exactly that), and which one lands is not guaranteed.
          borderTop: `1px solid ${t.cardBorder}`,
          borderRight: `1px solid ${t.cardBorder}`,
          borderBottom: `1px solid ${t.cardBorder}`,
          borderLeft: `${u(2.5)} solid ${ACCENT.indigo}`,
          borderRadius: u(10),
          padding: `${u(6.5)} ${u(10)}`,
          fontSize: u(9.5),
          lineHeight: 1.5,
        };

  return (
    <ShotFrame theme={t} ratio="4 / 3">
      {/* Score: every Raya turn is preceded by its composing dots, so the
          transcript plays like the session it is rather than appearing as a
          finished list. The recommended material resolves last. */}
      <div style={{ position: "absolute", inset: 0, padding: u(15), display: "flex", flexDirection: "column", gap: u(7) }}>
        <div className="shot-in" style={{ display: "flex", alignItems: "center", gap: u(7) }}>
          <span
            style={{
              flex: "none",
              width: u(19),
              height: u(19),
              borderRadius: u(999),
              background: ACCENT.indigo,
              color: "#fff",
              fontSize: u(7.5),
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            R
          </span>
          <span style={{ fontSize: u(11.5), fontWeight: 700, color: t.text, letterSpacing: "-0.01em" }}>
            <RayaName />
          </span>
          <span style={{ marginLeft: "auto", fontSize: u(8.5), color: t.muted }}>Maya · Year 9 · Mathematics</span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: u(7) }}>
          {TURNS_GUIDED.map((turn, i) =>
            turn.who === "student" ? (
              <div key={turn.text} className="shot-in" style={{ ...at(guidedBeat(i)), ...bubble(true) }}>
                {turn.text}
              </div>
            ) : (
              // Raya's turns show the composing dots first — the one beat that
              // makes the drawing read as a session running, not a screenshot.
              <Resolving
                key={turn.text}
                delay={guidedBeat(i)}
                placeholder={<Composing theme={t} />}
              >
                <div style={bubble(false)}>{turn.text}</div>
              </Resolving>
            ),
          )}
        </div>

        <div
          className="shot-in"
          style={{ ...at(guidedBeat(4)), ...panel(t, u(11), u(10)), marginTop: "auto", display: "flex", flexDirection: "column", gap: u(7) }}
        >
          <div style={{ fontSize: u(8), fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: t.muted }}>
            Recommended next
          </div>
          {NEXT_MATERIAL.map((m, i) => (
            <Resolving
              key={m.title}
              delay={guidedBeat(4) + 160 + i * 180}
              placeholder={
                <div style={{ display: "flex", alignItems: "center", gap: u(7) }}>
                  <Skel theme={t} w={u(12)} h={14} />
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: u(3) }}>
                    <Skel theme={t} w="54%" h={7} />
                    <Skel theme={t} w="72%" h={5} />
                  </div>
                </div>
              }
            >
              <div style={{ display: "flex", alignItems: "center", gap: u(7) }}>
                <span style={{ flex: "none", width: u(12), height: u(14), borderRadius: u(3), background: ACCENT[m.tone] }} />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "block", fontSize: u(9.5), fontWeight: 600, color: t.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {m.title}
                  </span>
                  <span style={{ display: "block", fontSize: u(8), color: t.muted }}>{m.meta}</span>
                </span>
                <span
                  style={{
                    flex: "none",
                    background: i === 0 ? t.ctaBg : "transparent",
                    color: i === 0 ? t.ctaText : t.muted,
                    border: `1px solid ${i === 0 ? "transparent" : t.inputBorder}`,
                    borderRadius: u(999),
                    padding: `${u(3.5)} ${u(9)}`,
                    fontSize: u(8.5),
                    fontWeight: 600,
                  }}
                >
                  {m.kind}
                </span>
              </div>
            </Resolving>
          ))}
          <div style={{ display: "flex", gap: u(5), flexWrap: "wrap" }}>
            {NEXT_FORMATS.map((f, i) => (
              <span
                key={f}
                className="shot-in"
                style={{
                  ...at(guidedBeat(4) + 620 + i * 80),
                  fontSize: u(8),
                  fontWeight: 500,
                  color: t.muted,
                  background: t.cardBg,
                  border: `1px solid ${t.cardBorder}`,
                  borderRadius: u(999),
                  padding: `${u(3)} ${u(8)}`,
                }}
              >
                {f}
              </span>
            ))}
          </div>
        </div>
      </div>
    </ShotFrame>
  );
}

/* ── Step 3 · what was understood travels back ── */

/**
 * The morning's list. `status` values are `KernelAlertType` verbatim — the same
 * five the Kernel band tabulates — and the row shape is prof-overview's:
 * name · class · subject · status · mastery.
 */
const FOCUS_ROWS: { name: string; klass: string; subject: string; status: string; pct: number; risk: string }[] = [
  { name: "Maya R.", klass: "Year 9", subject: "Mathematics", status: "False mastery", pct: 34, risk: "#ef4444" },
  { name: "Jonas T.", klass: "Year 10", subject: "Physics", status: "Recurring error", pct: 41, risk: "#ef4444" },
  { name: "Aiko O.", klass: "Year 8", subject: "French", status: "Cognitive overload", pct: 58, risk: "#f59e0b" },
  { name: "Refik C.", klass: "Year 11", subject: "Biology", status: "Passive dependency", pct: 66, risk: "#f59e0b" },
];

export function ReturnShot({ theme: t }: { theme: Theme }) {
  return (
    <ShotFrame theme={t} ratio="4 / 3">
      {/* Score: the roll-up resolves first, then the list fills in student by
          student out of its placeholders — the morning's diagnosis arriving —
          and the blocking prerequisite lands last, on the emphasised beat. */}
      <div style={{ position: "absolute", inset: 0, padding: u(15), display: "flex", flexDirection: "column", gap: u(9) }}>
        <div className="shot-in" style={{ display: "flex", alignItems: "center", gap: u(8) }}>
          <span style={{ flex: 1, minWidth: 0, fontSize: u(12.5), fontWeight: 700, color: t.text, letterSpacing: "-0.01em" }}>
            Students to focus on
          </span>
          <span style={ghostPill(t)}>Open Focus →</span>
        </div>

        {/* The roll-up above the list, so the plate carries a scale as well as
            four names: this is a class of 128, not a shortlist of four. */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: u(7) }}>
          {[
            { label: "Tracked", to: 128, suffix: "", tone: t.text },
            { label: "Need attention", to: 12, suffix: "", tone: ACCENT.orange },
            { label: "Avg. mastery", to: 71, suffix: "%", tone: ACCENT.green },
          ].map((k, i) => (
            <Resolving
              key={k.label}
              delay={120 + i * 90}
              placeholder={
                <div style={{ display: "flex", flexDirection: "column", gap: u(4) }}>
                  <Skel theme={t} w="70%" h={5} />
                  <Skel theme={t} w="46%" h={10} />
                </div>
              }
            >
              <div style={{ background: t.inputFieldBg, border: `1px solid ${t.cardBorder}`, borderRadius: u(9), padding: `${u(6)} ${u(8)}` }}>
                <div style={{ fontSize: u(7.5), color: t.muted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{k.label}</div>
                <div style={{ fontSize: u(13), fontWeight: 700, color: k.tone, marginTop: u(1) }}>
                  <CountUp to={k.to} suffix={k.suffix} delay={120 + i * 90} />
                </div>
              </div>
            </Resolving>
          ))}
        </div>

        <div style={{ ...panel(t, u(11), u(10)), display: "flex", flexDirection: "column", gap: u(8) }}>
          {FOCUS_ROWS.map((r, i) => {
            const beat = 440 + i * 150;
            return (
              <Resolving
                key={r.name}
                delay={beat}
                placeholder={
                  <div style={{ display: "flex", alignItems: "center", gap: u(7) }}>
                    <Skel theme={t} w={u(6)} h={6} />
                    <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: u(3) }}>
                      <Skel theme={t} w={`${46 - i * 4}%`} h={6} />
                      <Skel theme={t} w={`${78 - i * 5}%`} h={5} />
                    </div>
                    <Skel theme={t} w={u(46)} h={6} />
                  </div>
                }
              >
                <div style={{ display: "flex", alignItems: "center", gap: u(7) }}>
                  <span style={{ flex: "none", width: u(6), height: u(6), borderRadius: u(999), background: r.risk }} />
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: "block", fontSize: u(9.5), fontWeight: 600, color: t.text }}>{r.name}</span>
                    <span
                      style={{
                        display: "block",
                        fontSize: u(8),
                        color: t.mutedLight,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {r.klass} · {r.subject} · {r.status}
                    </span>
                  </span>
                  <span style={{ flex: "none", display: "flex", alignItems: "center", gap: u(6) }}>
                    <span style={{ display: "block", width: u(30), height: u(4), borderRadius: u(999), background: t.inputFieldBg, overflow: "hidden" }}>
                      <span className="shot-bar" style={{ ...at(beat), display: "block", width: `${r.pct}%`, height: "100%", background: r.risk }} />
                    </span>
                    <span style={{ fontSize: u(9), fontWeight: 700, color: r.risk, width: u(22), textAlign: "right" }}>
                      <CountUp to={r.pct} suffix="%" delay={beat} />
                    </span>
                  </span>
                </div>
              </Resolving>
            );
          })}
        </div>

        <div
          className="shot-pick"
          style={{
            ...at(1120),
            display: "flex",
            alignItems: "center",
            gap: u(8),
            background: t.orangeBg,
            border: `1px solid ${t.orangeBorder}`,
            borderRadius: u(11),
            padding: `${u(7)} ${u(9)}`,
          }}
        >
          <span
            style={{
              flex: "none",
              width: u(16),
              height: u(16),
              borderRadius: u(999),
              background: ACCENT.orange,
              color: "#fff",
              fontSize: u(10),
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            !
          </span>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: u(9.5), fontWeight: 600, color: t.orangeText }}>Shared blocking prerequisite</div>
            <div style={{ fontSize: u(8.5), color: t.muted }}>Dividing fractions gates 3 later concepts, for 2 of them.</div>
          </div>
        </div>

        {/* The guardrail, stated where it is actually enforced: this panel is
            everything the teacher receives, and a transcript is not in it. */}
        <div
          className="shot-in"
          style={{ ...at(1320), marginTop: "auto", paddingTop: u(8), borderTop: `1px solid ${t.cardBorder}`, fontSize: u(9), color: t.muted, lineHeight: 1.5 }}
        >
          Mastery only. Never the conversation.
        </div>
      </div>
    </ShotFrame>
  );
}

/* ───────────────────────── The Socratic ladder ───────────────────────── */

/**
 * The student app's nav, in the app's own order and with the app's own icons
 * (components/raya/raya-shell.tsx). Labels come from the message catalogue —
 * "My Kernel", not "Kernel", and "Homework", not "Exercises".
 */
const RAYA_NAV: { label: string; Icon: typeof IconChat }[] = [
  { label: "Chat", Icon: IconChat },
  { label: "Rooms", Icon: IconRooms },
  { label: "Tools", Icon: IconTools },
  { label: "Homework", Icon: IconQuiz },
  { label: "My Kernel", Icon: IconKernel },
  { label: "Settings", Icon: IconSettings },
];

/** Past conversations, as the sidebar lists them under the Chat item. */
const SESSIONS = [
  "Limits of a rational function",
  "Dividing fractions — why invert?",
  "Le passé composé vs imparfait",
];

/**
 * The escalation, played as the session it actually is.
 *
 * There is no rung label on a bubble here, because there is none in the
 * product: PUMP / HINT / ASSERTION / SUMMARY are instructions in the tutor's
 * system prompt (`lib/raya/prompt.ts`, "# EMT escalation"), not chrome the
 * student sees. The climb has to be legible from what Raya says, which is the
 * harder version and the honest one — she opens by asking, hints only after an
 * attempt, and when she finally states the missing step she still doesn't hand
 * over the number. Emma computes the 6 herself.
 */
const TURNS: { who: "raya" | "me"; text: string }[] = [
  { who: "raya", text: "Before I say anything — what happens to (x² − 9)/(x − 3) when you put x = 3 in?" },
  { who: "me", text: "It gives 0/0. I already tried that." },
  { who: "raya", text: "Good — so the work is done. What does a 0/0 tell you about a factor the top and the bottom might share?" },
  { who: "me", text: "…that (x − 3) is in both?" },
  { who: "raya", text: "That's the piece that was missing. Cancel it first, then substitute. Try it and tell me what you land on." },
  { who: "me", text: "6. And I can see why now." },
];

/**
 * When turn `i` lands. Slow enough to read as a conversation replaying rather
 * than a list appearing — this sequence IS the argument the section makes, so
 * it's the one place on the site worth spending a couple of seconds.
 */
const turnBeat = (i: number) => 220 + i * 300;
/** The Analyze click, then the Kernel's reading of the session it produced. */
const ANALYZE_BEAT = turnBeat(TURNS.length - 1) + 260;
const ANALYSIS_BEAT = ANALYZE_BEAT + 260;

/**
 * The right panel's standing nudges. Two real sources merged, exactly as
 * `getStudentRecommendations` returns them: the school's directives, then the
 * class instructions, labelled with the subject when they carry one.
 */
const FOR_YOU: { content: string; source: string }[] = [
  { content: "Exam fortnight: short sessions, no marathons.", source: "Your school" },
  { content: "Ask for the algebra before the limit.", source: "Mathematics" },
  { content: "Two attempts before a worked example.", source: "Your teacher" },
];

/**
 * The escalation policy as the screen it happens on — the real Raya student
 * app (components/raya/raya-shell.tsx + chat/chat-surface.tsx): the sidebar
 * with its six routes and the session history, the chat header with its two
 * actions, the thread, the composer, and the "For you" panel where the
 * teacher's nudges live and where Analyze drops the Kernel's reading of the
 * session that just happened.
 *
 * Sidebar and panel carry `pub-shot-aside` so the narrow layout keeps only the
 * transcript: below the breakpoint there isn't width for three columns, and
 * the transcript alone still makes the point.
 */
export function SocraticShot({ theme: t }: { theme: Theme }) {
  // Three adjacent panels in three tones, separated by a 1px border and
  // nothing else — the app shell is flat by design (no gaps, no floating
  // cards), so the shot is too.
  const sidebarBg = t.sectionAltBg;
  const rightBg = t.inputFieldBg;

  const navRow = (label: string, Icon: typeof IconChat, active: boolean, beat: number, trailing?: ReactNode) => (
    <div
      key={label}
      className="shot-in"
      style={{
        ...at(beat),
        display: "flex",
        alignItems: "center",
        gap: uw(8),
        padding: `${uw(5)} ${uw(8)}`,
        borderRadius: uw(9),
        background: active ? t.chipBg : "transparent",
        color: active ? t.text : t.muted,
        fontSize: uw(10),
        fontWeight: active ? 600 : 400,
      }}
    >
      <Icon style={{ width: uw(12), height: uw(12) }} />
      <span style={{ flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{label}</span>
      {trailing}
    </div>
  );

  const headerPill = (label: ReactNode, beat: number, pick = false) => (
    <span
      className={pick ? "shot-pick" : "shot-in"}
      style={{
        ...at(beat),
        flex: "none",
        whiteSpace: "nowrap",
        fontSize: uw(9),
        borderTop: `1px solid ${t.cardBorder}`,
        borderRight: `1px solid ${t.cardBorder}`,
        borderBottom: `1px solid ${t.cardBorder}`,
        borderLeft: `1px solid ${t.cardBorder}`,
        borderRadius: uw(999),
        padding: `${uw(4)} ${uw(9)}`,
        color: pick ? t.text : t.mutedLight,
        background: pick ? t.chipBg : "transparent",
      }}
    >
      {label}
    </span>
  );

  const iconBtn = (icon: ReactNode, beat: number) => (
    <span
      className="shot-in"
      style={{
        ...at(beat),
        flex: "none",
        width: uw(20),
        height: uw(20),
        borderRadius: uw(6),
        border: `1px solid ${t.cardBorder}`,
        color: t.mutedLight,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {icon}
    </span>
  );

  /** The composer's round buttons: voice, attach, AI mode, send. */
  const round = (child: ReactNode, filled = false) => (
    <span
      style={{
        flex: "none",
        width: uw(24),
        height: uw(24),
        borderRadius: uw(999),
        background: filled ? t.ctaBg : t.inputFieldBg,
        color: filled ? t.ctaText : t.mutedLight,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: uw(11),
      }}
    >
      {child}
    </span>
  );

  return (
    <ShotFrame theme={t} ratio="21 / 9" className="pub-shot-wide">
      <div
        className="pub-shot-grid"
        style={{
          position: "absolute",
          inset: 0,
          display: "grid",
          gridTemplateColumns: `${uw(152)} 1fr ${uw(186)}`,
          background: t.cardBg,
        }}
      >
        {/* ── Sidebar ─────────────────────────────────────────────────── */}
        <div
          className="pub-shot-aside"
          style={{
            minWidth: 0,
            display: "flex",
            flexDirection: "column",
            gap: uw(2),
            padding: `${uw(11)} ${uw(9)}`,
            background: sidebarBg,
            borderRight: `1px solid ${t.cardBorder}`,
          }}
        >
          <div className="shot-in" style={{ display: "flex", alignItems: "center", gap: uw(6), padding: `0 ${uw(4)}`, marginBottom: uw(10) }}>
            {/* The app's own mark, both variants — the sidebar swaps them by
                theme because the light artwork disappears on a dark rail. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={t.dark ? "/raya-mark-dark.png" : "/raya-mark.png"}
              alt=""
              style={{ width: uw(22), height: uw(22), objectFit: "contain", flex: "none" }}
            />
            <span style={{ flex: 1, fontSize: uw(11), fontWeight: 800, color: t.text, fontFamily: "var(--font-plex),'IBM Plex Sans',sans-serif" }}>
              <RayaName />
            </span>
            <IconChevron style={{ width: uw(10), height: uw(10), color: t.muted, transform: "rotate(90deg)" }} />
          </div>

          {navRow(
            RAYA_NAV[0].label,
            RAYA_NAV[0].Icon,
            true,
            60,
            <IconChevron style={{ width: uw(8), height: uw(8) }} />,
          )}

          {/* The session history, open under the Chat route it belongs to. */}
          <div style={{ padding: `${uw(4)} 0 ${uw(6)} ${uw(16)}`, display: "flex", flexDirection: "column", gap: uw(2) }}>
            <div
              className="shot-in"
              style={{
                ...at(90),
                background: t.chipBg,
                color: t.text,
                borderRadius: uw(7),
                padding: `${uw(4)} ${uw(7)}`,
                fontSize: uw(9),
                fontWeight: 600,
                textAlign: "center",
              }}
            >
              + New session
            </div>
            {SESSIONS.map((s, i) => (
              <div
                key={s}
                className="shot-in"
                style={{
                  ...at(120 + i * 40),
                  display: "flex",
                  alignItems: "center",
                  gap: uw(4),
                  borderRadius: uw(7),
                  padding: `${uw(4)} ${uw(7)}`,
                  background: i === 0 ? t.chipBg : "transparent",
                }}
              >
                <span
                  style={{
                    flex: 1,
                    minWidth: 0,
                    fontSize: uw(9),
                    fontWeight: i === 0 ? 700 : 500,
                    color: i === 0 ? t.text : t.muted,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {s}
                </span>
                <span style={{ flex: "none", fontSize: uw(8), color: t.mutedLight }}>✕</span>
              </div>
            ))}
          </div>

          {RAYA_NAV.slice(1).map((n, i) => navRow(n.label, n.Icon, false, 250 + i * 40))}

          {/* The profile chip, pinned to the bottom of the rail. */}
          <div
            className="shot-in"
            style={{
              ...at(450),
              marginTop: "auto",
              display: "flex",
              alignItems: "center",
              gap: uw(7),
              padding: `${uw(5)} ${uw(6)}`,
              borderRadius: uw(9),
              background: t.chipBg,
            }}
          >
            <span
              style={{
                flex: "none",
                width: uw(22),
                height: uw(22),
                borderRadius: uw(999),
                background: ACCENT.indigo,
                color: "#fff",
                fontSize: uw(9),
                fontWeight: 700,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              EM
            </span>
            <span style={{ minWidth: 0 }}>
              <span style={{ display: "block", fontSize: uw(9.5), fontWeight: 600, color: t.text }}>Emma M.</span>
              <span style={{ display: "block", fontSize: uw(8), color: t.muted }}>Raya Plus</span>
            </span>
          </div>
        </div>

        {/* ── The chat surface ────────────────────────────────────────── */}
        <div style={{ minWidth: 0, display: "flex", flexDirection: "column", background: t.cardBg }}>
          {/* Session name + state, then the two header actions. */}
          <div
            className="shot-in"
            style={{
              flex: "none",
              display: "flex",
              alignItems: "center",
              gap: uw(7),
              padding: `${uw(9)} ${uw(14)}`,
              background: t.cardBg,
              borderBottom: `1px solid ${t.cardBorder}`,
            }}
          >
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: "block", fontSize: uw(11.5), fontWeight: 700, color: t.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                Limits of a rational function
              </span>
              <span style={{ display: "block", fontSize: uw(8.5), color: t.greenText }}>● in session</span>
            </span>
            {headerPill("View kernel profile", 90)}
            {headerPill("Analyze", ANALYZE_BEAT, true)}
            {iconBtn(<IconFile style={{ width: uw(10), height: uw(10) }} />, 130)}
            {iconBtn(<IconPanel style={{ width: uw(10), height: uw(10) }} />, 150)}
          </div>

          {/* The thread, pinned to its newest message the way the real one is
              — the slack falls above, so this reads as a session already
              running rather than one that starts at the top of the frame. */}
          <div
            style={{
              flex: 1,
              minHeight: 0,
              // Clipped, so a turn that wraps one line further than expected
              // scrolls off the top of the thread the way a real one does,
              // instead of climbing over the session header.
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
              justifyContent: "flex-end",
              gap: uw(8),
              padding: `${uw(8)} ${uw(14)}`,
            }}
          >
            {TURNS.map((m, i) => {
              const mine = m.who === "me";
              const avatar = mine ? (
                <span
                  style={{
                    flex: "none",
                    width: uw(18),
                    height: uw(18),
                    borderRadius: uw(999),
                    background: ACCENT.indigo,
                    color: "#fff",
                    fontSize: uw(7.5),
                    fontWeight: 700,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  EM
                </span>
              ) : (
                <span
                  style={{
                    flex: "none",
                    width: uw(18),
                    height: uw(18),
                    borderRadius: uw(999),
                    overflow: "hidden",
                    background: t.dark ? "#141b2e" : "#ffffff",
                    border: `1px solid ${t.cardBorder}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={t.dark ? "/raya-mark-dark.png" : "/raya-mark.png"}
                    alt=""
                    style={{ width: "82%", height: "82%", objectFit: "contain" }}
                  />
                </span>
              );

              const row = (
                <div
                  style={{
                    display: "flex",
                    gap: uw(6),
                    alignItems: "flex-end",
                    alignSelf: mine ? "flex-end" : "flex-start",
                    flexDirection: mine ? "row-reverse" : "row",
                    maxWidth: "85%",
                  }}
                >
                  {avatar}
                  <div
                    style={{
                      minWidth: 0,
                      background: mine ? t.ctaBg : t.inputFieldBg,
                      color: mine ? t.ctaText : t.text,
                      borderRadius: mine ? `${uw(13)} ${uw(13)} ${uw(4)} ${uw(13)}` : `${uw(13)} ${uw(13)} ${uw(13)} ${uw(4)}`,
                      padding: `${uw(7)} ${uw(11)}`,
                      fontSize: uw(11),
                      lineHeight: 1.5,
                    }}
                  >
                    {m.text}
                  </div>
                </div>
              );

              // Raya composes before she answers; the student's turns just land.
              return mine ? (
                <div key={m.text} className="shot-in" style={{ ...at(turnBeat(i)), display: "flex", flexDirection: "column" }}>
                  {row}
                </div>
              ) : (
                <Resolving
                  key={m.text}
                  delay={turnBeat(i)}
                  placeholder={
                    <div style={{ display: "flex", gap: uw(6), alignItems: "flex-end" }}>
                      {avatar}
                      <Composing theme={t} unit={uw} />
                    </div>
                  }
                >
                  {row}
                </Resolving>
              );
            })}
          </div>

          {/* The composer: voice, the field, attach, AI mode, send. */}
          <div
            className="shot-in"
            style={{
              ...at(170),
              flex: "none",
              display: "flex",
              alignItems: "center",
              gap: uw(6),
              padding: `${uw(9)} ${uw(14)}`,
              borderTop: `1px solid ${t.cardBorder}`,
            }}
          >
            {round(<IconMic style={{ width: uw(11), height: uw(11) }} />)}
            <span
              style={{
                flex: 1,
                minWidth: 0,
                background: t.inputFieldBg,
                border: `1px solid ${t.inputBorder}`,
                borderRadius: uw(999),
                padding: `${uw(6)} ${uw(12)}`,
                fontSize: uw(10),
                color: t.inputPlaceholder,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              Write your reply to <RayaName />...
            </span>
            {round(<IconAttach style={{ width: uw(11), height: uw(11) }} />)}
            {round(<IconAiMode style={{ width: uw(11), height: uw(11) }} />)}
            {round("↑", true)}
          </div>
        </div>

        {/* ── "For you" ───────────────────────────────────────────────── */}
        <div
          className="pub-shot-aside"
          style={{
            minWidth: 0,
            display: "flex",
            flexDirection: "column",
            background: rightBg,
            borderLeft: `1px solid ${t.cardBorder}`,
          }}
        >
          <div
            className="shot-in"
            style={{
              ...at(60),
              flex: "none",
              display: "flex",
              alignItems: "center",
              gap: uw(6),
              padding: `${uw(9)} ${uw(12)}`,
              borderBottom: `1px solid ${t.cardBorder}`,
            }}
          >
            <span style={{ flex: 1, minWidth: 0, fontSize: uw(11), fontWeight: 700, color: t.text }}>For you</span>
            <span style={{ flex: "none", fontSize: uw(10), color: t.mutedLight }}>»</span>
          </div>

          <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", gap: uw(8), padding: uw(12) }}>
            {/* The nudges take the slack and clip if there is none; the
                analysis card below them never does — it is the payoff, and a
                panel whose top scrolls is what the real one does anyway. */}
            <div style={{ flex: "0 1 auto", minHeight: 0, overflow: "hidden", display: "flex", flexDirection: "column", gap: uw(8) }}>
              {FOR_YOU.map((r, i) => (
                <div
                  key={r.content}
                  className="shot-in"
                  style={{
                    ...at(200 + i * 90),
                    flex: "none",
                    background: t.cardBg,
                    border: `1px solid ${t.cardBorder}`,
                    borderRadius: uw(10),
                    padding: `${uw(7)} ${uw(8)}`,
                  }}
                >
                  <div style={{ fontSize: uw(9), fontWeight: 600, color: t.text, lineHeight: 1.4 }}>{r.content}</div>
                  <div style={{ fontSize: uw(8), color: t.muted, marginTop: uw(2) }}>{r.source}</div>
                </div>
              ))}
            </div>

            {/* The payoff of the Analyze click above: what the Kernel made of
                the session, in the fields it actually returns. `flex: none`
                because this card is the one thing in the panel that must never
                be the part that gets squeezed. */}
            <div style={{ flex: "none" }}>
            <Resolving
              delay={ANALYSIS_BEAT}
              placeholder={
                <div style={{ display: "flex", flexDirection: "column", gap: uw(6), paddingTop: uw(4) }}>
                  <Skel theme={t} w="58%" h={9} unit={uw} />
                  <Skel theme={t} w="100%" h={7} unit={uw} />
                  <Skel theme={t} w="88%" h={7} unit={uw} />
                  <Skel theme={t} w="70%" h={7} unit={uw} />
                </div>
              }
            >
              <div style={{ border: `1px solid ${t.cardBorder}`, borderRadius: uw(12), padding: uw(10), background: t.cardBg }}>
                <div style={{ display: "flex", alignItems: "center", gap: uw(4), marginBottom: uw(6) }}>
                  <span style={{ flex: 1, minWidth: 0, fontSize: uw(10), fontWeight: 700, color: t.text }}>Kernel analysis</span>
                  {["TXT", "PDF", "✕"].map((a) => (
                    <span
                      key={a}
                      style={{
                        flex: "none",
                        fontSize: uw(7.5),
                        background: t.inputFieldBg,
                        border: `1px solid ${t.cardBorder}`,
                        color: t.mutedLight,
                        borderRadius: uw(999),
                        padding: `${uw(1.5)} ${uw(5)}`,
                      }}
                    >
                      {a}
                    </span>
                  ))}
                </div>
                <div style={{ fontSize: uw(9), color: t.text, lineHeight: 1.45 }}>
                  <strong>Root gap:</strong> Factoring a difference of squares
                </div>
                <div style={{ fontSize: uw(9), color: t.text, lineHeight: 1.45, marginTop: uw(4) }}>
                  <strong>Summary:</strong> Reads the 0/0 right, but doesn&apos;t reach for factoring unprompted. The limit isn&apos;t the gap — the algebra under it is.
                </div>
                <div style={{ fontSize: uw(8), color: t.muted, marginTop: uw(6) }}>
                  Confidence: 0.82 · KCs: 5 · Model: gemini-3.1-flash-lite
                </div>
              </div>
            </Resolving>
            </div>
          </div>
        </div>
      </div>
    </ShotFrame>
  );
}

/* ───────────────────────── The four rungs ───────────────────────── */

/**
 * One session per rung, each on a different subject, so the four cards read as
 * four moments of one product rather than one exchange shown four times.
 *
 * Each is written so the rung is legible from what Raya actually says — she is
 * never labelled with the rung she is on, because the product doesn't label
 * her. PUMP / HINT / ASSERTION / SUMMARY are instructions in the system prompt
 * (`lib/raya/prompt.ts`, "# EMT escalation"), not chrome the student sees.
 *
 * Note what each one REFUSES to do, which is the section's whole claim:
 *  - Pump      is asked for the answer outright and doesn't give it.
 *  - Hint      names the shape of the problem and leaves the choice open.
 *  - Assertion arrives only after two failed tries, states one rule, and still
 *              makes the student do the balancing.
 *  - Summary   keeps the sentence the student said, not the exercises.
 */
const RUNG_SESSIONS: {
  title: string;
  turns: { who: "raya" | "me"; text: string }[];
  /** The Summary rung ends by turning the finished session into Kernel data. */
  analyze?: boolean;
}[] = [
  {
    title: "Photosynthesis — lesson 4",
    turns: [
      { who: "me", text: "Just give me the answer to question 4 — why do plants need light?" },
      { who: "raya", text: "Not yet. You've met this one already. What do you think the light is being used for inside the leaf?" },
      { who: "me", text: "To make food? Sugar, I think." },
      { who: "raya", text: "That's the word I wanted. Made out of what, though — a leaf can't make sugar out of nothing." },
    ],
  },
  {
    title: "Le passé composé vs imparfait",
    turns: [
      { who: "me", text: "«Je mangeais quand il est arrivé» — I had both in the imparfait first and it felt wrong." },
      { who: "raya", text: "Your ear was right. One of those two verbs is the background and the other interrupts it. Which is which?" },
      { who: "me", text: "Eating is the background?" },
      { who: "raya", text: "Say why, and it'll stick." },
    ],
  },
  {
    title: "Balancing equations",
    turns: [
      { who: "me", text: "Two tries and H2 + O2 → H2O still won't balance. I'm stuck." },
      { who: "raya", text: "Then here's the piece you're missing: you may change the number in front of a formula, never the small ones inside it. H₂O has to stay H₂O." },
      { who: "me", text: "Oh. So 2H2 + O2 → 2H2O." },
    ],
  },
  {
    title: "Dividing fractions",
    turns: [
      { who: "raya", text: "Before we stop — in your own words, why does dividing by a fraction make the answer bigger?" },
      { who: "me", text: "Because you're asking how many halves fit inside it, and a lot of halves fit." },
      { who: "raya", text: "That's the one. That sentence is what I keep — not the six exercises." },
    ],
    analyze: true,
  },
];

/**
 * The score for one session: when each turn lands, and when the exchange is
 * over.
 *
 * Beats are cumulative rather than a fixed step, because a turn's length is
 * not fixed: Raya's replies take as long as they take to stream, and a turn
 * that started before the previous one finished would read as two people
 * talking over each other. Each turn is followed by a beat of reading time —
 * the pause is what makes the next message feel like a response to it.
 */
function rungScore(turns: { who: "raya" | "me"; text: string }[]) {
  const beats: number[] = [];
  let t = 240;
  for (const m of turns) {
    beats.push(t);
    t += m.who === "raya" ? 380 + streamMs(m.text) + 420 : 700;
  }
  return { beats, end: t };
}

/**
 * One rung's session, drawn on the real chat surface
 * (components/chat/chat-surface.tsx): the session header with its two actions,
 * and the thread with Raya's logo avatar, the student's initials chip, and the
 * app's two bubble tones and asymmetric corner radii.
 *
 * Deliberately cropped above the composer. These sit beside an explanation
 * inside a card that already names the rung — the argument is what is said in
 * the thread, and a fourth copy of the send button next to it is noise. A crop
 * of a real screen stays a real screen; a redrawn one wouldn't.
 */
export function RungShot({ theme: t, rung }: { theme: Theme; rung: number }) {
  const session = RUNG_SESSIONS[rung] ?? RUNG_SESSIONS[0];
  const { beats, end } = rungScore(session.turns);
  // The finished exchange holds for a beat, then the session replays. The hold
  // is the part that matters: without it the last reply is gone before it can
  // be read, and the card becomes a flicker instead of a session.
  const cycle = end + 2600;

  const headerPill = (label: string, beat: number, pick = false) => (
    <span
      className={pick ? "shot-pick" : "shot-in"}
      style={{
        ...at(beat),
        flex: "none",
        whiteSpace: "nowrap",
        fontSize: u(7.5),
        borderTop: `1px solid ${t.cardBorder}`,
        borderRight: `1px solid ${t.cardBorder}`,
        borderBottom: `1px solid ${t.cardBorder}`,
        borderLeft: `1px solid ${t.cardBorder}`,
        borderRadius: u(999),
        padding: `${u(3)} ${u(8)}`,
        color: pick ? t.text : t.mutedLight,
        background: pick ? t.chipBg : "transparent",
      }}
    >
      {label}
    </span>
  );

  const rayaAvatar = (
    <span
      style={{
        flex: "none",
        width: u(17),
        height: u(17),
        borderRadius: u(999),
        overflow: "hidden",
        background: t.dark ? "#141b2e" : "#ffffff",
        border: `1px solid ${t.cardBorder}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={t.dark ? "/raya-mark-dark.png" : "/raya-mark.png"}
        alt=""
        style={{ width: "82%", height: "82%", objectFit: "contain" }}
      />
    </span>
  );

  const meAvatar = (
    <span
      style={{
        flex: "none",
        width: u(17),
        height: u(17),
        borderRadius: u(999),
        background: ACCENT.indigo,
        color: "#fff",
        fontSize: u(7),
        fontWeight: 700,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      EM
    </span>
  );

  return (
    // 16/9 rather than the feature shots' 4/3, and the tightest ratio the four
    // turns fit in. It is the sticky stack that sets it: the last card pins at
    // STICKY_BASE + 3 × HEADER_H = 260px down, so everything below that has to
    // clear a laptop viewport (~640px) or the fourth rung gets cut in half at
    // exactly the moment the stack is meant to be readable.
    <ShotFrame theme={t} ratio="16 / 9" loopMs={cycle}>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", background: t.cardBg }}>
        {/* Session name + state + the two header actions. */}
        <div
          className="shot-in"
          style={{
            flex: "none",
            display: "flex",
            alignItems: "center",
            gap: u(6),
            padding: `${u(8)} ${u(12)}`,
            background: t.cardBg,
            borderBottom: `1px solid ${t.cardBorder}`,
          }}
        >
          <span style={{ flex: 1, minWidth: 0 }}>
            {/* The conversation's own title, which the app only knows once the
                session has loaded — so it resolves out of a placeholder rather
                than being there before the thread it names. */}
            <Resolving delay={110} placeholder={<Skel theme={t} w="66%" h={10} />}>
              <span
                style={{
                  display: "block",
                  fontSize: u(10),
                  fontWeight: 700,
                  color: t.text,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {session.title}
              </span>
            </Resolving>
            {/* The header's real two-state line: `busy ? "Thinking…" : "● in
                session"` in chat-surface.tsx. It holds on Thinking while the
                turns play and settles green when the exchange lands. */}
            <Resolving
              delay={end + 80}
              placeholder={<span style={{ display: "block", fontSize: u(7.5), color: t.mutedLight }}>Thinking…</span>}
            >
              <span style={{ display: "block", fontSize: u(7.5), color: t.greenText }}>● in session</span>
            </Resolving>
          </span>
          {headerPill("View kernel profile", 70)}
          {/* On the Summary rung this is the beat that matters: the finished
              session becoming Kernel data. Elsewhere it just sits there, the
              way it does in the app until a session is worth analysing. */}
          {session.analyze ? headerPill("Analyze", end + 340, true) : headerPill("Analyze", 100)}
        </div>

        {/* The thread, pinned to its newest message and clipped above — a turn
            that wraps one line further scrolls off the top the way a real
            thread does, instead of climbing over the session header. */}
        <div
          style={{
            flex: 1,
            minHeight: 0,
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            justifyContent: "flex-end",
            gap: u(6),
            padding: `${u(8)} ${u(12)}`,
          }}
        >
          {session.turns.map((m, i) => {
            const mine = m.who === "me";
            const radii = mine
              ? `${u(12)} ${u(12)} ${u(3)} ${u(12)}`
              : `${u(12)} ${u(12)} ${u(12)} ${u(3)}`;

            const rowShell = (children: ReactNode) => (
              <div
                style={{
                  display: "flex",
                  gap: u(5),
                  alignItems: "flex-end",
                  flexDirection: mine ? "row-reverse" : "row",
                }}
              >
                {mine ? meAvatar : rayaAvatar}
                {children}
              </div>
            );

            const row = rowShell(
              <div
                style={{
                  minWidth: 0,
                  background: mine ? t.ctaBg : t.inputFieldBg,
                  color: mine ? t.ctaText : t.text,
                  borderRadius: radii,
                  padding: `${u(6)} ${u(9)}`,
                  fontSize: u(9),
                  lineHeight: 1.5,
                }}
              >
                {/* Raya's bubble opens empty and fills as her answer streams;
                    the student's arrives written. */}
                {mine ? m.text : <Streamed text={m.text} from={beats[i] + 220} />}
              </div>,
            );

            // What sits in the row's place until the turn lands. Raya composes,
            // because that is what the surface does while a reply streams; the
            // student's own message is a bubble-shaped placeholder sized to the
            // message it becomes, so it resolves in place with no reflow.
            const placeholder = mine
              ? rowShell(
                  <span
                    style={{
                      display: "block",
                      width: u(Math.min(215, 62 + m.text.length * 1.7)),
                      height: u(m.text.length > 62 ? 37 : 24),
                      borderRadius: radii,
                      background: t.dark ? "rgba(255,255,255,0.09)" : "rgba(15,23,42,0.07)",
                    }}
                  />,
                )
              : rowShell(<Composing theme={t} />);

            // The wrapper carries the side and the width cap, so the grid cell
            // `Resolving` builds can shrink to its content: `align-self` is a
            // flex axis here and a block axis inside that grid, so putting them
            // on the same element would place the bubble on the wrong side.
            return (
              <div
                key={m.text}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: mine ? "flex-end" : "flex-start",
                  alignSelf: mine ? "flex-end" : "flex-start",
                  maxWidth: "88%",
                }}
              >
                <Resolving delay={beats[i]} placeholder={placeholder}>
                  {row}
                </Resolving>
              </div>
            );
          })}
        </div>
      </div>
    </ShotFrame>
  );
}
