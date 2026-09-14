import type { ReactNode } from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import BrowserFrame from "@/components/site/DeviceFrame";
import { FrozenShot } from "./FrozenShot";
import { FONTS, INK, theme } from "./brand";
import type { TimedScene } from "./timeline";

/** One product shot shown during part of a scene. */
export type Beat = {
  /** Seconds from the start of the scene. */
  at: number;
  url: string;
  node: ReactNode;
  /** <1 slows the shot's choreography down so it can be read on a video. */
  speed?: number;
  /** Replay the shot's choreography from the top every this many seconds. */
  replayEvery?: number;
};

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/**
 * A scene built around the site's own product shots: a heading on one side,
 * the shot in its browser frame on the other (or below it, for the wide chat
 * transcript), a slow camera push, and a cross-fade between beats.
 */
export function ShotScene({ scene, beats, layout }: { scene: TimedScene; beats: Beat[]; layout: "side" | "wide" }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const total = scene.duration;

  const enter = spring({ frame, fps, config: { damping: 200 }, durationInFrames: Math.round(0.9 * fps) });
  const exit = interpolate(t, [total - 0.45, total], [1, 0], clamp);
  const push = interpolate(t, [0, total], [0.975, 1.025], clamp);

  const heading = (
    <div
      style={{
        opacity: enter * exit,
        transform: `translateY(${(1 - enter) * 26}px)`,
        textAlign: layout === "wide" ? "center" : "left",
      }}
    >
      {scene.eyebrow && (
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 10,
            padding: "8px 18px",
            borderRadius: 999,
            background: "rgba(47,127,224,0.1)",
            border: "1px solid rgba(47,127,224,0.25)",
            color: INK.blue,
            fontFamily: FONTS.display,
            fontSize: 26,
            fontWeight: 600,
            marginBottom: 22,
          }}
        >
          <span style={{ width: 9, height: 9, borderRadius: "50%", background: INK.blue }} />
          {scene.eyebrow}
        </div>
      )}
      {scene.headline && (
        <div
          style={{
            fontFamily: FONTS.display,
            fontSize: layout === "wide" ? 60 : 68,
            fontWeight: 700,
            lineHeight: 1.06,
            letterSpacing: "-0.025em",
            color: INK.text,
            maxWidth: layout === "wide" ? 1400 : 640,
          }}
        >
          {scene.headline}
        </div>
      )}
    </div>
  );

  // Sized so the frame's bottom edge clears the caption band at every point of
  // the camera push (captions sit in the bottom ~130px).
  const shotWidth = layout === "wide" ? 1380 : 960;

  const stage = beats.map((beat, i) => {
    const next = beats[i + 1]?.at ?? total;
    const visible =
      interpolate(t, [beat.at - 0.01, beat.at + 0.45], [0, 1], clamp) *
      (i < beats.length - 1 ? interpolate(t, [next - 0.45, next], [1, 0], clamp) : 1);
    if (visible <= 0) return null;
    const local = Math.max(0, t - beat.at);
    const played = beat.replayEvery ? local % beat.replayEvery : local;
    return (
      // Clipped to the first beat's frame: a taller drawing (the concept graph)
      // shows its top and never pushes past the caption band.
      <div key={i} style={{ position: "absolute", inset: 0, opacity: visible, overflow: "hidden", borderRadius: 18 }}>
        <BrowserFrame theme={theme} url={beat.url}>
          <FrozenShot timeMs={played * 1000 * (beat.speed ?? 1)}>{beat.node}</FrozenShot>
        </BrowserFrame>
      </div>
    );
  });

  const shot = (
    <div
      style={{
        position: "relative",
        width: shotWidth,
        opacity: enter * exit,
        transform: `translateY(${(1 - enter) * 40}px) scale(${push})`,
        transformOrigin: "50% 45%",
        filter: "drop-shadow(0 40px 60px rgba(15,23,42,0.16))",
      }}
    >
      {/* The first beat sizes the stage; the others stack on top of it. */}
      <div style={{ visibility: "hidden" }}>
        <BrowserFrame theme={theme} url={beats[0].url}>
          <FrozenShot timeMs={0}>{beats[0].node}</FrozenShot>
        </BrowserFrame>
      </div>
      {stage}
    </div>
  );

  if (layout === "wide") {
    return (
      <AbsoluteFill style={{ alignItems: "center", paddingTop: 56 }}>
        {heading}
        <div style={{ marginTop: 34 }}>{shot}</div>
      </AbsoluteFill>
    );
  }

  return (
    <AbsoluteFill style={{ flexDirection: "row", alignItems: "center", padding: "0 120px 140px 130px", gap: 80 }}>
      <div style={{ flex: "0 0 600px" }}>{heading}</div>
      {shot}
    </AbsoluteFill>
  );
}
