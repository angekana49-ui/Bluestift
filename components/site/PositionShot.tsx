"use client";

import type { CSSProperties } from "react";
import type { Theme } from "./theme";
import { at } from "./ProductShots";
import { DiagramFrame, kernelInk } from "./KernelDiagrams";
import { useTranslate } from "@/components/ui/locale";
import type { MessageKey } from "@/lib/i18n";

/**
 * Where this product sits, argued on the one axis that separates the three
 * layers: time.
 *
 *   a gradebook  records an instant and keeps it — a mark, on the days work
 *                is due, and silence in between
 *   a tutor      lives an instant and loses it — brilliant while the session
 *                runs, gone the moment it ends
 *   this         holds a continuous state between them: what was understood,
 *                decaying when it is not used, repaired when it is
 *
 * Three things carry that, and each replaced something flat.
 *
 * The state is a MASS, not a line. A 3px stroke among scattered dots is three
 * greys of equal weight and the eye ranks none of them; a filled body between
 * two thin rails is obviously the subject of the picture. The two bought layers
 * are rails on purpose — they are the frame, not the argument.
 *
 * Sessions are IMPULSES, not dots. Thirteen identical circles on a dotted rule
 * read as a cloud. Bars of varying height rising toward the mass they feed read
 * as a signal train, and they say where the state comes from.
 *
 * And the readout is a LIVE GAUGE. It used to be a static label that appeared
 * once the sweep had finished, which meant the drawing held a still frame for
 * eight seconds of a seventeen-second cycle. The gauge now tracks the head the
 * whole way across, and that is not decoration — "this is readable on any day"
 * is the entire claim, so watching the number move while the two rails say
 * nothing IS the argument. Built from pre-sampled values cross-fading, so it
 * stays CSS-only: no rAF loop on a landing page.
 *
 * The picture has to be true even where the data is invented. The curve is
 * computed from the sessions below it with the Kernel's own shape — a gain per
 * session, exponential decay by weeks elapsed — which is the relationship
 * `k_raw` and `k_effective` stand in (lib/kernel/types.ts). Every number the
 * gauge shows is sampled from that curve, and the status word is derived from
 * the number, so no label can contradict what is drawn.
 */

const W = 1200;
const H = 520;

const X0 = 200;
const X1 = 1160;
/** Twelve weeks of a term, which is the unit a teacher actually plans in. */
const WEEKS = 12;
const x = (w: number) => X0 + ((X1 - X0) * w) / WEEKS;

/** The two bought layers, as rails. */
const Y_LMS = 78;
const Y_TUTOR = 458;
/**
 * The state's box. k=0 sits on the floor and the ceiling is 0.8 rather than 1:
 * nothing in this model is ever fully secure, and a scale whose top could not
 * be reached is more honest than headroom nobody uses.
 */
const K_CEIL = 0.7;
const Y_FLOOR = 380;
const Y_CEIL = 132;
const k2y = (k: number) => Y_FLOOR - ((Y_FLOOR - Y_CEIL) * k) / K_CEIL;

/**
 * The four days work was due, and the shape of the argument: the mark at 7.9
 * is the one that matters, and the state under it had already collapsed a
 * fortnight earlier.
 */
const DUE = [
  { w: 1.6, mark: "12/20" },
  { w: 4.4, mark: "13/20" },
  { w: 8.4, mark: "8/20" },
  { w: 11.6, mark: "14/20" },
];

/**
 * The sessions. Irregular on purpose — a student works when they work, not on
 * the timetable, and the mismatch between the two rhythms is half the point.
 * The three-week hole after week five is the other half.
 */
const SESSIONS = [0.5, 1.1, 1.8, 2.4, 3.1, 3.8, 4.5, 5.1, 8.8, 9.4, 10.0, 10.7, 11.3];

/** Where the reading head stops: a day with nothing due and no session running. */
const READ_W = 7.0;

/**
 * The state, as a superposition of what each session left behind.
 *
 * The first version of this applied each session as an instantaneous jump
 * followed by exponential decay, which is the textbook forgetting curve and
 * draws a sawtooth: thirteen teeth, read as a staircase. That is not only ugly,
 * it is wrong in a way worth naming — nothing a student learns lands whole at
 * the moment they learn it. Consolidation has a rise time.
 *
 * So a session deposits strength that RISES and then decays, and the state is
 * the sum of what is still standing. The rise term is squared, which makes the
 * derivative zero at the moment a session starts: no kink where a bump begins,
 * and therefore no corner anywhere in the curve. The saturation on the outside
 * is what stops thirteen sessions stacking to certainty — the last tenth is
 * always the expensive one.
 *
 * It is still the Kernel's relationship (`k_raw` and `k_effective` differ by
 * time elapsed), just modelled with the rise the sawtooth pretended away.
 */
const TAU_RISE = 0.45;
const TAU_DECAY = 1.2;
const AMP = 1.5;
const K_MAX = 0.7;

/** The superposition itself. Sessions in — must be sorted — strength out. */
function stateFrom(sessions: readonly number[], w: number): number {
  let r = 0;
  for (const s of sessions) {
    if (s >= w) break;
    const u = w - s;
    r += Math.pow(1 - Math.exp(-u / TAU_RISE), 2) * Math.exp(-u / TAU_DECAY);
  }
  return K_MAX * (1 - Math.exp(-AMP * r));
}

const stateAt = (w: number) => stateFrom(SESSIONS, w);

/** The day the term's worst mark lands, which is the day the two branches are
 *  compared on. Read off DUE rather than repeated, so they cannot drift. */
const MARK_W = DUE[2].w;

/**
 * The same term, if the Tuesday is read.
 *
 * This is the only invented thing on the plate, and it is invented the honest
 * way: the same model, the same student, the same two sessions — moved inside
 * the ten days the gradebook took to notice instead of landing after it. Not
 * more work. The same work, sooner.
 *
 * The two branches share every session before the reading, so they are the same
 * curve until the first moved session at 7.3 and the fork is earned rather than
 * asserted. And the arithmetic is the argument: on the day the 8/20 arrives the
 * real state is 0.14 and this one is 0.48 — which crosses the threshold the
 * status word is derived from, so even the label changes on its own.
 */
const ACTED = [7.3, 7.9];
const ACTED_SESSIONS = [...SESSIONS.filter((s) => s < READ_W), ...ACTED];
const actedAt = (w: number) => stateFrom(ACTED_SESSIONS, w);

/** The word the number earns. Derived, so a label can never contradict it. */
const statusOf = (k: number) => (k < 0.4 ? "fragile" : k < 0.7 ? "developing" : "secure");

const STATUS_KEY: Record<ReturnType<typeof statusOf>, MessageKey> = {
  fragile: "ps.status.fragile",
  developing: "kd.status.developing",
  secure: "kd.status.secure",
};

/**
 * The mass, as abutting columns.
 *
 * One filled path would have to be revealed by a clip animation; forty-eight
 * columns each fading in as the head reaches them is the same effect built out
 * of the one primitive this site already has, and it degrades to a complete
 * shape if motion is off. They abut exactly rather than overlapping, so a
 * translucent fill does not seam.
 */
const COLS = 48;
const COLUMNS = Array.from({ length: COLS }, (_, i) => {
  const wa = (WEEKS * i) / COLS;
  const wb = (WEEKS * (i + 1)) / COLS;
  const steps = 4;
  const top: string[] = [];
  for (let s = 0; s <= steps; s++) {
    const ww = wa + ((wb - wa) * s) / steps;
    top.push(`${x(ww).toFixed(1)} ${k2y(stateAt(ww)).toFixed(1)}`);
  }
  return {
    w: wa,
    d: `M${x(wa).toFixed(1)} ${Y_FLOOR} L${top.join(" L")} L${x(wb).toFixed(1)} ${Y_FLOOR} Z`,
  };
});

/** The crest, drawn over the mass so the shape has an edge to read. */
const CREST = (() => {
  const pts: string[] = [];
  for (let i = 0; i <= 240; i++) {
    const w = (WEEKS * i) / 240;
    pts.push(`${x(w).toFixed(1)} ${k2y(stateAt(w)).toFixed(1)}`);
  }
  return `M${pts.join(" L")}`;
})();

/**
 * The branch, and the ground between the two branches.
 *
 * It leaves from the reading and stops at the mark — deliberately. Running it
 * to the end of term would be speculating about a whole term on the strength of
 * one decision, and the claim here is much smaller and much harder to argue
 * with: over these ten days, and only these, here is what the reading was worth.
 */
const GHOST_STEPS = 70;
const ghostW = (i: number) => READ_W + ((MARK_W - READ_W) * i) / GHOST_STEPS;
const GHOST = (() => {
  const pts: string[] = [];
  for (let i = 0; i <= GHOST_STEPS; i++) pts.push(`${x(ghostW(i)).toFixed(1)} ${k2y(actedAt(ghostW(i))).toFixed(1)}`);
  return `M${pts.join(" L")}`;
})();
/** The gap itself, as a body. A dashed line above a dashed line is two lines;
 *  the area between them is the one quantity this half of the plate is about. */
const GHOST_AREA = (() => {
  const top: string[] = [];
  const bottom: string[] = [];
  for (let i = 0; i <= GHOST_STEPS; i++) {
    top.push(`${x(ghostW(i)).toFixed(1)} ${k2y(actedAt(ghostW(i))).toFixed(1)}`);
    bottom.push(`${x(ghostW(i)).toFixed(1)} ${k2y(stateAt(ghostW(i))).toFixed(1)}`);
  }
  return `M${top.join(" L")} L${bottom.reverse().join(" L")} Z`;
})();

/**
 * The three readings under the plate — the level progressing, which is the one
 * thing the curve above states and never demonstrates. Sampled off `actedAt`,
 * and the day counts are computed rather than written, so a moved session
 * cannot leave a wrong number behind.
 */
const NEXT = [READ_W, 7.7, MARK_W].map((w) => ({
  days: Math.round((w - READ_W) * 7),
  k: actedAt(w),
}));

/* ─────────────────────────────── the score ─────────────────────────────── */

/** The head crosses the term up to the readout, then the rest lands after it. */
const T = {
  frame: 200,
  rails: 480,
  headFrom: 1000,
  /** Slow on purpose: the gauge is meant to be watched, not glimpsed. */
  headMs: 5600,
  /** Everything before the readout appears as the head reaches it. */
  hit: (w: number) => 1000 + (5600 * w) / READ_W,
  land: 6900,
  /** The rest of the term, after the verdict — including the mark that was late. */
  rest: 8400,
  restMs: 1900,
  late: (w: number) => 8400 + (1900 * (w - READ_W)) / (WEEKS - READ_W),
  caught: 10800,
  /**
   * The answer, and it has to come after the indictment rather than beside it.
   * The plate spends eleven seconds establishing that neither bought rail could
   * speak on that Tuesday; a branch drawn before that landed would be arguing
   * with a case nobody has heard yet.
   */
  ghost: 11500,
  step: (i: number) => 13100 + i * 620,
  foot: 15200,
  cycle: 18600,
};

/**
 * The gauge's stops. Seven samples across the head's travel, each one holding
 * until the next takes over, so the number moves while the head does.
 */
/** When the i-th stop takes the panel. Half a step early, so the number leads
 *  the head into the week it is reading rather than trailing out of it. */
const gaugeAt = (i: number) => T.hit((READ_W * (i + 1)) / 7) - T.headMs / 14;

const GAUGE = Array.from({ length: 7 }, (_, i) => ({
  w: (READ_W * (i + 1)) / 7,
  k: stateAt((READ_W * (i + 1)) / 7),
  at: gaugeAt(i),
  /**
   * Each stop lives exactly until the next one starts — the seventh until the
   * landing reading takes the panel for good.
   *
   * Derived, not typed. All eight readings share one slot, and the span used to
   * be written as `T.headMs / 7 + 260`: a stop 260ms longer than the gap to the
   * next one, which is 260ms of two numbers laid over each other in the same
   * monospace cell, seven times a cycle. Written this way the overlap is not a
   * number anyone can get wrong — there is nowhere left to put it.
   */
  span: (i === 6 ? T.land : gaugeAt(i + 1)) - gaugeAt(i),
}));

const K_AT_READ = stateAt(READ_W);
const MONO = "ui-monospace,SFMono-Regular,Menlo,monospace";

/**
 * Where the gauge lives. Fixed, because a gauge that moved would be a label.
 *
 * Top right, on its own panel. The panel is not decoration: the curve's highest
 * point across this stretch is y=194, so a bare number here would have been
 * laid over the crest at week ten. With a card behind it the readout is an
 * instrument on the drawing rather than a caption lost in it — and the seventy
 * pixels above the mass are the only place on this plate that is empty for the
 * whole term.
 */
const GX = 896;
const GW = X1 - GX;
const GTOP = 88;
const GBOT = 172;

export function PositionShot({ theme: t }: { theme: Theme }) {
  const tr = useTranslate();
  const ink = kernelInk(t);
  const line = t.cardBorder;
  const dim = t.mutedLight;

  /** A rail's name and what it holds, in the gutter. */
  const rail = (y: number, name: string, sub: string, tint: string, delay: number) => (
    <g className="shot-fade" style={at(delay)}>
      <text x={X0 - 24} y={y - 3} textAnchor="end" className="pub-pos-lane" fill={tint}>
        {name}
      </text>
      <text x={X0 - 24} y={y + 16} textAnchor="end" className="pub-pos-sub" fill={dim}>
        {sub}
      </text>
    </g>
  );

  /** One reading of the state — the same instrument, a different moment. */
  const reading = (k: number, cls: string, style: CSSProperties) => (
    <g className={cls} style={style}>
      <text x={GX + 18} y={GTOP + 24} className="pub-pos-sub" fill={dim}>
        {tr("ps.gaugeCaption")}
      </text>
      <text x={GX + 18} y={GBOT - 8} className="pub-pos-gauge" fill={ink.bridge} fontFamily={MONO}>
        {k.toFixed(2)}
      </text>
      <text
        x={GX + 116}
        y={GBOT - 8}
        className="pub-pos-say"
        fill={statusOf(k) === "fragile" ? ink.bridge : dim}
      >
        {tr(STATUS_KEY[statusOf(k)])}
      </text>
    </g>
  );

  return (
    <DiagramFrame theme={t} loopMs={T.cycle}>
      {/* One duration for the head and the columns behind it: they are the same
          motion seen twice, and the day they drift the head stops meaning
          anything. */}
      <div className="pub-pos" style={{ ["--dur-head" as string]: `${T.headMs}ms` }}>
        <svg viewBox={`0 0 ${W} ${H}`} className="pub-pos-svg" aria-hidden>
          {/* The term. Quiet — it is the ground the three layers are measured
              against, not a fourth thing to read. */}
          <g className="shot-fade" style={at(T.frame)}>
            {Array.from({ length: WEEKS + 1 }, (_, i) => (
              <path key={`w${i}`} d={`M${x(i)} ${Y_LMS + 16} V${Y_TUTOR - 16}`} stroke={line} strokeWidth={1} />
            ))}
            <text x={X1} y={Y_TUTOR + 46} textAnchor="end" className="pub-pos-sub" fill={dim}>
              {tr("ps.oneTerm")}
            </text>
          </g>

          {/* ── rail 1: the gradebook. Four instants, kept ───────────────── */}
          <g className="shot-fade" style={at(T.rails)}>
            <path d={`M${X0} ${Y_LMS} H${X1}`} stroke={line} strokeWidth={2} />
          </g>
          {rail(Y_LMS, tr("ps.rail.lms.name"), tr("ps.rail.lms.sub"), dim, T.rails)}
          {DUE.map((d, i) => {
            /* The two marks after the readout arrive in the late phase — the
               whole point being that the gradebook is behind. */
            const late = d.w > READ_W;
            const emph = i === 2;
            return (
              /* Hung ABOVE the rail, not below it. Below, they occupied the
                 only stretch of this plate that is empty for the whole term —
                 the band between the rail and the crest — which is where the
                 gauge and the two verdicts have to live. */
              <g key={`d${d.w}`} className="shot-fade" style={at(late ? T.late(d.w) : T.hit(d.w))}>
                <path
                  d={`M${x(d.w)} ${Y_LMS} V${Y_LMS - 24}`}
                  stroke={emph ? ink.bridge : dim}
                  strokeWidth={emph ? 3 : 2}
                  strokeLinecap="round"
                />
                <text
                  x={x(d.w)}
                  y={Y_LMS - 32}
                  textAnchor="middle"
                  className="pub-pos-mark"
                  fill={emph ? ink.bridge : dim}
                >
                  {d.mark}
                </text>
              </g>
            );
          })}

          {/* ── the mass: one continuous thing, between the two ──────────── */}
          {COLUMNS.map((c, i) => (
            <path
              key={`c${i}`}
              className="shot-fade"
              style={at(c.w > READ_W ? T.late(c.w) : T.hit(c.w))}
              d={c.d}
              fill={ink.bridge}
              fillOpacity={t.dark ? 0.3 : 0.18}
            />
          ))}
          <path
            className="pub-pos-draw"
            style={at(T.headFrom)}
            d={CREST}
            pathLength={100}
            fill="none"
            stroke={ink.bridge}
            strokeWidth={3.5}
            strokeLinecap="round"
          />
          {rail((Y_CEIL + Y_FLOOR) / 2 - 40, "Raya", tr("ps.rail.raya.sub"), ink.bridge, T.rails + 140)}

          {/* ── rail 2: the tutor. Many instants, none of them kept ──────── */}
          <g className="shot-fade" style={at(T.rails + 280)}>
            <path d={`M${X0} ${Y_TUTOR} H${X1}`} stroke={line} strokeWidth={2} />
          </g>
          {rail(Y_TUTOR, tr("ps.rail.tutor.name"), tr("ps.rail.tutor.sub"), dim, T.rails + 280)}
          {SESSIONS.map((s) => (
            /* An impulse, rising toward the mass it feeds and dying where it
               stands. Height varies with how much the session moved the state,
               so even the bars are read off the model rather than drawn. */
            <g key={`s${s}`} className="pub-pos-burst" style={at(s > READ_W ? T.late(s) : T.hit(s))}>
              <path
                d={`M${x(s)} ${Y_TUTOR} V${Y_TUTOR - 16 - 26 * (1 - stateAt(s))}`}
                stroke={ink.learner}
                strokeWidth={3}
                strokeLinecap="round"
              />
            </g>
          ))}

          {/* ── the head, and the gauge that rides it ────────────────────── */}
          <g className="pub-pos-head">
            <path d={`M0 ${Y_LMS - 34} V${Y_TUTOR + 24}`} stroke={ink.bridge} strokeWidth={2} strokeOpacity={0.55} />
          </g>

          <g className="shot-fade" style={at(T.headFrom)}>
            <rect
              x={GX}
              y={GTOP}
              width={GW}
              height={GBOT - GTOP}
              rx={14}
              fill={t.cardBg}
              stroke={t.cardBorder}
              strokeWidth={1}
            />
          </g>
          {GAUGE.map((g, i) => (
            <g key={`g${i}`}>
              {reading(g.k, "shot-tick", { ...at(g.at), ["--dur-span" as string]: `${g.span}ms` })}
            </g>
          ))}
          {/* The reading it settles on, which is the one that indicts the other
              two rails — so unlike the six before it, this one stays. */}
          {reading(K_AT_READ, "shot-fade", at(T.land))}

          {/* ── the day itself ───────────────────────────────────────────── */}
          <g className="shot-fade" style={at(T.land)}>
            <path
              d={`M${x(READ_W)} ${Y_LMS - 34} V${Y_TUTOR + 24}`}
              stroke={t.text}
              strokeWidth={1.5}
              strokeDasharray="4 4"
            />
            <circle cx={x(READ_W)} cy={k2y(K_AT_READ)} r={7} fill={ink.bridge} />
            <text x={x(READ_W)} y={Y_TUTOR + 46} textAnchor="middle" className="pub-pos-sub" fill={t.text}>
              {tr("ps.tuesdayWeek7")}
            </text>
          </g>

          {/* What the two bought rails have to say on that day. The gradebook's
              line is the sharpest thing here, and it is not "nothing": its most
              recent word is a REASSURING mark from three weeks ago, while the
              state underneath has already collapsed. A blank rail reads as an
              oversight; a stale, comfortable number reads as the problem. */}
          <g className="shot-fade" style={at(T.land + 300)}>
            <text x={x(READ_W) - 16} y={Y_LMS + 44} textAnchor="end" className="pub-pos-say" fill={dim}>
              {tr("ps.lastMarkPrefix")} {DUE[1].mark}, {Math.round(READ_W - DUE[1].w)} {tr("ps.weeksAgo")}
            </text>
          </g>
          {/* Above the tallest impulse (416) and below the mass floor (380),
              which is the only clear stripe on this side of the plate. */}
          <g className="shot-fade" style={at(T.land + 560)}>
            <text x={x(READ_W) - 16} y={Y_TUTOR - 54} textAnchor="end" className="pub-pos-say" fill={dim}>
              {tr("ps.noSessionRunning")}
            </text>
          </g>

          {/* ── and the mark that arrives ten days late ──────────────────── */}
          <g className="shot-fade" style={at(T.caught)}>
            <path
              d={`M${x(READ_W) + 8} ${Y_LMS + 22} H${x(DUE[2].w) - 8}`}
              stroke={ink.bridge}
              strokeWidth={1.5}
              strokeDasharray="5 4"
            />
            <text
              x={(x(READ_W) + x(DUE[2].w)) / 2}
              y={Y_LMS + 44}
              textAnchor="middle"
              className="pub-pos-say"
              fill={ink.bridge}
            >
              {tr("ps.tenDaysLate")}
            </text>
          </g>

          {/* ── and what those ten days were worth ───────────────────────── */}
          <g className="shot-fade" style={at(T.ghost + 500)}>
            <path d={GHOST_AREA} fill={ink.bridge} fillOpacity={t.dark ? 0.16 : 0.1} />
          </g>
          <path
            className="pub-pos-ghost"
            style={at(T.ghost)}
            d={GHOST}
            pathLength={100}
            fill="none"
            stroke={ink.bridge}
            strokeWidth={3}
            strokeOpacity={0.9}
            strokeLinecap="round"
          />
          {/* Left of the branch end, in the one pocket this side of the plate
              keeps clear: the mass tops out at y≈281 across x 794–862 and the
              gauge starts at x=896, so a right-aligned label here touches
              neither. The value is read off the branch, not written. */}
          <g className="shot-fade" style={at(T.ghost + 900)}>
            <circle cx={x(MARK_W)} cy={k2y(actedAt(MARK_W))} r={5.5} fill={ink.bridge} />
            <text x={x(MARK_W) - 12} y={k2y(actedAt(MARK_W)) - 4} textAnchor="end" className="pub-pos-mark" fill={ink.bridge}>
              {actedAt(MARK_W).toFixed(2)}
            </text>
            <text x={x(MARK_W) - 12} y={k2y(actedAt(MARK_W)) + 13} textAnchor="end" className="pub-pos-sub" fill={dim}>
              {tr(STATUS_KEY[statusOf(actedAt(MARK_W))])}
            </text>
          </g>
        </svg>

        {/* The level progressing, which the curve above states and never shows.
            Same model, same student, same two sessions — read on the Tuesday
            instead of after the mark. */}
        <div className="pub-pos-next" style={{ borderColor: t.cardBorder }}>
          <span className="pub-pos-next-h shot-fade" style={{ ...at(T.ghost + 1200), color: ink.bridge }}>
            {tr("ps.ifThatTuesdayRead")}
          </span>
          <div className="pub-pos-next-row">
            {NEXT.map((n, i) => (
              <div key={n.days} className="pub-pos-next-cell shot-in" style={at(T.step(i))}>
                <span className="pub-pos-next-when" style={{ color: t.mutedLight }}>
                  {n.days === 0 ? tr("ps.thatTuesday") : `${n.days} ${tr("ps.daysOn")}`}
                </span>
                <span className="pub-pos-next-k" style={{ color: ink.bridge }}>
                  {n.k.toFixed(2)}
                </span>
                <span className="pub-pos-next-say" style={{ color: t.muted }}>
                  {tr(STATUS_KEY[statusOf(n.k)])}
                </span>
                <span className="pub-pos-next-bar" style={{ background: t.inputFieldBg }}>
                  <i style={{ width: `${(n.k / K_CEIL) * 100}%`, background: ink.bridge }} />
                </span>
              </div>
            ))}
          </div>
          <span className="pub-pos-next-note shot-fade" style={{ ...at(T.step(2) + 500), color: t.mutedLight }}>
            {tr("ps.leftAsItWentA")} {stateAt(MARK_W).toFixed(2)} · {tr(STATUS_KEY[statusOf(stateAt(MARK_W))])} {tr("ps.leftAsItWentB")}{" "}
            {DUE[2].mark} {tr("ps.leftAsItWentC")}
          </span>
        </div>

        <div
          className="pub-pos-foot shot-fade"
          style={{ ...at(T.foot), color: t.mutedLight, borderColor: t.cardBorder }}
        >
          {tr("ps.footer")}
        </div>
      </div>
    </DiagramFrame>
  );
}
