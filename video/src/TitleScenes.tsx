import { AbsoluteFill, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { RayaName } from "@/components/ui/brand";
import { FONTS, INK } from "./brand";
import type { TimedScene } from "./timeline";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** How far into a line the picture is, 0 → 1 over the first half-second. */
function useLineIn(scene: TimedScene, index: number) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const line = scene.lines[index];
  return spring({ frame: frame - Math.round(line.start * fps) + 3, fps, config: { damping: 200 }, durationInFrames: Math.round(0.6 * fps) });
}

/**
 * The hook: the problem in two sentences, then Raya. The first two lines stay
 * on screen and step back as the next arrives, so the three read as one thought.
 */
export function IntroScene({ scene }: { scene: TimedScene }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const a = useLineIn(scene, 0);
  const b = useLineIn(scene, 1);
  const c = useLineIn(scene, 2);
  const exit = interpolate(t, [scene.duration - 0.45, scene.duration], [1, 0], clamp);

  const sentence = (progress: number, dim: number, size: number, color: string) => ({
    fontFamily: FONTS.display,
    fontSize: size,
    fontWeight: 700,
    letterSpacing: "-0.03em",
    lineHeight: 1.1,
    color,
    opacity: progress * dim,
    transform: `translateY(${(1 - progress) * 30}px)`,
  });

  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", textAlign: "center", opacity: exit, paddingBottom: 90 }}>
      <div style={sentence(a, 1 - c * 0.55, 76, INK.text)}>Every student gets stuck sometimes.</div>
      <div style={{ ...sentence(b, 1 - c * 0.55, 76, INK.muted), marginTop: 18 }}>Most AI just hands over the answer.</div>
      <div style={{ ...sentence(c, 1, 104, INK.text), marginTop: 56 }}>
        <RayaName style={{ color: INK.blue }} /> does something better.
      </div>
    </AbsoluteFill>
  );
}

/** The end card: the name, the promise, the one action. */
export function OutroScene({ scene }: { scene: TimedScene }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const mark = spring({ frame, fps, config: { damping: 14, stiffness: 120 }, durationInFrames: Math.round(1.2 * fps) });
  const cta = useLineIn(scene, 1);
  const fadeOut = interpolate(t, [scene.duration - 0.8, scene.duration], [1, 0], clamp);

  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", textAlign: "center", opacity: fadeOut, paddingBottom: 110 }}>
      <Img
        src={staticFile("brand/bluestift-mark.png")}
        style={{ width: 132, height: 132, borderRadius: "50%", transform: `scale(${0.6 + mark * 0.4})`, opacity: mark }}
      />
      <div style={{ marginTop: 30, fontSize: 150, lineHeight: 1, color: INK.text, opacity: mark }}>
        <RayaName />
      </div>
      <div
        style={{
          marginTop: 22,
          fontFamily: FONTS.display,
          fontSize: 54,
          fontWeight: 600,
          letterSpacing: "-0.02em",
          color: INK.muted,
          opacity: mark,
        }}
      >
        The tutor that helps you think.
      </div>
      <div style={{ marginTop: 54, opacity: cta, transform: `translateY(${(1 - cta) * 20}px)`, display: "flex", flexDirection: "column", alignItems: "center", gap: 20 }}>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 14,
            padding: "20px 42px",
            borderRadius: 999,
            background: INK.navy,
            color: "#ffffff",
            fontFamily: FONTS.display,
            fontSize: 38,
            fontWeight: 600,
          }}
        >
          <span style={{ width: 12, height: 12, borderRadius: "50%", background: "#34d399" }} />
          Start free — no card needed
        </div>
        <div style={{ fontFamily: FONTS.body, fontSize: 30, fontWeight: 500, color: INK.muted }}>thebluestift.com</div>
      </div>
    </AbsoluteFill>
  );
}
