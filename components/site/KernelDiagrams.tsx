"use client";

import { useMemo, useState, type CSSProperties, type ReactNode } from "react";
import type { Theme } from "./theme";
import { at, useShotSequence } from "./ProductShots";
import { useTranslate } from "@/components/ui/locale";
import type { MessageKey } from "@/lib/i18n";

/**
 * The two drawings in the Cognitive Kernel band.
 *
 * They are deliberately NOT in ProductShots.tsx. Every shot in that file traces
 * a screen the product renders and is judged on whether it looks like that
 * screen. Neither of these is a screen — no single surface shows the shape of
 * the system — so they are held to a different standard instead: the picture
 * has to be true even where the data is invented.
 *
 * Where the truth comes from, so the next person can re-check rather than
 * trust: the endpoints and payloads are lib/kernel/client.ts and
 * lib/kernel/types.ts; the four letters are k_raw/k_effective, v_score,
 * p_score and m_score on ConceptStateOut and MindsetOut; root_gap,
 * detection_path, recommended_path, confidence and alerts are the fields of
 * AnalyzeResponse; re_emergence_error is one of the seven KernelAlertType
 * values; the school's channel is CurriculumContext going in and
 * LoadAlertsResponse coming back.
 *
 * ── Why they look like this ───────────────────────────────────────────────
 * The first one was a labelled diagram once — stations, routes, a spec sheet
 * of the pipeline. It was accurate and nobody would read it. A landing page
 * gets one glance, and a glance can hold a shape, not a list. So the first
 * drawing is now a shape with one idea in it: the learner is in the middle and
 * everything else is in orbit around them, exchanging continuously. Every
 * label on it is a thing, not an explanation.
 *
 * The second one is drawn as a molecule on purpose. A prerequisite graph laid
 * out by a random scatter looks like noise, and noise is the opposite of the
 * claim — the claim is that this thing is *structured*, that concepts sit in
 * fixed relations to each other. Fused hexagonal rings on a lattice give
 * uniform bond lengths, three bond angles, and a shape that reads as chemistry
 * before it reads as anything else. The bonds that cross a subject are curved,
 * because those are the ones no syllabus writes down.
 *
 * Both loop while on screen through the same choreography every product shot
 * uses. That matters more here than anywhere else on the page: the claim is
 * that the Kernel and the apps talk continuously, and a still picture of a
 * loop is exactly the thing that fails to prove it.
 */

const MONO = "ui-monospace,SFMono-Regular,Menlo,monospace";
const DEG = Math.PI / 180;

/**
 * The frame both drawings sit in.
 *
 * A plain plate — no window rail. The rail on a product shot means "this is a
 * screen of the app"; putting one here would claim the architecture is
 * something you can open, which it isn't.
 */
export function DiagramFrame({
  theme: t,
  loopMs,
  restartKey,
  className,
  children,
}: {
  theme: Theme;
  /**
   * Replay the whole plate on this cycle. Only for a drawing that finishes and
   * would otherwise sit there as a still — a drawing whose motion is already
   * endless must not set it, because a replay it does not need is a hard cut
   * it cannot hide.
   */
  loopMs?: number;
  /** Changing this replays the whole plate from the top. See useShotSequence. */
  restartKey?: unknown;
  className?: string;
  children: ReactNode;
}) {
  const { ref } = useShotSequence(loopMs, restartKey);
  return (
    <div
      ref={ref}
      className={className ? `pub-diagram ${className}` : "pub-diagram"}
      style={{
        position: "relative",
        background: t.dark
          ? "linear-gradient(160deg,#0f1930 0%,#0b1324 100%)"
          : "linear-gradient(160deg,#f7fafd 0%,#eef3f9 100%)",
      }}
    >
      {children}
    </div>
  );
}

/**
 * One accent per actor, in both modes.
 *
 * The band follows the page theme instead of being permanently inverted, so
 * every colour here needs two values and both have to clear 4.5:1 as text on
 * the card behind them. The light column is the darker one — measured against
 * #ffffff these run 4.9:1 to 7.1:1.
 */
function palette(t: Theme) {
  return t.dark
    ? { learner: "#a78bfa", surface: "#7ab3f7", kernel: "#34d399", teacher: "#fbbf24" }
    : { learner: "#6d28d9", surface: "#1d4ed8", kernel: "#047857", teacher: "#b45309" };
}

/* ═════════════════ 1 · the loop — everything orbits the learner ═════════════ */

const OW = 1200;
const OH = 620;
const CX = 600;
const CY = 310;

/** Shell radii, from the learner outwards. */
const SH = [
  { rx: 208, ry: 130 }, // what the student touches
  { rx: 392, ry: 244 }, // the Kernel
  { rx: 486, ry: 268 }, // the school around it
];

type P = { x: number; y: number };

const on = (shell: number, deg: number): P => ({
  x: CX + SH[shell].rx * Math.cos(deg * DEG),
  y: CY + SH[shell].ry * Math.sin(deg * DEG),
});

/**
 * An ellipse, or a slice of one, as a polyline.
 *
 * Sampled rather than written as an `A` arc for one reason that matters: every
 * ring in this drawing carries `pathLength="100"`, so a single dash rule can
 * send beads around shells of completely different sizes at whatever speed
 * each one deserves, without anything measuring anything.
 */
function ring(rx: number, ry: number, a1 = 0, a2 = 360, steps = 84) {
  const pts: string[] = [];
  for (let i = 0; i <= steps; i++) {
    const a = (a1 + ((a2 - a1) * i) / steps) * DEG;
    pts.push(`${(CX + rx * Math.cos(a)).toFixed(1)} ${(CY + ry * Math.sin(a)).toFixed(1)}`);
  }
  return `M${pts.join(" L")}`;
}

const line = (a: P, b: P) => `M${a.x.toFixed(1)} ${a.y.toFixed(1)} L${b.x.toFixed(1)} ${b.y.toFixed(1)}`;

/** A bond with a bow in it — the control point pushed off the chord's midpoint. */
const bend = (a: P, b: P, bow = 0.2) => {
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return `M${a.x.toFixed(1)} ${a.y.toFixed(1)} Q${(mx - dy * bow).toFixed(1)} ${(my + dx * bow).toFixed(1)} ${b.x.toFixed(1)} ${b.y.toFixed(1)}`;
};

/** The three surfaces, evenly spaced on the inner shell. */
const SURFACES: { deg: number; id: string; name?: string; nameKey?: MessageKey; subKey: MessageKey; above: boolean }[] = [
  // "Raya for Schools" is a product name and stays as-is in every locale, like
  // "Raya" itself — hence `name` (literal) rather than `nameKey` for these two.
  { deg: 210, id: "raya", name: "Raya", subKey: "kd.orbit.raya.sub", above: true },
  { deg: 330, id: "rayaSchools", name: "Raya for Schools", subKey: "kd.orbit.rayaSchools.sub", above: true },
  { deg: 90, id: "homework", nameKey: "kd.orbit.homework.name", subKey: "kd.orbit.homework.sub", above: false },
];

/**
 * The four numbers, on the diagonals so the spokes arrive between them.
 *
 * Each one carries a glyph rather than only its initial, and the glyphs are
 * arguments rather than decoration — every one of them draws what that column
 * is actually measuring, in the words the cards below the drawing use:
 *
 *   K  a course of bricks   — "what holds up without help"
 *   V  a rising trend       — "how fast it's moving"
 *   P  an hourglass         — "whether it survives the week"
 *   M  a person, outlined   — "tracked per student, not per concept"
 *
 * M being the only one drawn as a person is the point of that set: the other
 * three are properties of a concept and M is a property of the human, which is
 * a real distinction in the contract (MindsetOut is not on ConceptStateOut).
 * It is outlined where the nucleus is filled, so it reads as the same person
 * seen as an attribute rather than as a second learner on the plate.
 *
 * Drawn against a 24-unit box centred on the node, so the whole set shares one
 * optical size and one stroke weight.
 */
const DIMS: { deg: number; letter: string; wordKey: MessageKey; icon: (fill: string) => ReactNode }[] = [
  {
    deg: 225,
    letter: "K",
    wordKey: "kd.word.knowledge",
    icon: (f) => (
      <g fill={f}>
        <rect x={-9} y={-8.4} width={18} height={4.6} rx={1.4} />
        <rect x={-9} y={-2.3} width={8.3} height={4.6} rx={1.4} />
        <rect x={0.7} y={-2.3} width={8.3} height={4.6} rx={1.4} />
        <rect x={-9} y={3.8} width={18} height={4.6} rx={1.4} />
      </g>
    ),
  },
  {
    deg: 315,
    letter: "V",
    wordKey: "kd.word.velocity",
    icon: (f) => (
      <g fill="none" stroke={f} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
        <path d="M-9 6 L-2.6 -0.4 L1.8 4 L8.6 -6" />
        <path d="M3.4 -6.6 H9 V-1.2" />
      </g>
    ),
  },
  {
    deg: 45,
    letter: "P",
    wordKey: "kd.word.persistence",
    icon: (f) => (
      <g fill={f}>
        <rect x={-7.6} y={-9.4} width={15.2} height={2.6} rx={1.3} />
        <rect x={-7.6} y={6.8} width={15.2} height={2.6} rx={1.3} />
        {/* Sand still in the top half, already fallen in the bottom — the
            concept has not slipped yet, but the clock is running. */}
        <path d="M-6.2 -6.8 H6.2 L0 0 Z" fillOpacity={0.45} />
        <path d="M-6.2 6.8 H6.2 L0 0 Z" />
      </g>
    ),
  },
  {
    deg: 135,
    letter: "M",
    wordKey: "kd.word.mindset",
    icon: (f) => (
      <g fill="none" stroke={f} strokeWidth={2.2} strokeLinecap="round">
        <circle cx={0} cy={-4.4} r={4} />
        <path d="M-7.8 8.4 a7.8 7.8 0 0 1 15.6 0" />
      </g>
    ),
  },
];

/**
 * Everything runs around one person.
 *
 * The nucleus is the learner. The inner shell is the three places they
 * actually touch the product. The ring outside that is the Kernel, carrying
 * the four numbers it keeps per concept. The outermost shell is the school —
 * and it is deliberately open at the two points where it attaches, because a
 * teacher never reaches through it to the student's state. They set the order
 * of things and they read what comes back; the diagnosis is not theirs to
 * edit.
 *
 * Nothing here plays a story. Packets run on every bond continuously and out
 * of phase with each other, which is the honest picture: this is not a request
 * that happens and finishes, it is traffic that never stops while anyone is
 * using the product.
 */
export function KernelLoopShot({ theme: t }: { theme: Theme }) {
  const tr = useTranslate();
  const c = palette(t);
  const onFill = t.dark ? "#0b1220" : "#ffffff";
  const faint = t.dark ? 0.3 : 0.35;

  /**
   * A node.
   *
   * The disc is wrapped in a group and the hover scale lives on the group, not
   * on the circle: `.shot-pick` drives `transform` on its own element and ends
   * on `transform: none` with `both`, so a hover transform sharing that element
   * would be silently discarded the moment the entrance finished.
   */
  const disc = (p: P, r: number, fill: string, beat: number) => (
    <g className="pub-orbit-node">
      <circle className="shot-pick" style={at(beat)} cx={p.x} cy={p.y} r={r} fill={fill} />
      <circle cx={p.x} cy={p.y} r={r + 10} fill="transparent" />
    </g>
  );

  /** A ring leaving a node — an arrival, or a heartbeat. */
  const beat = (p: P, r: number, stroke: string, delay: number, dur = 3400) => (
    <circle
      className="pub-orbit-beat"
      style={{ ...at(delay), ["--dur-beat" as string]: `${dur}ms` }}
      cx={p.x}
      cy={p.y}
      r={r}
      fill="none"
      stroke={stroke}
      strokeWidth={2}
    />
  );

  /** A packet running one bond, forever, at its own pace. */
  const packet = (k: string, d: string, stroke: string, delay: number, dur: number, width = 3) => (
    <path
      key={k}
      className="shot-flow is-loop"
      style={{ ...at(delay), ["--dur-flow" as string]: `${dur}ms` }}
      d={d}
      pathLength={100}
      strokeDasharray="14 110"
      fill="none"
      stroke={stroke}
      strokeWidth={width}
      strokeLinecap="round"
      vectorEffect="non-scaling-stroke"
    />
  );

  const teacher = on(2, 180);
  const school = on(2, 0);
  const kNode = on(1, 225);
  const mNode = on(1, 135);
  const vNode = on(1, 315);
  const pNode = on(1, 45);

  /** Kernel ↔ school, curved, and pointing the way the data really travels. */
  const outward = [bend(kNode, teacher, 0.16), bend(mNode, teacher, -0.16)];
  const inward = [bend(school, vNode, 0.16), bend(school, pNode, -0.16)];

  /**
   * The four quarters of the Kernel ring, so packets can run between the
   * numbers as well as in and out of them. Nothing arrives at K and stops: a
   * concept's mastery is read against how fast it is moving and what survived
   * the week, so the ring has traffic of its own.
   */
  const QUARTERS = [
    [225, 315],
    [315, 405],
    [45, 135],
    [135, 225],
  ].map(([a, b]) => ring(SH[1].rx, SH[1].ry, a, b, 28));

  /*
   * No `loopMs`. Every packet, bead, halo and heartbeat in here is already
   * `infinite`, so after the two-second entrance this drawing never becomes a
   * still and has nothing to be replayed for. It replayed every ninety seconds
   * anyway, which bought nothing and cost a hard cut: the entrances snap back
   * to opacity 0 and fade in again, over a picture that was mid-orbit. The
   * replay exists for shots that finish. This one does not finish.
   */
  return (
    <DiagramFrame theme={t}>
      <svg viewBox={`0 0 ${OW} ${OH}`} className="pub-orbit-svg" aria-hidden>
        {/* One group so the narrow layout can push the whole composition in
            without any of the geometry below knowing about it. */}
        <g className="pub-orbit-fit" style={{ ["--orbit-o" as string]: `${CX}px ${CY}px` }}>
          {/* ── the school, outermost and deliberately open at the sides ── */}
          <g className="pub-orbit-outer">
            {[
              [190, 350],
              [10, 170],
            ].map(([a1, a2]) => (
              <path
                key={a1}
                className="shot-wire"
                style={at(1400)}
                d={ring(SH[2].rx, SH[2].ry, a1, a2)}
                pathLength={100}
                strokeDasharray="100"
                fill="none"
                stroke={c.teacher}
                strokeOpacity={faint}
                strokeWidth={1.4}
                vectorEffect="non-scaling-stroke"
              />
            ))}
            {[...outward, ...inward].map((d, i) => (
              <path
                key={`sb${i}`}
                className="shot-wire"
                style={at(1500 + i * 90)}
                d={d}
                pathLength={100}
                strokeDasharray="100"
                fill="none"
                stroke={c.teacher}
                strokeOpacity={0.55}
                strokeWidth={1.6}
                vectorEffect="non-scaling-stroke"
              />
            ))}
            {/* Beads on the school's arcs too — slowly, and against the
                Kernel's direction. A term moves at a different speed from a
                conversation and the drawing should say so. */}
            {[
              [190, 350],
              [10, 170],
            ].map(([a1], k) => (
              <path
                key={`ob${a1}`}
                className="pub-orbit-run is-back"
                style={{ ["--dur-orbit" as string]: "26s", ["--d" as string]: `${k * 900}ms` }}
                d={ring(SH[2].rx, SH[2].ry, a1, a1 === 190 ? 350 : 170)}
                pathLength={100}
                strokeDasharray="1.2 15.8"
                fill="none"
                stroke={c.teacher}
                strokeOpacity={0.75}
                strokeWidth={2.8}
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
            ))}

            {outward.map((d, i) => packet(`out${i}`, d, c.kernel, 1900 + i * 700, 2600, 2.6))}
            {inward.map((d, i) => packet(`in${i}`, d, c.teacher, 2200 + i * 700, 2600, 2.6))}

            {beat(teacher, 26, c.teacher, 2600, 5200)}
            {beat(school, 26, c.teacher, 4400, 5200)}
            {disc(teacher, 18, c.teacher, 1700)}
            {disc(school, 18, c.teacher, 1800)}

            <g className="pub-orbit-side pub-orbit-side-l shot-fade" style={at(1900)}>
              <text className="pub-orbit-name" x={teacher.x} y={teacher.y + 40} fill={t.text}>
                {tr("kd.orbit.teacher.name")}
              </text>
              <text className="pub-orbit-sub" x={teacher.x} y={teacher.y + 58} fill={t.mutedLight}>
                {tr("kd.orbit.teacher.sub")}
              </text>
            </g>
            <g className="pub-orbit-side pub-orbit-side-r shot-fade" style={at(2000)}>
              <text className="pub-orbit-name" x={school.x} y={school.y + 40} fill={t.text}>
                {tr("kd.orbit.school.name")}
              </text>
              <text className="pub-orbit-sub" x={school.x} y={school.y + 58} fill={t.mutedLight}>
                {tr("kd.orbit.school.sub")}
              </text>
            </g>
          </g>

          {/* ── the Kernel ── */}
          <path
            className="shot-wire"
            style={at(900)}
            d={ring(SH[1].rx, SH[1].ry)}
            pathLength={100}
            strokeDasharray="100"
            fill="none"
            stroke={c.kernel}
            strokeOpacity={0.5}
            strokeWidth={1.8}
            vectorEffect="non-scaling-stroke"
          />
          {/* Beads riding the ring, and one brighter arc sweeping ahead of
              them. Dashes rather than circles in a rotating group: a rotation
              would take the labels with it. */}
          <path
            className="pub-orbit-run"
            style={{ ["--dur-orbit" as string]: "16s" }}
            d={ring(SH[1].rx, SH[1].ry)}
            pathLength={100}
            strokeDasharray="1.6 10.9"
            fill="none"
            stroke={c.kernel}
            strokeOpacity={0.85}
            strokeWidth={3.4}
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
          <path
            className="pub-orbit-run"
            style={{ ["--dur-orbit" as string]: "6s" }}
            d={ring(SH[1].rx, SH[1].ry)}
            pathLength={100}
            strokeDasharray="16 84"
            fill="none"
            stroke={c.kernel}
            strokeOpacity={0.9}
            strokeWidth={2.6}
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
          {/* Traffic between the four numbers. They are not four independent
              counters — mastery is read against velocity, velocity against what
              survived the week — so the ring works on itself, not only on what
              arrives from outside. */}
          {QUARTERS.map((d, i) => packet(`q${i}`, d, c.kernel, 1500 + i * 620, 2300, 2.4))}

          {/* ── the spokes: out to the Kernel, and back ── */}
          {SURFACES.map((s, i) => {
            const inner: P = { x: CX + Math.cos(s.deg * DEG) * 42, y: CY + Math.sin(s.deg * DEG) * 42 };
            const outer = on(1, s.deg);
            return (
              <g key={s.id}>
                <path
                  className="shot-wire"
                  style={at(500 + i * 110)}
                  d={line(inner, outer)}
                  pathLength={100}
                  strokeDasharray="100"
                  fill="none"
                  stroke={c.surface}
                  strokeOpacity={0.55}
                  strokeWidth={1.6}
                  vectorEffect="non-scaling-stroke"
                />
                {/* Out on every turn; back before the next one is written.
                    Three packets per spoke, deliberately not in step — traffic
                    that queues up is traffic, traffic that marches is a
                    diagram of traffic. */}
                {packet("up", line(inner, outer), c.surface, 1200 + i * 520, 1700)}
                {packet("down", line(outer, inner), c.kernel, 2050 + i * 520, 1700)}
                {packet("up2", line(inner, outer), c.surface, 2900 + i * 830, 2100)}
              </g>
            );
          })}

          {/* ── the inner shell ── */}
          <path
            className="shot-wire"
            style={at(400)}
            d={ring(SH[0].rx, SH[0].ry)}
            pathLength={100}
            strokeDasharray="100"
            fill="none"
            stroke={c.surface}
            strokeOpacity={faint}
            strokeWidth={1.4}
            vectorEffect="non-scaling-stroke"
          />
          <path
            className="pub-orbit-run is-back"
            style={{ ["--dur-orbit" as string]: "11s" }}
            d={ring(SH[0].rx, SH[0].ry)}
            pathLength={100}
            strokeDasharray="1.4 13.3"
            fill="none"
            stroke={c.surface}
            strokeOpacity={0.8}
            strokeWidth={3}
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />

          {/* ── the four numbers ── */}
          {DIMS.map((d, i) => {
            const p = on(1, d.deg);
            return (
              <g key={d.letter}>
                {/* One ring per quarter-turn of the sweep above, so the four
                    numbers light in sequence rather than blinking together. */}
                {beat(p, 35, c.kernel, i * 620, 2480)}
                <g className="pub-orbit-node">
                  <circle className="shot-pick" style={at(1000 + i * 90)} cx={p.x} cy={p.y} r={27} fill={c.kernel} />
                  <g className="shot-fade" style={at(1060 + i * 90)} transform={`translate(${p.x} ${p.y})`}>
                    {d.icon(onFill)}
                  </g>
                </g>
                {/* The initial moves down into the label, so the glyph gets the
                    disc to itself and the letter stays next to the column name
                    it belongs to — which is how the four cards below name
                    them too. */}
                <text
                  className="pub-orbit-name shot-fade"
                  style={at(1120 + i * 90)}
                  x={p.x}
                  y={p.y + 48}
                  textAnchor="middle"
                  fill={t.muted}
                >
                  <tspan fill={c.kernel} fontWeight={800}>
                    {d.letter}
                  </tspan>
                  {` · ${tr(d.wordKey)}`}
                </text>
              </g>
            );
          })}

          {/* The ring's name, sitting on the ring, on a chip that clears the
              line behind it. */}
          <g className="shot-fade" style={at(1300)}>
            <rect x={CX - 96} y={CY - SH[1].ry - 13} width={192} height={26} rx={13} fill={t.cardBg} />
            <text className="pub-orbit-chip" x={CX} y={CY - SH[1].ry + 5} textAnchor="middle" fill={c.kernel}>
              {tr("kd.orbit.chip")}
            </text>
          </g>

          {/* ── the three surfaces ── */}
          {SURFACES.map((s, i) => {
            const p = on(0, s.deg);
            const ly = s.above ? p.y - 34 : p.y + 40;
            return (
              <g key={s.id}>
                {beat(p, 27, c.surface, 300 + i * 1040, 3120)}
                {disc(p, 20, c.surface, 700 + i * 110)}
                <g className="shot-fade" style={at(820 + i * 110)}>
                  <text className="pub-orbit-name" x={p.x} y={ly} textAnchor="middle" fill={t.text}>
                    {s.name ?? tr(s.nameKey!)}
                  </text>
                  <text className="pub-orbit-sub" x={p.x} y={ly + (s.above ? -17 : 18)} textAnchor="middle" fill={t.mutedLight}>
                    {tr(s.subKey)}
                  </text>
                </g>
              </g>
            );
          })}

          {/* ── the learner ── */}
          {/* A heartbeat, three rings out of phase. It is the only motion in
              the drawing that isn't traffic, and it is deliberately the slowest
              thing on the plate: everything else here moves at the speed of a
              conversation, and this moves at the speed of a person. */}
          {[0, 1700, 3400].map((d) => (
            <g key={d}>{beat({ x: CX, y: CY }, 46, c.learner, d, 5100)}</g>
          ))}
          <circle className="pub-orbit-halo" cx={CX} cy={CY} r={64} fill={c.learner} fillOpacity={0.16} />
          <circle className="shot-pick" style={at(200)} cx={CX} cy={CY} r={38} fill={c.learner} />
          <g className="shot-fade" style={at(420)} fill={onFill}>
            <circle cx={CX} cy={CY - 8} r={9.5} />
            <path d={`M${CX - 17} ${CY + 20} a17 17 0 0 1 34 0 z`} />
          </g>
          <g className="shot-fade" style={at(560)}>
            <text className="pub-orbit-hero" x={CX} y={CY - 58} textAnchor="middle" fill={t.text}>
              {tr("kd.orbit.learner.name")}
            </text>
            <text className="pub-orbit-sub" x={CX} y={CY - 40} textAnchor="middle" fill={t.mutedLight}>
              {tr("kd.orbit.learner.sub")}
            </text>
          </g>
        </g>
      </svg>

      {/* No background of its own: a bar under the picture is a caption on the
          same plate, where the chip it replaced was a card floating over it and
          needed to be opaque to be readable. Same rule as the graph's strip. */}
      <div className="pub-orbit-foot shot-fade" style={{ ...at(2400), color: t.mutedLight, borderColor: t.cardBorder }}>
        {tr("kd.orbit.footer")}
      </div>
    </DiagramFrame>
  );
}

/* ══════════════════════ 2 · the graph, drawn as a molecule ═════════════════ */

/**
 * The ontology, at the size it actually is, on a lattice.
 *
 * Every subject is a cluster of fused hexagonal rings. That is not a costume:
 * a honeycomb gives every bond the same length and only three angles, so the
 * picture is regular wherever you look at it, and a graph that is regular
 * reads as a structure rather than as a spill. It is also completely
 * deterministic — no seeded scatter, no jitter, nothing that could differ
 * between the server's render and the browser's.
 *
 * Labels are English snake_case. The Kernel pivots through English whatever
 * language the session runs in, so this is what a node is called in the graph
 * regardless of what the student typed at it.
 */
type Subject = "math" | "physics" | "chemistry" | "biology" | "history";

const SUBJECT_COLOR: Record<Subject, { dark: string; light: string }> = {
  math: { dark: "#4C9BE8", light: "#1e6fc4" },
  // Nudged down from #b4620d, which measured 4.47:1 on white — fine as a fill,
  // three hundredths short as text, and the band's caption now sets a subject
  // name in this colour at 21.6px. #ae5e0c clears 4.5:1 on the page white AND
  // on the shot's own gradient, so the one value is safe wherever it lands.
  physics: { dark: "#E8954C", light: "#ae5e0c" },
  chemistry: { dark: "#a78bfa", light: "#6d28d9" },
  biology: { dark: "#34d399", light: "#0f766e" },
  history: { dark: "#f472b6", light: "#be185d" },
};

const W = 1200;
const H = 640;

/** Bond length. Everything else in the lattice is derived from it. */
const BOND = 33;
/** The six vertices of one ring, and the two steps between neighbouring rings. */
const HEXV = [30, 90, 150, 210, 270, 330].map((d) => [Math.cos(d * DEG) * BOND, Math.sin(d * DEG) * BOND]);
const STEP_U = [BOND * Math.sqrt(3), 0];
const STEP_V = [(BOND * Math.sqrt(3)) / 2, BOND * 1.5];

/**
 * Where each subject sits and how many rings it is made of.
 *
 * The shapes are hand-written because the arrangement is the composition:
 * maths sits low-left with its face turned to physics, because the one
 * inference this drawing exists to show runs between exactly those two.
 */
const BLOBS: { s: Subject; ox: number; oy: number; hex: [number, number][] }[] = [
  { s: "history", ox: 172, oy: 120, hex: [[0, 0], [1, 0], [0, 1]] },
  {
    s: "math",
    ox: 330,
    oy: 372,
    hex: [[0, 0], [1, 0], [0, 1], [-1, 1], [-1, 0], [0, -1], [1, -1], [2, -1]],
  },
  { s: "physics", ox: 770, oy: 205, hex: [[0, 0], [1, 0], [0, 1], [-1, 1], [-1, 0], [0, -1], [1, -1]] },
  { s: "chemistry", ox: 1000, oy: 460, hex: [[0, 0], [1, 0], [0, 1], [-1, 1], [1, -1]] },
  { s: "biology", ox: 595, oy: 520, hex: [[0, 0], [1, 0], [2, 0], [0, 1], [1, -1]] },
];

type Atom = { x: number; y: number; s: Subject };

/** Atoms, ring centres and bonds, built once at module load. */
const MOL = (() => {
  const atoms: Atom[] = [];
  const rings: Atom[] = [];
  const bonds: [number, number][] = [];
  const seen = new Set<string>();

  // Adjacent rings share two vertices. Snapping to an existing atom within a
  // couple of units is what fuses them instead of stacking two circles on the
  // same spot — comparing floats for equality would not survive the sums above.
  const add = (x: number, y: number, s: Subject) => {
    const hit = atoms.findIndex((a) => Math.abs(a.x - x) < 2 && Math.abs(a.y - y) < 2);
    if (hit >= 0) return hit;
    atoms.push({ x: +x.toFixed(2), y: +y.toFixed(2), s });
    return atoms.length - 1;
  };

  for (const b of BLOBS) {
    for (const [u, v] of b.hex) {
      const hx = b.ox + u * STEP_U[0] + v * STEP_V[0];
      const hy = b.oy + u * STEP_U[1] + v * STEP_V[1];
      rings.push({ x: +hx.toFixed(2), y: +hy.toFixed(2), s: b.s });
      const idx = HEXV.map(([dx, dy]) => add(hx + dx, hy + dy, b.s));
      for (let k = 0; k < 6; k++) {
        const i = idx[k];
        const j = idx[(k + 1) % 6];
        const key = i < j ? `${i}-${j}` : `${j}-${i}`;
        if (seen.has(key)) continue;
        seen.add(key);
        bonds.push([i, j]);
      }
    }
  }
  return { atoms, rings, bonds };
})();

const ADJ: number[][] = MOL.atoms.map(() => []);
MOL.bonds.forEach(([i, j]) => {
  ADJ[i].push(j);
  ADJ[j].push(i);
});

/** The atom nearest a point, optionally inside one subject. */
function near(x: number, y: number, s?: Subject) {
  let best = 0;
  let bd = Infinity;
  MOL.atoms.forEach((a, i) => {
    if (s && a.s !== s) return;
    const d = (a.x - x) ** 2 + (a.y - y) ** 2;
    if (d < bd) {
      bd = d;
      best = i;
    }
  });
  return best;
}

/** The shortest chain of bonds between two atoms — the walk, computed not drawn. */
function chain(from: number, to: number) {
  const prev = new Map<number, number>([[from, -1]]);
  const queue = [from];
  while (queue.length) {
    const cur = queue.shift() as number;
    if (cur === to) break;
    for (const nx of ADJ[cur]) {
      if (prev.has(nx)) continue;
      prev.set(nx, cur);
      queue.push(nx);
    }
  }
  const out: number[] = [];
  for (let cur = to; cur !== -1 && prev.has(cur); cur = prev.get(cur) as number) out.unshift(cur);
  return out;
}

/**
 * The bonds that cross a subject.
 *
 * They are the reason there is one graph and not one per course, they are the
 * only kind of edge a syllabus never writes down, and they are curved so you
 * can tell at a glance which links the Kernel inferred and which ones came out
 * of a curriculum. The first one is the story.
 */
const BRIDGE_SPEC: [[number, number, Subject], [number, number, Subject]][] = [
  [[446, 322, "math"], [688, 205, "physics"]],
  [[230, 180, "history"], [300, 300, "math"]],
  [[400, 445, "math"], [575, 495, "biology"]],
  [[845, 255, "physics"], [1010, 395, "chemistry"]],
  [[735, 530, "biology"], [950, 505, "chemistry"]],
  [[770, 285, "physics"], [650, 470, "biology"]],
  [[430, 300, "math"], [700, 240, "physics"]],
  [[250, 160, "history"], [690, 180, "physics"]],
  [[280, 415, "math"], [600, 545, "biology"]],
  [[800, 140, "physics"], [1050, 410, "chemistry"]],
];

const BRIDGES = BRIDGE_SPEC.map(([a, b], i) => ({
  a: near(a[0], a[1], a[2]),
  b: near(b[0], b[1], b[2]),
  bow: i % 2 ? 0.15 : -0.15,
}));

/**
 * A name for every concept in the graph, not just the ones a story names.
 *
 * This is what makes the drawing worth pointing at. A hundred anonymous dots
 * are a texture; a hundred named prerequisites are an ontology, and the
 * difference is the entire claim of the section. They are ordinary curriculum
 * concepts in the order a course would meet them, which is also why the
 * clusters read as coherent when you hover across one.
 */
const VOCAB: Record<Subject, string[]> = {
  math: [
    "counting", "place_value", "fractions", "decimals", "ratio_and_proportion",
    "percentages", "negative_numbers", "order_of_operations", "algebraic_expressions",
    "linear_equations", "inequalities", "systems_of_equations", "quadratic_equations",
    "factoring", "polynomials", "exponents", "radicals", "logarithms", "cartesian_plane",
    "graphing_functions", "function_notation", "domain_and_range", "function_variation",
    "limits", "derivative_functions", "chain_rule", "optimisation", "integrals",
    "sequences", "probability_basics", "standard_deviation",
  ],
  physics: [
    "units_and_measurement", "vectors", "position_and_displacement", "velocity",
    "acceleration", "kinematic_equations", "projectile_motion", "newtons_laws",
    "free_body_diagrams", "friction", "circular_motion", "momentum", "impulse",
    "work_and_energy", "conservation_of_energy", "power", "gravitation", "pressure",
    "fluid_statics", "thermal_expansion", "heat_transfer", "wave_motion", "sound_waves",
    "reflection_and_refraction", "electric_circuits", "magnetic_fields",
  ],
  chemistry: [
    "atomic_structure", "electron_configuration", "periodic_trends", "ionic_bonding",
    "covalent_bonding", "molecular_geometry", "polarity", "intermolecular_forces",
    "the_mole", "molar_mass", "stoichiometry", "limiting_reagent", "percent_yield",
    "molarity", "acids_and_bases", "ph_scale", "titration", "redox_reactions",
    "oxidation_numbers", "reaction_rates", "chemical_equilibrium", "thermochemistry",
  ],
  biology: [
    "cell_theory", "cell_membrane", "osmosis", "enzymes", "photosynthesis",
    "cellular_respiration", "atp", "mitosis", "meiosis", "dna_structure",
    "dna_replication", "transcription", "translation", "mendelian_genetics",
    "punnett_squares", "mutations", "natural_selection", "speciation", "taxonomy",
    "ecosystems", "food_webs", "homeostasis",
  ],
  history: [
    "primary_sources", "chronology", "cause_and_consequence", "ancient_civilisations",
    "roman_republic", "feudalism", "the_renaissance", "the_reformation",
    "age_of_exploration", "the_enlightenment", "industrial_revolution",
    "colonial_empires", "world_war_one", "decolonisation", "cold_war",
  ],
};

const SUBJECTS = Object.keys(SUBJECT_COLOR) as Subject[];

/**
 * The display label for every concept id in VOCAB — `voc.<id>`, one key per
 * id, built rather than hand-listed so a vocabulary id can never drift from
 * its translation key. The id itself (VOCAB) stays English snake_case in
 * every locale — see the VOCAB comment — but what a visitor actually reads,
 * on canvas and in the reading strip, is this label, translated like
 * anything else on the page.
 */
const CONCEPT_LABEL_KEY = Object.fromEntries(
  SUBJECTS.flatMap((s) => VOCAB[s].map((id) => [id, `voc.${id}`])),
) as Record<string, MessageKey>;

/** How a subject is written when it is said out loud rather than keyed. */
const SUBJECT_NAME_KEY: Record<Subject, MessageKey> = {
  math: "shot.subject.mathematics",
  physics: "onb.subject.physics",
  chemistry: "onb.subject.chemistry",
  biology: "onb.subject.biology",
  history: "kd.subject.history",
};

/**
 * Everything, filed by subject.
 *
 * Grouping the drawing this way costs nothing (the clusters do not overlap, so
 * one subject's atoms sitting above another's bonds is invisible) and buys the
 * legend its filter: dimming a whole subject becomes one opacity on one group
 * instead of a conditional on two hundred and fifty elements.
 */
const GROUPED = SUBJECTS.map((s) => ({
  s,
  rings: MOL.rings.filter((r) => r.s === s),
  bonds: MOL.bonds.filter(([i]) => MOL.atoms[i].s === s),
  atoms: MOL.atoms.map((a, i) => ({ a, i })).filter(({ a }) => a.s === s),
}));

/** Which bridges touch a given atom — for the focus layer. */
const BRIDGE_AT = (i: number) => BRIDGES.filter((b) => b.a === i || b.b === i);

const BRIDGE_C = { dark: "#E8454C", light: "#c62828" };
const FAIL_C = { dark: "#f87171", light: "#dc2626" };
const SECURE_C = { dark: "#4ade80", light: "#15803d" };

/**
 * The colours the section's own prose may borrow from the drawings.
 *
 * Exported rather than re-typed next door, because the whole value of colouring
 * a caption is that it is the SAME colour as the thing it describes. A heading
 * that says "the cause was in maths" in a blue two shades off the maths cluster
 * underneath it is worse than a black one — it implies a code and then breaks
 * it. Keeping one table means a palette change moves the prose with the ink.
 *
 * Every value here is already load-bearing inside the drawings and has been
 * checked as text against both modes; nothing new is introduced.
 */
export function kernelInk(t: Theme) {
  const s = (k: Subject) => (t.dark ? SUBJECT_COLOR[k].dark : SUBJECT_COLOR[k].light);
  return {
    /** The nucleus of the loop — the one person everything orbits. */
    learner: palette(t).learner,
    /** The other person, in the colour the loop already gives the school side. */
    teacher: palette(t).teacher,
    /** The two clusters the worked example crosses between. */
    physics: s("physics"),
    math: s("math"),
    /** The curved links, and the only lines in the graph no syllabus writes. */
    bridge: t.dark ? BRIDGE_C.dark : BRIDGE_C.light,
  };
}

/**
 * The camera stops, written as transforms.
 *
 * With `transform-origin: 0 0`, `scale(s) translate(tx,ty)` puts the point
 * (cx,cy) in the middle of the frame when tx = W/2s − cx. Deriving them from
 * the atom coordinates keeps the tour honest: move a cluster and the shot
 * framing it moves too, instead of drifting off the thing it was aimed at.
 */
const shot = (cx: number, cy: number, s: number) =>
  `scale(${s}) translate(${(W / (2 * s) - cx).toFixed(1)}px, ${(H / (2 * s) - cy).toFixed(1)}px)`;

const WIDE = shot(W / 2, H / 2, 1);
/** What a stop can see, so a label can be checked against it before it ships. */
const frame = (cx: number, cy: number, s: number) => ({
  x0: cx - W / (2 * s),
  x1: cx + W / (2 * s),
  y0: cy - H / (2 * s),
  y1: cy + H / (2 * s),
});

/**
 * Beats, in ms, against a 30 s tour, pinned to the camera stops in
 * `@keyframes graphCam`. Each `step` is one hop landing: a bond that draws
 * itself and stays drawn, a packet that runs it exactly once, and the number
 * of that step appearing inside the concept it arrives at.
 *
 * The packets deliberately do NOT loop. Three looping highlights end up all
 * running at once within a few seconds, which is precisely how a sequence of
 * steps turns back into a red smear.
 *
 * `graphLoop` in the stylesheet dims the whole plate over the last second and
 * a half, so when the sequence is torn down and restarted the restart lands on
 * an empty frame rather than cutting from a finished picture to a blank one.
 */
const G = {
  bonds: 260,
  bridges: 1300,
  step: [4400, 7700, 11000, 14300] as const,
  cross: 16600,
  root: 18700,
  secure: 23400,
  foot: 25600,
  cycle: 30000,
};

/* ─────────────────────────── the worked cases ─────────────────────────── */

/**
 * A diagnosis the tour can play, written as data.
 *
 * Only the prose is typed out. Every atom, every camera stop and every label
 * position is derived from the lattice, which is the only reason there are
 * three of these and not one: the first version had five hand-measured label
 * offsets, and adding a second case meant measuring five more by hand and
 * re-checking every camera crop by hand. Now a case is a bridge, a direction,
 * five names and six sentences.
 *
 * All three cross a subject boundary, because that is the claim. A diagnosis
 * that stayed inside its own course would be something a syllabus could have
 * told you.
 */
type CaseSpec = {
  id: string;
  chipKey: MessageKey;
  /** The crossing that carries the cause. `from` says which end fails. */
  bridge: number;
  from: Subject;
  /** Which way to walk back into the failing subject to find the attempt. */
  away: [number, number];
  /** Four names along the walk, then the root gap. English snake_case on
   *  purpose — see the VOCAB comment above; these are graph node ids, not
   *  display prose. */
  names: [string, string, string, string, string];
  /** What the two subject callouts say under their names. */
  noteKeys: [MessageKey, MessageKey];
  /** One line per step, six of them. */
  bodyKeys: [MessageKey, MessageKey, MessageKey, MessageKey, MessageKey, MessageKey];
  kickerKeys: [MessageKey, MessageKey, MessageKey, MessageKey, MessageKey, MessageKey];
  alert: string;
  confidence: string;
};

const CASE_NOTE_KEYS: [MessageKey, MessageKey] = ["kd.note.sessionBroke", "kd.note.actuallyBroke"];
const CASE_KICKER_KEYS: [MessageKey, MessageKey, MessageKey, MessageKey, MessageKey, MessageKey] = [
  "kd.kicker.failed",
  "kd.kicker.sitsOn",
  "kd.kicker.whichSitsOn",
  "kd.kicker.andThatOn",
  "kd.kicker.rootCause",
  "kd.kicker.alreadySolid",
];

const SPECS: CaseSpec[] = [
  {
    id: "mechanics",
    chipKey: "kd.case.mechanics.chip",
    bridge: 0,
    from: "physics",
    away: [1, -1],
    names: ["newtons_laws", "free_body_diagrams", "kinematic_equations", "acceleration", "derivative_functions"],
    noteKeys: CASE_NOTE_KEYS,
    kickerKeys: CASE_KICKER_KEYS,
    bodyKeys: [
      "kd.body.mechanics1",
      "kd.body.mechanics2",
      "kd.body.mechanics3",
      "kd.body.mechanics4",
      "kd.body.mechanics5",
      "kd.body.mechanics6",
    ],
    alert: "re_emergence_error",
    confidence: "0.82",
  },
  {
    id: "thermo",
    chipKey: "kd.case.thermo.chip",
    bridge: 3,
    from: "chemistry",
    away: [1, 1],
    names: ["thermochemistry", "reaction_rates", "chemical_equilibrium", "oxidation_numbers", "conservation_of_energy"],
    noteKeys: CASE_NOTE_KEYS,
    kickerKeys: CASE_KICKER_KEYS,
    bodyKeys: [
      "kd.body.thermo1",
      "kd.body.thermo2",
      "kd.body.thermo3",
      "kd.body.thermo4",
      "kd.body.thermo5",
      "kd.body.thermo6",
    ],
    alert: "false_mastery",
    confidence: "0.76",
  },
  {
    id: "respiration",
    chipKey: "kd.case.respiration.chip",
    bridge: 4,
    from: "biology",
    away: [-1, 1],
    names: ["cellular_respiration", "atp", "enzymes", "cell_membrane", "redox_reactions"],
    noteKeys: CASE_NOTE_KEYS,
    kickerKeys: CASE_KICKER_KEYS,
    bodyKeys: [
      "kd.body.respiration1",
      "kd.body.respiration2",
      "kd.body.respiration3",
      "kd.body.respiration4",
      "kd.body.respiration5",
      "kd.body.respiration6",
    ],
    alert: "passive_dependency",
    confidence: "0.79",
  },
];

/**
 * The atom exactly three bonds from the crossing, inside the failing subject.
 *
 * Three is a decision about legibility, not about the model. The walk used to
 * run six hops through concepts the drawing never named, and what you saw was
 * a red line wandering off into a cluster: every step was there and not one of
 * them was readable. Three hops between four named concepts is a chain a
 * person can follow at the speed the camera moves.
 */
function threeBondsFrom(start: number, s: Subject, away: [number, number]) {
  let ring = [start];
  const seen = new Set(ring);
  for (let d = 0; d < 3 && ring.length; d++) {
    const next: number[] = [];
    for (const i of ring) {
      for (const j of ADJ[i]) {
        if (seen.has(j) || MOL.atoms[j].s !== s) continue;
        seen.add(j);
        next.push(j);
      }
    }
    ring = next;
  }
  if (!ring.length) return start;
  // Of the atoms at that distance, the one furthest along the given heading,
  // so the walk travels back towards the boundary instead of sideways.
  const score = (i: number) => MOL.atoms[i].x * away[0] + MOL.atoms[i].y * away[1];
  return ring.reduce((best, i) => (score(i) > score(best) ? i : best), ring[0]);
}

/** Two concepts sitting behind the root gap, far enough apart to label. */
function groundBehind(root: number) {
  const near2: number[] = [];
  for (const a of ADJ[root]) {
    for (const b of ADJ[a]) {
      if (b !== root && !ADJ[root].includes(b) && !near2.includes(b)) near2.push(b);
    }
  }
  const pool = near2.length >= 2 ? near2 : ADJ[root];
  let best: [number, number] = [pool[0], pool[1] ?? pool[0]];
  let bd = -1;
  for (let i = 0; i < pool.length; i++) {
    for (let j = i + 1; j < pool.length; j++) {
      const d = (MOL.atoms[pool[i]].x - MOL.atoms[pool[j]].x) ** 2 + (MOL.atoms[pool[i]].y - MOL.atoms[pool[j]].y) ** 2;
      if (d > bd) {
        bd = d;
        best = [pool[i], pool[j]];
      }
    }
  }
  return best;
}

/**
 * Where each name goes, solved rather than measured.
 *
 * A label is about a hundred and seventy units wide and two concepts on the
 * walk are thirty-three units apart, so any fixed rule — alternate above and
 * below, push away from the centre — puts two of them on top of each other
 * sooner or later. This tries a fixed ladder of offsets and takes the first
 * that clears every label already placed, every numbered node, and the crop of
 * the camera stop that reveals it. Deterministic, so the answer is the same on
 * the server and in the browser, and cheap enough that adding a fourth case
 * costs nothing.
 */
const TRIES: [number, number, "start" | "middle" | "end"][] = [
  [0, -30, "middle"], [0, 40, "middle"],
  [20, 5, "start"], [-20, 5, "end"],
  [18, -26, "start"], [-18, -26, "end"],
  [18, 36, "start"], [-18, 36, "end"],
  [0, -50, "middle"], [0, 58, "middle"],
  [28, 5, "start"], [-28, 5, "end"],
  [26, -34, "start"], [-26, -34, "end"],
  [26, 44, "start"], [-26, 44, "end"],
];

type Box = { x0: number; x1: number; y0: number; y1: number };
const hits = (a: Box, b: Box) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;

/**
 * The label's own font size, scaled down once a translated concept name runs
 * long. English's compound ids ("free_body_diagrams") and their translations
 * are usually close in length, but German in particular compounds words the
 * others don't ("Reaktionsgeschwindigkeiten" for `reaction_rates`) — nearly
 * twice the width at the same size. Without this, TRIES' close-in offsets
 * all fail collision for the long label and every one of them falls through
 * to the ring search, landing far from the node it names even though nothing
 * is actually overlapping. Shrinking the box first keeps a long label near
 * its concept instead of solving the crowding by fleeing it.
 */
const labelFontSize = (len: number) => (len > 26 ? 10.5 : len > 19 ? 12 : 15);

function placeLabel(
  i: number,
  labelLength: number,
  taken: Box[],
  nodes: Box[],
  view: { x0: number; x1: number; y0: number; y1: number },
) {
  const a = MOL.atoms[i];
  const fontSize = labelFontSize(labelLength);
  const w = labelLength * fontSize * 0.6;
  /**
   * TRIES and the ring search below are written as the SCREEN pixels a label
   * should sit from its node — not raw graph units. The camera stop showing
   * this concept scales the whole plate by `zoom` (1× at the wide shot, up to
   * 3× zoomed in on a single node), and that scaling applies to the offset
   * exactly as it applies to everything else drawn in the same group. A
   * candidate written in raw units therefore lands `zoom` times farther from
   * the node on screen than it reads in this file — invisible at the wide
   * shot, and the reason a name drifted a quarter of the frame from the
   * concept it named the moment the camera closed in on it. Dividing every
   * offset by `zoom` here keeps the label the same few pixels from its node
   * at every stop, which is the only thing this function is trying to do.
   */
  const zoom = W / (view.x1 - view.x0);
  const u = 1 / zoom;
  for (const [tdx, tdy, anchor] of TRIES) {
    const dx = tdx * u;
    const dy = tdy * u;
    const cx = a.x + dx;
    const cy = a.y + dy;
    const x0 = anchor === "start" ? cx : anchor === "end" ? cx - w : cx - w / 2;
    const box = { x0, x1: x0 + w, y0: cy - 13, y1: cy + 4 };
    // 12 units of air inside the crop, so nothing sits on the frame edge.
    if (box.x0 < view.x0 + 12 || box.x1 > view.x1 - 12) continue;
    if (box.y0 < view.y0 + 12 || box.y1 > view.y1 - 12) continue;
    if ([...taken, ...nodes].some((o) => hits(box, o))) continue;
    return { dx, dy, anchor, box, fontSize };
  }

  // The ladder can genuinely run out — a concept in the middle of a cluster
  // with two numbered neighbours has most of its neighbourhood spoken for. Walk
  // outwards in rings until something clears, rather than dropping the label
  // somewhere blind and hoping: the blind fallback put a name straight through
  // the numbered node above it, and it took a headless check to notice.
  for (const r of [18, 26, 34, 44, 56, 70, 86]) {
    const rr = r * u; // same screen-pixel-to-raw-unit conversion as above
    for (let k = 0; k < 16; k++) {
      // Start at 12 o'clock and alternate sides, so a label lands as close to
      // straight above or below its concept as the crowding allows.
      const ang = (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 22.5 - 90;
      const dx = Math.cos(ang * DEG) * rr;
      const dy = Math.sin(ang * DEG) * rr + 5 * u;
      const anchor = dx > 8 * u ? "start" : dx < -8 * u ? "end" : "middle";
      const cx = a.x + dx;
      const x0 = anchor === "start" ? cx : anchor === "end" ? cx - w : cx - w / 2;
      const box = { x0, x1: x0 + w, y0: a.y + dy - 13, y1: a.y + dy + 4 };
      if (box.x0 < view.x0 + 12 || box.x1 > view.x1 - 12) continue;
      if (box.y0 < view.y0 + 12 || box.y1 > view.y1 - 12) continue;
      if ([...taken, ...nodes].some((o) => hits(box, o))) continue;
      return { dx, dy, anchor: anchor as "start" | "middle" | "end", box, fontSize };
    }
  }

  // Genuinely nowhere to put it. Flagged so a case added later fails loudly
  // rather than shipping a name printed over a node.
  const dy = -30 * u;
  const x0 = a.x - w / 2;
  return { dx: 0, dy, anchor: "middle" as const, box: { x0, x1: x0 + w, y0: a.y + dy - 13, y1: a.y + dy + 4 }, over: true, fontSize };
}

/** One case, fully resolved: atoms, camera, beats, label placement. */
function buildCase(spec: CaseSpec) {
  const b = BRIDGES[spec.bridge];
  const causeSide = MOL.atoms[b.a].s === spec.from ? b.a : b.b;
  const root = causeSide === b.a ? b.b : b.a;
  const failed = threeBondsFrom(causeSide, spec.from, spec.away);
  const walk = chain(failed, causeSide);
  const secure = groundBehind(root);
  const marked = [...walk, root, ...secure];
  return { spec, bridge: b, causeSide, root, failed, walk, secure, marked };
}

const CASES = SPECS.map(buildCase);

/**
 * The names, forced onto the atoms each case runs through.
 *
 * Everything else gets its subject's vocabulary in lattice order. The concepts
 * a story names have to sit where the camera is pointing, so they are swapped
 * into place — and the one they displace takes the name that was there, so no
 * concept in the graph ever loses its name or gets a second one.
 */
const NAMES: string[] = (() => {
  const taken: Partial<Record<Subject, number>> = {};
  const out = MOL.atoms.map((a) => {
    const n = taken[a.s] ?? 0;
    taken[a.s] = n + 1;
    return VOCAB[a.s][n] ?? `${a.s}_concept_${n}`;
  });
  for (const c of CASES) {
    const forced: [number, string][] = [
      [c.walk[0], c.spec.names[0]],
      [c.walk[1], c.spec.names[1]],
      [c.walk[2], c.spec.names[2]],
      [c.causeSide, c.spec.names[3]],
      [c.root, c.spec.names[4]],
    ];
    for (const [idx, name] of forced) {
      if (idx === undefined) continue;
      const cur = out.indexOf(name);
      if (cur === idx) continue;
      if (cur >= 0) out[cur] = out[idx];
      out[idx] = name;
    }
  }
  return out;
})();

/**
 * Per-case camera, beats and label placement.
 *
 * Split out from `buildCase` only because the label solver reads NAMES, and
 * NAMES cannot exist until every case has claimed its atoms.
 *
 * Takes a `labelLength` reader rather than reading NAMES directly, because the
 * box the solver clears for a label is sized off how many pixels it will
 * actually take on screen — and that changes with the language a visitor
 * reads it in. Built inside the component (see `ConceptGraphShot`) instead of
 * once at module load, so a locale switch re-solves the eighteen placements
 * against the real translated text instead of against English's.
 */
function buildTours(labelLength: (i: number) => number) {
  return CASES.map((c) => {
    const A = c.walk.map((i) => MOL.atoms[i]);
    const AR = MOL.atoms[c.root];
    const A0 = A[0];
    const near3 = 3;
    const cam = [
      WIDE,
      shot(A[0].x, A[0].y, near3),
      shot(A[1].x, A[1].y, near3),
      shot(A[2].x, A[2].y, near3),
      shot(A[3].x, A[3].y, near3),
      shot(AR.x, AR.y, 2.8),
      shot((AR.x + A0.x) / 2, (AR.y + A0.y) / 2, 1.45),
      WIDE,
    ];
    const views = [
      frame(A[0].x, A[0].y, near3),
      frame(A[1].x, A[1].y, near3),
      frame(A[2].x, A[2].y, near3),
      frame(A[3].x, A[3].y, near3),
      frame(AR.x, AR.y, 2.8),
      frame((AR.x + A0.x) / 2, (AR.y + A0.y) / 2, 1.45),
    ];

    // The numbered nodes are obstacles for every label, including their own.
    const nodes: Box[] = [...c.walk, c.root].map((i) => ({
      x0: MOL.atoms[i].x - 14,
      x1: MOL.atoms[i].x + 14,
      y0: MOL.atoms[i].y - 14,
      y1: MOL.atoms[i].y + 14,
    }));

    const taken: Box[] = [];
    const marks = c.marked.map((i, k) => {
      const step = k < 4 ? k : k === 4 ? 4 : 5;
      const at = k < 4 ? G.step[k] + 400 : k === 4 ? G.root : G.secure + (k - 5) * 300;
      const p = placeLabel(i, labelLength(i), taken, nodes, views[step]);
      taken.push(p.box);
      return { i, n: k < 5 ? k + 1 : 0, at, dx: p.dx, dy: p.dy, anchor: p.anchor, over: !!p.over, fontSize: p.fontSize };
    });

    return {
      cam,
      marks,
      /**
       * The two subjects, called out in the same corner one after the other.
       *
       * The first leaves as the camera does — its span ends ON `G.cross`, and the
       * second arrives 200ms later, so the corner is empty for the crossing
       * itself and the two names are never on the glass together. It used to run
       * 400ms past the second one's entrance, which is 400ms of "Mathematics" set
       * across "Physics" at 40px in two different colours: the one reading this
       * drawing must never offer, since naming the subject out loud is the whole
       * point of the callout.
       *
       * The second has no span. It is the half of the sentence the reading strip
       * spends the rest of the cycle unpacking, so there is nothing to hand over
       * to — and at rest it is the one word worth leaving up.
       */
      call: [
        { s: c.spec.from, noteKey: c.spec.noteKeys[0], at: 2600, span: G.cross - 2600 },
        { s: MOL.atoms[c.root].s, noteKey: c.spec.noteKeys[1], at: G.cross + 200, span: null as number | null },
      ],
    };
  });
}

/**
 * Per-concept state, the shape `/load_profile` returns it in.
 *
 * Invented, and deterministic — a hash of the index rather than Math.random,
 * because the server and the browser have to agree on every number or the page
 * rehydrates into a different graph. `k_effective` is derived from `k_raw` and
 * the days elapsed rather than drawn independently: that relationship IS the
 * forgetting model, and a panel where the two moved apart at random would be
 * quietly lying about the one thing it exists to show.
 */
function rnd01(i: number, salt: number) {
  let x = Math.imul(i + 1, 0x9e3779b1) ^ Math.imul(salt + 101, 0x85ebca6b);
  x = Math.imul(x ^ (x >>> 15), 0xc2b2ae35);
  x = Math.imul(x ^ (x >>> 13), 0x27d4eb2f);
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
}

type CState = { k: number; ke: number; v: number; p: number; days: number };

const STATE: CState[] = MOL.atoms.map((_, i) => {
  // Tuned so roughly a fifth of the map reads as a gap. That ratio is a
  // drawing decision as much as a data one: at half, the picture is full of
  // holes and looks like a broken student; at a twentieth, the one hole the
  // tour flies to has nothing to stand out from.
  const k = 0.36 + rnd01(i, 1) * 0.6;
  const days = Math.round(rnd01(i, 5) * 26);
  return {
    k,
    ke: Math.max(0.04, k - (days / 26) * 0.26 * (0.4 + rnd01(i, 2) * 0.6)),
    v: 0.08 + rnd01(i, 3) * 0.88,
    p: 0.08 + rnd01(i, 4) * 0.88,
    days,
  };
});

// Every concept a case names carries numbers that agree with what the panel
// says about it. A root gap has to read as a gap when you hover it, and the
// two "already solid" concepts have to read as secure — otherwise the drawing
// and the words beside it are describing different students.
for (const c of CASES) {
  STATE[c.root] = { k: 0.41, ke: 0.28, v: 0.28, p: 0.33, days: 11 };
  STATE[c.failed] = { k: 0.52, ke: 0.44, v: 0.31, p: 0.22, days: 4 };
  STATE[c.causeSide] = { k: 0.58, ke: 0.49, v: 0.4, p: 0.36, days: 6 };
  STATE[c.secure[0]] = { k: 0.86, ke: 0.83, v: 0.71, p: 0.79, days: 3 };
  STATE[c.secure[1]] = { k: 0.91, ke: 0.88, v: 0.74, p: 0.84, days: 2 };
}

/** The three bands `status` collapses to, and what each one looks like. */
const statusOf = (i: number) => (STATE[i].ke < 0.4 ? "gap" : STATE[i].ke < 0.72 ? "developing" : "secure");

const STATUS_KEY: Record<ReturnType<typeof statusOf>, MessageKey> = {
  gap: "kd.status.gap",
  developing: "kd.status.developing",
  secure: "kd.status.secure",
};

/**
 * The whole ontology, and one diagnosis computed against it.
 *
 * The tour is the argument. It opens on the size of the thing — five subjects,
 * a hundred concepts, bonded — then flies to a failed attempt in physics and
 * tracks the Kernel backwards, bond by bond, until it stops on a maths concept
 * on the other side of a subject boundary. Nothing in this product's category
 * produces that sentence, and no amount of prompt engineering gets you there:
 * it needs the graph, and it needs per-concept state on top of the graph.
 *
 * The panel beside it is the same response in words. It exists because the
 * canvas was carrying too many labels: a drawing can show you where the cause
 * was, but "they had this once and it came back wrong" is a sentence, and
 * sentences belong off the picture.
 */
export function ConceptGraphShot({ theme: t }: { theme: Theme }) {
  const tr = useTranslate();
  const col = (s: Subject) => (t.dark ? SUBJECT_COLOR[s].dark : SUBJECT_COLOR[s].light);
  const bridge = t.dark ? BRIDGE_C.dark : BRIDGE_C.light;
  const fail = t.dark ? FAIL_C.dark : FAIL_C.light;
  const secure = t.dark ? SECURE_C.dark : SECURE_C.light;

  const seg = (i: number, j: number) => {
    const a = MOL.atoms[i];
    const b = MOL.atoms[j];
    return `M${a.x} ${a.y} L${b.x} ${b.y}`;
  };
  const arc = (i: number, j: number, bow: number) => bend(MOL.atoms[i], MOL.atoms[j], bow);

  /**
   * Which concept the panel is describing.
   *
   * `hover` is the pointer; `pin` survives it, so a concept can be clicked and
   * kept while you go and look at something else on the drawing. Touch gets the
   * same behaviour for free — a tap fires pointerenter and click both, and the
   * pin is what makes the card outlast the finger.
   */
  const [hover, setHover] = useState<number | null>(null);
  const [pin, setPin] = useState<number | null>(null);
  const [only, setOnly] = useState<Subject | null>(null);
  const focus = hover ?? pin;

  /**
   * Which of the three worked diagnoses is playing.
   *
   * One example proves the mechanism exists; three prove it is a mechanism and
   * not a demo built around a single lucky pair of concepts. They run on the
   * same graph, and each one crosses a different boundary — physics into
   * maths, chemistry into physics, biology into chemistry.
   *
   * A switch does two things, and it needs both.
   *
   * The keys below remount the animated subtrees, so the new example is drawn
   * by elements that are unambiguously at zero rather than by reused ones
   * carrying the previous run's phase. And `ex` goes to the frame as its
   * restart key, which resets the thirty-second loop clock — without that the
   * new run inherits the remains of the cycle it interrupted, so a switch made
   * late in a tour plays for a second and then throws itself back to the start.
   *
   * Remounting alone was the old behaviour, and it left the clock desynced.
   * Resetting the clock alone leaves the reuse, which is worse: the two subject
   * callouts share one absolute corner, and one of them holding a stale phase
   * prints both names on top of each other.
   */
  const [ex, setEx] = useState(0);
  const kase = CASES[ex];
  /** A concept's id (from NAMES), translated to what a visitor actually reads. */
  const conceptLabel = (id: string) => tr((CONCEPT_LABEL_KEY[id] ?? id) as MessageKey);
  // Rebuilt whenever the locale changes (`tr` is stable across renders in the
  // same locale — see useTranslate), because the label solver sizes every box
  // off the real translated text, not off English's.
  const tours = useMemo(() => buildTours((i) => conceptLabel(NAMES[i]).length), [tr]);
  const tour = tours[ex];
  // Aliased at their old names so the drawing below reads as one diagnosis
  // rather than as a lookup repeated ninety times.
  const { walk: WALK, root: ROOT, causeSide: CAUSE_SIDE, failed: FAILED, secure: SECURE, bridge: XBRIDGE } = kase;
  const CAM = tour.cam;

  /**
   * Bonds picked to carry a permanent pulse — other people's sessions.
   *
   * Fourteen, not twenty-six. The point of these is that the graph is shared
   * and never still; past about fifteen the eye stops reading them as separate
   * events and starts reading the whole cluster as flickering, which is worse
   * than showing none at all.
   */
  const traffic = MOL.bonds.filter((_, i) => i % 9 === 4).slice(0, 14);

  /** One metric row of the concept card. */
  const metric = (label: string, value: number, tint: string, dim = false) => (
    <div className="pub-hud-metric">
      <span style={{ fontFamily: MONO, fontWeight: 700, color: dim ? t.mutedLight : tint }}>{label}</span>
      <span className="pub-hud-track" style={{ background: t.inputFieldBg }}>
        <span
          className="pub-hud-fill"
          style={{ width: `${Math.round(value * 100)}%`, background: tint, opacity: dim ? 0.45 : 1 }}
        />
      </span>
      <span style={{ fontFamily: MONO, color: dim ? t.mutedLight : t.text, textAlign: "right" }}>
        {value.toFixed(2)}
      </span>
    </div>
  );

  /**
   * The reading, as steps, in the order the tour walks them.
   *
   * It used to be a column beside the drawing. That was the wrong place twice
   * over: a narrow gutter forces every line to break three times, and a panel
   * off to one side is a thing you look at *instead* of the drawing rather than
   * with it. It now runs the full width underneath, and each step fills in at
   * the moment the camera reaches the concept it names — so the sheet is
   * written in front of you while you watch, and the two halves are never
   * describing different moments.
   *
   * `concept` is read out of NAMES rather than typed, so the text can never
   * drift from the atom the badge is actually sitting on.
   */
  /** The six rows of the reading, built from the case that is playing. */
  const tint = [fail, t.text, t.text, t.orangeText, fail, secure];
  const concept = [
    conceptLabel(NAMES[WALK[0]]),
    conceptLabel(NAMES[WALK[1]]),
    conceptLabel(NAMES[WALK[2]]),
    conceptLabel(NAMES[CAUSE_SIDE]),
    conceptLabel(NAMES[ROOT]),
    `${conceptLabel(NAMES[SECURE[0]])} · ${conceptLabel(NAMES[SECURE[1]])}`,
  ];
  const STEPS = kase.spec.bodyKeys.map((bodyKey, k) => ({
    at: k < 4 ? G.step[k] : k === 4 ? G.root : G.secure,
    n: k + 1,
    kicker: tr(kase.spec.kickerKeys[k]),
    concept: concept[k],
    accent: tint[k],
    body: tr(bodyKey),
  }));

  /**
   * The concepts that get a name printed on the canvas.
   *
   * The offsets are solved at module load, not written here — see `placeLabel`.
   * They used to be five hand-measured numbers, which was fine for one worked
   * example and became five more numbers per example after that, each needing
   * its own check against its own camera crop. `over` is the solver admitting
   * it could not find a clear spot; it never fires today, and if it starts to
   * it means a case was added whose cluster is too tight to label.
   */
  const MARKED = tour.marks.map((m) => ({
    ...m,
    tint: m.n === 0 ? secure : m.n === 1 ? fail : m.n === 5 ? fail : t.text,
  }));

  return (
    <DiagramFrame theme={t} loopMs={G.cycle} restartKey={ex}>
      {/* `pub-graph-loop` dims the whole plate over the last second and a half
          of the cycle. The replay works by tearing the `is-live` class off and
          putting it back, which rewinds every animation inside at once — from
          a finished picture that is a hard cut. Fading out first means the
          restart happens on an empty frame and the loop has no seam. */}
      <div className="pub-graph pub-graph-loop">
        <div
          className={`pub-graph-canvas${focus === null ? "" : " is-focus"}`}
          onPointerLeave={() => setHover(null)}
        >
          <svg viewBox={`0 0 ${W} ${H}`} className="pub-graph-svg" aria-hidden>
            {/* One extra group outside the camera: the narrow layout pushes a
                fixed zoom in here, so every stop of the tour becomes a tighter
                shot of the same tour rather than a second tour written for
                phones. */}
            <g className="pub-graph-zoom">
              {/* Keyed on the case, and it has to stay that way.
                  Reusing these elements across a switch looks like the cheaper
                  option and is not: an element carrying a running animation
                  keeps running it when its `--d` changes underneath, so the
                  new example inherits the old one's phase. A fresh element is
                  the only thing that is unambiguously at zero. */}
              <g
                key={kase.spec.id}
                className="pub-graph-cam"
                style={
                  {
                    "--cam0": CAM[0],
                    "--cam1": CAM[1],
                    "--cam2": CAM[2],
                    "--cam3": CAM[3],
                    "--cam4": CAM[4],
                    "--cam5": CAM[5],
                    "--cam6": CAM[6],
                    "--cam7": CAM[7],
                  } as CSSProperties
                }
              >
                {/* Everything the tour draws lives in here, so picking one
                    concept can push the whole ontology back with a single
                    opacity instead of restyling three hundred elements.

                    Nothing in this group uses `non-scaling-stroke`. It was on
                    every bond, and recomputing a hundred and fifty stroke
                    widths on each frame of a thirty-second camera move is
                    exactly the cost you feel as judder — while a bond that
                    thickens as you zoom into it is what a molecular diagram
                    does anyway. */}
                <g className="pub-graph-base">
                  {GROUPED.map((grp, gi) => (
                    <g
                      key={grp.s}
                      className="pub-graph-subj"
                      style={{ opacity: only && only !== grp.s ? 0.12 : 1 }}
                    >
                      {/* The ring markers. Chemistry's own notation for "this
                          ring is a thing, not six separate bonds" — and the
                          reason each cluster reads as a body at the wide stop
                          instead of as a wire frame. */}
                      {grp.rings.map((r, i) => (
                        <circle
                          key={`r${i}`}
                          className="shot-pick"
                          style={at(G.bonds + 700 + (gi * 7 + i) * 26)}
                          cx={r.x}
                          cy={r.y}
                          r={BOND * 0.52}
                          fill="none"
                          stroke={col(grp.s)}
                          strokeOpacity={t.dark ? 0.15 : 0.17}
                          strokeWidth={1.1}
                        />
                      ))}

                      {grp.bonds.map(([i, j], k) => (
                        <path
                          key={`b${i}-${j}`}
                          className="shot-wire"
                          style={at(G.bonds + (k % 40) * 22)}
                          d={seg(i, j)}
                          pathLength={100}
                          strokeDasharray="100"
                          fill="none"
                          stroke={col(grp.s)}
                          strokeOpacity={t.dark ? 0.4 : 0.44}
                          strokeWidth={1.3}
                        />
                      ))}

                      {/* Mastery, drawn into the atom itself. A hollow ring is
                          a concept whose k_effective has fallen through the
                          floor — so the gaps in a student's map are visible as
                          holes in the drawing before anything is hovered, and
                          the tour is flying towards one of them. */}
                      {grp.atoms.map(({ a, i }) => {
                        const st = statusOf(i);
                        const big = i === FAILED || i === ROOT;
                        const mid = i === CAUSE_SIDE || WALK.includes(i) || SECURE.includes(i);
                        return (
                          <circle
                            key={`a${i}`}
                            className="shot-pick"
                            style={at(120 + (i % 46) * 20)}
                            cx={a.x}
                            cy={a.y}
                            r={big ? 8 : mid ? 6.5 : 4.3}
                            fill={st === "gap" ? "none" : col(grp.s)}
                            fillOpacity={st === "developing" ? 0.4 : 0.92}
                            stroke={st === "gap" ? col(grp.s) : "none"}
                            strokeWidth={1.4}
                          />
                        );
                      })}
                    </g>
                  ))}

                  {/* The cross-subject bonds, bowed. Everything inside a
                      cluster is straight and regular; the only curves in the
                      drawing are the links nobody wrote down. */}
                  {BRIDGES.map((b, i) => (
                    <path
                      key={`x${i}`}
                      className="shot-wire"
                      style={at(G.bridges + i * 70)}
                      d={arc(b.a, b.b, b.bow)}
                      pathLength={100}
                      strokeDasharray="100"
                      fill="none"
                      stroke={bridge}
                      strokeOpacity={only ? 0.14 : 0.55}
                      strokeWidth={1.8}
                    />
                  ))}

                  {/* Concurrent traffic. Not decoration: a shared graph is
                      being written to by everyone using it, and a graph with a
                      single session running on it would be a drawing of a
                      demo. Twenty-six of them, staggered across nine seconds,
                      so no two ever leave together. */}
                  {traffic.map(([i, j], k) => (
                    <path
                      key={`t${i}-${j}`}
                      className="shot-flow is-loop"
                      style={{ ...at(600 + k * 690), ["--dur-flow" as string]: `${2200 + (k % 5) * 300}ms` }}
                      d={seg(i, j)}
                      pathLength={100}
                      strokeDasharray="22 110"
                      fill="none"
                      stroke={col(MOL.atoms[i].s)}
                      strokeOpacity={only && only !== MOL.atoms[i].s ? 0.12 : 0.8}
                      strokeWidth={2}
                    />
                  ))}

                  {/* And the same on four of the bridges, because the links
                      between subjects are the ones being written to hardest. */}
                  {BRIDGES.slice(1, 3).map((b, k) => (
                    <path
                      key={`bt${k}`}
                      className="shot-flow is-loop"
                      style={{ ...at(1500 + k * 1600), ["--dur-flow" as string]: "3200ms" }}
                      d={arc(b.a, b.b, b.bow)}
                      pathLength={100}
                      strokeDasharray="18 110"
                      fill="none"
                      stroke={bridge}
                      strokeOpacity={0.75}
                      strokeWidth={2.2}
                    />
                  ))}

                  {/* ── the walk, one step at a time ──
                      Each hop is two elements: a bond that draws itself at its
                      beat and then STAYS drawn, so the chain accumulates
                      behind the camera and you can see the whole path by the
                      end; and a packet that runs the hop exactly once. The
                      packet does not loop, which is the whole fix — three
                      looping highlights are all running together within six
                      seconds, and a sequence of steps turns back into a
                      smear. */}
                  {WALK.slice(0, -1).map((i, k) => (
                    <g key={`w${i}`}>
                      <path
                        className="shot-wire"
                        style={at(G.step[k + 1])}
                        d={seg(i, WALK[k + 1])}
                        pathLength={100}
                        strokeDasharray="100"
                        fill="none"
                        stroke={fail}
                        strokeWidth={3.2}
                        strokeLinecap="round"
                      />
                      <path
                        className="shot-flow"
                        style={{ ...at(G.step[k + 1]), ["--dur-flow" as string]: "1100ms" }}
                        d={seg(i, WALK[k + 1])}
                        pathLength={100}
                        strokeDasharray="30 110"
                        fill="none"
                        stroke={fail}
                        strokeWidth={5}
                        strokeLinecap="round"
                      />
                    </g>
                  ))}
                  {/* The last hop is the bridge, and it is the only one that
                      leaves the subject. */}
                  <path
                    className="shot-wire"
                    style={at(G.cross)}
                    d={arc(XBRIDGE.b, XBRIDGE.a, XBRIDGE.bow)}
                    pathLength={100}
                    strokeDasharray="100"
                    fill="none"
                    stroke={fail}
                    strokeWidth={3.2}
                    strokeLinecap="round"
                  />
                  <path
                    className="shot-flow"
                    style={{ ...at(G.cross), ["--dur-flow" as string]: "1400ms" }}
                    d={arc(XBRIDGE.b, XBRIDGE.a, XBRIDGE.bow)}
                    pathLength={100}
                    strokeDasharray="30 110"
                    fill="none"
                    stroke={fail}
                    strokeWidth={5}
                    strokeLinecap="round"
                  />

                  <circle
                    className="shot-ring"
                    style={at(G.step[0])}
                    cx={MOL.atoms[FAILED].x}
                    cy={MOL.atoms[FAILED].y}
                    r={17}
                    fill="none"
                    stroke={fail}
                    strokeWidth={2.6}
                  />
                  <circle
                    className="shot-ring"
                    style={at(G.root)}
                    cx={MOL.atoms[ROOT].x}
                    cy={MOL.atoms[ROOT].y}
                    r={19}
                    fill="none"
                    stroke={fail}
                    strokeWidth={3}
                  />
                  {SECURE.map((i) => (
                    <circle
                      key={`sec${i}`}
                      className="shot-pick"
                      style={at(G.secure)}
                      cx={MOL.atoms[i].x}
                      cy={MOL.atoms[i].y}
                      r={13}
                      fill="none"
                      stroke={secure}
                      strokeWidth={2.2}
                    />
                  ))}

                  {/* Names and step numbers, arriving with the camera that
                      frames them. The name carries a fat stroke of the plate
                      colour underneath it (paint-order: stroke) — without it a
                      label crossing a cluster is unreadable, which is what was
                      wrong before. Numbers sit up and to the right so they
                      never share space with the name. */}
                  {MARKED.map((m) => (
                    <g key={`m${m.i}`} className="shot-in" style={at(m.at)}>
                      <text
                        x={MOL.atoms[m.i].x + m.dx}
                        y={MOL.atoms[m.i].y + m.dy}
                        textAnchor={m.anchor}
                        fill={m.tint}
                        fontSize={m.fontSize}
                        fontWeight={700}
                        fontFamily={MONO}
                        paintOrder="stroke"
                        stroke={t.cardBg}
                        strokeWidth={6}
                        strokeLinejoin="round"
                      >
                        {conceptLabel(NAMES[m.i])}
                      </text>
                      {m.n > 0 && (
                        <>
                          {/* The step number IS the node — same centre, drawn
                              over it. It used to be a filled disc set twenty
                              units off to one side, and in a picture made
                              entirely of filled discs that can only read as one
                              more concept: it faked a node and it faked a bend
                              in the path. Nothing here is beside anything now.

                              The disc keeps the SUBJECT colour rather than
                              taking the diagnosis red, because watching the
                              numbers change colour between 4 and 5 is the
                              cheapest possible way to land "and the cause was
                              in another subject". The halo is the plate
                              colour, so the lattice passes behind it instead
                              of through it. */}
                          <circle
                            cx={MOL.atoms[m.i].x}
                            cy={MOL.atoms[m.i].y}
                            r={11}
                            fill={col(MOL.atoms[m.i].s)}
                            stroke={t.cardBg}
                            strokeWidth={2.5}
                          />
                          <text
                            x={MOL.atoms[m.i].x}
                            y={MOL.atoms[m.i].y + 4.6}
                            textAnchor="middle"
                            fill={t.cardBg}
                            fontSize={13}
                            fontWeight={800}
                            fontFamily={MONO}
                          >
                            {m.n}
                          </text>
                        </>
                      )}
                    </g>
                  ))}
                </g>

                {/* ── the concept under the pointer ──
                    Drawn on top of the dimmed ontology rather than by
                    restyling it: what a person wants when they point at a
                    concept is that concept and the things it touches, and
                    nothing else in the picture is worth a repaint. */}
                {focus !== null && (
                  <g className="pub-graph-focus">
                    {ADJ[focus].map((j) => (
                      <path
                        key={`fb${j}`}
                        d={seg(focus, j)}
                        fill="none"
                        stroke={col(MOL.atoms[focus].s)}
                        strokeWidth={2.4}
                      />
                    ))}
                    {BRIDGE_AT(focus).map((b, k) => (
                      <path key={`fx${k}`} d={arc(b.a, b.b, b.bow)} fill="none" stroke={bridge} strokeWidth={2.8} />
                    ))}
                    {[...ADJ[focus], ...BRIDGE_AT(focus).map((b) => (b.a === focus ? b.b : b.a))].map((j) => (
                      <circle key={`fn${j}`} cx={MOL.atoms[j].x} cy={MOL.atoms[j].y} r={5.6} fill={col(MOL.atoms[j].s)} />
                    ))}
                    <circle
                      cx={MOL.atoms[focus].x}
                      cy={MOL.atoms[focus].y}
                      r={13}
                      fill="none"
                      stroke={col(MOL.atoms[focus].s)}
                      strokeWidth={2.4}
                    />
                    <circle cx={MOL.atoms[focus].x} cy={MOL.atoms[focus].y} r={7} fill={col(MOL.atoms[focus].s)} />
                    <text
                      x={MOL.atoms[focus].x}
                      y={MOL.atoms[focus].y - 22}
                      textAnchor="middle"
                      fill={t.text}
                      fontSize={Math.min(14, labelFontSize(conceptLabel(NAMES[focus]).length))}
                      fontWeight={700}
                      fontFamily={MONO}
                      paintOrder="stroke"
                      stroke={t.cardBg}
                      strokeWidth={6}
                      strokeLinejoin="round"
                    >
                      {conceptLabel(NAMES[focus])}
                    </text>
                  </g>
                )}

                {/* The hit targets, last so they sit above everything, and
                    wider than the atoms they cover — at the wide stop an atom
                    is four pixels across and nobody can hit that. */}
                <g className="pub-graph-hit">
                  {MOL.atoms.map((a, i) => (
                    <circle
                      key={`h${i}`}
                      cx={a.x}
                      cy={a.y}
                      r={13}
                      fill="transparent"
                      onPointerEnter={() => setHover(i)}
                      onClick={() => setPin((cur) => (cur === i ? null : i))}
                    />
                  ))}
                </g>
              </g>
            </g>
          </svg>

          {/* The legend doubles as the filter. Pointing at a subject is the
              question "what is this colour doing here", and pushing the other
              four back is the answer. */}
          <div className="pub-graph-legend" style={{ color: t.mutedLight, background: t.cardBg, borderColor: t.cardBorder }}>
            {SUBJECTS.map((s) => (
              <span
                key={s}
                className={`pub-graph-key${only === s ? " is-on" : ""}`}
                style={{ color: only === s ? col(s) : undefined }}
                onPointerEnter={() => setOnly(s)}
                onPointerLeave={() => setOnly(null)}
              >
                {/* Lower-cased on purpose — the legend is the "keyed" form,
                    kept visually distinct from the capitalised subject named
                    out loud in the corner callout below. */}
                <i style={{ background: col(s) }} /> {tr(SUBJECT_NAME_KEY[s]).toLowerCase()}
              </span>
            ))}
            <span>
              <i style={{ background: bridge }} /> {tr("kd.legend.crosses")}
            </span>
          </div>

          {/* The subject, said out loud.
              The clusters are colour-coded and the legend decodes them, but a
              colour is a lookup and a word is not — and the single sentence
              this whole drawing exists to land is "the failure was in physics,
              the cause was in maths". Naming the subject as the camera enters
              it means that sentence can be got without ever reading the key.
              Set outside the camera group so it stays a caption on the frame
              rather than a label that flies about with the drawing.

              Keyed on the case as well as the subject: both callouts sit in
              this same absolute corner, so an element reused from the previous
              case — where it had a different delay and a different span — can
              hold its old phase and print one subject on top of the other.

              The one with no span is the one that stays; see `call` above for
              why the first has to be gone before the second arrives. */}
          {tour.call.map((sc) => (
            <div
              key={`${kase.spec.id}-${sc.s}`}
              className={`pub-graph-subject ${sc.span === null ? "shot-fade" : "shot-span"}`}
              style={sc.span === null ? at(sc.at) : { ...at(sc.at), ["--dur-span" as string]: `${sc.span}ms` }}
            >
              <b style={{ color: col(sc.s) }}>{tr(SUBJECT_NAME_KEY[sc.s])}</b>
              <span style={{ color: t.mutedLight }}>{tr(sc.noteKey)}</span>
            </div>
          ))}

          <div className="pub-graph-count" style={{ color: t.mutedLight, background: t.cardBg, borderColor: t.cardBorder }}>
            <b style={{ color: t.text }}>{MOL.atoms.length}</b> {tr("kd.stats.concepts")} ·{" "}
            <b style={{ color: t.text }}>{MOL.bonds.length + BRIDGES.length}</b> {tr("kd.stats.prerequisites")} ·{" "}
            <b style={{ color: bridge }}>{BRIDGES.length}</b> {tr("kd.stats.acrossBoundary")}
          </div>

        </div>

        {/* ── the reading, full width, filling in as the tour runs ── */}
        <div className="pub-graph-strip" style={{ ["--hud-edge" as string]: t.cardBorder }}>
          {focus === null ? (
            <>
              {/* The invitation used to be a chip floating on the drawing.
                  Three overlays on one picture is two too many — it belongs
                  with the reading, where every other sentence already is. */}
              <div className="pub-graph-lede">
                <span style={{ color: t.text }}>{tr("kd.lede.title")}</span>
                <span style={{ color: t.mutedLight }}>
                  {tr("kd.lede.sub")}
                </span>
              </div>

              {/* Three worked cases on the same graph. One would prove the
                  mechanism exists; three prove it is a mechanism rather than a
                  demo assembled around one lucky pair of concepts — and each
                  crosses a different boundary, so the claim is not "physics
                  rests on maths" but "the cause is wherever it is". */}
              <div className="pub-graph-cases">
                {CASES.map((c, i) => (
                  <button
                    key={c.spec.id}
                    type="button"
                    className={`pub-graph-case${i === ex ? " is-on" : ""}`}
                    onClick={() => setEx(i)}
                    style={{
                      borderColor: i === ex ? col(c.spec.from) : t.cardBorder,
                      color: i === ex ? col(c.spec.from) : t.muted,
                      background: i === ex ? "transparent" : t.cardBg,
                    }}
                  >
                    <i style={{ background: col(c.spec.from) }} />
                    {tr(c.spec.chipKey)}
                  </button>
                ))}
              </div>

              {/* One bar across the whole width, running the length of the
                  tour. It is the only thing on the plate that says how much of
                  the reasoning you have already watched. */}
              <span key={`r${kase.spec.id}`} className="pub-graph-rail" style={{ background: t.inputFieldBg }}>
                <i style={{ background: fail }} />
              </span>

              <div key={kase.spec.id} className="pub-steps">
                {STEPS.map((s) => (
                  <div key={s.n} className="pub-step shot-fade" style={at(s.at)}>
                    <span className="pub-step-n" style={{ color: t.mutedLight }}>
                      <b style={{ background: s.accent, color: t.cardBg }}>{s.n}</b>
                      {s.kicker}
                    </span>
                    <span className="pub-step-name" style={{ color: s.accent, fontFamily: MONO }}>
                      {s.concept}
                    </span>
                    <span className="pub-step-body" style={{ color: t.muted }}>
                      {s.body}
                    </span>
                  </div>
                ))}
              </div>

              <div className="pub-graph-foot shot-fade" style={{ ...at(G.foot), color: t.mutedLight, borderColor: t.cardBorder }}>
                {tr("kd.footer.alertRaised")} <b style={{ color: t.orangeText, fontFamily: MONO }}>{kase.spec.alert}</b> · {tr("kd.footer.confidence")}{" "}
                <b style={{ color: t.text }}>{kase.spec.confidence}</b> · {tr("kd.footer.walked")}{" "}
                <b style={{ color: t.text }}>{WALK.length + 1}</b> {tr("kd.footer.conceptsAcross")}{" "}
                <b style={{ color: t.text }}>2</b> {tr("kd.footer.tail")}
              </div>
            </>
          ) : (
            /* One row of ConceptStateOut, in the same slot the steps use, so
               the two readings can never crowd each other. K and K′ are two
               bars of one colour on purpose: the gap between them is the
               forgetting, and a gap is something you see rather than read. */
            <div className="pub-graph-card">
              <div className="pub-graph-card-id">
                <span className="pub-step-n" style={{ color: t.mutedLight }}>
                  <i style={{ background: col(MOL.atoms[focus].s) }} />
                  {tr(SUBJECT_NAME_KEY[MOL.atoms[focus].s]).toLowerCase()}
                </span>
                <span className="pub-step-name" style={{ color: t.text, fontFamily: MONO, fontSize: 15 }}>
                  {conceptLabel(NAMES[focus])}
                </span>
                <span
                  className="pub-hud-pill"
                  style={{
                    color: statusOf(focus) === "gap" ? fail : statusOf(focus) === "secure" ? secure : t.orangeText,
                    borderColor: statusOf(focus) === "gap" ? fail : statusOf(focus) === "secure" ? secure : t.orangeText,
                  }}
                >
                  {tr(STATUS_KEY[statusOf(focus)])}
                </span>
                <span className="pub-step-body" style={{ color: t.muted }}>
                  {tr("kd.kicker.sitsOn")} <b style={{ color: t.text }}>{ADJ[focus].length}</b> {tr("kd.stats.prerequisites")}
                  {BRIDGE_AT(focus).length > 0 && (
                    <>
                      , <b style={{ color: bridge }}>{BRIDGE_AT(focus).length}</b> {tr("kd.card.ofThemOther")}
                    </>
                  )}
                  . {pin === focus ? tr("kd.card.pinned") : tr("kd.card.clickToPin")}
                </span>
              </div>

              <div className="pub-graph-card-metrics">
                {metric("K", STATE[focus].k, col(MOL.atoms[focus].s))}
                {metric("K′", STATE[focus].ke, col(MOL.atoms[focus].s), true)}
                {metric("V", STATE[focus].v, col(MOL.atoms[focus].s))}
                {metric("P", STATE[focus].p, col(MOL.atoms[focus].s))}
                <span className="pub-step-body pub-graph-card-note" style={{ color: t.muted }}>
                  <b style={{ color: t.text }}>K′</b> {tr("kd.card.noteA")} <b style={{ color: t.text }}>K</b> {tr("kd.card.noteB")}{" "}
                  {STATE[focus].days} {tr(STATE[focus].days === 1 ? "kd.card.day" : "kd.card.days")} {tr("kd.card.untouched")}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </DiagramFrame>
  );
}
