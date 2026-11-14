import type { ReactNode } from "react";
import { AbsoluteFill, Html5Audio, Img, staticFile } from "remotion";
import { FONT_VARS, FONTS, useFontsReady } from "../brand";
import { EASE, mix, span, useTime } from "../motion";
import { At, Glow, PAL, Vignette } from "../film/kit";
import { MARKS } from "../generated/marks";
import { CUES, DURATION_SEC } from "./cues";
import { wordAt } from "./transcript";
import { ALGEBRA, DemoGraph, graphZoomAt } from "./Graph";
import {
  KernelInsights,
  RayaChat,
  StudioScreen,
  StudyRoom,
  TeacherInstructions,
  TeacherNote,
  TeacherRoster,
  TeacherStudent,
} from "./screens";
import { RAYA_SOLVED, RAYA_THREAD, ROOM_MESSAGES, SOFIA, TEACHER } from "./data";

/**
 * The YC demo cut: 148.71 s, one composition, one audio track.
 *
 * The graph never leaves; foreground blocks stack over it in story order and
 * return nothing outside their time. Every accent is pinned to a word of the
 * transcript (via `wordAt`) or a cue start — when the Whisper pass re-times
 * the cues, the picture follows.
 */

const S = (id: number): number => {
  const cue = CUES.find((c) => c.id === id);
  if (!cue) throw new Error(`no cue ${id}`);
  return cue.startSec;
};

/** Words the accents pin to. */
const W = {
  asks: wordAt("asks", 27.6) ?? 29.8,
  hint: wordAt("hint", 29.5) ?? 32.2,
  reveals: wordAt("reveals", 31.7) ?? 33.9,
  social: wordAt("social", 42.4) ?? 48.8,
  guide: wordAt("guide", 115.9) ?? 118.5,
};

/** Where the Meanwhile pull-back lands (canvas pixels): the class roster. */
const BADGE = { x: 960, y: 420 };

const fade = (t: number, a: number, b: number, c: number, d: number) => span(t, a, b, EASE.soft) * (1 - span(t, c, d, EASE.soft));

/**
 * Chat composer pinned to the bottom, even on a fresh thread: the welcome
 * screen's greeting + suggestions are hidden and its column bottom-aligned.
 * Demo-only override (the app itself is untouched); the welcome backdrop
 * class only exists while the thread is empty, so live threads are unaffected.
 */
const WELCOME_CSS = `.chat-welcome-bg > div:last-child { justify-content: flex-end !important; padding-bottom: 40px !important; }
.chat-welcome-bg > div:last-child > :nth-child(1), .chat-welcome-bg > div:last-child > :nth-child(2), .chat-welcome-bg > div:last-child > :nth-child(5) { display: none !important; }`;

/* ───────────────────────── cue 1: the orbit opening ───────────────────────── */

function OrbitOpening({ t }: { t: number }) {
  if (t < 0 || t > S(2) + 0.5) return null;
  const enter = span(t, 0, 20 / 30, EASE.arrive);
  const out = 1 - span(t, S(2), S(2) + 0.5, EASE.soft);
  const breathe = 1 + Math.sin(t * 2.1) * 0.018;
  return (
    <div style={{ position: "absolute", inset: 0, opacity: Math.min(enter, out) }}>
      <At x={960} y={520}>
        <div style={{ position: "relative", width: 0, height: 0 }}>
          <div style={{ position: "absolute", left: -310, top: -110, width: 620, height: 220, perspective: 900 }}>
            <div style={{ position: "absolute", inset: 0, borderRadius: "50%", border: `3px solid ${PAL.electric}`, opacity: 0.9, transform: `rotateX(68deg) rotate(${(t * 22).toFixed(2)}deg)`, boxShadow: `0 0 24px rgba(75,155,255,0.5)` }} />
            <div style={{ position: "absolute", inset: 0, borderRadius: "50%", border: `3px solid ${PAL.amber}`, opacity: 0.9, transform: `rotateX(68deg) rotate(${(-t * 16 + 55).toFixed(2)}deg)`, boxShadow: `0 0 24px rgba(255,181,71,0.45)` }} />
          </div>
          <Img src={MARKS["icon-512.png"]} style={{ position: "absolute", left: -140, top: -160, width: 280, height: 280, transform: `scale(${(mix(0.8, 1, enter) * breathe).toFixed(4)})`, filter: "drop-shadow(0 24px 60px rgba(0,0,0,0.5))" }} />
        </div>
      </At>
      <At x={960} y={760}>
        <div style={{ fontFamily: FONTS.display, fontWeight: 700, fontSize: 54, letterSpacing: "0.02em", color: PAL.ice, opacity: enter }}>Bluestift</div>
      </At>
    </div>
  );
}

/* ───────────────────────── cue 4: the breathing logo ───────────────────────── */

function BreathingLogo({ t }: { t: number }) {
  if (t < S(4) || t > S(5)) return null;
  const breathe = 1 + Math.sin(t * 2.1) * 0.028;
  return (
    <div style={{ position: "absolute", inset: 0, opacity: fade(t, S(4) + 0.1, S(4) + 0.5, S(5) - 0.4, S(5)) }}>
      <Glow x={960} y={540} r={340} color={PAL.blue} opacity={0.4} />
      <At x={960} y={540}>
        <Img src={MARKS["icon-512.png"]} style={{ width: 210, height: 210, transform: `scale(${breathe.toFixed(4)})`, filter: "drop-shadow(0 24px 70px rgba(0,0,0,0.55))" }} />
      </At>
    </div>
  );
}

/* ───────────────────────── the demo-data label ───────────────────────── */

function DemoLabel({ t }: { t: number }) {
  const on = t < S(2) + 0.5 ? span(t, 0.2, 0.6) * (1 - span(t, S(2), S(2) + 0.5)) : fade(t, S(5) - 0.2, S(5) + 0.3, S(18) - 0.5, S(18));
  if (on <= 0.01) return null;
  return (
    <div style={{ position: "absolute", top: 34, left: 0, right: 0, display: "flex", justifyContent: "center", opacity: on }}>
      <span style={{ fontFamily: FONTS.mono, fontSize: 19, letterSpacing: "0.24em", color: "rgba(255,181,71,0.92)", border: "1px solid rgba(255,181,71,0.4)", borderRadius: 999, padding: "8px 24px 8px 28px", background: "rgba(5,9,19,0.55)" }}>
        ILLUSTRATIVE EXAMPLE · DEMO DATA
      </span>
    </div>
  );
}

/* ───────────────────────── cues 5–6: Raya, then the Study Room ───────────────────────── */

function BlockRaya({ t }: { t: number }) {
  if (t < S(5) || t > S(6) + 0.5) return null;
  const enter = span(t, S(5), S(5) + 0.5, EASE.move);
  const out = 1 - span(t, S(6), S(6) + 0.5, EASE.soft);
  // Each reply lands on its word: asks, hint, reveals. Mines fill the gaps.
  const raya1 = W.asks - 0.25;
  const mine2 = raya1 + 1.6;
  const raya2 = W.hint - 0.2;
  const mine3 = raya2 + 1.5;
  const raya3 = W.reveals - 0.2;
  const beats = [
    { mineAt: S(5) + 1.8, mine: RAYA_THREAD[0].mine, rayaAt: raya1, raya: RAYA_THREAD[0].raya },
    { mineAt: mine2, mine: RAYA_THREAD[1].mine, rayaAt: raya2, raya: RAYA_THREAD[1].raya },
    { mineAt: mine3, mine: RAYA_THREAD[2].mine, rayaAt: raya3, raya: RAYA_THREAD[2].raya },
  ];
  return (
    <div style={{ position: "absolute", inset: 0, opacity: Math.min(enter, out) }}>
      <RayaChat t={t} beats={beats} title="Velocity-time graphs" />
    </div>
  );
}

function BlockRoom({ t }: { t: number }) {
  if (t < S(6) || t > S(7) + 0.5) return null;
  const enter = span(t, S(6), S(6) + 0.5, EASE.move);
  const out = 1 - span(t, S(7), S(7) + 0.5, EASE.soft);
  const social = span(t, W.social, W.social + 0.4) * (1 - span(t, W.social + 1.6, W.social + 2.4));
  const beats = [S(6) + 1.2, S(6) + 3.2, S(6) + 5.4, S(6) + 7.2, S(6) + 8.8, S(6) + 10.6];
  return (
    <div style={{ position: "absolute", inset: 0, opacity: Math.min(enter, out) }}>
      <StudyRoom
        t={t}
        beats={beats}
        inputAt={beats[5] - 1.6}
        inputText={ROOM_MESSAGES[5].content ?? ""}
        teacherAt={null}
        roomStart={S(6)}
        myId={SOFIA.id}
      />
      {social > 0.01 && <Glow x={960} y={508} r={620} color={PAL.electric} opacity={0.12 * social} />}
    </div>
  );
}

/* ───────────────────────── cues 7–8: the notification, the diagnosis ───────────────────────── */

function BlockInsights({ t }: { t: number }) {
  if (t < S(7) || t > S(9) + 0.5) return null;
  const morph = span(t, S(7) + 1.2, S(7) + 1.9, EASE.move);
  const toastIn = span(t, S(7), S(7) + 0.25, EASE.arrive);
  // The dive out: the frame pushes in and blurs away as Raya returns.
  const dive = span(t, S(9), S(9) + 0.4, EASE.leave);
  const zoom = mix(1, 1.12, span(t, S(8), S(8) + 3, EASE.move)) * mix(1, 1.18, dive);
  const dim = mix(0, 0.3, span(t, S(8), S(8) + 1, EASE.move));
  // Scroll the Kernel page: curve + gauge first, then the concept cards, then
  // the open "why stuck" panel as "root cause" lands on cue 8.
  const scrollY =
    mix(0, 450, span(t, S(7) + 3, S(8), EASE.move)) +
    mix(0, 300, span(t, S(8), S(8) + 2.5, EASE.move));

  const rect = {
    x: mix(1330, 0, morph),
    y: mix(150, 0, morph),
    w: mix(470, 1920, morph),
    h: mix(150, 1080, morph),
  };
  return (
    <div style={{ position: "absolute", inset: 0, opacity: 1 - dive, filter: dive > 0.01 ? `blur(${(dive * 5).toFixed(2)}px)` : undefined }}>
      <div style={{ position: "absolute", left: rect.x, top: rect.y, width: rect.w, height: rect.h, opacity: toastIn }}>
        <div style={{ position: "absolute", inset: 0, borderRadius: mix(24, 0, morph), overflow: "hidden", background: "linear-gradient(165deg,#0e1934,#070d22)", border: "1px solid rgba(159,214,255,0.25)", boxShadow: "0 2px 6px rgba(0,0,0,0.5), 0 50px 110px rgba(0,0,0,0.55)" }}>
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", gap: 18, padding: "0 30px", opacity: 1 - morph }}>
            <div style={{ width: 18, height: 18, borderRadius: "50%", background: PAL.amber, boxShadow: `0 0 18px ${PAL.amber}`, flexShrink: 0 }} />
            <div>
              <div style={{ fontFamily: FONTS.body, fontWeight: 600, fontSize: 26, color: PAL.ice, whiteSpace: "nowrap" }}>Learning insights are ready</div>
              <div style={{ fontFamily: FONTS.mono, fontSize: 15, letterSpacing: "0.2em", color: "rgba(238,246,255,0.5)" }}>NOTIFICATION · NOW</div>
            </div>
          </div>
          <div style={{ position: "absolute", inset: 0, opacity: morph, transform: `scale(${zoom.toFixed(4)})` }}>
            <KernelInsights t={t} whyAt={S(8)} whyConceptId="vt-graphs" scrollY={scrollY} />
            {dim > 0.01 && <div style={{ position: "absolute", inset: 0, background: `rgba(3,6,15,${dim.toFixed(3)})`, borderRadius: 24 }} />}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────── cue 9: the problem clicks ───────────────────────── */

function BlockSolved({ t }: { t: number }) {
  if (t < S(9) || t > S(10) + 0.4) return null;
  const enter = span(t, S(9) + 0.1, S(9) + 0.5, EASE.arrive);
  const out = 1 - span(t, S(10), S(10) + 0.3, EASE.soft);
  const beats = [{ mineAt: S(9) + 1.0, mine: RAYA_SOLVED.mine, rayaAt: S(9) + 2.6, raya: RAYA_SOLVED.raya }];
  return (
    <div style={{ position: "absolute", inset: 0, opacity: Math.min(enter, out), transform: `scale(${mix(1.05, 1, enter).toFixed(4)})` }}>
      <RayaChat t={t} beats={beats} title="Velocity-time graphs" />
    </div>
  );
}

/* ───────────────────────── cue 10: Tools Studio ───────────────────────── */

function BlockStudio({ t }: { t: number }) {
  if (t < S(10) || t > S(11) + 0.1) return null;
  const enter = span(t, S(10), S(10) + 0.6, EASE.move);
  const out = 1 - span(t, S(11) - 0.3, S(11) + 0.1, EASE.soft);
  // Creation card first (make your own from anything), then down to the
  // library where the quiz and flashcards Raya made are waiting.
  const scrollY = mix(0, 650, span(t, S(10) + 2, S(10) + 9, EASE.move));
  return (
    <div style={{ position: "absolute", inset: 0, opacity: Math.min(enter, out), transform: `translateY(${mix(140, 0, enter).toFixed(1)}px)` }}>
      <StudioScreen scrollY={scrollY} />
    </div>
  );
}

/* ───────────────────────── cues 11–12: Meanwhile… ───────────────────────── */

function TeacherFrame({ opacity }: { opacity: number }) {
  return (
    <div style={{ position: "absolute", inset: 0, opacity }}>
      <TeacherRoster filter="all" />
    </div>
  );
}

function Meanwhile({ t }: { t: number }) {
  // 93.0 → 93.53 push in (16f, ease-in) · peak · 93.6 → 94.07 pull back (14f, ease-out).
  if (t < S(11) - 0.05 || t > S(12) + 0.2) return null;
  const push = span(t, S(11), S(11) + 16 / 30, EASE.leave);
  const back = span(t, S(11) + 18 / 30, S(11) + 32 / 30, EASE.arrive);
  const s = mix(mix(1, 26, push), 1, back);
  // The aim travels faster than the zoom, so the red node stays in frame and
  // grows the whole push. The cut hides inside the full-red peak: push ends
  // centered on the algebra node, pull-back starts on the teacher badge.
  const aimPush = span(t, S(11), S(11) + 16 / 30, EASE.arrive);
  const aimBack = span(t, S(11) + 18 / 30, S(11) + 32 / 30, EASE.arrive);
  // Aim at the node where the graph's own zoom puts it, not its raw coords.
  const gz = graphZoomAt(t);
  const nodeX = 960 + (ALGEBRA.x - 960) * gz;
  const nodeY = 540 + (ALGEBRA.y - 540) * gz;
  const cx = back > 0 ? mix(BADGE.x, 960, aimBack) : mix(960, nodeX, aimPush);
  const cy = back > 0 ? mix(BADGE.y, 540, aimBack) : mix(540, nodeY, aimPush);
  const disc = span(t, S(11) + 10 / 30, S(11) + 16 / 30, EASE.leave) * (1 - span(t, S(11) + 18 / 30, S(11) + 22 / 30, EASE.arrive));
  // Opaque by the end of the pull-back (30f), so the teacher view is fully
  // readable when "Her teacher has a full class" lands — not a second later.
  const frameIn = span(t, S(11) + 17 / 30, S(11) + 30 / 30, EASE.arrive);
  const blur = mix(push * 6, 0, back);
  return (
    <div style={{ position: "absolute", inset: 0, transformOrigin: "0 0", transform: `translate(960px,540px) scale(${s.toFixed(4)}) translate(${-cx.toFixed(1)}px,${-cy.toFixed(1)}px)`, filter: blur > 0.05 ? `blur(${blur.toFixed(2)}px)` : undefined }}>
      <DemoGraph t={t} />
      <TeacherFrame opacity={frameIn} />
      {disc > 0.01 && <div style={{ position: "absolute", left: cx - 1500 * disc, top: cy - 1500 * disc, width: 3000 * disc, height: 3000 * disc, borderRadius: "50%", background: PAL.coral, opacity: Math.min(1, disc * 1.4) }} />}
    </div>
  );
}

function BlockTeacher({ t }: { t: number }) {
  if (t < S(12) + 0.15 || t > S(13) + 0.4) return null;
  const out = 1 - span(t, S(13), S(13) + 0.3, EASE.soft);
  return <TeacherFrame opacity={out} />;
}

/* ───────────────────────── cue 13: the filter, the profile ───────────────────────── */

function BlockFilter({ t }: { t: number }) {
  if (t < S(13) || t > S(14) + 0.4) return null;
  const enter = span(t, S(13), S(13) + 0.5, EASE.move);
  const out = 1 - span(t, S(14), S(14) + 0.3, EASE.soft);
  // The filter chip switches to "needs attention", then Sofia's profile cuts
  // in — low mastery and the "Leaning on answers" badge read at the top.
  const filter = t < S(13) + 1.0 ? "all" : "alert";
  const prof = span(t, S(13) + 3.5, S(13) + 4.0, EASE.move);
  return (
    <div style={{ position: "absolute", inset: 0, opacity: Math.min(enter, out) }}>
      <div style={{ position: "absolute", inset: 0, opacity: 1 - prof }}>
        <TeacherRoster filter={filter} />
      </div>
      <div style={{ position: "absolute", inset: 0, opacity: prof }}>
        <TeacherStudent scrollY={0} />
      </div>
    </div>
  );
}

/* ───────────────────────── cue 14: the red node ───────────────────────── */

function BlockGraph({ t }: { t: number }) {
  if (t < S(14) || t > S(15) + 0.4) return null;
  const enter = span(t, S(14), S(14) + 0.5, EASE.move);
  const out = 1 - span(t, S(15), S(15) + 0.4, EASE.soft);
  // Push down the profile to the learning graph, then halo the algebra gap.
  const scrollY = mix(0, 450, span(t, S(14) + 0.2, S(14) + 1.8, EASE.move));
  const halo = span(t, S(14) + 1.8, S(14) + 2.3, EASE.arrive);
  return (
    <div style={{ position: "absolute", inset: 0, opacity: Math.min(enter, out) }}>
      <TeacherStudent scrollY={scrollY} />
      {halo > 0.01 && (
        <div style={{ position: "absolute", left: 680, top: 408, transform: "translate(-50%,-50%)", opacity: halo }}>
          <div style={{ position: "absolute", left: -22, top: -22, width: 44, height: 44, borderRadius: "50%", border: "3px solid rgba(255,107,91,0.9)", boxShadow: `0 0 26px ${PAL.coral}` }} />
          <div style={{ position: "absolute", inset: -14 - Math.sin(t * 3.2) * 3, borderRadius: "50%", border: "2px solid rgba(255,107,91,0.7)" }} />
        </div>
      )}
    </div>
  );
}

/* ───────────────────────── cues 15–16: rooms, guidance, privacy ───────────────────────── */

function LockGlyph() {
  return (
    <svg width="96" height="118" viewBox="0 0 96 118">
      <rect x="18" y="50" width="60" height="52" rx="12" fill="none" stroke={PAL.ice} strokeWidth="6" />
      <path d="M33 50 V38 a15 15 0 0 1 30 0 V50" fill="none" stroke={PAL.ice} strokeWidth="6" />
      <circle cx="48" cy="74" r="6" fill={PAL.ice} />
    </svg>
  );
}

function BlockGuide({ t }: { t: number }) {
  if (t < S(15) || t > S(17) + 0.3) return null;
  const second = span(t, W.guide, W.guide + 0.4, EASE.move);
  const lock = fade(t, S(16), S(16) + 0.4, S(16) + 2.3, S(16) + 2.7);
  const out = 1 - span(t, S(17), S(17) + 0.3, EASE.soft);
  // The teacher opens the room: history lands fast, then her hello.
  const roomBeats = [0.2, 0.45, 0.7, 0.95, 1.2, 1.45].map((d) => S(15) + d);
  return (
    <div style={{ position: "absolute", inset: 0, opacity: out }}>
      <div style={{ position: "absolute", inset: 0, opacity: 1 - second }}>
        <StudyRoom t={t} beats={roomBeats} inputAt={1e9} inputText="" teacherAt={S(15) + 2.0} roomStart={S(6)} myId={TEACHER.id} />
      </div>
      <div style={{ position: "absolute", inset: 0, opacity: second }}>
        <TeacherInstructions t={t} typeAt={W.guide + 0.6} typeDur={2.6} postAt={W.guide + 3.4} />
      </div>
      {lock > 0.01 && <div style={{ position: "absolute", inset: 0, background: "#050913", opacity: lock * 0.55 }} />}
      {lock > 0.01 && (
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 18, opacity: lock }}>
          <LockGlyph />
          <div style={{ fontFamily: FONTS.display, fontWeight: 700, fontSize: 58, color: PAL.ice, letterSpacing: "-0.01em" }}>Mastery only</div>
          <div style={{ fontFamily: FONTS.mono, fontSize: 17, letterSpacing: "0.24em", color: "rgba(238,246,255,0.6)" }}>NEVER PRIVATE CONVERSATIONS</div>
        </div>
      )}
    </div>
  );
}

/* ───────────────────────── cue 17: the note ───────────────────────── */

function BlockNote({ t }: { t: number }) {
  if (t < S(17) || t > S(18) + 0.5) return null;
  const enter = span(t, S(17), S(17) + 0.5, EASE.move);
  const out = 1 - span(t, S(18), S(18) + 0.4, EASE.soft);
  return (
    <div style={{ position: "absolute", inset: 0, opacity: Math.min(enter, out), transform: `scale(${mix(0.97, 1, enter).toFixed(4)})` }}>
      <TeacherNote t={t} typeAt={S(17) + 0.8} typeDur={2.4} postAt={S(17) + 3.4} />
    </div>
  );
}

/* ───────────────────────── cue 18: the split screen ───────────────────────── */

function BlockSplit({ t }: { t: number }) {
  if (t < S(18) || t > S(19) + 0.8) return null;
  const enter = span(t, S(18), S(18) + 20 / 30, EASE.move);
  const shrink = span(t, S(19), S(19) + 0.8, EASE.leave);
  const link = span(t, S(18) + 0.4, S(18) + 1.4, EASE.move);
  const half = (side: "left" | "right") => {
    const w = 820;
    const h = 660;
    const x = side === "left" ? 110 : 990;
    const from = side === "left" ? -620 : 620;
    return { x: mix(x + from, x, enter), y: 160, w, h };
  };
  const L = half("left");
  const R = half("right");
  // Each half holds the real screen, frozen at its red-node moment.
  const z = 820 / 1920;
  const inner = (content: ReactNode) => (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", borderRadius: 24 }}>
      <div style={{ position: "absolute", left: 0, top: (660 - 1080 * z) / 2, width: 1920, height: 1080, transform: `scale(${z})`, transformOrigin: "top left" }}>
        {content}
      </div>
    </div>
  );
  return (
    <div style={{ position: "absolute", inset: 0, opacity: enter * (1 - shrink), transform: `scale(${mix(1, 0.12, shrink).toFixed(4)})`, transformOrigin: "960px 540px" }}>
      <div style={{ position: "absolute", left: L.x, top: L.y, width: L.w, height: L.h, borderRadius: 24, boxShadow: "0 2px 6px rgba(0,0,0,0.5), 0 50px 110px rgba(0,0,0,0.55)" }}>
        {inner(<KernelInsights t={S(8) + 3} whyAt={S(8)} whyConceptId="vt-graphs" scrollY={750} />)}
      </div>
      <div style={{ position: "absolute", left: R.x, top: R.y, width: R.w, height: R.h, borderRadius: 24, boxShadow: "0 2px 6px rgba(0,0,0,0.5), 0 50px 110px rgba(0,0,0,0.55)" }}>
        {inner(<TeacherStudent scrollY={450} />)}
      </div>
      {link > 0.01 && (
        <svg width={1920} height={1080} viewBox="0 0 1920 1080" style={{ position: "absolute", inset: 0 }}>
          <line x1={880} y1={490} x2={mix(880, 1040, link)} y2={490} stroke={PAL.coral} strokeWidth={10} opacity={0.35 * link} strokeLinecap="round" />
          <line x1={880} y1={490} x2={mix(880, 1040, link)} y2={490} stroke={PAL.coral} strokeWidth={3.5} opacity={link} strokeLinecap="round" />
          <circle cx={880} cy={490} r={12} fill={PAL.coral} opacity={link} />
          <circle cx={1040} cy={490} r={12} fill={PAL.coral} opacity={link} />
        </svg>
      )}
    </div>
  );
}

/* ───────────────────────── cues 19–21: logo, line, URL ───────────────────────── */

/**
 * A title that fades in with a small rise — deliberately NOT the masked
 * rise: a big title traveling from fully below an overflow:hidden mask
 * blacks out everything under the clip edge in headless Chrome (seen at
 * 135.25 and 141.0). No clip, no blur, no %-travel: just opacity + 14 px.
 */
function FadeTitle({ t, at, out, dur = 0.5, style, children }: { t: number; at: number; out?: number; dur?: number; style?: React.CSSProperties; children: ReactNode }) {
  const p = span(t, at, at + dur, EASE.arrive);
  const leave = out != null ? 1 - span(t, out, out + 0.4, EASE.soft) : 1;
  const o = Math.min(p, leave);
  if (o <= 0.01) return null;
  return <div style={{ ...style, opacity: o, transform: `translateY(${((1 - p) * 14).toFixed(1)}px)` }}>{children}</div>;
}

function BlockOutro({ t }: { t: number }) {
  if (t < S(19)) return null;
  const logoIn = span(t, S(19) + 0.4, S(19) + 1.2, EASE.arrive);
  const logoOut = 1 - span(t, S(20) - 0.3, S(20) + 0.1, EASE.soft);
  const urlIn = span(t, S(21), S(21) + 0.4, EASE.arrive);
  return (
    <>
      {logoIn > 0.01 && logoOut > 0.01 && (
        <div style={{ position: "absolute", inset: 0, opacity: Math.min(logoIn, logoOut) }}>
          <Glow x={960} y={540} r={380} color={PAL.blue} opacity={0.35} />
          <At x={960} y={540}>
            <Img src={MARKS["icon-512.png"]} style={{ width: 250, height: 250, transform: `scale(${(0.6 + 0.4 * logoIn).toFixed(4)})`, filter: "drop-shadow(0 24px 70px rgba(0,0,0,0.55))" }} />
          </At>
        </div>
      )}
      {t >= S(20) - 0.2 && t <= S(21) + 0.2 && (
        <At x={960} y={500}>
          <FadeTitle t={t} at={S(20)} out={S(21) - 0.3} style={{ fontFamily: FONTS.display, fontWeight: 700, fontSize: 96, letterSpacing: "-0.02em", color: PAL.ice, textAlign: "center", lineHeight: 1.15 }}>
            We diagnose first.
            <br />
            The learning follows.
          </FadeTitle>
        </At>
      )}
      {t >= S(21) - 0.2 && (
        <div style={{ position: "absolute", inset: 0, opacity: urlIn }}>
          <At x={960} y={400}>
            <Img src={MARKS["icon-512.png"]} style={{ width: 150, height: 150, filter: "drop-shadow(0 18px 50px rgba(0,0,0,0.5))" }} />
          </At>
          <At x={960} y={620}>
            <FadeTitle t={t} at={S(21)} style={{ fontFamily: FONTS.display, fontWeight: 700, fontSize: 128, letterSpacing: "-0.03em", color: PAL.ice }}>
              thebluestift.com
            </FadeTitle>
          </At>
        </div>
      )}
    </>
  );
}

/* ───────────────────────── the film ───────────────────────── */

export function DemoFilm() {
  useFontsReady();
  const t = useTime();
  const meanwhile = t >= S(11) - 0.05 && t <= S(12) + 0.2;
  // The cue-4 dive: one punch into the graph as it dims.
  const punch = span(t, S(4), S(4) + 12 / 30, EASE.leave) * (1 - span(t, S(4) + 0.35, S(4) + 0.7, EASE.arrive));
  const fadeIn = 1 - span(t, 0, 0.33, EASE.soft);
  const fadeOut = span(t, DURATION_SEC - 1.0, DURATION_SEC, EASE.soft);

  return (
    <AbsoluteFill style={{ fontFamily: FONTS.body, background: "#050913" }}>
      <style>{FONT_VARS}{WELCOME_CSS}</style>
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "linear-gradient(170deg, #0a1430 0%, #070d22 55%, #050913 100%)",
          transform: punch > 0.01 ? `scale(${(1 + punch * 0.15).toFixed(4)})` : undefined,
          filter: punch > 0.01 ? `blur(${(punch * 4).toFixed(2)}px)` : undefined,
        }}
      >
        {!meanwhile && <DemoGraph t={t} />}
        {!meanwhile && (
          <>
            <OrbitOpening t={t} />
            <BreathingLogo t={t} />
            <BlockRaya t={t} />
            <BlockRoom t={t} />
            <BlockInsights t={t} />
            <BlockSolved t={t} />
            <BlockStudio t={t} />
            <BlockTeacher t={t} />
            <BlockFilter t={t} />
            <BlockGraph t={t} />
            <BlockGuide t={t} />
            <BlockNote t={t} />
            <BlockSplit t={t} />
            <BlockOutro t={t} />
          </>
        )}
        {meanwhile && <Meanwhile t={t} />}
      </div>
      <Vignette strength={0.3} />
      <DemoLabel t={t} />
      {/* brightness lift: plain white veil, no CSS filter (compositor-safe) */}
      <AbsoluteFill style={{ background: "#ffffff", opacity: 0.05 }} />
      {fadeIn > 0.01 && <AbsoluteFill style={{ background: "#050913", opacity: fadeIn }} />}
      {fadeOut > 0.01 && <AbsoluteFill style={{ background: "#000000", opacity: fadeOut }} />}
      <Html5Audio src={staticFile("audio/demo-mix.mp3")} />
    </AbsoluteFill>
  );
}
