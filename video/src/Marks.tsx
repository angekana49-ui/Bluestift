import type { CSSProperties } from "react";
import { Img } from "remotion";
import { RAYA_FONT } from "@/components/ui/brand";
import { FONTS } from "./brand";
import { MARKS } from "./generated/marks";

/**
 * The two marks and their names, as the film moves them.
 *
 * The Raya mark is a nine-petal pinwheel, which is to say a wheel: set it on
 * a line and roll it, and it reads as rolling rather than spinning only if
 * the turn matches the travel exactly — angle = distance ÷ radius. `RayaWheel`
 * takes the centre's x and derives the turn from it, so it can never skid.
 */

export const BLUE = { deep: "#173d8a", bright: "#2f7fe0" };

/**
 * The Raya mark on a ground line at `groundY`, its centre at `x`, having
 * rolled from `x0`. `speed` (px/s, signed) adds a trace of motion blur while
 * it moves fast, the way a shutter would record it.
 */
export function RayaWheel({
  x,
  x0,
  groundY,
  size,
  speed = 0,
  opacity = 1,
  dark = false,
  shadow = true,
  turn,
}: {
  x: number;
  x0: number;
  groundY: number;
  size: number;
  speed?: number;
  opacity?: number;
  dark?: boolean;
  shadow?: boolean;
  /** Degrees, when something other than rolling turns it. */
  turn?: number;
}) {
  // The artwork's petals reach ~92% of its box; the wheel's radius is theirs.
  const r = (size * 0.92) / 2;
  const angle = turn ?? ((x - x0) / r) * (180 / Math.PI);
  const src = MARKS[dark ? "raya-mark-dark.png" : "icon-raya-512.png"];
  // Degrees the wheel turns during a 1/60 s exposure.
  const smear = Math.min(14, Math.abs(speed / r) * (180 / Math.PI) / 60);
  const img = (extra: number, alpha: number) => (
    <Img
      src={src}
      style={{
        position: "absolute",
        inset: 0,
        width: size,
        height: size,
        transform: `rotate(${angle - extra * Math.sign(speed)}deg)`,
        opacity: alpha,
      }}
    />
  );
  return (
    <div style={{ position: "absolute", left: x - size / 2, top: groundY - size / 2 - r * 0.02, width: size, height: size, opacity }}>
      {shadow && (
        <div
          style={{
            position: "absolute",
            left: size * 0.12,
            right: size * 0.12,
            top: size * 0.93,
            height: size * 0.09,
            borderRadius: "50%",
            background: `radial-gradient(ellipse at center, rgba(15,23,42,${dark ? 0.5 : 0.22}) 0%, transparent 70%)`,
          }}
        />
      )}
      {smear > 1.5 && img(smear, 0.22)}
      {smear > 1.5 && img(smear / 2, 0.35)}
      {img(0, 1)}
    </div>
  );
}

/** The Bluestift mark: the bird, the gear and the link. */
export function BluestiftMark({ size, style }: { size: number; style?: CSSProperties }) {
  return <Img src={MARKS["icon-512.png"]} style={{ width: size, height: size, display: "block", ...style }} />;
}

/**
 * "Bluestift", in the flagship lockup's two blues. Split for colour only —
 * the name is still one word, spelled as it always is.
 */
export function BluestiftWordmark({ size, dark = false, style }: { size: number; dark?: boolean; style?: CSSProperties }) {
  return (
    <span
      translate="no"
      style={{
        fontFamily: FONTS.display,
        fontWeight: 700,
        fontSize: size,
        letterSpacing: "-0.035em",
        lineHeight: 1,
        whiteSpace: "nowrap",
        ...style,
      }}
    >
      <span style={{ color: dark ? "#8fb8f0" : BLUE.deep }}>Blue</span>
      <span style={{ color: dark ? "#4e9bf5" : BLUE.bright }}>stift</span>
    </span>
  );
}

/** "Raya" in its wordmark face. */
export function RayaWordmark({ size, color = BLUE.deep, style }: { size: number; color?: string; style?: CSSProperties }) {
  return (
    <span translate="no" style={{ fontFamily: RAYA_FONT, fontWeight: 700, fontSize: size, lineHeight: 1, color, letterSpacing: "-0.01em", ...style }}>
      Raya
    </span>
  );
}
