import type { CSSProperties, ReactNode } from "react";
import { AbsoluteFill, Img } from "remotion";
import { MARKS } from "../generated/marks";
import { RAYA_FONT } from "@/components/ui/brand";
import { FONTS } from "../brand";
import { clamp01, EASE, mix, rand, span } from "../motion";
import { BAR, line, type Line } from "../timeline";

/**
 * The motion-design kit the film is built from.
 *
 * The first cut flew the site's screenshots around a sky. This one is drawn:
 * colour fields that change with the music, type that lands on the word the
 * voice says, line illustrations that build themselves, and the product's own
 * pieces — a composer, a chat bubble, a report — redrawn large and clean, used
 * as graphic elements rather than as pictures of a screen.
 *
 * Everything here is a pure function of film time `t`, so any frame renders
 * on its own and scrubbing is exact.
 */

export const PAL = {
  ink: "#050913",
  night: "#070d22",
  navy: "#0b1838",
  deep: "#173d8a",
  blue: "#2f7fe0",
  electric: "#4b9bff",
  sky: "#9fd6ff",
  ice: "#eef6ff",
  paper: "#f7f9fc",
  amber: "#ffb547",
  coral: "#ff6b5b",
  violet: "#8b5cf6",
  cyan: "#38e1ff",
  mint: "#34d399",
  cream: "#fff6ea",
  white: "#ffffff",
  text: "#0b1220",
};

export const TYPE = {
  /** The headline voice: Inter at its heaviest, set tight. */
  heavy: (size: number, color: string = PAL.text): CSSProperties => ({ fontFamily: FONTS.body, fontWeight: 900, fontSize: size, lineHeight: 0.98, letterSpacing: "-0.045em", color }),
  /** The product's own face, for anything that is the product speaking. */
  display: (size: number, weight = 700, color: string = PAL.text): CSSProperties => ({ fontFamily: FONTS.display, fontWeight: weight, fontSize: size, lineHeight: 1.1, letterSpacing: "-0.02em", color }),
  /** The emotional word: Instrument Serif italic. */
  serif: (size: number, color: string = PAL.text): CSSProperties => ({ fontFamily: FONTS.serif, fontStyle: "italic", fontWeight: 400, fontSize: size, lineHeight: 1, letterSpacing: "-0.01em", color }),
  mono: (size: number, color: string = PAL.text, weight = 500): CSSProperties => ({ fontFamily: FONTS.mono, fontWeight: weight, fontSize: size, letterSpacing: "0.02em", color }),
  body: (size: number, weight = 500, color: string = PAL.text): CSSProperties => ({ fontFamily: FONTS.body, fontWeight: weight, fontSize: size, lineHeight: 1.35, color }),
};

/* ───────────────────────────── stage ───────────────────────────── */

/** A full-frame colour field: two-stop gradient plus a soft light source. */
export function Field({ from, to, angle = 160, light, lightAt = [30, 20], children }: { from: string; to: string; angle?: number; light?: string; lightAt?: [number, number]; children?: ReactNode }) {
  return (
    <AbsoluteFill style={{ background: `linear-gradient(${angle}deg, ${from}, ${to})` }}>
      {light && <AbsoluteFill style={{ background: `radial-gradient(circle at ${lightAt[0]}% ${lightAt[1]}%, ${light}, transparent 60%)` }} />}
      {children}
    </AbsoluteFill>
  );
}

/** Film grain: one turbulence tile, shifted every frame so it lives. */
const GRAIN = `url("data:image/svg+xml;utf8,${encodeURIComponent(
  `<svg xmlns='http://www.w3.org/2000/svg' width='240' height='240'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.5  0 0 0 0 0.5  0 0 0 0 0.5  0 0 0 0.55 0'/></filter><rect width='100%' height='100%' filter='url(#n)'/></svg>`,
)}")`;
export function Grain({ t, opacity = 0.09 }: { t: number; opacity?: number }) {
  const f = Math.floor(t * 12);
  return (
    <AbsoluteFill
      style={{
        backgroundImage: GRAIN,
        backgroundSize: "240px 240px",
        backgroundPosition: `${Math.floor(rand(f, 1) * 240)}px ${Math.floor(rand(f, 2) * 240)}px`,
        opacity,
        mixBlendMode: "overlay",
        pointerEvents: "none",
      }}
    />
  );
}

export function Vignette({ strength = 0.45 }: { strength?: number }) {
  return <AbsoluteFill style={{ background: `radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,${strength}) 100%)`, pointerEvents: "none" }} />;
}

/**
 * A scene that arrives by a circle opening from a point — the film's one
 * transition, always on a change of the music, always from where the eye is.
 */
export function Reveal({ t, at, dur = 0.7, x = 50, y = 50, children, until }: { t: number; at: number; dur?: number; x?: number; y?: number; children: ReactNode; until?: number }) {
  if (t < at - 0.001) return null;
  if (until != null && t > until) return null;
  const p = span(t, at, at + dur, EASE.move);
  const r = mix(0, 150, p);
  return <AbsoluteFill style={{ clipPath: p >= 1 ? undefined : `circle(${r.toFixed(2)}% at ${x}% ${y}%)` }}>{children}</AbsoluteFill>;
}

/** A camera on a scene: zoom about the centre, then a pan, in screen pixels. */
export function Camera({ x = 0, y = 0, zoom = 1, roll = 0, children }: { x?: number; y?: number; zoom?: number; roll?: number; children: ReactNode }) {
  return (
    <AbsoluteFill style={{ transform: `translate(${(-x * zoom).toFixed(2)}px, ${(-y * zoom).toFixed(2)}px) scale(${zoom.toFixed(4)}) rotate(${roll.toFixed(3)}deg)`, transformOrigin: "50% 50%" }}>
      {children}
    </AbsoluteFill>
  );
}

/** Something placed by its centre at (x, y) on a 1920×1080 frame. */
export function At({ x, y, children, style }: { x: number; y: number; children: ReactNode; style?: CSSProperties }) {
  return (
    <div style={{ position: "absolute", left: x, top: y, transform: "translate(-50%, -50%)" }}>
      <div style={style}>{children}</div>
    </div>
  );
}

/* ───────────────────────────── type ───────────────────────────── */

/**
 * A line of the narration, set as it is said: each word rises out of its own
 * mask on the syllable the voice reaches it. `accent` words are set in the
 * serif italic and coloured — the word the sentence leans on.
 */
export function Spoken({
  id,
  t,
  size = 120,
  color = PAL.text,
  accentColor = PAL.blue,
  accent = [],
  phrases,
  out,
  align = "center",
  maxWidth = 1640,
  lead = 0.08,
  style,
  heavy = true,
  text,
}: {
  id: string;
  t: number;
  size?: number;
  color?: string;
  accentColor?: string;
  accent?: string[];
  /** Only these phrases of the line (indices). */
  phrases?: number[];
  /** When the words leave: they rise away together. */
  out?: number;
  align?: "left" | "center" | "right";
  maxWidth?: number;
  lead?: number;
  style?: CSSProperties;
  heavy?: boolean;
  /** Show this text instead of the line's own words, still timed word for word by the line. */
  text?: string;
}) {
  const l: Line = line(id);
  let words = l.words;
  if (phrases) {
    const keep = phrases.map((k) => l.phrases[k]);
    words = words.filter((w) => keep.some((p) => w.at >= p.start - 0.01 && w.at < p.end + 0.01));
  }
  const custom = text?.split(/\s+/);
  // Punctuation comes back from the written line, token by token, in order.
  const tokens = l.text.split(/\s+/);
  const punctOf = (w: { word: string; at: number }) => tokens[l.words.indexOf(w as Line["words"][number])]?.match(/[,:.!?]+$/)?.[0] ?? "";
  const items = custom
    ? custom.map((w, i) => ({ word: w, punct: "", at: words[Math.min(words.length - 1, Math.floor((i / custom.length) * words.length))]?.at ?? l.start }))
    : words.map((w) => ({ word: w.word, punct: punctOf(w), at: w.at }));
  const leave = out != null ? span(t, out, out + 0.22, EASE.leave) : 0;
  if (leave >= 1) return null;
  const base = heavy ? TYPE.heavy(size, color) : TYPE.display(size, 700, color);
  return (
    <div style={{ maxWidth, textAlign: align, ...style, opacity: 1 - leave * 0.2, transform: `translateY(${(-leave * size * 0.9).toFixed(1)}px)` }}>
      {items.map((w, i) => {
        const p = span(t, w.at - lead, w.at - lead + 0.38, EASE.arrive);
        const isAccent = accent.some((a) => w.word.toLowerCase().replace(/[^\w']/g, "") === a.toLowerCase());
        const wordStyle = isAccent ? { ...TYPE.serif(size * 1.12, accentColor) } : base;
        return (
          <span key={i} style={{ display: "inline-block", overflow: "hidden", verticalAlign: "bottom", padding: `0 ${(size * 0.25).toFixed(1)}px ${(size * 0.14).toFixed(1)}px 0`, marginBottom: -size * 0.1 }}>
            <span style={{ display: "inline-block", ...wordStyle, transform: `translateY(${((1 - p) * 105).toFixed(1)}%)`, opacity: p > 0 ? 1 : 0, filter: p < 0.98 ? `blur(${((1 - p) * 8).toFixed(2)}px)` : undefined }}>
              {w.word}
              {w.punct}
            </span>
          </span>
        );
      })}
    </div>
  );
}

/** A word or two set by hand on a cue, same rise. */
export function Title({ t, at, children, style, out, dur = 0.5 }: { t: number; at: number; children: ReactNode; style?: CSSProperties; out?: number; dur?: number }) {
  const p = span(t, at, at + dur, EASE.arrive);
  const leave = out != null ? span(t, out, out + 0.4, EASE.leave) : 0;
  if (p <= 0 || leave >= 1) return null;
  return (
    <div style={{ overflow: "hidden", padding: "0.06em 0.1em 0.16em" }}>
      <div style={{ ...style, transform: `translateY(${((1 - p) * 105 - leave * 110).toFixed(1)}%)`, filter: p < 0.98 ? `blur(${((1 - p) * 8).toFixed(2)}px)` : undefined }}>{children}</div>
    </div>
  );
}

/** A number counting up to `to` over [a, b]. */
export function count(t: number, a: number, b: number, to: number) {
  return Math.round(to * span(t, a, b, EASE.arrive));
}

/* ───────────────────────────── shapes ───────────────────────────── */

/** An SVG stroke that draws itself as `p` goes 0 → 1. */
export function Draw({ d, p, stroke, width = 3, glow, fill = "none", opacity = 1, cap = "round" }: { d: string; p: number; stroke: string; width?: number; glow?: string; fill?: string; opacity?: number; cap?: "round" | "butt" }) {
  const k = clamp01(p);
  if (k <= 0) return null;
  return (
    <>
      {glow && <path d={d} fill="none" stroke={glow} strokeWidth={width * 5} strokeLinecap={cap} pathLength={1} strokeDasharray={1} strokeDashoffset={1 - k} opacity={0.35 * opacity} style={{ filter: "blur(8px)" }} />}
      <path d={d} fill={fill} stroke={stroke} strokeWidth={width} strokeLinecap={cap} strokeLinejoin="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - k} opacity={opacity} />
    </>
  );
}

/** A full-frame SVG layer in frame pixels. */
export function Svg({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <svg width={1920} height={1080} viewBox="0 0 1920 1080" style={{ position: "absolute", inset: 0, overflow: "visible", ...style }}>
      {children}
    </svg>
  );
}

/** Lines bursting out of a point at time `at`. */
export function Burst({ t, at, x, y, color = PAL.white, rays = 16, r0 = 60, r1 = 420, width = 3, dur = 0.7, salt = 0 }: { t: number; at: number; x: number; y: number; color?: string; rays?: number; r0?: number; r1?: number; width?: number; dur?: number; salt?: number }) {
  const p = span(t, at, at + dur, EASE.arrive);
  if (p <= 0 || p >= 1) return null;
  return (
    <g opacity={1 - p}>
      {Array.from({ length: rays }, (_, i) => {
        const a = (i / rays) * Math.PI * 2 + rand(i, salt) * 0.3;
        const len = mix(0.5, 1, rand(i, salt + 1));
        const inner = mix(r0, r1 * len * 0.75, p);
        const outer = mix(r0, r1 * len, Math.min(1, p * 1.4));
        return <line key={i} x1={x + Math.cos(a) * inner} y1={y + Math.sin(a) * inner} x2={x + Math.cos(a) * outer} y2={y + Math.sin(a) * outer} stroke={color} strokeWidth={width} strokeLinecap="round" />;
      })}
    </g>
  );
}

/** A ring going out from a point and fading. */
export function Pulse({ t, at, x, y, color = PAL.white, r0 = 20, r1 = 260, width = 3, dur = 0.9 }: { t: number; at: number; x: number; y: number; color?: string; r0?: number; r1?: number; width?: number; dur?: number }) {
  const p = span(t, at, at + dur, EASE.arrive);
  if (p <= 0 || p >= 1) return null;
  return <circle cx={x} cy={y} r={mix(r0, r1, p)} fill="none" stroke={color} strokeWidth={width * (1 - p * 0.7)} opacity={1 - p} />;
}

/** Slow drifting motes of light. */
export function Motes({ t, count: n = 40, color = PAL.white, seed = 0, size = 3, opacity = 0.5, speed = 18 }: { t: number; count?: number; color?: string; seed?: number; size?: number; opacity?: number; speed?: number }) {
  return (
    <Svg>
      {Array.from({ length: n }, (_, i) => {
        const r = (k: number) => rand(i + seed * 101, k);
        const depth = 0.3 + r(1) * 0.7;
        const x = ((r(2) * 2100 + t * speed * depth * (r(3) > 0.5 ? 1 : -1)) % 2100 + 2100) % 2100 - 90;
        const y = ((r(4) * 1200 - t * speed * 0.6 * depth) % 1200 + 1200) % 1200 - 60;
        const tw = 0.5 + 0.5 * Math.sin(t * (1 + r(5) * 2) + i);
        return <circle key={i} cx={x} cy={y} r={size * depth} fill={color} opacity={opacity * depth * (0.4 + 0.6 * tw)} />;
      })}
    </Svg>
  );
}

/** A soft round light. */
export function Glow({ x, y, r, color, opacity = 1 }: { x: number; y: number; r: number; color: string; opacity?: number }) {
  return <div style={{ position: "absolute", left: x - r, top: y - r, width: r * 2, height: r * 2, borderRadius: "50%", background: `radial-gradient(circle, ${color}, transparent 68%)`, opacity, pointerEvents: "none" }} />;
}

/* ───────────────────────────── the product, drawn large ───────────────────────────── */

/** A card of the app's UI, lifted out of the screen: white, rounded, deep shadow. */
export function Card({ children, w, style, dark = false }: { children: ReactNode; w?: number; style?: CSSProperties; dark?: boolean }) {
  return (
    <div
      style={{
        width: w,
        borderRadius: 28,
        background: dark ? "linear-gradient(180deg,#121a33,#0c1328)" : "#ffffff",
        border: dark ? "1px solid rgba(255,255,255,0.08)" : "1px solid rgba(15,23,42,0.06)",
        boxShadow: dark ? "0 2px 4px rgba(0,0,0,0.4), 0 40px 90px rgba(0,0,0,0.5)" : "0 2px 4px rgba(15,23,42,0.06), 0 40px 90px rgba(15,23,42,0.18)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/** A 3D tilt for anything, eased in from a starting pose. */
export function tilt({ rx = 0, ry = 0, rz = 0, s = 1, x = 0, y = 0, z = 0, o = 1 }: { rx?: number; ry?: number; rz?: number; s?: number; x?: number; y?: number; z?: number; o?: number }): CSSProperties {
  return {
    transform: `perspective(1800px) translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, ${z.toFixed(1)}px) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg) rotateZ(${rz.toFixed(2)}deg) scale(${s.toFixed(4)})`,
    opacity: o,
  };
}

/** On a beat of the music near `t` — for cuts that land. */
export const beat = BAR / 4;

/** The Raya mark (the flower), turned by `turn` degrees. */
export function RayaMark({ size, turn = 0, dark = false, style }: { size: number; turn?: number; dark?: boolean; style?: CSSProperties }) {
  return <Img src={MARKS[dark ? "raya-mark-dark.png" : "icon-raya-512.png"]} style={{ width: size, height: size, display: "block", transform: `rotate(${turn.toFixed(2)}deg)`, ...style }} />;
}

/** The landing's call to try Raya, as a pill — pressed as `pressed` runs 0 → 1. */
export function TryRayaPill({ pressed }: { pressed: number }) {
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        borderRadius: 999,
        padding: "18px 34px",
        background: PAL.blue,
        boxShadow: "0 12px 30px rgba(47,127,224,0.32)",
        whiteSpace: "nowrap",
        ...TYPE.display(30, 650, "#ffffff"),
        transform: `scale(${(1 - 0.05 * Math.sin(clamp01(pressed) * Math.PI)).toFixed(4)})`,
      }}
    >
      Try <span style={{ fontFamily: RAYA_FONT, fontWeight: 700, margin: "0 9px" }}>Raya</span> now — no account needed
    </div>
  );
}
