import { AbsoluteFill, Img } from "remotion";
import { MARKS } from "./generated/marks";
import { keys, useTime } from "./motion";
import { MUSIC } from "./timeline";

/**
 * The one sky every scene sits in, from the first frame to the last — so a
 * change of scene never cuts the world behind it, only what is in front.
 *
 * Day is the landing's light theme, softened; night is its dark theme. The
 * film goes to night for the Kernel (the part of the product nobody sees)
 * and comes back to day when the people in it take control. Between, the
 * light only drifts: three out-of-focus sources, too slow to notice, fast
 * enough that the frame is never a still.
 */

/** How dark the sky is, 0 day → 1 night. */
export function nightAt(t: number) {
  return keys(t, [
    [0, 0],
    // Dusk under the dark shots of the Raya tour, day again for the Study Room.
    [49.6, 0],
    [50.8, 0.62],
    [56.8, 0.62],
    [58.0, 0],
    // Night for the Kernel, dawn for the people in control.
    [93.9, 0],
    [96.4, 1],
    [MUSIC.full - 1.6, 1],
    [MUSIC.full + 0.4, 0],
  ]);
}

/** How much of the painted cloud bank shows. Only at the two ends of the film. */
function cloudsAt(t: number) {
  return keys(t, [
    [0, 1],
    [6.4, 1],
    [9.5, 0],
    [158.2, 0],
    [161.5, 1],
  ]);
}

export function Sky() {
  const t = useTime();
  const night = nightAt(t);
  const clouds = cloudsAt(t);

  const light = (x: number, y: number, size: number, color: string, opacity: number) => (
    <div
      style={{
        position: "absolute",
        left: x - size / 2,
        top: y - size / 2,
        width: size,
        height: size,
        borderRadius: "50%",
        background: `radial-gradient(circle, ${color} 0%, transparent 68%)`,
        opacity,
      }}
    />
  );
  const drift = (speed: number, phase: number, amp: number) => Math.sin(t * speed + phase) * amp;

  return (
    <AbsoluteFill style={{ overflow: "hidden", background: "#eef4fd" }}>
      {/* Day. */}
      {/* A step bluer than it was: a white screen on a near-white sky had no
          edge, and the landing's own ground is bluer still. */}
      <AbsoluteFill style={{ background: "linear-gradient(178deg,#eaf2fe 0%,#d5e5fa 38%,#b7d2f4 72%,#96bdee 100%)" }} />
      {light(1500 + drift(0.05, 0, 60), 120 + drift(0.07, 1, 30), 1500, "rgba(255,244,228,0.85)", (1 - night) * 0.45)}
      {light(260 + drift(0.06, 2, 90), 900 + drift(0.05, 0.4, 40), 1300, "rgba(170,204,248,0.9)", (1 - night) * 0.6)}

      {/* The painted clouds of the landing's hero, low and out of focus. */}
      {clouds > 0.001 && (
        <Img
          src={MARKS["hero-clouds-wide.png"]}
          style={{
            position: "absolute",
            // The painting is mirrored down its middle; that seam is kept near
            // the left edge, where a symmetric cloud reads as a cloud.
            // (Now just past it: kept anywhere in frame, it still read as a mirror.)
            left: -2300 - t * 0.4,
            bottom: -330 + keys(t, [[0, -70], [9, 40], [158, 40], [175, -40]]),
            width: 4500,
            height: 1400,
            objectFit: "cover",
            objectPosition: "50% 85%",
            opacity: clouds * (1 - night) * 0.9,
            // The painting's own sky is a deeper, greener blue than this one:
            // only its clouds are kept, and they are cooled into the film's.
            maskImage: "linear-gradient(180deg, transparent 0%, transparent 34%, rgba(0,0,0,0.9) 62%, #000 100%)",
            WebkitMaskImage: "linear-gradient(180deg, transparent 0%, transparent 34%, rgba(0,0,0,0.9) 62%, #000 100%)",
            filter: "blur(2.5px) saturate(0.45) brightness(1.1) hue-rotate(8deg)",
          }}
        />
      )}

      {/* Night. */}
      {night > 0.001 && (
        <AbsoluteFill style={{ opacity: night }}>
          <AbsoluteFill style={{ background: "linear-gradient(180deg,#0b1122 0%,#0d1526 46%,#070b14 100%)" }} />
          {light(420 + drift(0.05, 1, 80), 260 + drift(0.06, 0, 40), 1400, "rgba(79,70,229,0.22)", 1)}
          {light(1480 + drift(0.04, 3, 70), 860 + drift(0.05, 2, 50), 1500, "rgba(52,211,153,0.12)", 1)}
          {light(960, 540 + drift(0.03, 1, 30), 1700, "rgba(47,127,224,0.14)", 1)}
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
}

/**
 * What the lens does: a soft vignette, a touch deeper at night, and nothing
 * else. Grain was tried and dropped — it is the one texture an encoder
 * spends the most bits on and the viewer gains the least from.
 */
export function Lens() {
  const t = useTime();
  const night = nightAt(t);
  return (
    <AbsoluteFill
      style={{
        pointerEvents: "none",
        background: `radial-gradient(ellipse 75% 70% at 50% 48%, transparent 55%, rgba(${night > 0.5 ? "0,0,0" : "15,23,42"},${0.1 + night * 0.22}) 100%)`,
      }}
    />
  );
}
