import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { FONTS } from "./brand";
import { FPS, SCENES } from "./timeline";

const LINES = SCENES.flatMap((scene) =>
  scene.lines.map((line) => ({ ...line, at: scene.start + line.start, until: scene.start + line.start + line.duration + 0.25 })),
);

/**
 * Burned-in captions, one line of the voice-over at a time.
 *
 * Most people meet this video with the sound off, so every word said is also on
 * screen. The text is exactly the script's, timed from the measured voice files.
 */
export function Captions() {
  const t = useCurrentFrame() / FPS;
  const line = LINES.find((l) => t >= l.at && t < l.until);
  if (!line) return null;

  const fade = Math.min(
    interpolate(t, [line.at, line.at + 0.18], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
    interpolate(t, [line.until - 0.18, line.until], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
  );

  return (
    <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "center", paddingBottom: 34, pointerEvents: "none" }}>
      <div
        style={{
          maxWidth: 1720,
          padding: "12px 28px",
          borderRadius: 16,
          background: "rgba(11,18,32,0.82)",
          color: "#ffffff",
          fontFamily: FONTS.body,
          fontSize: 35,
          fontWeight: 600,
          lineHeight: 1.3,
          letterSpacing: "-0.005em",
          textAlign: "center",
          opacity: fade,
          transform: `translateY(${(1 - fade) * 8}px)`,
          boxShadow: "0 12px 40px rgba(11,18,32,0.25)",
        }}
      >
        {line.text}
      </div>
    </AbsoluteFill>
  );
}
