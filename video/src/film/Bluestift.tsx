import { AbsoluteFill } from "remotion";
import { BluestiftMark, BluestiftWordmark, RayaWordmark } from "../Marks";
import { EASE, keys, mix, rand, span, useTime } from "../motion";
import { line, MUSIC, phrase, wordAt } from "../timeline";
import { At, Burst, Camera, Draw, Field, PAL, Pulse, RayaMark, Reveal, Spoken, Svg } from "./kit";

/**
 * "Bluestift is a collaborative platform, built around Raya…"
 *
 * Daylight. People arrive around the mark and link to each other — the
 * collaborative part — and on "Raya" the centre becomes the wheel. Then four
 * hard cuts on four verbs, each with its own drawing: a bulb (learn), an X
 * that turns into an arrow up (fail), a summit (challenge), a map with one
 * node locked in a reticle (where they're stuck). The camera pulls back from
 * that one node to a whole class of them colouring into a picture, and lands
 * on "better", set as large as the frame allows.
 */

const PEOPLE = [
  { i: "AM", c: "#6366f1" }, { i: "LD", c: "#2f7fe0" }, { i: "TB", c: "#16a34a" }, { i: "NK", c: "#d97706" },
  { i: "JO", c: "#db2777" }, { i: "SY", c: "#0891b2" }, { i: "EM", c: "#7c3aed" }, { i: "KA", c: "#ea580c" },
  { i: "RB", c: "#0d9488" }, { i: "MR", c: "#e11d48" },
];

function Avatar({ i, c, size = 86 }: { i: string; c: string; size?: number }) {
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", background: c, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Inter", fontWeight: 800, fontSize: size * 0.34, boxShadow: `0 10px 30px ${c}55, inset 0 0 0 4px rgba(255,255,255,0.35)` }}>
      {i}
    </div>
  );
}

const ICON = {
  bulb: "M100 22 C58 22 36 54 36 86 C36 112 54 126 64 144 L64 160 L136 160 L136 144 C146 126 164 112 164 86 C164 54 142 22 100 22 Z M76 176 L124 176 M86 192 L114 192",
  x: "M52 52 L148 148 M148 52 L52 148",
  up: "M34 168 C92 164 128 124 150 50 M116 58 L152 46 L162 84",
  peak: "M14 176 L78 70 L108 116 L134 84 L188 176 Z",
  flag: "M78 70 L78 22 L114 34 L78 46",
};

export function FilmBluestift() {
  const t = useTime();
  const from = MUSIC.theme;
  if (t < from || t > MUSIC.groove + 0.8) return null;

  const start = line("bluestift-0").start;
  const rayaWord = wordAt("bluestift-0", "Raya");
  const ai = phrase("bluestift-0", 2).start;
  const learn = line("bluestift-1").start;
  const fail = phrase("bluestift-1", 1).start;
  const challenge = phrase("bluestift-1", 2).start;
  const stuck = phrase("bluestift-1", 3).start;
  const stuckWord = wordAt("bluestift-1", "stuck");
  const notAlone = line("bluestift-2").start;
  const whole = phrase("bluestift-2", 1).start;
  const easily = line("bluestift-3").start;
  const better = line("bluestift-4").start;
  const betterWord = wordAt("bluestift-4", "better");

  /* ── the network ── */
  const netOut = span(t, learn - 0.35, learn, EASE.leave);
  const wheelIn = span(t, rayaWord - 0.15, rayaWord + 0.55, EASE.arrive);
  const ring = PEOPLE.map((p, k) => {
    const a = (k / PEOPLE.length) * Math.PI * 2 - Math.PI / 2 + t * 0.05;
    const arrive = span(t, start - 0.2 + k * 0.08, start + 0.55 + k * 0.08, EASE.arrive);
    const r = mix(900, k % 2 ? 330 : 300, arrive);
    return { ...p, x: 960 + Math.cos(a) * r * 1.35, y: 470 + Math.sin(a) * r * 0.82, arrive };
  });
  const links = span(t, start + 0.6, start + 1.8, EASE.move);

  /* ── the four verbs ── */
  const beatOf = (a: number, b: number) => (t >= a - 0.02 && t < b - 0.02 ? 1 : 0);
  const punch = (a: number) => 1 + 0.06 * (1 - span(t, a, a + 0.35, EASE.arrive));
  const bg = t < fail - 0.02 ? PAL.ice : t < challenge - 0.02 ? "#fff1ee" : t < stuck - 0.02 ? "#eafaf3" : PAL.ice;

  /* ── one node among a class ── */
  const pull = span(t, notAlone - 0.1, notAlone + 1.2, EASE.move);
  const picture = span(t, whole, whole + 1.4, EASE.linear);
  const classOut = span(t, easily - 0.3, easily + 0.2, EASE.leave);

  /* ── better ── */
  const blue = span(t, easily - 0.3, easily + 0.3, EASE.move);

  return (
    <Reveal t={t} at={from} dur={0.75} x={50} y={52}>
      <Field from={PAL.white} to={PAL.ice} angle={180} light="rgba(159,214,255,0.55)" lightAt={[50, 40]} />

      {/* ── the network around the mark, then the wheel ── */}
      {netOut < 1 && t < learn + 0.1 && (
        <AbsoluteFill style={{ opacity: 1 - netOut, transform: `scale(${1 + netOut * 0.15})` }}>
          <Svg>
            {ring.map((p, k) => {
              const q = ring[(k + 3) % ring.length];
              return (
                <g key={p.i}>
                  <Draw d={`M${p.x} ${p.y} L960 470`} p={links * p.arrive} stroke="rgba(47,127,224,0.35)" width={2.5} />
                  <Draw d={`M${p.x} ${p.y} L${q.x} ${q.y}`} p={span(t, start + 1.2 + k * 0.05, start + 2.2 + k * 0.05)} stroke="rgba(47,127,224,0.18)" width={2} />
                </g>
              );
            })}
            <Pulse t={t} at={rayaWord} x={960} y={470} color={PAL.blue} r0={120} r1={420} width={4} />
            <Burst t={t} at={rayaWord - 0.05} x={960} y={470} color={PAL.blue} rays={18} r0={150} r1={380} salt={2} />
          </Svg>
          {ring.map((p) => (
            <At key={p.i} x={p.x} y={p.y} style={{ opacity: p.arrive, transform: `scale(${(0.6 + 0.4 * p.arrive).toFixed(3)})` }}>
              <Avatar i={p.i} c={p.c} />
            </At>
          ))}
          <At x={960} y={470}>
            <div style={{ position: "relative", width: 260, height: 260, borderRadius: "50%", background: "#fff", boxShadow: "0 30px 80px rgba(47,127,224,0.25)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div style={{ position: "absolute", opacity: 1 - wheelIn, transform: `scale(${1 - wheelIn * 0.3}) rotate(${wheelIn * -90}deg)` }}>
                <BluestiftMark size={170} />
              </div>
              {wheelIn > 0 && (
                <div style={{ position: "absolute", opacity: wheelIn, transform: `scale(${(0.7 + 0.3 * wheelIn).toFixed(3)})` }}>
                  <RayaMark size={200} turn={(t - rayaWord) * 50 - (1 - wheelIn) * 120} />
                </div>
              )}
            </div>
          </At>
          <At x={960} y={92} style={{ opacity: span(t, start - 0.1, start + 0.5) * (1 - span(t, rayaWord - 0.4, rayaWord - 0.1)) }}>
            <BluestiftWordmark size={84} />
          </At>
          <At x={960} y={92} style={{ opacity: span(t, rayaWord - 0.05, rayaWord + 0.4) }}>
            <RayaWordmark size={96} />
          </At>
          <At x={960} y={900}>
            <Spoken id="bluestift-0" t={t} phrases={[0]} size={82} accent={["collaborative"]} out={phrase("bluestift-0", 1).start - 0.32} />
          </At>
          <At x={960} y={900}>
            <Spoken id="bluestift-0" t={t} phrases={[1, 2]} size={74} accent={["learning"]} out={learn - 0.4} maxWidth={1500} />
          </At>
        </AbsoluteFill>
      )}

      {/* ── four verbs, four drawings, hard cuts ── */}
      {t >= learn - 0.02 && t < notAlone + 0.05 && (
        <AbsoluteFill style={{ background: bg }}>
          <Svg>
            {beatOf(learn, fail) > 0 && (
              <g transform={`translate(1180 230) scale(${(3.1 * punch(learn)).toFixed(3)})`}>
                <Draw d={ICON.bulb} p={span(t, learn, learn + 0.8)} stroke={PAL.amber} width={5} glow={PAL.amber} />
              </g>
            )}
            {beatOf(fail, challenge) > 0 && (
              <g transform={`translate(1180 230) scale(${(3.1 * punch(fail)).toFixed(3)}) translate(${(Math.sin(t * 60) * 4 * (1 - span(t, fail, fail + 0.4))).toFixed(1)} 0)`}>
                <Draw d={ICON.x} p={span(t, fail, fail + 0.25)} stroke={PAL.coral} width={7} opacity={1 - span(t, fail + 0.35, fail + 0.55)} />
                <Draw d={ICON.up} p={span(t, fail + 0.35, fail + 0.65)} stroke={PAL.mint} width={7} glow={PAL.mint} />
              </g>
            )}
            {beatOf(challenge, stuck) > 0 && (
              <g transform={`translate(1160 250) scale(${(3.1 * punch(challenge)).toFixed(3)})`}>
                <Draw d={ICON.peak} p={span(t, challenge, challenge + 0.6)} stroke={PAL.mint} width={5} fill="rgba(52,211,153,0.10)" />
                <Draw d={ICON.flag} p={span(t, challenge + 0.45, challenge + 0.85)} stroke={PAL.coral} width={5} />
              </g>
            )}
          </Svg>
          {beatOf(stuck, notAlone + 0.05) > 0 && <StuckMap t={t} at={stuck} lock={stuckWord} pull={pull} />}

          <div style={{ position: "absolute", left: 140, top: 380, width: 900 }}>
            {beatOf(learn, fail) > 0 && <Spoken id="bluestift-1" t={t} phrases={[0]} size={150} align="left" accent={["learn"]} accentColor={PAL.amber} />}
            {beatOf(fail, challenge) > 0 && <Spoken id="bluestift-1" t={t} phrases={[1]} size={190} align="left" accent={["fail"]} accentColor={PAL.coral} />}
            {beatOf(challenge, stuck) > 0 && <Spoken id="bluestift-1" t={t} phrases={[2]} size={130} align="left" accent={["themselves"]} accentColor="#0f9f6e" />}
          </div>
          {beatOf(stuck, notAlone) > 0 && (
            <div style={{ position: "absolute", left: 120, top: 760, width: 1700 }}>
              <Spoken id="bluestift-1" t={t} phrases={[3]} size={84} align="left" accent={["stuck"]} accentColor={PAL.coral} />
            </div>
          )}
        </AbsoluteFill>
      )}

      {/* ── a whole class: the picture ── */}
      {t >= notAlone - 0.1 && classOut < 1 && (
        <AbsoluteFill style={{ opacity: 1 - classOut }}>
          <ClassPicture t={t} pull={pull} picture={picture} />
          <At x={960} y={930}>
            <Spoken id="bluestift-2" t={t} size={72} accent={["whole"]} out={easily - 0.4} maxWidth={1750} />
          </At>
        </AbsoluteFill>
      )}

      {/* ── better ── */}
      {blue > 0 && (
        <AbsoluteFill style={{ opacity: blue }}>
          <Field from={PAL.deep} to={PAL.blue} angle={150} light="rgba(159,214,255,0.45)" lightAt={[70, 30]} />
          <Svg>
            <Burst t={t} at={betterWord - 0.05} x={960} y={600} color={PAL.sky} rays={28} r0={260} r1={900} width={3} dur={0.9} salt={5} />
            <Draw d="M1010 690 C1160 735 1420 735 1640 670" p={span(t, betterWord + 0.15, betterWord + 0.65)} stroke={PAL.amber} width={10} glow={PAL.amber} />
          </Svg>
          <At x={960} y={360}>
            <Spoken id="bluestift-3" t={t} size={92} color="rgba(255,255,255,0.92)" accent={["easily"]} accentColor={PAL.sky} out={better - 0.3} maxWidth={1700} />
          </At>
          <At x={960} y={560} style={{ transform: `scale(${keys(t, [[better, 0.92], [MUSIC.groove, 1.06]], EASE.linear).toFixed(4)})` }}>
            <Spoken id="bluestift-4" t={t} size={190} color={PAL.white} accent={["better"]} accentColor={PAL.amber} maxWidth={1840} />
          </At>
        </AbsoluteFill>
      )}
    </Reveal>
  );
}

/** Five concepts, one of them locked in a reticle — "exactly where they're stuck". */
const MAP = [
  { x: 1180, y: 300, label: "Fractions" },
  { x: 1480, y: 230, label: "Ratios" },
  { x: 1600, y: 470, label: "Equations" },
  { x: 1320, y: 560, label: "Functions" },
  { x: 1050, y: 520, label: "Graphs" },
];
function StuckMap({ t, at, lock, pull }: { t: number; at: number; lock: number; pull: number }) {
  const target = MAP[3];
  const lockP = span(t, lock - 0.3, lock + 0.25, EASE.arrive);
  return (
    <AbsoluteFill style={{ opacity: 1 - pull }}>
      <Svg>
        {[[0, 1], [1, 2], [2, 3], [3, 4], [4, 0], [0, 3]].map(([a, b], k) => (
          <Draw key={k} d={`M${MAP[a].x} ${MAP[a].y} L${MAP[b].x} ${MAP[b].y}`} p={span(t, at + k * 0.06, at + 0.5 + k * 0.06)} stroke="rgba(47,127,224,0.4)" width={3} />
        ))}
        {MAP.map((n, k) => {
          const p = span(t, at + k * 0.07, at + 0.4 + k * 0.07, EASE.arrive);
          const hot = n === target;
          return (
            <g key={n.label} opacity={p}>
              <circle cx={n.x} cy={n.y} r={hot ? 30 : 22} fill={hot ? PAL.coral : "#fff"} stroke={hot ? PAL.coral : PAL.blue} strokeWidth={4} />
              <text x={n.x} y={n.y + 62} textAnchor="middle" style={{ fontFamily: "Space Grotesk", fontWeight: 600, fontSize: 28, fill: hot ? PAL.coral : "#44546a" }}>{n.label}</text>
            </g>
          );
        })}
        {lockP > 0 && (
          <g transform={`translate(${target.x} ${target.y}) rotate(${mix(90, 0, lockP)}) scale(${mix(2.4, 1, lockP)})`} opacity={lockP}>
            <circle r={58} fill="none" stroke={PAL.coral} strokeWidth={4} />
            {[0, 90, 180, 270].map((a) => (
              <line key={a} x1={0} y1={-78} x2={0} y2={-48} stroke={PAL.coral} strokeWidth={5} strokeLinecap="round" transform={`rotate(${a})`} />
            ))}
          </g>
        )}
      </Svg>
    </AbsoluteFill>
  );
}

/** The one node becomes one of a class; the class colours into a picture. */
function ClassPicture({ pull, picture }: { t: number; pull: number; picture: number }) {
  const cols = 22;
  const rows = 9;
  const z = mix(6, 1, pull);
  // The picture the class makes: a soft gradient of mastery, warm where help is needed.
  const heat = (c: number, r: number) => 0.5 + 0.5 * Math.sin(c * 0.45 + r * 0.6) * Math.cos(c * 0.15 - r * 0.3);
  return (
    <AbsoluteFill style={{ background: PAL.ice }}>
      <Camera zoom={z} x={(1320 - 960) * (1 - pull)} y={(560 - 470) * (1 - pull)}>
        <Svg>
          {Array.from({ length: cols * rows }, (_, k) => {
            const c = k % cols;
            const r = Math.floor(k / cols);
            const x = 960 + (c - (cols - 1) / 2) * 70;
            const y = 470 + (r - (rows - 1) / 2) * 70;
            const order = rand(k, 3);
            const lit = span(picture, order * 0.7, order * 0.7 + 0.3);
            const h = heat(c, r);
            const color = h > 0.62 ? PAL.mint : h > 0.38 ? PAL.amber : PAL.coral;
            const isOne = c === 15 && r === 5;
            return (
              <g key={k}>
                <circle cx={x} cy={y} r={isOne ? 26 : 22} fill={lit > 0 ? color : "#fff"} fillOpacity={lit > 0 ? 0.35 + 0.65 * lit : 1} stroke={isOne ? PAL.coral : "rgba(47,127,224,0.35)"} strokeWidth={isOne ? 4 : 2.5} />
              </g>
            );
          })}
        </Svg>
      </Camera>
      {picture > 0.05 && (
        <svg width={1920} height={1080} style={{ position: "absolute", inset: 0 }}>
          <Draw d="M180 880 L180 120 L960 40 L1740 120 L1740 880" p={span(picture, 0.2, 0.9)} stroke={PAL.deep} width={4} opacity={0.5} />
        </svg>
      )}
    </AbsoluteFill>
  );
}
