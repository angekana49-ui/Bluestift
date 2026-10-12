import type { ReactNode } from "react";
import { AbsoluteFill } from "remotion";
import { Flock, type Bird } from "../Birds";
import { BluestiftMark, BluestiftWordmark } from "../Marks";
import { DURATION, line, MUSIC, phrase, wordAt } from "../timeline";
import { EASE, mix, rand, span, useTime } from "../motion";
import { At, Burst, Field, Glow, Motes, PAL, Pulse, RayaMark, Reveal, Spoken, Svg, tilt, TryRayaPill, TYPE } from "./kit";

/**
 * "So that was a quick look at Bluestift… how it all fits together."
 *
 * A clear sky. One token from each part of the film circles the centre — the
 * two orbits, the people, the flower, a heatmap cell, a Kernel node, a key,
 * a switch — and on "together" they fall into the mark. The address types
 * itself, Raya rolls in on "just ask Raya" with the button to try it now,
 * the birds take off on "jump aboard", and the mark and its name settle on
 * the final chord with the light crossing them.
 */

function Token({ children, color }: { children: ReactNode; color: string }) {
  return (
    <div style={{ width: 120, height: 120, borderRadius: 32, background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 18px 40px ${color}44`, border: `3px solid ${color}` }}>
      {children}
    </div>
  );
}

const TOKENS: { color: string; art: ReactNode }[] = [
  {
    color: PAL.electric,
    art: (
      <svg width="80" height="80" viewBox="0 0 80 80">
        <ellipse cx="30" cy="40" rx="24" ry="10" fill="none" stroke={PAL.electric} strokeWidth="4" transform="rotate(-20 30 40)" />
        <ellipse cx="50" cy="40" rx="24" ry="10" fill="none" stroke={PAL.amber} strokeWidth="4" transform="rotate(20 50 40)" />
      </svg>
    ),
  },
  { color: "#6366f1", art: <div style={{ display: "flex", gap: 4 }}>{["#6366f1", "#16a34a", "#db2777"].map((c) => <span key={c} style={{ width: 24, height: 24, borderRadius: "50%", background: c }} />)}</div> },
  { color: PAL.blue, art: <RayaMark size={84} /> },
  { color: PAL.amber, art: <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 20px)", gap: 4 }}>{[PAL.mint, PAL.amber, PAL.coral, PAL.mint, PAL.mint, PAL.amber, PAL.coral, PAL.mint, PAL.amber].map((c, k) => <span key={k} style={{ width: 20, height: 20, borderRadius: 5, background: c }} />)}</div> },
  {
    color: PAL.cyan,
    art: (
      <svg width="80" height="80" viewBox="0 0 80 80">
        <path d="M15 60 L40 20 L65 55 M40 20 L40 50" stroke={PAL.cyan} strokeWidth="4" fill="none" />
        {[[15, 60], [40, 20], [65, 55], [40, 50]].map(([x, y]) => <circle key={`${x}${y}`} cx={x} cy={y} r="7" fill="#0a1030" stroke={PAL.cyan} strokeWidth="4" />)}
      </svg>
    ),
  },
  {
    color: PAL.amber,
    art: (
      <svg width="84" height="84" viewBox="0 0 84 84">
        <circle cx="26" cy="42" r="14" fill="none" stroke={PAL.amber} strokeWidth="6" />
        <path d="M40 42 L76 42 L76 52 M64 42 L64 50" stroke={PAL.amber} strokeWidth="6" fill="none" />
      </svg>
    ),
  },
  { color: "#10b981", art: <div style={{ width: 76, height: 42, borderRadius: 99, background: "#10b981", padding: 5, boxSizing: "border-box" }}><div style={{ width: 32, height: 32, borderRadius: "50%", background: "#fff", marginLeft: 34 }} /></div> },
];

export function FilmOutro() {
  const t = useTime();
  const from = line("outro-0").start - 1.6;
  if (t < from) return null;

  const look = line("outro-0").start;
  const thanks = line("outro-1").start;
  const hope = line("outro-2").start;
  const together = wordAt("outro-2", "together");
  const learn = line("outro-3").start;
  const visit = phrase("outro-3", 1).start;
  const askRaya = phrase("outro-3", 2).start;
  const rayaWord = wordAt("outro-3", "Raya");
  const aboard = line("outro-4").start;
  const welcome = phrase("outro-4", 2).start;

  /* ── the tokens, circling, then falling into the mark ── */
  const gather = span(t, together - 0.45, together + 0.15, EASE.move);
  const tokensOut = span(t, together + 0.1, together + 0.25);
  const markP = span(t, together - 0.05, together + 0.5, EASE.arrive);
  const markUp = span(t, learn - 0.3, learn + 0.5, EASE.move);

  /* ── the address, Raya, the button ── */
  const address = "thebluestift.com";
  const typed = address.slice(0, Math.round(address.length * span(t, visit, visit + 0.9, EASE.linear)));
  const pill = span(t, visit - 0.35, visit, EASE.arrive) * (1 - span(t, aboard + 0.2, aboard + 0.6));
  const raya = span(t, askRaya - 0.1, rayaWord + 0.4, EASE.arrive) * (1 - span(t, aboard + 0.2, aboard + 0.6));
  const tryP = span(t, askRaya + 0.1, askRaya + 0.5, EASE.arrive) * (1 - span(t, aboard + 0.2, aboard + 0.6));
  const tryPress = span(t, rayaWord + 0.15, rayaWord + 0.45, EASE.linear);

  /* ── the take-off and the final mark ── */
  const birds: Bird[] = Array.from({ length: 16 }, (_, i) => {
    const r = (k: number) => rand(i + 90, k);
    const depth = 0.3 + r(1) * 0.7;
    return {
      from: aboard + 0.05 + r(2) * 1.3,
      to: aboard + 3.4 + r(3) * 2.4,
      start: [700 + r(4) * 520, 1140],
      end: [i % 2 ? -260 - r(5) * 300 : 2180 + r(5) * 300, -160 - r(6) * 300],
      size: 28 + depth * 40,
      amp: 8 + r(7) * 12,
      period: 1.1 + r(8),
      arc: 120 + r(9) * 160,
      depth,
      seed: i + 90,
    };
  });
  const finalP = span(t, welcome - 0.2, MUSIC.final, EASE.arrive);
  const nameP = span(t, welcome + 0.25, MUSIC.final + 0.1, EASE.move);
  const shine = span(t, MUSIC.final - 0.05, MUSIC.final + 1.1, EASE.soft);
  const fade = span(t, DURATION - 1.6, DURATION - 0.05, EASE.soft);

  return (
    <Reveal t={t} at={from} dur={1.0} x={50} y={50}>
      <Field from="#f4faff" to="#a9d8ff" angle={180} light="rgba(255,255,255,0.95)" lightAt={[50, 35]} />
      <Motes t={t} count={50} seed={9} color="#ffffff" opacity={0.7} size={3.5} />

      {/* tokens circling the centre */}
      {tokensOut < 1 &&
        TOKENS.map((tok, k) => {
          const arrive = span(t, from + 0.35 + k * 0.2, from + 1.05 + k * 0.2, EASE.arrive);
          const a = (k / TOKENS.length) * Math.PI * 2 + t * 0.35;
          const r = mix(1, 0, gather);
          const x = 960 + Math.cos(a) * 560 * r;
          const y = 470 + Math.sin(a) * 300 * r;
          return (
            <At key={k} x={x} y={y} style={tilt({ o: arrive * (1 - tokensOut), s: mix(0.5, 1, arrive) * mix(1, 0.4, gather), rz: Math.sin(t + k) * 6 })}>
              <Token color={tok.color}>{tok.art}</Token>
            </At>
          );
        })}
      <Svg>
        <Burst t={t} at={together + 0.05} x={960} y={470} color={PAL.blue} rays={28} r0={120} r1={620} width={3} dur={0.9} salt={60} />
        <Pulse t={t} at={together + 0.1} x={960} y={470} color={PAL.blue} r0={100} r1={640} width={4} dur={1.1} />
      </Svg>

      {/* the mark the tokens became; it lifts for the address */}
      {markP > 0 && finalP < 0.6 && (
        <At x={960} y={mix(mix(470, 250, markUp), 400, span(t, aboard + 0.3, welcome, EASE.move))} style={tilt({ s: mix(0.5, 1, markP) * mix(1, 0.7, markUp) * mix(1, 1.25, span(t, aboard + 0.3, welcome, EASE.move)), o: markP * (1 - span(t, welcome - 0.15, welcome + 0.25)) })}>
          <div style={{ width: 240, height: 240, borderRadius: "50%", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 30px 90px rgba(47,127,224,0.35)" }}>
            <BluestiftMark size={170} />
          </div>
        </At>
      )}

      {/* the address */}
      {pill > 0 && (
        <At x={960} y={520} style={tilt({ o: pill, s: mix(0.92, 1, pill) })}>
          <div style={{ display: "flex", alignItems: "center", gap: 20, padding: "0 50px", height: 120, minWidth: 820, borderRadius: 999, background: "rgba(255,255,255,0.95)", boxShadow: "0 30px 70px rgba(15,23,42,0.16)", ...TYPE.display(60, 600, PAL.text), boxSizing: "border-box" }}>
            <svg width="38" height="38" viewBox="0 0 16 16" style={{ opacity: 0.5 }}>
              <path d="M5 7V5a3 3 0 0 1 6 0v2h.5A1.5 1.5 0 0 1 13 8.5v4A1.5 1.5 0 0 1 11.5 14h-7A1.5 1.5 0 0 1 3 12.5v-4A1.5 1.5 0 0 1 4.5 7H5Zm1.5 0h3V5a1.5 1.5 0 0 0-3 0v2Z" fill={PAL.text} />
            </svg>
            <span>{typed}</span>
            {typed.length < address.length && <span style={{ width: 4, height: 60, background: PAL.text, opacity: Math.round(t * 3) % 2 ? 1 : 0.2 }} />}
          </div>
        </At>
      )}
      {raya > 0 && (
        <At x={mix(-200, 960, raya)} y={700} style={tilt({ o: raya })}>
          <div style={{ width: 150, height: 150, borderRadius: "50%", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 20px 60px rgba(47,127,224,0.35)" }}>
            <RayaMark size={116} turn={mix(-540, 0, raya)} />
          </div>
        </At>
      )}
      {tryP > 0 && (
        <At x={960} y={860} style={tilt({ o: tryP, y: (1 - tryP) * 24 })}>
          <TryRayaPill pressed={tryPress} />
        </At>
      )}

      <Flock birds={birds} color="#2f7fe0" farColor="#7aa7e3" />

      {/* the final mark */}
      {finalP > 0 && (
        <At x={960} y={470} style={{ transform: `scale(${mix(1, 1.04, span(t, MUSIC.final, DURATION, EASE.linear)).toFixed(4)})` }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 30 }}>
            <div style={{ position: "relative", opacity: finalP, transform: `scale(${(0.8 + 0.2 * finalP).toFixed(3)})`, filter: finalP < 0.97 ? `blur(${((1 - finalP) * 14).toFixed(1)}px)` : undefined }}>
              <BluestiftMark size={260} />
              {shine > 0 && shine < 1 && (
                <div style={{ position: "absolute", inset: 0, background: `linear-gradient(115deg, transparent ${(shine * 240 - 110).toFixed(1)}%, rgba(255,255,255,0.95) ${(shine * 240 - 90).toFixed(1)}%, transparent ${(shine * 240 - 70).toFixed(1)}%)`, mixBlendMode: "screen" }} />
              )}
            </div>
            <div style={{ clipPath: `inset(-20% ${((1 - nameP) * 100).toFixed(2)}% -20% 0)` }}>
              <BluestiftWordmark size={150} />
            </div>
          </div>
        </At>
      )}
      <Glow x={960} y={470} r={520} color="rgba(255,255,255,0.6)" opacity={shine > 0 && shine < 1 ? Math.sin(shine * Math.PI) : 0} />

      {/* the words */}
      <At x={960} y={860}>
        <Spoken id="outro-0" t={t} size={84} accent={["quick"]} accentColor={PAL.blue} out={thanks - 0.25} maxWidth={1800} />
      </At>
      <At x={960} y={860}>
        <Spoken id="outro-1" t={t} size={96} accent={["Thank"]} accentColor={PAL.blue} out={hope - 0.25} />
      </At>
      <At x={960} y={860}>
        <Spoken id="outro-2" t={t} size={76} accent={["together"]} accentColor={PAL.blue} out={learn - 0.25} maxWidth={1800} />
      </At>
      <At x={960} y={985}>
        {t < aboard && <Spoken id="outro-3" t={t} phrases={[0]} size={52} accent={["more"]} accentColor={PAL.blue} out={visit - 0.2} />}
      </At>
      <At x={960} y={985}>
        <Spoken id="outro-4" t={t} phrases={[0, 1]} size={74} accent={["aboard", "enjoy"]} accentColor={PAL.blue} out={welcome - 0.2} />
      </At>
      <At x={960} y={890}>
        {t < MUSIC.final - 0.2 && <Spoken id="outro-4" t={t} phrases={[2]} size={70} accent={["welcome"]} accentColor={PAL.blue} out={MUSIC.final - 0.6} />}
      </At>

      {fade > 0 && <AbsoluteFill style={{ background: "#050913", opacity: fade }} />}
    </Reveal>
  );
}
