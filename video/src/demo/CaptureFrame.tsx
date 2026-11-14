import type { CSSProperties, ReactNode } from "react";
import { interpolate, OffthreadVideo, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import manifestFile from "./manifest.json";
import { timecode } from "./cues";
import { FONTS } from "../brand";
import { PAL } from "../film/kit";

/**
 * The product on screen: real captures in a rounded frame — or, until the
 * capture phase delivers them, an honest production slate that names the
 * missing file. The slate is drawn to read as a slate (clapper stripes,
 * timecode, AWAITING CAPTURE), never as product UI: no fake messages, no
 * fake numbers, no fake buttons. Drop a capture into captures/, re-run
 * scripts/demo-manifest.mjs, and the frame shows the real app.
 */

const manifest = manifestFile as Record<string, boolean>;
export const hasCapture = (file: string): boolean => manifest[file] === true;

/** The product frame's geometry on a 1920×1080 canvas. */
export const FRAME = { x: 240, y: 116, w: 1440, h: 784 };

const STRIPES = `repeating-linear-gradient(-55deg, rgba(238,246,255,0.85) 0 26px, rgba(5,9,19,0.9) 26px 52px)`;

export function Slate({
  t,
  file,
  sceneId,
  title,
  sub,
  demoData = false,
  compact = false,
  style,
}: {
  t: number;
  file: string;
  sceneId: string;
  title: string;
  sub: string;
  demoData?: boolean;
  compact?: boolean;
  style?: CSSProperties;
}) {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        borderRadius: 24,
        overflow: "hidden",
        background: "linear-gradient(165deg, #0e1934 0%, #0a1229 55%, #070d22 100%)",
        border: "1px solid rgba(159,214,255,0.22)",
        display: "flex",
        flexDirection: "column",
        ...style,
      }}
    >
      <div style={{ height: compact ? 34 : 46, background: STRIPES, opacity: 0.5, flexShrink: 0 }} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: compact ? "10px 22px 0" : "14px 30px 0" }}>
        <span style={{ fontFamily: FONTS.mono, fontSize: compact ? 17 : 21, letterSpacing: "0.14em", color: "rgba(159,214,255,0.85)" }}>{sceneId}</span>
        <span style={{ fontFamily: FONTS.mono, fontSize: compact ? 17 : 21, letterSpacing: "0.1em", color: "rgba(238,246,255,0.55)" }}>
          {timecode(t)} · 1080p30
        </span>
      </div>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: compact ? 10 : 16, padding: "0 40px" }}>
        <div style={{ fontFamily: FONTS.display, fontWeight: 700, fontSize: compact ? 44 : 68, letterSpacing: "-0.02em", color: PAL.ice, textAlign: "center", lineHeight: 1.05 }}>{title}</div>
        <div style={{ fontFamily: FONTS.mono, fontSize: compact ? 16 : 22, letterSpacing: "0.06em", color: "rgba(238,246,255,0.6)", textAlign: "center" }}>
          REAL CAPTURE · {file}
        </div>
        <div
          style={{
            fontFamily: FONTS.mono,
            fontSize: compact ? 15 : 19,
            letterSpacing: "0.18em",
            color: PAL.amber,
            border: `1px solid ${PAL.amber}`,
            borderRadius: 999,
            padding: compact ? "6px 18px" : "9px 26px",
            marginTop: compact ? 2 : 8,
          }}
        >
          AWAITING CAPTURE
        </div>
        <div style={{ fontFamily: FONTS.body, fontSize: compact ? 15 : 20, color: "rgba(238,246,255,0.45)", textAlign: "center", maxWidth: 760 }}>{sub}</div>
      </div>
      <div style={{ display: "flex", justifyContent: "center", paddingBottom: compact ? 12 : 18 }}>
        <span style={{ fontFamily: FONTS.mono, fontSize: compact ? 13 : 16, letterSpacing: "0.22em", color: demoData ? "rgba(255,181,71,0.9)" : "rgba(238,246,255,0.35)" }}>
          {demoData ? "ILLUSTRATIVE EXAMPLE · DEMO DATA" : "BLUESTIFT DEMO · YC CUT"}
        </span>
      </div>
    </div>
  );
}

export function CaptureFrame({
  t,
  entryAt,
  file,
  sceneId,
  title,
  sub,
  demoData = false,
  zoom = 1,
  dim = 0,
  geometry = FRAME,
  tilt = true,
  children,
}: {
  t: number;
  /** When the frame's entry spring starts (seconds). */
  entryAt: number;
  file: string | null;
  sceneId: string;
  title: string;
  sub: string;
  demoData?: boolean;
  zoom?: number;
  /** 0 → 1 darkens the frame (key moments). */
  dim?: number;
  geometry?: { x: number; y: number; w: number; h: number };
  tilt?: boolean;
  children?: ReactNode;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const entryFrame = Math.round(entryAt * fps);
  const s = spring({ frame: Math.max(0, frame - entryFrame), fps, config: { damping: 200 } });
  const scale = 0.92 + 0.08 * s;
  const opacity = interpolate(frame - entryFrame, [0, 6], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const rx = tilt ? (1 - s) * 5 : 0;
  const ry = tilt ? (1 - s) * -7 : 0;

  return (
    <div style={{ position: "absolute", left: geometry.x, top: geometry.y, width: geometry.w, height: geometry.h, perspective: 1600, opacity }}>
      <div style={{ width: "100%", height: "100%", transform: `scale(${scale.toFixed(4)}) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg)`, transformStyle: "preserve-3d" }}>
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: 24,
            overflow: "hidden",
            boxShadow: "0 2px 6px rgba(0,0,0,0.5), 0 50px 110px rgba(0,0,0,0.55), 0 0 0 1px rgba(159,214,255,0.14)",
            background: "#070d22",
            transform: `scale(${zoom.toFixed(4)})`,
          }}
        >
          {file && hasCapture(file) ? (
            <OffthreadVideo src={staticFile(`captures/${file}`)} style={{ width: "100%", height: "100%", objectFit: "cover" }} muted />
          ) : (
            <Slate t={t} file={file ?? "—"} sceneId={sceneId} title={title} sub={sub} demoData={demoData} />
          )}
          {dim > 0.01 && <div style={{ position: "absolute", inset: 0, background: `rgba(3,6,15,${dim.toFixed(3)})`, borderRadius: 24 }} />}
          {children}
        </div>
      </div>
    </div>
  );
}
