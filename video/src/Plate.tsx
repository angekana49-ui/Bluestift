import type { CSSProperties, ReactNode } from "react";
import BrowserFrame from "@/components/site/DeviceFrame";
import { getTheme, type Theme } from "@/components/site/theme";
import { FrozenShot } from "./FrozenShot";

/**
 * A product screen floating in the film's space: the site's browser frame
 * around one of the site's own shots, played at `ms` of its choreography.
 *
 * `pose` places it — pixels from the frame's centre, depth, turn, scale —
 * and `focus` is how sharp it is, the one lens effect that sells a real
 * camera: 1 is in focus, 0 is as soft as the background ever gets.
 */
export type Pose = {
  x?: number;
  y?: number;
  z?: number;
  rx?: number;
  ry?: number;
  rz?: number;
  s?: number;
  o?: number;
  focus?: number;
};

/**
 * What the site's stylesheet and frames do that a film must not:
 *
 * - the shots' own window rail, drawn a second time inside the browser frame
 *   that already has one;
 * - the hero dashboard's page-load entrance, which a render cannot seek
 *   (src/reveal.ts plays it on the film's clock instead);
 * - the frame's glass reflection. On a page it is a hint of a window; filmed,
 *   on a pale sky, it is a white veil across the top-left third of every light
 *   screen, and it took the colour out of exactly the words being read.
 *
 * And what the sky needs from a light screen: an edge. The frame's hairline
 * vanishes against a sky nearly as pale as the screen, so light plates get a
 * firmer rim and a deeper, three-layer shadow to stand on.
 *
 * And one Chrome quirk: SVG text is laid out at a font scaled by every CSS
 * transform above it, measured when it is laid out and not when the transform
 * changes. The Kernel gauge's "68%" was laid out again mid-zoom (the plate
 * before it unmounting) and jumped off the arc, oversized, for the rest of the
 * shot — only in a continuous render, never in a still. `geometricPrecision`
 * makes Chrome lay SVG text out at its own size. Scoped to the Kernel plates
 * (`vid-kernel`): on the others it has never shown, and a film patched in
 * pieces must not change how the untouched pieces draw their text.
 */
export const VIDEO_CSS = `
.vid-plate .pub-shot > [aria-hidden]:first-child{display:none!important}
.pub-hero-tile,.pub-hero-fill,.pub-hero-gauge,.pub-hero-rise{animation:none!important}
.vid-plate .pub-frame > div:nth-child(2) > span[aria-hidden]:last-child{display:none!important}
.vid-light .pub-frame{border-color:rgba(15,23,42,0.17)!important;box-shadow:0 1px 2px rgba(15,23,42,0.10),0 14px 32px rgba(15,23,42,0.12),0 48px 110px rgba(15,23,42,0.24)!important}
.vid-light.vid-bare > div{box-shadow:0 0 0 1px rgba(15,23,42,0.14),0 14px 32px rgba(15,23,42,0.12),0 48px 110px rgba(15,23,42,0.24)!important}
.vid-kernel svg text{text-rendering:geometricPrecision}
`;

export function poseStyle({ x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, s = 1, o = 1, focus = 1 }: Pose): CSSProperties {
  const blur = (1 - focus) * 16;
  return {
    position: "absolute",
    left: "50%",
    top: "50%",
    // Centred first, then moved: a centring translate written after the scale
    // is scaled with it, and every plate not at scale 1 landed off its mark.
    transform: `translate(-50%, -50%) translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, ${z.toFixed(2)}px) rotateX(${rx.toFixed(3)}deg) rotateY(${ry.toFixed(3)}deg) rotateZ(${rz.toFixed(3)}deg) scale(${s.toFixed(4)})`,
    opacity: o,
    filter: blur > 0.25 ? `blur(${blur.toFixed(2)}px)` : undefined,
  };
}

export function Plate({
  dark = false,
  url,
  width,
  ms,
  pose,
  children,
  crop,
  bare = false,
  className,
}: {
  /** Extra class on the plate, to scope a stylesheet to this one. */
  className?: string;
  dark?: boolean;
  url?: string;
  width: number;
  /** Time in the shot's own choreography; omit for its finished composition. */
  ms?: number;
  pose: Pose;
  /** The shot, drawn for the given theme. */
  children: (t: Theme) => ReactNode;
  /** Show only this band of the screen: pixels from its top, and height. */
  crop?: { top: number; height: number };
  /** No browser chrome — for the diagrams, which are not screens. */
  bare?: boolean;
}) {
  if ((pose.o ?? 1) <= 0.001) return null;
  const t = getTheme(dark);
  // Always through FrozenShot, if only for the images it points at this
  // package's public/: a finished composition is simply a late moment.
  const shot = <FrozenShot timeMs={ms ?? 600000}>{children(t)}</FrozenShot>;
  const screen = crop ? (
    <div style={{ height: crop.height, overflow: "hidden" }}>
      <div style={{ marginTop: -crop.top }}>{shot}</div>
    </div>
  ) : (
    shot
  );
  return (
    <div className={["vid-plate", dark ? "vid-dark" : "vid-light", bare ? "vid-bare" : "", className ?? ""].join(" ").trim()} style={{ ...poseStyle(pose), width, color: t.text }}>
      {bare ? (
        <div
          style={{
            borderRadius: 18,
            overflow: "hidden",
            boxShadow: dark
              ? "0 1px 2px rgba(0,0,0,0.5), 0 24px 60px rgba(0,0,0,0.45)"
              : "0 1px 2px rgba(15,23,42,0.07), 0 24px 60px rgba(15,23,42,0.16)",
          }}
        >
          {screen}
        </div>
      ) : (
        <BrowserFrame theme={t} url={url}>
          {screen}
        </BrowserFrame>
      )}
    </div>
  );
}

/**
 * A soft ring drawn around the thing being named — the pointer a presenter
 * would use, kept quiet enough to read as light rather than as a sticker.
 */
export function Halo({ x, y, w, h, radius = 14, strength, color = "47,127,224" }: { x: number; y: number; w: number; h: number; radius?: number; strength: number; color?: string }) {
  if (strength <= 0.001) return null;
  const grow = 1 + (1 - strength) * 0.08;
  return (
    <div
      style={{
        position: "absolute",
        left: "50%",
        top: "50%",
        width: w,
        height: h,
        borderRadius: radius,
        transform: `translate(${x}px, ${y}px) translate(-50%, -50%) scale(${grow})`,
        boxShadow: `0 0 0 2.5px rgba(${color},${(0.85 * strength).toFixed(3)}), 0 0 36px 6px rgba(${color},${(0.28 * strength).toFixed(3)})`,
        pointerEvents: "none",
      }}
    />
  );
}

/**
 * Where a point of the film's space lands on the frame, through `camera` —
 * for a title that has to meet a plate exactly. Ignores roll and depth, which
 * are only ever a hair when this is used.
 */
export function toFrame(p: { x: number; y: number }, camera: { x: number; y: number; zoom: number }) {
  return { x: 960 + camera.zoom * (p.x - camera.x), y: 540 + camera.zoom * (p.y - camera.y) };
}

let measureCtx: CanvasRenderingContext2D | null = null;
/** The width of one line of text in a loaded face, for laying titles out by hand. */
export function textWidth(text: string, font: string) {
  measureCtx ??= document.createElement("canvas").getContext("2d");
  if (!measureCtx) return text.length * 0.55 * Number(font.match(/(\d+(?:\.\d+)?)px/)?.[1] ?? 16);
  measureCtx.font = font;
  return measureCtx.measureText(text).width;
}

/**
 * Where a point of a shot sits in the film's space, for aiming the camera at
 * it: `px, py` in pixels from the top-left of the screen (as
 * scripts/measure.mjs reports them), for a plate of `width` whose screen is
 * `screenH` tall. Ignores the plate's turn, which is only ever small when the
 * camera is looking closely.
 */
export function spot(pose: Pose, width: number, screenH: number, px: number, py: number, framed = true) {
  const rail = framed ? 43 : 0;
  const s = pose.s ?? 1;
  return { x: (pose.x ?? 0) + s * (px - width / 2), y: (pose.y ?? 0) + s * (rail + py - (rail + screenH) / 2) };
}

/**
 * The film's space: a perspective box the size of the frame, looked at by a
 * camera that can pan, dolly (zoom) and roll a hair. Children are placed with
 * `poseStyle` relative to its centre.
 */
export function World({
  camera = {},
  perspective = 2400,
  children,
  style,
}: {
  camera?: { x?: number; y?: number; zoom?: number; roll?: number };
  perspective?: number;
  children: ReactNode;
  style?: CSSProperties;
}) {
  const { x = 0, y = 0, zoom = 1, roll = 0 } = camera;
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", ...style }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          transform: `scale(${zoom.toFixed(4)}) rotate(${roll.toFixed(3)}deg) translate(${(-x).toFixed(2)}px, ${(-y).toFixed(2)}px)`,
          transformOrigin: "50% 50%",
          perspective,
          perspectiveOrigin: `${960 + x}px ${540 + y}px`,
        }}
      >
        {children}
      </div>
    </div>
  );
}
