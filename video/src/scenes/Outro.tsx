import { AbsoluteFill, Img, staticFile } from "remotion";
import { Flock, type Bird } from "../Birds";
import { FONTS } from "../brand";
import { MARKS } from "../generated/marks";
import { BluestiftMark, BluestiftWordmark, RayaWheel } from "../Marks";
import { EASE, envelope, handheld, keys, mix, rand, span, useTime } from "../motion";
import { poseStyle, World } from "../Plate";
import { TEXTURES } from "../Texture";
import { DURATION, line, MUSIC, phrase, wordAt } from "../timeline";

/**
 * "So that was a quick look at Bluestift… how it all fits together."
 *
 * Back in the sky it opened in. Every screen of the film drifts in the air
 * and, on "fits together", settles into one mosaic. The address types itself
 * as it is said, Raya rolls in on "just ask Raya", the birds take off on
 * "jump aboard", and the Bluestift mark forms on "welcome to Bluestift" —
 * finished exactly on the final chord, with the light crossing it.
 */

const CELL = { w: 520, h: 330, gap: 26 };

const LOCK = "M5 7V5a3 3 0 0 1 6 0v2h.5A1.5 1.5 0 0 1 13 8.5v4A1.5 1.5 0 0 1 11.5 14h-7A1.5 1.5 0 0 1 3 12.5v-4A1.5 1.5 0 0 1 4.5 7H5Zm1.5 0h3V5a1.5 1.5 0 0 0-3 0v2Z";

export function Outro() {
  const t = useTime();
  // Just before the sub-processors page has gone, never over it.
  const from = line("outro-0").start - 1.7;
  if (t < from) return null;

  const together = wordAt("outro-2", "together");
  const learn = line("outro-3").start;
  const visit = phrase("outro-3", 1).start;
  const askRaya = phrase("outro-3", 2).start;
  const rayaWord = wordAt("outro-3", "Raya");
  const aboard = line("outro-4").start;
  const welcome = phrase("outro-4", 2).start;

  /* ── the mosaic ── */
  const gather = span(t, together - 1.9, together + 0.15, EASE.move);
  const mosaicOut = span(t, learn - 0.5, learn + 1.6, EASE.move);
  const mosaicIn = span(t, from, from + 2.2, EASE.soft);
  const sweep = span(t, together + 0.05, together + 1.1, EASE.soft);

  const tiles = TEXTURES.map((spec, i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const gx = (col - 1) * (CELL.w + CELL.gap);
    const gy = (row - 1) * (CELL.h + CELL.gap);
    const r = (k: number) => rand(i, k);
    const sx = (r(1) - 0.5) * 1900;
    const sy = (r(2) - 0.5) * 1100 + 260 - (t - from) * 22;
    const float = Math.sin(t * 0.6 + i) * 10 * (1 - gather);
    return {
      spec,
      pose: {
        x: mix(sx, gx, gather),
        y: mix(sy, gy, gather) + float,
        z: mix(-300 - r(3) * 500, 0, gather),
        ry: mix((r(4) - 0.5) * 50, 0, gather),
        rz: mix((r(5) - 0.5) * 10, 0, gather),
        s: 1,
        // All the way out: it used to rest at a fifth and then vanish in one frame.
        o: mosaicIn * (1 - mosaicOut),
        focus: mix(0.45, 1, gather) * (1 - mosaicOut * 0.7),
      },
    };
  });

  /* ── the address, and Raya ── */
  // With the address, not before it: an empty bar waiting to be typed into is
  // a second of nothing.
  const pill = envelope(t, visit - 0.5, visit - 0.1, aboard - 0.2, aboard + 0.5);
  const address = "thebluestift.com";
  const typed = address.slice(0, Math.round(address.length * span(t, visit, visit + 1.0, EASE.linear)));
  const rollFrom = -260;
  const roll = (at: number) => keys(at, [[askRaya - 0.2, rollFrom], [rayaWord + 0.35, 960]], EASE.arrive);
  const wheelX = roll(t);
  const wheelSpeed = (roll(t + 1 / 60) - wheelX) * 60;
  const wheel = envelope(t, askRaya - 0.25, askRaya, aboard, aboard + 0.6);

  /* ── the take-off ── */
  const takeOff: Bird[] = Array.from({ length: 11 }, (_, i) => {
    const r = (k: number) => rand(i + 40, k);
    const depth = 0.3 + r(1) * 0.7;
    const left = i % 2 === 0;
    return {
      from: aboard + 0.05 + r(2) * 1.4,
      to: aboard + 3.6 + r(3) * 2.4,
      start: [860 + r(4) * 200, 1120],
      end: [left ? -200 - r(5) * 300 : 2120 + r(5) * 300, -120 - r(6) * 300],
      size: 26 + depth * 36,
      amp: 8 + r(7) * 12,
      period: 1.1 + r(8),
      arc: 120 + r(9) * 160,
      depth,
      seed: i + 40,
    };
  });

  /* ── the mark ── */
  const markIn = span(t, welcome - 0.2, MUSIC.final, EASE.arrive);
  const nameIn = span(t, welcome + 0.3, MUSIC.final + 0.1, EASE.move);
  const shine = span(t, MUSIC.final - 0.05, MUSIC.final + 1.1, EASE.soft);
  const fadeOut = span(t, DURATION - 1.8, DURATION - 0.05, EASE.soft);

  const drift = handheld(t);
  const camera = {
    x: drift.x,
    y: drift.y + keys(t, [[from, 180], [together, 0]]),
    zoom: keys(t, [[from, 0.72], [together + 0.2, 0.86], [learn + 1, 0.8]]),
    roll: drift.r,
  };

  return (
    <AbsoluteFill>
      {mosaicOut < 1 && (
        <World camera={camera} perspective={2200}>
          {tiles.map(({ spec, pose }) => (
            <div key={spec.name} style={{ ...poseStyle(pose), width: CELL.w, height: CELL.h, borderRadius: 16, overflow: "hidden", boxShadow: spec.dark ? "0 18px 50px rgba(0,0,0,0.35)" : "0 18px 50px rgba(15,23,42,0.16)" }}>
              <Img src={staticFile(`textures/${spec.name}.png`)} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top left", display: "block" }} />
              {sweep > 0 && sweep < 1 && (
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    background: `linear-gradient(110deg, transparent ${(sweep * 260 - 120).toFixed(1)}%, rgba(255,255,255,0.55) ${(sweep * 260 - 100).toFixed(1)}%, transparent ${(sweep * 260 - 80).toFixed(1)}%)`,
                  }}
                />
              )}
            </div>
          ))}
        </World>
      )}

      {pill > 0.001 && (
        <div
          style={{
            position: "absolute",
            left: 960 - 420,
            top: 380,
            width: 840,
            height: 104,
            borderRadius: 999,
            background: "rgba(255,255,255,0.92)",
            border: "1px solid rgba(15,23,42,0.08)",
            boxShadow: "0 1px 2px rgba(15,23,42,0.06), 0 24px 60px rgba(15,23,42,0.14)",
            display: "flex",
            alignItems: "center",
            gap: 20,
            padding: "0 44px",
            boxSizing: "border-box",
            opacity: pill,
            transform: `translateY(${((1 - pill) * 20).toFixed(1)}px) scale(${0.96 + 0.04 * pill})`,
            fontFamily: FONTS.display,
            fontSize: 52,
            fontWeight: 600,
            color: "#0b1220",
            letterSpacing: "-0.01em",
          }}
        >
          <svg width="34" height="34" viewBox="0 0 16 16" style={{ flex: "none", opacity: 0.55 }}>
            <path d={LOCK} fill="#0b1220" />
          </svg>
          <span>{typed}</span>
          {typed.length < address.length && t > visit - 0.3 && <span style={{ width: 3, height: 54, background: "#0b1220", opacity: Math.round(t * 3) % 2 ? 1 : 0.2 }} />}
        </div>
      )}
      {wheel > 0.001 && (
        <AbsoluteFill style={{ opacity: wheel }}>
          <RayaWheel x={wheelX} x0={rollFrom} groundY={690} size={170} speed={wheelSpeed} />
        </AbsoluteFill>
      )}

      <Flock birds={takeOff} color="#2f7fe0" farColor="#7aa7e3" />

      {markIn > 0.001 && (
        <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", transform: `scale(${keys(t, [[MUSIC.final, 1], [DURATION, 1.04]], EASE.linear)})` }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 26, marginTop: -40 }}>
            <div style={{ position: "relative", width: 240, height: 240, opacity: markIn, transform: `scale(${0.82 + 0.18 * markIn}) translateY(${((1 - markIn) * 30).toFixed(1)}px)`, filter: markIn < 0.97 ? `blur(${((1 - markIn) * 12).toFixed(2)}px)` : undefined }}>
              <BluestiftMark size={240} />
              {shine > 0 && shine < 1 && (
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    background: `linear-gradient(115deg, transparent ${(shine * 240 - 110).toFixed(1)}%, rgba(255,255,255,0.9) ${(shine * 240 - 90).toFixed(1)}%, transparent ${(shine * 240 - 70).toFixed(1)}%)`,
                    WebkitMaskImage: `url(${MARKS["icon-512.png"]})`,
                    WebkitMaskSize: "100% 100%",
                    maskImage: `url(${MARKS["icon-512.png"]})`,
                    maskSize: "100% 100%",
                  }}
                />
              )}
            </div>
            <div style={{ clipPath: `inset(-20% ${((1 - nameIn) * 100).toFixed(2)}% -20% 0)` }}>
              <BluestiftWordmark size={140} />
            </div>
          </div>
        </AbsoluteFill>
      )}

      {fadeOut > 0.001 && <AbsoluteFill style={{ background: "#f7faff", opacity: fadeOut }} />}
    </AbsoluteFill>
  );
}
