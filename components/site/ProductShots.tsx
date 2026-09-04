"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import type { Theme } from "./theme";
import { RayaName } from "@/components/ui/brand";
import { useTranslate } from "@/components/ui/locale";
import type { MessageKey } from "@/lib/i18n";
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
 *  nominal width is right at every size — with one exception, below. */
const BASE = 400;
/**
 * Nominal px → container-relative units for the feature shots.
 *
 * A `calc` over a custom property rather than a number divided in JS, for the
 * same reason `uw()` below is one: the showcase bands (ConnectionSection,
 * FeaturesSection) lay their cards out as full-width rows above 1100px, where
 * a shot is ~2× the width it is in a 3-up card. Every length here is
 * width-derived, so at a fixed nominal width that would also make it 2× TALLER
 * — a 600px-tall drawing of a 400px-wide screen. `--shot-base` is what the
 * stylesheet widens there (globals.css, `.pub-showcase-card`), which scales the
 * composition up by less than the frame grows instead of in lockstep with it.
 * Unset — everywhere else — it resolves to BASE and renders exactly as before.
 */
const u = (n: number) => `calc(${n} * 100cqw / var(--shot-base, ${BASE}))`;

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

/**
 * The pause between a shot finishing and replaying it.
 *
 * Same number RungShot has cycled on since the ladder started looping: under
 * about two seconds the last beat is gone before it can be read, and the card
 * reads as a flicker rather than as a session.
 */
const SHOT_HOLD = 2600;

/**
 * How long each showcase shot's own choreography runs — the largest
 * delay+duration across its beats, measured off the rendered page rather than
 * added up by hand, because half of these beats are computed (word counts,
 * row indices) rather than written as literals.
 *
 * They exist so the six can cycle: these are the product demos, and a demo
 * that plays once and then sits there is a screenshot for everyone who arrives
 * at the section a moment later. A shot is paused whenever it is off screen
 * (`is-idle`, see useShotSequence) and never animates at all under
 * `prefers-reduced-motion`, so looping costs nothing when nobody is watching.
 *
 * If you change a shot's choreography, re-measure — a cycle SHORTER than its
 * sequence restarts the shot mid-play.
 */
const SEQUENCE_MS = {
  kernel: 1590,
  room: 5440,
  tools: 1670,
  focus: 1880,
  guided: 2960,
  return: 1740,
} as const;

/** A shot's full cycle: play it, hold the finished composition, replay. */
const loop = (key: keyof typeof SEQUENCE_MS) => SEQUENCE_MS[key] + SHOT_HOLD;

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
export const at = (ms: number) => ({ "--d": `${ms}ms` }) as CSSProperties;

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
 * visitor gets. Looping there is the session running, not decoration.
 *
 * The replay is triggered by the cycle animation's own `animationend`, not by
 * a timer running alongside it. Two clocks was the old design and it could not
 * be made to work: the sequence ends on the document timeline and a timer
 * fires whenever the main thread is free, so on a busy frame the replay lands
 * late — after the plate has already faded out — and the lateness is a visible
 * hole at the seam. See `shotCycle` in globals.css.
 *
 * `restartKey` is for a shot whose subject can be changed from outside — the
 * Kernel graph, where picking a different worked example has to start that
 * example from the top. There is nothing to reset beside the CSS any more: the
 * cycle IS one of the animations, so rewinding the sequence rewinds the clock.
 */
export function useShotSequence(loopMs?: number, restartKey?: unknown) {
  const ref = useRef<HTMLDivElement>(null);
  const [live, setLive] = useState(false);

  /**
   * One rewind of every animation inside.
   *
   * They are all scoped to `.is-live`, so dropping the class rewinds them at
   * once. The offsetWidth read between the two writes is load-bearing: without
   * it the browser coalesces them into no change at all and nothing restarts.
   */
  const rewind = useCallback(() => {
    const el = ref.current;
    // Never opted in: motion is off, or the shot was already on screen at
    // mount and is showing its finished state.
    if (!el?.classList.contains("pub-shot-anim")) return;
    el.classList.remove("is-live");
    void el.offsetWidth;
    el.classList.add("is-live");
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

    // The one animation whose only job is to be a cycle long. Filtered by name
    // AND by target: every entrance inside this shot also bubbles an
    // animationend up to here, and a stray one would replay the tour early.
    const onEnd = (e: AnimationEvent) => {
      if (e.animationName === "shotCycle" && e.target === el) rewind();
    };

    let first = true;
    let armed = false;

    const io = new IntersectionObserver(
      (entries) => {
        const onScreen = entries.some((e) => e.isIntersecting);

        /*
         * "Was this shot already on screen before the visitor could scroll to
         * it" is decided HERE, on the observer's first report, and not by
         * measuring the element in the effect body.
         *
         * It used to be measured: `getBoundingClientRect().top <
         * innerHeight * 0.92`, read synchronously at mount. That is a layout
         * read taken before layout is necessarily final — during hydration the
         * bands above have not all reached their height, so a shot four
         * screens down can still report a `top` inside the fold and opt itself
         * OUT of ever animating. It is a race, so it looked fine locally and
         * left the mockups as stills exactly when the page was slowest, which
         * is when a visitor is most likely to be watching one load.
         *
         * An IntersectionObserver callback runs after layout, by definition,
         * so its first entry answers the same question without the race.
         */
        if (first) {
          first = false;
          // On screen already: an entrance now would be a flash, not a reveal.
          // The shot keeps its finished composition, as it always has.
          if (onScreen) {
            io.disconnect();
            return;
          }
          el.classList.add("pub-shot-anim");
          if (loopMs) {
            el.style.setProperty("--loop", `${loopMs}ms`);
            el.classList.add("is-cycling");
          }
          el.addEventListener("animationend", onEnd);
          armed = true;
          return;
        }
        if (!armed) return;

        // Behind the fold nothing is paid for. Paused rather than rewound, so
        // scrolling back finds the shot where it was rather than restarted —
        // and the cycle animation is paused with everything else, which is what
        // keeps the replay from firing at a moment nobody is watching.
        el.classList.toggle("is-idle", !onScreen);
        if (!onScreen) return;
        el.classList.add("is-live");
        setLive(true);
      },
      { threshold: 0.35 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      el.removeEventListener("animationend", onEnd);
    };
  }, [loopMs, rewind]);

  /**
   * The subject changed under us: replay from the top.
   *
   * Skipped on mount — the observer owns the first run, and firing here as
   * well would restart the sequence in the same frame it started.
   */
  const mounted = useRef(false);
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    // Only replay something that is already playing. Putting `is-live` on a
    // shot the observer has not reached yet would spend its entrance off
    // screen, and the visitor would scroll down to a finished still.
    if (!ref.current?.classList.contains("is-live")) return;
    rewind();
  }, [restartKey, rewind]);

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
  mastered: { labelKey: "shot.status.mastered", color: "#22c55e" },
  partial: { labelKey: "shot.status.inProgress", color: "#f59e0b" },
  gap: { labelKey: "shot.status.toWork", color: "#ef4444" },
} as const satisfies Record<string, { labelKey: MessageKey; color: string }>;

/**
 * The Kernel's three axes. A concept is never one number in this product —
 * knowing it, retaining it and applying it are measured apart, and the gap
 * between them is the diagnosis. Colours are the app's.
 */
const AXES: { key: "k" | "v" | "p"; labelKey: MessageKey; color: string }[] = [
  { key: "k", labelKey: "shot.axis.knowledge", color: "#2f7fe0" },
  { key: "v", labelKey: "shot.axis.retention", color: "#8b5cf6" },
  { key: "p", labelKey: "shot.axis.application", color: "#06b6d4" },
];

const CONCEPTS: { id: string; labelKey: MessageKey; status: keyof typeof KC_STATUS; lastKey: MessageKey; k: number; v: number; p: number }[] = [
  { id: "unitCircle", labelKey: "shot.topic.unitCircle", status: "mastered", lastKey: "shot.kernel.lastUnitCircle", k: 91, v: 84, p: 88 },
  { id: "photosynthesis", labelKey: "shot.topic.photosynthesis", status: "partial", lastKey: "shot.kernel.lastPhotosynthesis", k: 72, v: 55, p: 61 },
  // The one that matters: known on paper, gone a week later, unusable in a
  // problem. A single grade averages those three into one reassuring number.
  { id: "dividingFractions", labelKey: "shot.topic.dividingFractions", status: "gap", lastKey: "shot.kernel.lastDividingFractions", k: 34, v: 21, p: 29 },
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
  const tr = useTranslate();
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
    <ShotFrame theme={t} ratio="4 / 3" loopMs={loop("kernel")}>
      {/* Score: the gauge and the mindset land first, then each concept card
          resolves out of its placeholder and fills its three axes — the profile
          assembling itself the way it actually loads. */}
      <div style={{ position: "absolute", inset: 0, padding: u(11), display: "flex", flexDirection: "column", gap: u(5) }}>
        <div className="shot-in" style={{ display: "flex", alignItems: "center", gap: u(8) }}>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: "block", fontSize: u(11.5), fontWeight: 700, color: t.text, letterSpacing: "-0.01em" }}>
              {tr("shot.kernel.yourProfile")}
            </span>
            <span style={{ display: "block", fontSize: u(8), color: t.muted }}>{tr("shot.kernel.meta")}</span>
          </span>
          <span style={tonePill(t, "green")}>{tr("shot.common.live")}</span>
        </div>

        {/* The two panels the profile opens with: overall mastery, and mindset. */}
        <div style={{ display: "grid", gridTemplateColumns: `${u(70)} 1fr`, gap: u(5) }}>
          <div className="shot-in" style={{ ...at(90), ...panel(t, u(9), u(6)) }}>
            <div style={{ fontSize: u(8), fontWeight: 700, color: t.text, marginBottom: u(2) }}>{tr("shot.kernel.overallMastery")}</div>
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
                {tr("shot.kernel.allConcepts")}
              </text>
            </svg>
          </div>

          <div className="shot-in" style={{ ...at(150), ...panel(t, u(9), u(7)), display: "flex", flexDirection: "column", gap: u(5) }}>
            <div style={{ display: "flex", alignItems: "center", gap: u(6) }}>
              <span style={{ flex: 1, fontSize: u(9), fontWeight: 700, color: t.text }}>{tr("shot.kernel.mindset")}</span>
              <span style={{ fontSize: u(8.5), color: t.muted }}>{tr("shot.kernel.growth")}</span>
            </div>
            {axisRow(tr("shot.kernel.growth"), MINDSET_M, ACCENT.green, 260)}
            <div style={{ fontSize: u(7.5), color: t.mutedLight }}>{tr("shot.kernel.growthDesc")}</div>
          </div>
        </div>

        {/* One card per tracked concept — the body of the page. */}
        {CONCEPTS.map((c, i) => {
          const st = KC_STATUS[c.status];
          const beat = 360 + i * 190;
          return (
            <Resolving
              key={c.id}
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
                    {tr(c.labelKey)}
                  </span>
                  <span style={{ fontSize: u(7.5), color: t.mutedLight }}>{tr(c.lastKey)}</span>
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
                    {tr(st.labelKey)}
                  </span>
                </div>
                {AXES.map((a, j) => axisRow(tr(a.labelKey), c[a.key], a.color, beat + 90 + j * 70))}
              </div>
            </Resolving>
          );
        })}
      </div>
    </ShotFrame>
  );
}

/* ───────────────────────── Study Rooms ───────────────────────── */

/** The room's five channels, in the app's own order. `rayaPrivate` renders
 *  as `<RayaName/> (private)` rather than through the label key, since the
 *  name has to stay the app's own component and not a translated string. */
const ROOM_TABS: { id: string; labelKey?: MessageKey }[] = [
  { id: "groupChat", labelKey: "shot.room.tabGroupChat" },
  { id: "rayaPrivate" },
  { id: "challenges", labelKey: "shot.room.tabChallenges" },
  { id: "files", labelKey: "shot.room.tabFiles" },
  { id: "report", labelKey: "shot.room.tabReport" },
];

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
const ROOM_TURNS: { who: "other" | "me" | "raya"; name: string; textKey: MessageKey }[] = [
  { who: "other", name: "Léa D.", textKey: "shot.room.turn1" },
  { who: "me", name: "You", textKey: "shot.room.turn2" },
  { who: "raya", name: "Raya", textKey: "shot.room.turn3" },
  { who: "other", name: "Noah K.", textKey: "shot.room.turn4" },
];

const roomBeat = (i: number) => 420 + i * 340;

/** Who is actually in the room, which room-view computes the same way from the
 *  channel's presence state (`onlineCount`). */
const ROOM_ONLINE = ROOM_MEMBERS.filter((m) => m.online).length;

/**
 * The session clock, one second per second.
 *
 * A room timer is a real thing this product enforces — the room goes read-only
 * when it runs out — and a frozen one is the single most obviously drawn pixel
 * in this shot. Six samples swapping at exactly 1000ms, so for the six seconds
 * anyone is actually looking at this card the clock is right. It stops after
 * that rather than looping: a countdown that jumped back up would undo the very
 * thing it was added to fix.
 *
 * Swapping, not cross-fading. They stack in one grid cell, so a reading that
 * outlives the gap to the next one puts two times in the same pill — and a
 * clock is the one element on this page where nobody will read the overlap as
 * a transition. It reads as a rendering fault, because that is what it is.
 */
const ROOM_CLOCK = ["24:31", "24:30", "24:29", "24:28", "24:27", "24:26"];

/** One second between readings, and one second is exactly how long a reading
 *  lives. The two have to be the same number, so they are the same number. */
const ROOM_TICK = 1000;

/**
 * A room mid-session (components/room-view.tsx + rooms/room-group-chat.tsx):
 * the real chrome — title, subject, member count, session timer — the five
 * channels, and the group thread with per-sender name labels and Raya
 * answering the room rather than one student in a private corner.
 *
 * The three things that make it read as running rather than transcribed are all
 * things room-view genuinely has, and two of them had been drawn and then lost:
 * presence (`presenceState` → a pulsing dot on the count and on each member who
 * is here), the session clock (which this product enforces, so a frozen one was
 * a lie), and Raya composing before she answers. The fourth is a half-typed
 * message in the composer, which is not a feature at all — just the shape a
 * room has when somebody is about to get it.
 */
export function RoomShot({ theme: t }: { theme: Theme }) {
  const tr = useTranslate();
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

  // The roster's avatar, and — for a member the channel says is here — the
  // app's own presence dot on the corner of it. Raya never carries one: she is
  // not a tracked member, and a dot on her would be claiming a presence the
  // real room does not report.
  const avatar = (initials: string, bg: string, online?: boolean) => (
    <span style={{ flex: "none", position: "relative", display: "inline-flex" }}>
      <span
        style={{
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
      {online && (
        <span
          className="pub-shot-live-dot"
          style={{
            position: "absolute",
            right: `-${u(1)}`,
            bottom: 0,
            width: u(6),
            height: u(6),
            borderRadius: u(999),
            background: ACCENT.green,
            // Rings against the shot's own ground, not the card's, so the dot
            // reads as sitting on the avatar rather than punched through it.
            border: `${u(1.5)} solid ${t.dark ? "#0f1930" : "#f7fafd"}`,
          }}
        />
      )}
    </span>
  );

  return (
    <ShotFrame theme={t} ratio="4 / 3" loopMs={loop("room")}>
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
            <span style={{ fontSize: u(12.5), fontWeight: 800, color: t.text, letterSpacing: "-0.01em" }}>{tr("shot.topic.trigonometry")}</span>
            {/* Subject, roster size, and who is here — the three things the real
                chrome carries. The live count is the one number in this shot
                that comes from the socket rather than the database, so it gets
                the app's own pulsing dot in front of it. */}
            <span style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: u(4), fontSize: u(8.5), color: t.muted, whiteSpace: "nowrap", overflow: "hidden" }}>
              <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>
                {tr("shot.room.membersLine")}
              </span>
              <span
                className="pub-shot-live-dot"
                style={{ flex: "none", width: u(5), height: u(5), borderRadius: u(999), background: ACCENT.green }}
              />
              <span style={{ flex: "none", fontWeight: 600, color: t.text }}>{ROOM_ONLINE} {tr("shot.common.online")}</span>
            </span>
            <span
              className="shot-in"
              style={{
                ...at(140),
                flex: "none",
                display: "grid",
                justifyItems: "end",
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
              {ROOM_CLOCK.map((c, i) => (
                <span
                  key={c}
                  /* The last reading stays; the ones before it hand over. Same
                     shape as the Kernel band's gauge — a chain of `shot-tick`
                     closed by something that does not fade back out, which is
                     also what the pill shows at rest. */
                  className={i === ROOM_CLOCK.length - 1 ? "shot-fade" : "shot-tick"}
                  style={{ ...at(140 + i * ROOM_TICK), gridArea: "1 / 1", ["--dur-span" as string]: `${ROOM_TICK}ms` }}
                >
                  ⏱ {c} {tr("shot.common.left")}
                </span>
              ))}
            </span>
          </div>

          <div style={{ display: "flex", gap: u(4), marginTop: u(6), flexWrap: "nowrap" }}>
            {ROOM_TABS.map((c, i) => (
              <span
                key={c.id}
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
                {c.id === "rayaPrivate" ? <><RayaName /> {tr("shot.room.tabPrivate")}</> : tr(c.labelKey!)}
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
                📄 Amira S. {tr("shot.room.sharedPrefix")} <strong style={{ color: t.text }}>{tr("shot.room.docTitle")}</strong>
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
                {m.who === "raya"
                  ? avatar("R", ACCENT.indigo)
                  : avatar(who?.initials ?? "", who?.bg ?? t.muted, who?.online)}
                <div style={{ display: "flex", flexDirection: "column", alignItems: mine ? "flex-end" : "flex-start", gap: u(2), minWidth: 0 }}>
                  <span style={{ fontSize: u(7), color: t.mutedLight }}>
                    {m.who === "raya" ? <RayaName /> : m.name === "You" ? tr("shot.common.you") : m.name}
                  </span>
                  <div style={bubble(m.who)}>{tr(m.textKey)}</div>
                </div>
              </div>
            );
            return m.who === "raya" ? (
              <Resolving
                key={m.textKey}
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
              <div key={m.textKey} className="shot-in" style={{ ...at(roomBeat(i)), display: "flex" , flexDirection: "column" }}>
                {row}
              </div>
            );
          })}

          {/* The composer, with the action that makes this a room and not a
              chat: bringing Raya in is something a member does on purpose. */}
          <div className="shot-in" style={{ ...at(roomBeat(4)), marginTop: "auto", display: "flex", alignItems: "center", gap: u(5) }}>
            {/* The last beat of the room, and the only one that is about a
                person rather than the product: Noah's answer lands, and you are
                already halfway through generalising it. Nothing here is a
                feature claim — it is text in an input, which is what a room
                looks like when it is working. */}
            <div
              style={{
                flex: 1,
                minWidth: 0,
                background: t.cardBg,
                border: `1px solid ${t.inputBorder}`,
                borderRadius: u(999),
                padding: `${u(6)} ${u(10)}`,
                fontSize: u(8.5),
                overflow: "hidden",
              }}
            >
              <Resolving
                delay={roomBeat(5)}
                placeholder={<span style={{ color: t.inputPlaceholder, whiteSpace: "nowrap" }}>{tr("shot.room.composerPlaceholder")}</span>}
              >
                <span style={{ color: t.text, whiteSpace: "nowrap" }}>
                  {tr("shot.room.composerDraft")}
                  <i
                    className="pub-shot-caret"
                    style={{
                      display: "inline-block",
                      width: u(1.5),
                      height: u(9),
                      marginLeft: u(2),
                      verticalAlign: "-0.1em",
                      background: t.text,
                    }}
                  />
                </span>
              </Resolving>
            </div>
            <span style={{ ...ghostPill(t), color: t.text, padding: `${u(5)} ${u(9)}` }}>
              {tr("shot.common.ask")} <RayaName />
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
const TOOLS: { id: string; labelKey: MessageKey; Icon: typeof IconSummary }[] = [
  { id: "summary", labelKey: "research.post.summary", Icon: IconSummary },
  { id: "quiz", labelKey: "shot.tools.quizMcq", Icon: IconQuiz },
  { id: "flashcards", labelKey: "shot.common.flashcards", Icon: IconFlashcards },
  { id: "mind_map", labelKey: "shot.common.mindMap", Icon: IconSummary },
];

/** The packet being generated from: several files combine into one source. */
const SOURCES: MessageKey[] = ["shot.tools.fileLesson4", "shot.tools.fileCellResp", "shot.tools.fileLabNotes"];

/**
 * The library underneath. `label` is the tool name and `meta` is the date —
 * or the status, while a row is still generating, which is exactly what the
 * real `LibraryRow` shows and what lets one row here resolve on its own beat.
 */
const LIBRARY: { labelKey: MessageKey; metaKey: MessageKey; pending?: boolean }[] = [
  { labelKey: "shot.tools.libQuizNewton", metaKey: "shot.tools.metaNewton" },
  { labelKey: "shot.tools.libFlashUnitCircle", metaKey: "shot.tools.metaUnitCircle" },
  { labelKey: "shot.tools.libMindMapFrench", metaKey: "shot.tools.metaFrench" },
  { labelKey: "shot.tools.libSummaryPhoto", metaKey: "shot.tools.metaGenerating", pending: true },
];

/**
 * The Tools Studio (components/tools.tsx), drawn as it renders: pick a tool,
 * drop a lesson in, and study what comes back — with everything already made
 * sitting in the library underneath. Every attempt on any of it lands in the
 * same Kernel profile the first shot draws, which is the section's claim.
 */
export function ToolsShot({ theme: t }: { theme: Theme }) {
  const tr = useTranslate();
  return (
    <ShotFrame theme={t} ratio="4 / 3" loopMs={loop("tools")}>
      {/* Score: the picker, the dropzone and its three sources, then Generate —
          and the library resolves row by row underneath, the last one arriving
          out of "generating" as the packet finishes. */}
      <div style={{ position: "absolute", inset: 0, padding: u(11), display: "flex", flexDirection: "column", gap: u(5) }}>
        <div className="shot-in">
          <div style={{ fontSize: u(12.5), fontWeight: 800, color: t.text, letterSpacing: "-0.01em" }}>{tr("shot.tools.title")}</div>
          <div style={{ fontSize: u(8), color: t.muted, marginTop: u(1) }}>
            {tr("shot.tools.subtitle")}
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
                  {tr(tool.labelKey)}
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
            {tr("shot.tools.dropzone")}
          </div>
          <div style={{ fontSize: u(7), color: t.mutedLight, marginTop: u(2) }}>{tr("shot.tools.dropzoneMeta")}</div>
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
              <span style={{ maxWidth: u(78), overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{tr(s)}</span>
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
            {tr("shot.common.generate")}
          </span>
          <span style={{ fontSize: u(7.5), color: t.muted }}>{tr("shot.tools.readingSources")}</span>
        </div>

        {/* The library. Everything already made from every lesson — and every
            attempt on it lands in the same Kernel profile. */}
        <div style={{ ...panel(t, u(10), u(7)), marginTop: "auto", display: "flex", flexDirection: "column" }}>
          <div className="shot-in" style={{ ...at(920), display: "flex", alignItems: "baseline", gap: u(5) }}>
            <span style={{ fontSize: u(9), fontWeight: 700, color: t.text }}>{tr("shot.tools.generatedLabel")}</span>
            <span style={{ fontSize: u(7.5), fontWeight: 600, color: t.mutedLight }}>18</span>
          </div>
          {LIBRARY.map((row, i) => (
            <Resolving
              key={row.labelKey}
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
                  {tr(row.labelKey)}
                </span>
                <span style={{ flex: "none", fontSize: u(7.5), color: t.mutedLight }}>{tr(row.metaKey)}</span>
                <span style={{ ...ghostPill(t), fontSize: u(7.5), padding: `${u(2)} ${u(7)}`, opacity: row.pending ? 0.4 : 1 }}>{tr("shot.common.study")}</span>
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
const INSTRUCTIONS: { id: string; textKey: MessageKey; subjectKey: MessageKey; on: boolean }[] = [
  { id: "unitCircle", textKey: "shot.focus.instr1", subjectKey: "shot.focus.subj1", on: true },
  { id: "essay", textKey: "shot.focus.instr2", subjectKey: "shot.focus.subj2", on: true },
  { id: "reasoning", textKey: "shot.focus.instr3", subjectKey: "shot.focus.subj3", on: true },
  { id: "molarMass", textKey: "shot.focus.instr4", subjectKey: "shot.focus.subj4", on: false },
];

export function FocusShot({ theme: t }: { theme: Theme }) {
  const tr = useTranslate();
  return (
    <ShotFrame theme={t} ratio="4 / 3" loopMs={loop("focus")}>
      {/* Score: the panel's rows resolve one after another out of their
          placeholders — the class's standing guidance loading — and only then
          is the new instruction composed and added. */}
      <div style={{ position: "absolute", inset: 0, padding: u(15), display: "flex", flexDirection: "column", gap: u(9) }}>
        <div className="shot-in" style={{ display: "flex", alignItems: "flex-start", gap: u(8) }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: u(12.5), fontWeight: 700, color: t.text, letterSpacing: "-0.01em" }}>
              {tr("shot.focus.instructionsTo")} <RayaName />
            </div>
            <div style={{ fontSize: u(9), color: t.muted, marginTop: u(2) }}>
              {tr("shot.focus.subtitle")}
            </div>
          </div>
          <span style={tonePill(t, "green")}>3 {tr("shot.common.active")}</span>
        </div>

        <div style={{ ...panel(t, u(11), u(10)), display: "flex", flexDirection: "column", gap: u(7) }}>
          {INSTRUCTIONS.map((ins, i) => (
            <Resolving
              key={ins.id}
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
                  <div style={{ fontSize: u(9.5), color: t.text, lineHeight: 1.35 }}>{tr(ins.textKey)}</div>
                  <div style={{ fontSize: u(8), color: t.mutedLight, marginTop: u(1.5) }}>{tr(ins.subjectKey)}</div>
                </div>
                <span style={ghostPill(t)}>{ins.on ? tr("shot.common.disable") : tr("shot.common.enable")}</span>
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
              {tr("shot.focus.composerDraft")}
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
            {tr("shot.focus.subjectSelect")}
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
            {tr("shot.common.add")}
          </span>
        </div>

        <div
          className="shot-in"
          style={{ ...at(1440), marginTop: "auto", paddingTop: u(8), borderTop: `1px solid ${t.cardBorder}`, fontSize: u(9), color: t.muted, lineHeight: 1.5 }}
        >
          {tr("shot.focus.reachesA")} <RayaName /> {tr("shot.focus.reachesB")}
        </div>
      </div>
    </ShotFrame>
  );
}

/* ── Step 2 · the student works, and the focus is woven in ── */

const NEXT_MATERIAL: { titleKey: MessageKey; metaKey: MessageKey; kindKey: MessageKey; tone: keyof typeof ACCENT }[] = [
  { titleKey: "shot.topic.dividingFractions", metaKey: "shot.guided.mat1Meta", kindKey: "shot.common.quiz", tone: "green" },
  { titleKey: "shot.topic.reciprocals", metaKey: "shot.guided.mat2Meta", kindKey: "shot.common.flashcards", tone: "blue" },
];

const NEXT_FORMATS: MessageKey[] = ["research.post.summary", "shot.common.mindMap", "shot.common.practiceSet"];

/**
 * The exchange, four turns of it — long enough that the escalation is visible
 * rather than asserted. Raya opens by asking, the student is wrong, Raya still
 * doesn't hand over the answer, and the student gets there themselves.
 */
const TURNS_GUIDED: { who: "raya" | "student"; textKey: MessageKey }[] = [
  { who: "raya", textKey: "shot.guided.turn1" },
  { who: "student", textKey: "shot.guided.turn2" },
  { who: "raya", textKey: "shot.guided.turn3" },
  { who: "student", textKey: "shot.guided.turn4" },
];

/** When turn `i` lands, and when Raya starts composing the one after it. */
const guidedBeat = (i: number) => 200 + i * 420;

export function GuidedShot({ theme: t }: { theme: Theme }) {
  const tr = useTranslate();
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
    <ShotFrame theme={t} ratio="4 / 3" loopMs={loop("guided")}>
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
          <span style={{ marginLeft: "auto", fontSize: u(8.5), color: t.muted }}>{tr("shot.guided.headerSubject")}</span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: u(7) }}>
          {TURNS_GUIDED.map((turn, i) =>
            turn.who === "student" ? (
              <div key={turn.textKey} className="shot-in" style={{ ...at(guidedBeat(i)), ...bubble(true) }}>
                {tr(turn.textKey)}
              </div>
            ) : (
              // Raya's turns show the composing dots first — the one beat that
              // makes the drawing read as a session running, not a screenshot.
              <Resolving
                key={turn.textKey}
                delay={guidedBeat(i)}
                placeholder={<Composing theme={t} />}
              >
                <div style={bubble(false)}>{tr(turn.textKey)}</div>
              </Resolving>
            ),
          )}
        </div>

        <div
          className="shot-in"
          style={{ ...at(guidedBeat(4)), ...panel(t, u(11), u(10)), marginTop: "auto", display: "flex", flexDirection: "column", gap: u(7) }}
        >
          <div style={{ fontSize: u(8), fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: t.muted }}>
            {tr("shot.guided.recommendedNext")}
          </div>
          {NEXT_MATERIAL.map((m, i) => (
            <Resolving
              key={m.titleKey}
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
                    {tr(m.titleKey)}
                  </span>
                  <span style={{ display: "block", fontSize: u(8), color: t.muted }}>{tr(m.metaKey)}</span>
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
                  {tr(m.kindKey)}
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
                {tr(f)}
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
const FOCUS_ROWS: { name: string; klassKey: MessageKey; subjectKey: MessageKey; statusKey: MessageKey; pct: number; risk: string }[] = [
  { name: "Maya R.", klassKey: "shot.year.9", subjectKey: "shot.subject.mathematics", statusKey: "shot.status.falseMastery", pct: 34, risk: "#ef4444" },
  { name: "Jonas T.", klassKey: "shot.year.10", subjectKey: "onb.subject.physics", statusKey: "shot.status.recurringError", pct: 41, risk: "#ef4444" },
  { name: "Aiko O.", klassKey: "shot.year.8", subjectKey: "shot.subject.french", statusKey: "shot.status.cognitiveOverload", pct: 58, risk: "#f59e0b" },
  { name: "Refik C.", klassKey: "shot.year.11", subjectKey: "onb.subject.biology", statusKey: "shot.status.passiveDependency", pct: 66, risk: "#f59e0b" },
];

export function ReturnShot({ theme: t }: { theme: Theme }) {
  const tr = useTranslate();
  return (
    <ShotFrame theme={t} ratio="4 / 3" loopMs={loop("return")}>
      {/* Score: the roll-up resolves first, then the list fills in student by
          student out of its placeholders — the morning's diagnosis arriving —
          and the blocking prerequisite lands last, on the emphasised beat. */}
      <div style={{ position: "absolute", inset: 0, padding: u(15), display: "flex", flexDirection: "column", gap: u(9) }}>
        <div className="shot-in" style={{ display: "flex", alignItems: "center", gap: u(8) }}>
          <span style={{ flex: 1, minWidth: 0, fontSize: u(12.5), fontWeight: 700, color: t.text, letterSpacing: "-0.01em" }}>
            {tr("shot.return.title")}
          </span>
          <span style={ghostPill(t)}>{tr("shot.return.openFocus")}</span>
        </div>

        {/* The roll-up above the list, so the plate carries a scale as well as
            four names: this is a class of 128, not a shortlist of four. */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: u(7) }}>
          {[
            { labelKey: "shot.return.tracked" as MessageKey, to: 128, suffix: "", tone: t.text },
            { labelKey: "shot.return.needAttention" as MessageKey, to: 12, suffix: "", tone: ACCENT.orange },
            { labelKey: "shot.return.avgMastery" as MessageKey, to: 71, suffix: "%", tone: ACCENT.green },
          ].map((k, i) => (
            <Resolving
              key={k.labelKey}
              delay={120 + i * 90}
              placeholder={
                <div style={{ display: "flex", flexDirection: "column", gap: u(4) }}>
                  <Skel theme={t} w="70%" h={5} />
                  <Skel theme={t} w="46%" h={10} />
                </div>
              }
            >
              <div style={{ background: t.inputFieldBg, border: `1px solid ${t.cardBorder}`, borderRadius: u(9), padding: `${u(6)} ${u(8)}` }}>
                <div style={{ fontSize: u(7.5), color: t.muted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{tr(k.labelKey)}</div>
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
                      {tr(r.klassKey)} · {tr(r.subjectKey)} · {tr(r.statusKey)}
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
            <div style={{ fontSize: u(9.5), fontWeight: 600, color: t.orangeText }}>{tr("shot.return.prereqTitle")}</div>
            <div style={{ fontSize: u(8.5), color: t.muted }}>{tr("shot.return.prereqBody")}</div>
          </div>
        </div>

        {/* The guardrail, stated where it is actually enforced: this panel is
            everything the teacher receives, and a transcript is not in it. */}
        <div
          className="shot-in"
          style={{ ...at(1320), marginTop: "auto", paddingTop: u(8), borderTop: `1px solid ${t.cardBorder}`, fontSize: u(9), color: t.muted, lineHeight: 1.5 }}
        >
          {tr("shot.return.footer")}
        </div>
      </div>
    </ShotFrame>
  );
}

/* ───────────────────────── The Socratic ladder ───────────────────────── */

/**
 * The student app's nav, in the app's own order and with the app's own icons
 * (components/raya/raya-shell.tsx). Labels come from the message catalogue —
 * "My Kernel", not "Kernel", and "Assignments", not "Exercises".
 */
const RAYA_NAV: { labelKey: MessageKey; Icon: typeof IconChat }[] = [
  { labelKey: "nav.chat", Icon: IconChat },
  { labelKey: "nav.rooms", Icon: IconRooms },
  { labelKey: "nav.tools", Icon: IconTools },
  { labelKey: "nav.assignments", Icon: IconQuiz },
  { labelKey: "nav.kernel", Icon: IconKernel },
  { labelKey: "nav.settings", Icon: IconSettings },
];

/** Past conversations, as the sidebar lists them under the Chat item. */
const SESSIONS: MessageKey[] = [
  "shot.topic.limitsRational",
  "shot.topic.dividingWhyInvert",
  "shot.topic.frenchTenses",
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
const TURNS: { who: "raya" | "me"; textKey: MessageKey }[] = [
  { who: "raya", textKey: "shot.socratic.turn1" },
  { who: "me", textKey: "shot.socratic.turn2" },
  { who: "raya", textKey: "shot.socratic.turn3" },
  { who: "me", textKey: "shot.socratic.turn4" },
  { who: "raya", textKey: "shot.socratic.turn5" },
  { who: "me", textKey: "shot.socratic.turn6" },
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
const FOR_YOU: { contentKey: MessageKey; sourceKey: MessageKey }[] = [
  { contentKey: "shot.socratic.forYou1", sourceKey: "shot.socratic.forYou1Source" },
  { contentKey: "shot.socratic.forYou2", sourceKey: "shot.subject.mathematics" },
  { contentKey: "shot.socratic.forYou3", sourceKey: "shot.socratic.forYou3Source" },
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
  const tr = useTranslate();
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
            tr(RAYA_NAV[0].labelKey),
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
              {tr("shot.socratic.newSession")}
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
                  {tr(s)}
                </span>
                <span style={{ flex: "none", fontSize: uw(8), color: t.mutedLight }}>✕</span>
              </div>
            ))}
          </div>

          {RAYA_NAV.slice(1).map((n, i) => navRow(tr(n.labelKey), n.Icon, false, 250 + i * 40))}

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
              <span style={{ display: "block", fontSize: uw(8), color: t.muted }}>{tr("shot.socratic.rayaPlus")}</span>
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
                {tr("shot.topic.limitsRational")}
              </span>
              <span style={{ display: "block", fontSize: uw(8.5), color: t.greenText }}>● {tr("shot.common.inSession")}</span>
            </span>
            {headerPill(tr("shot.common.viewKernelProfile"), 90)}
            {headerPill(tr("shot.common.analyze"), ANALYZE_BEAT, true)}
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
                    {tr(m.textKey)}
                  </div>
                </div>
              );

              // Raya composes before she answers; the student's turns just land.
              return mine ? (
                <div key={m.textKey} className="shot-in" style={{ ...at(turnBeat(i)), display: "flex", flexDirection: "column" }}>
                  {row}
                </div>
              ) : (
                <Resolving
                  key={m.textKey}
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
              {tr("shot.socratic.writeReplyTo")} <RayaName />...
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
            <span style={{ flex: 1, minWidth: 0, fontSize: uw(11), fontWeight: 700, color: t.text }}>{tr("shot.socratic.forYou")}</span>
            <span style={{ flex: "none", fontSize: uw(10), color: t.mutedLight }}>»</span>
          </div>

          <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", gap: uw(8), padding: uw(12) }}>
            {/* The nudges take the slack and clip if there is none; the
                analysis card below them never does — it is the payoff, and a
                panel whose top scrolls is what the real one does anyway. */}
            <div style={{ flex: "0 1 auto", minHeight: 0, overflow: "hidden", display: "flex", flexDirection: "column", gap: uw(8) }}>
              {FOR_YOU.map((r, i) => (
                <div
                  key={r.contentKey}
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
                  <div style={{ fontSize: uw(9), fontWeight: 600, color: t.text, lineHeight: 1.4 }}>{tr(r.contentKey)}</div>
                  <div style={{ fontSize: uw(8), color: t.muted, marginTop: uw(2) }}>{tr(r.sourceKey)}</div>
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
                  <span style={{ flex: 1, minWidth: 0, fontSize: uw(10), fontWeight: 700, color: t.text }}>{tr("shot.socratic.kernelAnalysis")}</span>
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
                  <strong>{tr("shot.socratic.rootGap")}</strong> {tr("shot.topic.factoringDiffSquares")}
                </div>
                <div style={{ fontSize: uw(9), color: t.text, lineHeight: 1.45, marginTop: uw(4) }}>
                  <strong>{tr("shot.socratic.summaryLabel")}</strong> {tr("shot.socratic.summaryBody")}
                </div>
                <div style={{ fontSize: uw(8), color: t.muted, marginTop: uw(6) }}>
                  {tr("shot.socratic.confidence")} 0.82 · {tr("shot.socratic.kcs")} 5 · {tr("shot.socratic.model")} gemini-3.1-flash-lite
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
  titleKey: MessageKey;
  turns: { who: "raya" | "me"; textKey: MessageKey }[];
  /** The Summary rung ends by turning the finished session into Kernel data. */
  analyze?: boolean;
}[] = [
  {
    titleKey: "shot.topic.photosynthesisLesson4",
    turns: [
      { who: "me", textKey: "shot.rung.p1_1" },
      { who: "raya", textKey: "shot.rung.p1_2" },
      { who: "me", textKey: "shot.rung.p1_3" },
      { who: "raya", textKey: "shot.rung.p1_4" },
    ],
  },
  {
    titleKey: "shot.topic.frenchTenses",
    turns: [
      { who: "me", textKey: "shot.rung.p2_1" },
      { who: "raya", textKey: "shot.rung.p2_2" },
      { who: "me", textKey: "shot.rung.p2_3" },
      { who: "raya", textKey: "shot.rung.p2_4" },
    ],
  },
  {
    titleKey: "shot.topic.balancingEquations",
    turns: [
      { who: "me", textKey: "shot.rung.p3_1" },
      { who: "raya", textKey: "shot.rung.p3_2" },
      { who: "me", textKey: "shot.rung.p3_3" },
    ],
  },
  {
    titleKey: "shot.topic.dividingFractions",
    turns: [
      { who: "raya", textKey: "shot.rung.p4_1" },
      { who: "me", textKey: "shot.rung.p4_2" },
      { who: "raya", textKey: "shot.rung.p4_3" },
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
  const tr = useTranslate();
  const session = RUNG_SESSIONS[rung] ?? RUNG_SESSIONS[0];
  // Resolved once per render — streamMs (inside rungScore) times the beats off
  // the actual rendered word count, which changes with the language, and the
  // rest of this shot draws off the same resolved strings rather than
  // re-translating on every read.
  const turns = session.turns.map((turn) => ({ who: turn.who, text: tr(turn.textKey) }));
  const { beats, end } = rungScore(turns);
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
    // STICKY_BASE + 3 × STACK_STEP = 170px down, so everything below that has to
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
                {tr(session.titleKey)}
              </span>
            </Resolving>
            {/* The header's real two-state line: `busy ? "Thinking…" : "● in
                session"` in chat-surface.tsx. It holds on Thinking while the
                turns play and settles green when the exchange lands. */}
            <Resolving
              delay={end + 80}
              placeholder={<span style={{ display: "block", fontSize: u(7.5), color: t.mutedLight }}>{tr("shot.common.thinking")}</span>}
            >
              <span style={{ display: "block", fontSize: u(7.5), color: t.greenText }}>● {tr("shot.common.inSession")}</span>
            </Resolving>
          </span>
          {headerPill(tr("shot.common.viewKernelProfile"), 70)}
          {/* On the Summary rung this is the beat that matters: the finished
              session becoming Kernel data. Elsewhere it just sits there, the
              way it does in the app until a session is worth analysing. */}
          {session.analyze ? headerPill(tr("shot.common.analyze"), end + 340, true) : headerPill(tr("shot.common.analyze"), 100)}
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
          {turns.map((m, i) => {
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
