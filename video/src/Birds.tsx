import { AbsoluteFill } from "remotion";
import { clamp01, mix, rand, useTime } from "./motion";

/**
 * The birds — the gull the onboarding flocks fly (components/ui/auth-chrome,
 * `BIRD_PATH`), flown on the film's clock instead of CSS timers.
 *
 * A real bird does not flap like a metronome: it beats in bursts and glides
 * between them, it banks a little into its climb, and a far one looks
 * smaller, slower and paler than a near one. Each bird here does all four,
 * deterministically, so every render of a frame is the same frame.
 */

const BIRD_PATH = "M2 9.5 C 6.5 2.5, 11.5 3, 15 8.5 C 18.5 3, 23.5 2.5, 28 9.5";

export type Bird = {
  /** When it enters and leaves the frame, in film seconds. */
  from: number;
  to: number;
  /** Where it enters and leaves, in frame pixels (1920×1080). */
  start: [number, number];
  end: [number, number];
  /** Wingspan in pixels. */
  size: number;
  /** Height of its undulation, and its period in seconds. */
  amp?: number;
  period?: number;
  /** A bow in the path: pixels the midpoint is lifted by. */
  arc?: number;
  /** 0 far … 1 near: paler and softer when far. */
  depth?: number;
  seed?: number;
};

function BirdGlyph({ bird, t, color }: { bird: Bird; t: number; color: string }) {
  const { from, to, start, end, size, amp = 14, period = 1.7, arc = 0, depth = 1, seed = 0 } = bird;
  const p = clamp01((t - from) / (to - from));
  if (p <= 0 || p >= 1) return null;

  // Along the path at an even pace — birds cruise; they do not ease.
  const along = (q: number) => {
    const x = mix(start[0], end[0], q);
    const y = mix(start[1], end[1], q) - arc * 4 * q * (1 - q);
    const wave = Math.sin((q * (to - from)) / period * Math.PI * 2 + seed * 3) * amp;
    return [x, y + wave] as const;
  };
  const [x, y] = along(p);
  const [x2, y2] = along(Math.min(1, p + 0.004));
  const heading = (Math.atan2(y2 - y, Math.abs(x2 - x) + 1e-6) * 180) / Math.PI;
  const facingLeft = end[0] < start[0];

  // Beat for a while, glide for a while. The beat is a little faster on a
  // smaller bird, as it is in the air.
  const local = t - from + seed * 2.3;
  const cycle = 2.6 + rand(seed, 1) * 1.2;
  const beating = (local % cycle) / cycle < 0.62;
  const beatRate = 0.34 + (1 - Math.min(1, size / 60)) * 0.12;
  const wing = beating ? 0.28 + 0.72 * (0.5 + 0.5 * Math.cos((local / beatRate) * Math.PI * 2)) : 0.82;

  const fade = Math.min(1, p / 0.06, (1 - p) / 0.06);
  const opacity = fade * (0.45 + 0.55 * depth);
  const h = size * 0.42;

  return (
    <div
      style={{
        position: "absolute",
        left: x - size / 2,
        top: y - h / 2,
        width: size,
        height: h,
        opacity,
        transform: `rotate(${(facingLeft ? -1 : 1) * heading * 0.45}deg) scaleX(${facingLeft ? -1 : 1})`,
        filter: depth < 0.45 ? `blur(${((0.45 - depth) * 2.4).toFixed(2)}px)` : undefined,
      }}
    >
      <svg width={size} height={h} viewBox="0 0 30 12" style={{ display: "block", overflow: "visible", transform: `scaleY(${wing})`, transformOrigin: "50% 75%" }}>
        <path d={BIRD_PATH} fill="none" stroke={color} strokeWidth={size > 40 ? 1.7 : 2} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

export function Flock({ birds, color = "#2f7fe0", farColor, style }: { birds: Bird[]; color?: string; farColor?: string; style?: React.CSSProperties }) {
  const t = useTime();
  return (
    <AbsoluteFill style={{ pointerEvents: "none", ...style }}>
      {birds.map((b, i) => (
        <BirdGlyph key={i} bird={b} t={t} color={(b.depth ?? 1) < 0.5 && farColor ? farColor : color} />
      ))}
    </AbsoluteFill>
  );
}

/**
 * A loose flock crossing the frame: `count` birds in staggered lanes, each on
 * its own period and depth, so they never line up into a formation.
 */
export function crossing({
  from,
  duration,
  count,
  leftToRight = true,
  top = 180,
  spread = 420,
  size = 34,
  rise = -120,
  salt = 0,
}: {
  from: number;
  duration: number;
  count: number;
  leftToRight?: boolean;
  top?: number;
  spread?: number;
  size?: number;
  rise?: number;
  salt?: number;
}): Bird[] {
  return Array.from({ length: count }, (_, i) => {
    const r = (k: number) => rand(i + salt * 13, k);
    const depth = 0.25 + r(1) * 0.75;
    const lane = top + (i / Math.max(1, count - 1)) * spread + (r(2) - 0.5) * 60;
    const lag = r(3) * duration * 0.28;
    const span = duration * (0.8 + (1 - depth) * 0.45);
    const x0 = -120 - r(4) * 160;
    const x1 = 1920 + 120 + r(5) * 160;
    return {
      from: from + lag,
      to: from + lag + span,
      start: leftToRight ? [x0, lane] : [x1, lane],
      end: leftToRight ? [x1, lane + rise * (0.6 + r(6))] : [x0, lane + rise * (0.6 + r(6))],
      size: size * (0.45 + depth * 0.75),
      amp: 8 + r(7) * 14,
      period: 1.3 + r(8) * 1.1,
      arc: 30 + r(9) * 60,
      depth,
      seed: i + salt,
    } satisfies Bird;
  });
}
