import { useMemo } from "react";
import { CUES, cueAt, FPS, type BackgroundState } from "./cues";
import { wordAt } from "./transcript";
import { EASE, mix, span } from "../motion";
import { Draw, PAL } from "../film/kit";

/**
 * The persistent background: a dark navy prerequisite graph, ~60 nodes on a
 * seeded layout, drifting slowly. Every state the cues file names is one set
 * of numbers; crossings between cues blend over 12 frames. Accents (the
 * crack, the flash, the path, the pulses) are pinned to the words that name
 * them, not to the cue grid.
 *
 * Kept cheap and low-contrast on purpose: at 4.6 Mbps, anything busy
 * back here would eat the UI's bitrate.
 */

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let z = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    z = (z + Math.imul(z ^ (z >>> 7), 61 | z)) ^ z;
    return ((z ^ (z >>> 14)) >>> 0) / 4294967296;
  };
}

interface Node {
  x: number;
  y: number;
  r: number;
  p1: number;
  p2: number;
}

export const ALGEBRA = { x: 150, y: 740, r: 15 };
export const PHYSICS = { x: 1770, y: 320, r: 15 };
const LINK_L = { x: 470, y: 540 };
const LINK_R = { x: 1450, y: 540 };

const NODES: Node[] = (() => {
  const rand = mulberry32(20261031);
  const nodes: Node[] = [
    { ...ALGEBRA, p1: rand() * 6.28, p2: rand() * 6.28 },
    { ...PHYSICS, p1: rand() * 6.28, p2: rand() * 6.28 },
  ];
  const keepOut = [ALGEBRA, PHYSICS, LINK_L, LINK_R];
  while (nodes.length < 60) {
    const x = 80 + rand() * 1760;
    const y = 70 + rand() * 940;
    if (keepOut.some((k) => Math.hypot(x - k.x, y - k.y) < 110)) continue;
    nodes.push({ x, y, r: 3.5 + rand() * 5, p1: rand() * 6.28, p2: rand() * 6.28 });
  }
  return nodes;
})();

const EDGES: [number, number][] = (() => {
  const seen = new Set<string>();
  const edges: [number, number][] = [];
  NODES.forEach((n, i) => {
    const near = NODES.map((m, j) => ({ j, d: Math.hypot(n.x - m.x, n.y - m.y) }))
      .filter((e) => e.j !== i)
      .sort((a, b) => a.d - b.d)
      .slice(0, 2);
    for (const { j } of near) {
      const key = i < j ? `${i}-${j}` : `${j}-${i}`;
      if (seen.has(key)) continue;
      seen.add(key);
      edges.push([i, j]);
    }
  });
  return edges;
})();

/** The lit path: algebra → four waypoints near the diagonal → physics (node indices; positions resolve per frame so the path rides the drift). */
const PATH_IDX: number[] = (() => {
  const idx = [0];
  for (const f of [0.2, 0.4, 0.6, 0.8]) {
    const tx = mix(ALGEBRA.x, PHYSICS.x, f);
    const ty = mix(ALGEBRA.y, PHYSICS.y, f);
    let best = 2;
    let bestD = Infinity;
    NODES.forEach((n, i) => {
      if (i < 2) return;
      const d = Math.hypot(n.x - tx, n.y - ty);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    idx.push(best);
  }
  idx.push(1);
  return idx;
})();

function pointAlongPts(pts: { x: number; y: number }[], f: number): { x: number; y: number } {
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
  const total = cum[cum.length - 1] || 1;
  const target = (((f % 1) + 1) % 1) * total;
  for (let i = 1; i < pts.length; i++) {
    if (target <= cum[i]) {
      const p = (target - cum[i - 1]) / (cum[i] - cum[i - 1] || 1);
      return { x: mix(pts[i - 1].x, pts[i].x, p), y: mix(pts[i - 1].y, pts[i].y, p) };
    }
  }
  return pts[pts.length - 1];
}

/** A jagged star over the algebra node: the crack. */
const CRACK_D = (() => {
  const rand = mulberry32(77);
  const rays = 7;
  let d = "";
  for (let i = 0; i < rays; i++) {
    const a = (i / rays) * Math.PI * 2 + rand() * 0.5;
    const len = 26 + rand() * 30;
    const mx = ALGEBRA.x + Math.cos(a) * len * 0.5 + (rand() - 0.5) * 14;
    const my = ALGEBRA.y + Math.sin(a) * len * 0.5 + (rand() - 0.5) * 14;
    d += `M${ALGEBRA.x.toFixed(1)} ${ALGEBRA.y.toFixed(1)}L${mx.toFixed(1)} ${my.toFixed(1)}L${(ALGEBRA.x + Math.cos(a) * len).toFixed(1)} ${(ALGEBRA.y + Math.sin(a) * len).toFixed(1)}`;
  }
  return d;
})();

/** The fracture climbing from algebra toward physics (first two-fifths). */
const FRACTURE_D = (() => {
  const rand = mulberry32(78);
  const x0 = ALGEBRA.x;
  const y0 = ALGEBRA.y - 20;
  const x1 = mix(ALGEBRA.x, PHYSICS.x, 0.42);
  const y1 = mix(ALGEBRA.y, PHYSICS.y, 0.42);
  let d = `M${x0.toFixed(1)} ${y0.toFixed(1)}`;
  for (let i = 1; i <= 6; i++) {
    const f = i / 6;
    d += `L${(mix(x0, x1, f) + (rand() - 0.5) * 36).toFixed(1)} ${(mix(y0, y1, f) + (rand() - 0.5) * 36).toFixed(1)}`;
  }
  return d;
})();

/** Regroup targets: rings around the logo. */
const RING = NODES.map((_, i) => {
  const a = (i / NODES.length) * Math.PI * 2 + (i % 5) * 0.35;
  const r = 240 + (i % 3) * 46;
  return { x: 960 + Math.cos(a) * r, y: 540 + Math.sin(a) * r * 0.62 };
});

interface StateParams {
  alpha: number;
  zoom: number;
  lit: number;
  redAlgebra: number;
  greenPhysics: number;
  path: number;
  linkPair: number;
  regroup: number;
  logoGlow: number;
}

const STATE_PARAMS: Record<BackgroundState, StateParams> = {
  graph_gray: { alpha: 0.55, zoom: 1, lit: 0, redAlgebra: 0, greenPhysics: 0, path: 0, linkPair: 0, regroup: 0, logoGlow: 0 },
  graph_gray_crack: { alpha: 0.55, zoom: 1, lit: 0, redAlgebra: 0.25, greenPhysics: 0, path: 0, linkPair: 0, regroup: 0, logoGlow: 0 },
  graph_dim: { alpha: 0.22, zoom: 1, lit: 0, redAlgebra: 0, greenPhysics: 0, path: 0, linkPair: 0, regroup: 0, logoGlow: 0.85 },
  graph_soft: { alpha: 0.38, zoom: 1, lit: 0, redAlgebra: 0, greenPhysics: 0, path: 0, linkPair: 0, regroup: 0, logoGlow: 0 },
  graph_path_lit: { alpha: 0.3, zoom: 1, lit: 0, redAlgebra: 1, greenPhysics: 0, path: 1, linkPair: 0, regroup: 0, logoGlow: 0 },
  graph_physics_green: { alpha: 0.38, zoom: 1, lit: 0, redAlgebra: 0, greenPhysics: 1, path: 0, linkPair: 0, regroup: 0, logoGlow: 0 },
  graph_class_wide: { alpha: 0.62, zoom: 0.86, lit: 24, redAlgebra: 0, greenPhysics: 0, path: 0, linkPair: 0, regroup: 0, logoGlow: 0 },
  graph_same_node_lit: { alpha: 0.38, zoom: 1, lit: 0, redAlgebra: 1, greenPhysics: 0, path: 0, linkPair: 0, regroup: 0, logoGlow: 0 },
  graph_two_nodes_linked: { alpha: 0.4, zoom: 1, lit: 0, redAlgebra: 0.4, greenPhysics: 0, path: 0, linkPair: 1, regroup: 0, logoGlow: 0 },
  graph_regroup: { alpha: 0.5, zoom: 0.94, lit: 6, redAlgebra: 0, greenPhysics: 0, path: 0, linkPair: 0, regroup: 1, logoGlow: 0.55 },
};

/** The graph's own zoom at `t` — the Meanwhile push aims through it. */
export function graphZoomAt(t: number): number {
  return blendParams(t).zoom;
}

function blendParams(t: number): StateParams {
  const cue = cueAt(t);
  const i = CUES.indexOf(cue);
  const cur = STATE_PARAMS[cue.background];
  if (i === 0) return cur;
  const prev = STATE_PARAMS[CUES[i - 1].background];
  const p = span(t, cue.startSec, cue.startSec + 12 / FPS, EASE.move);
  const out = {} as StateParams;
  (Object.keys(cur) as (keyof StateParams)[]).forEach((k) => {
    out[k] = mix(prev[k], cur[k], p);
  });
  return out;
}

export function DemoGraph({ t }: { t: number }) {
  const cue = cueAt(t);
  const st = blendParams(t);

  const word = useMemo(
    () => ({
      physicsFlash: wordAt("physics", 2.0) ?? 3.2,
      algebraCrack: wordAt("algebra", 8.0) ?? 9.9,
      rootPulse: wordAt("root", 65.0) ?? 67.6,
      clicks: wordAt("clicks", 71.0) ?? 75.2,
    }),
    [],
  );

  // Time-pinned accents.
  const flash = span(t, word.physicsFlash, word.physicsFlash + 0.3, EASE.arrive) * (1 - span(t, word.physicsFlash + 0.55, word.physicsFlash + 1.0, EASE.soft));
  const crackP = span(t, word.algebraCrack, word.algebraCrack + 1.4, EASE.arrive);
  const fractureP = span(t, word.algebraCrack + 0.5, word.algebraCrack + 3.2, EASE.move);
  const crackVisible = cue.id >= 3 && cue.id <= 7 ? 1 : 1 - span(t, CUES[7].startSec, CUES[7].startSec + 0.4);
  const rootPulse = span(t, word.rootPulse, word.rootPulse + 0.9, EASE.arrive);
  const pathDraw = span(t, word.rootPulse, word.rootPulse + 2.0, EASE.move) * st.path;
  // The diagnosed node stays red from the diagnosis to the Meanwhile peak,
  // whatever the cue grid says in between — the push-in needs a red node.
  // Pinned to the aligned cue 11, not a hardcoded time: the peak sits inside
  // the push (16f) and the release hides under the full-red disc.
  const s11 = CUES.find((c) => c.id === 11)?.startSec ?? 93.0;
  const redHold = span(t, word.rootPulse, word.rootPulse + 0.5, EASE.arrive) * (1 - span(t, s11 + 0.55, s11 + 0.9, EASE.soft));
  const redAlgebra = Math.max(st.redAlgebra, redHold);
  const greenOn = cue.id === 9 ? span(t, word.clicks, word.clicks + 0.5, EASE.arrive) : st.greenPhysics * span(t, word.clicks, word.clicks + 0.5, EASE.arrive);

  const drifted = (n: Node, i: number) => ({
    x: n.x + Math.sin((t * Math.PI * 2) / 26 + n.p1) * 10,
    y: n.y + Math.cos((t * Math.PI * 2) / 31 + n.p2) * 8,
    r: n.r,
    i,
  });

  const pts = NODES.map((n, i) => {
    const d = drifted(n, i);
    return { x: mix(d.x, RING[i].x, st.regroup), y: mix(d.y, RING[i].y, st.regroup), r: d.r };
  });

  const pathPts = PATH_IDX.map((i) => pts[i]);
  const pathD = pathPts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
  const traveller = pointAlongPts(pathPts, t * 0.14);
  const crackDx = pts[0].x - ALGEBRA.x;
  const crackDy = pts[0].y - ALGEBRA.y;

  const edgeAlpha = 0.34 * st.alpha;
  const nodeFill = "#8fa8d8";

  return (
    <svg width={1920} height={1080} viewBox="0 0 1920 1080" style={{ position: "absolute", inset: 0, overflow: "visible" }}>
      <g transform={`translate(960 540) scale(${st.zoom.toFixed(4)}) translate(-960 -540)`}>
        {EDGES.map(([a, b], i) => (
          <line key={i} x1={pts[a].x} y1={pts[a].y} x2={pts[b].x} y2={pts[b].y} stroke="#7d9bd6" strokeWidth={1.4} opacity={edgeAlpha} />
        ))}
        {pts.map((p, i) => {
          const isAlgebra = i === 0;
          const isPhysics = i === 1;
          const lit = i >= 2 && i - 2 < Math.round(st.lit);
          let fill = nodeFill;
          let opacity = (isAlgebra || isPhysics ? 0.95 : 0.75) * st.alpha;
          let r = p.r;
          if (lit) {
            fill = PAL.electric;
            opacity = 0.9;
          }
          if (isAlgebra && redAlgebra > 0.01) {
            fill = redAlgebra >= 1 ? PAL.coral : "#b06a6a";
            opacity = Math.max(opacity, redAlgebra);
            r = p.r * (1 + redAlgebra * 0.25);
          }
          if (isPhysics && flash > 0.01) {
            fill = PAL.coral;
            opacity = Math.max(opacity, flash);
            r = p.r * (1 + flash * 0.5);
          }
          if (isPhysics && greenOn > 0.01) {
            fill = PAL.mint;
            opacity = Math.max(opacity, greenOn);
            r = p.r * (1 + greenOn * 0.3);
          }
          if (isAlgebra) r = Math.max(r, 13);
          if (isPhysics) r = Math.max(r, 13);
          return <circle key={i} cx={p.x} cy={p.y} r={r} fill={fill} opacity={opacity} />;
        })}

        {/* The crack and its fracture (cues 3–7, fading into the dive). */}
        {crackVisible > 0.01 && (
          <g opacity={crackVisible} transform={`translate(${crackDx.toFixed(1)} ${crackDy.toFixed(1)})`}>
            <Draw d={CRACK_D} p={crackP} stroke="#ff8a7a" width={2.5} glow="#ff6b5b" />
            <Draw d={FRACTURE_D} p={fractureP} stroke="#ff8a7a" width={2} opacity={0.8} />
          </g>
        )}

        {/* The diagnosis path (cue 8). */}
        {pathDraw > 0.01 && (
          <>
            <Draw d={pathD} p={pathDraw} stroke={PAL.amber} width={4} glow={PAL.amber} />
            {pathDraw > 0.9 && <circle cx={traveller.x} cy={traveller.y} r={7} fill={PAL.amber} opacity={0.9 * st.path} style={{ filter: "blur(1px)" }} />}
            {pathDraw > 0.75 && (
              <circle cx={pathPts[pathPts.length - 1].x} cy={pathPts[pathPts.length - 1].y} r={30} fill={PAL.amber} opacity={0.45 * (pathDraw - 0.75) * 4 * st.path} style={{ filter: "blur(7px)" }} />
            )}
          </>
        )}

        {/* The root-cause pulse: one ring out of the algebra node. */}
        {rootPulse > 0.01 && rootPulse < 1 && <circle cx={pts[0].x} cy={pts[0].y} r={mix(18, 240, rootPulse)} fill="none" stroke={PAL.coral} strokeWidth={3.5 * (1 - rootPulse * 0.7)} opacity={1 - rootPulse} />}

        {/* The split-screen link (cue 18): two red nodes, one glowing line. */}
        {st.linkPair > 0.01 && (
          <g opacity={st.linkPair}>
            <Draw d={`M${LINK_L.x} ${LINK_L.y}L${LINK_R.x} ${LINK_R.y}`} p={span(t, CUES[17].startSec + 0.4, CUES[17].startSec + 1.4, EASE.move)} stroke={PAL.coral} width={3.5} glow={PAL.coral} />
            <circle cx={LINK_L.x} cy={LINK_L.y} r={13} fill={PAL.coral} opacity={0.95} />
            <circle cx={LINK_R.x} cy={LINK_R.y} r={13} fill={PAL.coral} opacity={0.95} />
          </g>
        )}

        {/* Halo on the algebra node whenever it stands out. */}
        {redAlgebra > 0.5 && (
          <circle cx={pts[0].x} cy={pts[0].y} r={pts[0].r + 12 + Math.sin(t * 3.2) * 3} fill="none" stroke={PAL.coral} strokeWidth={2.5} opacity={0.65 * redAlgebra} />
        )}
      </g>

      {/* Logo glow for the dim and regroup states. */}
      {st.logoGlow > 0.01 && (
        <circle cx={960} cy={540} r={330} fill={PAL.blue} opacity={0.16 * st.logoGlow} style={{ filter: "blur(60px)" }} />
      )}
    </svg>
  );
}
