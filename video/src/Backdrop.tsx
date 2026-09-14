import { AbsoluteFill, useCurrentFrame } from "remotion";
import { FPS } from "./timeline";

/**
 * One continuous sky behind every scene, so a cut between scenes never cuts the
 * background: the same soft blues as the landing's light theme, with three
 * slow blurred lights drifting across it. Driven by the frame, never by time.
 */
export function Backdrop() {
  const t = useCurrentFrame() / FPS;
  const drift = (speed: number, phase: number, amp: number) => Math.sin(t * speed + phase) * amp;

  const light = (x: number, y: number, size: number, color: string) => ({
    position: "absolute" as const,
    left: x,
    top: y,
    width: size,
    height: size,
    borderRadius: "50%",
    background: color,
    filter: "blur(120px)",
    opacity: 0.55,
  });

  return (
    <AbsoluteFill style={{ background: "linear-gradient(160deg,#f6f9ff 0%,#eaf1fc 52%,#dfe9f8 100%)", overflow: "hidden" }}>
      <div style={light(-180 + drift(0.11, 0, 90), -220 + drift(0.09, 1, 60), 900, "#b9d5fb")} />
      <div style={light(1150 + drift(0.08, 2, 120), 380 + drift(0.1, 0.5, 80), 980, "#c9c3fb")} />
      <div style={light(420 + drift(0.07, 4, 140), 720 + drift(0.12, 3, 50), 760, "#bdeee0")} />
    </AbsoluteFill>
  );
}
