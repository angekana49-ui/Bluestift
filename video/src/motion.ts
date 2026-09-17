import { Easing, useCurrentFrame, useVideoConfig } from "remotion";

/**
 * The film's motion vocabulary, kept small on purpose.
 *
 * Everything moves the way a camera operator or a well-damped rig moves: it
 * leaves gently, travels, and settles without a bounce. Nothing is linear
 * (nothing real is), nothing overshoots (a product film that wobbles looks
 * cheap), and nothing snaps.
 */

export const EASE = {
  /** A move: gentle out, gentle in. The default for anything the camera does. */
  move: Easing.bezier(0.45, 0, 0.2, 1),
  /** An arrival: most of the distance early, a long settle. */
  arrive: Easing.bezier(0.16, 1, 0.3, 1),
  /** A departure: starts slow, leaves fast. */
  leave: Easing.bezier(0.7, 0, 0.84, 0),
  /** A breath: symmetric and soft, for fades and light. */
  soft: Easing.bezier(0.37, 0, 0.63, 1),
  linear: (x: number) => x,
};

export const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
export const mix = (a: number, b: number, p: number) => a + (b - a) * p;

/** Film time in seconds. */
export function useTime() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return frame / fps;
}

/** 0 before `from`, 1 after `to`, eased in between. */
export function span(t: number, from: number, to: number, ease = EASE.move) {
  if (to <= from) return t >= to ? 1 : 0;
  return ease(clamp01((t - from) / (to - from)));
}

/** In over [a, b], out over [c, d]: a fade envelope. */
export function envelope(t: number, a: number, b: number, c: number, d: number, ease = EASE.soft) {
  return Math.min(span(t, a, b, ease), 1 - span(t, c, d, ease));
}

/**
 * A value through keyframes `[time, value]`, eased between each pair — the
 * way a camera move is written: where it is at each moment you can hear.
 */
export function keys(t: number, frames: [number, number][], ease = EASE.move) {
  if (t <= frames[0][0]) return frames[0][1];
  for (let i = 1; i < frames.length; i++) {
    const [t1, v1] = frames[i];
    if (t <= t1) {
      const [t0, v0] = frames[i - 1];
      return mix(v0, v1, span(t, t0, t1, ease));
    }
  }
  return frames[frames.length - 1][1];
}

/** Several named values through the same keyframe times. */
export function keysOf<K extends string>(t: number, frames: [number, Record<K, number>][], ease = EASE.move): Record<K, number> {
  const out = {} as Record<K, number>;
  for (const k of Object.keys(frames[0][1]) as K[]) out[k] = keys(t, frames.map(([at, v]) => [at, v[k]]), ease);
  return out;
}

/**
 * The time a site shot should be at, given film time: piecewise-linear through
 * `[filmSeconds, shotMs]` pairs, so each beat of a shot's own choreography can
 * be pinned to the word that names it, and held (or slowed) between.
 */
export function warp(t: number, pairs: [number, number][]) {
  if (t <= pairs[0][0]) return pairs[0][1];
  for (let i = 1; i < pairs.length; i++) {
    const [t1, m1] = pairs[i];
    if (t <= t1) {
      const [t0, m0] = pairs[i - 1];
      return mix(m0, m1, (t - t0) / (t1 - t0));
    }
  }
  const [tl, ml] = pairs[pairs.length - 1];
  return ml + (t - tl) * 1000;
}

/**
 * The drift a hand-held gimbal never quite removes — a few pixels and a
 * fraction of a degree, at frequencies that never line up. Deterministic.
 */
export function float(t: number, seed = 0, amount = 1) {
  const s = seed * 1.7;
  return {
    x: (Math.sin(t * 0.37 + s) * 3.2 + Math.sin(t * 0.83 + s * 2.1) * 1.4) * amount,
    y: (Math.sin(t * 0.29 + s * 1.3) * 2.6 + Math.sin(t * 0.71 + s * 0.7) * 1.1) * amount,
    r: (Math.sin(t * 0.23 + s * 0.4) * 0.08) * amount,
  };
}

/**
 * A camera path as an operator on a gimbal would fly it: the keyframed path,
 * averaged over a short Gaussian window around each moment. Starts and stops
 * round off, the fastest moves lose about a third of their peak speed, and the
 * middle of every move stays where it was written — so the camera still
 * arrives on its word. Zoom is averaged in log space, where equal steps look
 * equal.
 */
export function steady<K extends string>(t: number, path: (at: number) => Record<K, number>, sigma = 0.24): Record<K, number> {
  const steps = 6;
  const reach = sigma * 2;
  let total = 0;
  const acc = {} as Record<K, number>;
  for (let i = -steps; i <= steps; i++) {
    const dt = (i / steps) * reach;
    const w = Math.exp(-(dt * dt) / (2 * sigma * sigma));
    const v = path(t + dt);
    for (const k of Object.keys(v) as K[]) {
      const x = k === "zoom" ? Math.log(v[k]) : v[k];
      acc[k] = (acc[k] ?? 0) + x * w;
    }
    total += w;
  }
  for (const k of Object.keys(acc) as K[]) acc[k] = k === "zoom" ? Math.exp(acc[k] / total) : acc[k] / total;
  return acc;
}

/**
 * The one hand-held drift the whole film shares, so a change of scene never
 * jolts the frame by the difference between two drifts.
 */
export const handheld = (t: number) => float(t, 7, 1);

/** Deterministic pseudo-random in [0, 1) for index `i`. */
export function rand(i: number, salt = 0) {
  const x = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453;
  return x - Math.floor(x);
}
