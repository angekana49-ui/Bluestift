import { AbsoluteFill } from "remotion";
import { EASE, envelope, mix, rand, span, useTime } from "../motion";
import { line, MUSIC, phrase, wordAt } from "../timeline";
import { At, Burst, Draw, Field, Glow, Motes, PAL, Pulse, RayaMark, Reveal, Spoken, Svg, tilt, Title, TYPE } from "./kit";

/**
 * The Kernel, at night, in neon.
 *
 * Three layers stacked like floors — Raya, Schools, and under them the one
 * that lights up: the Kernel. Four instruments for what it measures, each on
 * its own word. On the music's breakdown they fold into a single point that
 * bursts into a concept graph; a radar sweep finds the node; generic advice
 * blows away; a physics mistake is traced back along its edge to the gap in
 * maths it came from; the graph grows; and the grades fall away from a
 * student who stays.
 */

const CYAN = PAL.cyan;
const VIOLET = PAL.violet;

// The concept graph: a fixed constellation, deterministic.
const NODES = Array.from({ length: 16 }, (_, k) => {
  const a = k * 2.399963; // golden angle: an even, organic spread
  const r = 120 + Math.sqrt(k + 1) * 105;
  return { x: 960 + Math.cos(a) * r * 1.5, y: 520 + Math.sin(a) * r * 0.85 };
});
const EDGES: [number, number][] = NODES.flatMap((_, k) => (k === 0 ? [] : [[k, Math.floor(rand(k, 41) * k)] as [number, number]]));
const FOUND = 9;

export function FilmKernel() {
  const t = useTime();
  const from = line("kernel-0").start - 0.45;
  if (t < from || t > MUSIC.full + 0.9) return null;

  const layer = phrase("kernel-0", 0).start;
  const oneLayer = wordAt("kernel-0", "layer");
  const theKernel = phrase("kernel-0", 2).start;
  const attempt = line("kernel-1").start;
  const know = phrase("kernel-1", 1).start;
  const fast = phrase("kernel-1", 2).start;
  const sticks = phrase("kernel-1", 3).start;
  const mindset = phrase("kernel-1", 4).start;
  const drop = MUSIC.breakdown;
  const guides = line("kernel-2").start;
  const found = wordAt("kernel-2", "found");
  const generic = line("kernel-3").start;
  const guess = phrase("kernel-3", 1).start;
  const physics = wordAt("kernel-4", "physics");
  const comes = wordAt("kernel-4", "comes");
  const maths = wordAt("kernel-4", "maths");
  const grows = line("kernel-5").start;
  const growsWord = wordAt("kernel-5", "grows");
  const assumes = line("kernel-6").start;
  const student = wordAt("kernel-6", "student");
  const grade = wordAt("kernel-6", "grade");

  const inBeat = (a: number, b: number) => t >= a && t < b;

  return (
    <Reveal t={t} at={from} dur={0.9} x={50} y={50}>
      <Field from="#03060f" to="#0a1030" angle={180} light="rgba(139,92,246,0.25)" lightAt={[50, 100]} />
      <Motes t={t} count={90} seed={7} color="#9fe8ff" opacity={0.5} size={2.4} speed={10} />

      {/* ── three floors; the Kernel lights ── */}
      {inBeat(from, attempt + 0.4) && <Layers t={t} layer={layer} oneLayer={oneLayer} theKernel={theKernel} leave={attempt - 0.1} />}

      {/* ── what it measures ── */}
      {inBeat(attempt - 0.2, drop + 0.6) && <Instruments t={t} attempt={attempt} know={know} fast={fast} sticks={sticks} mindset={mindset} drop={drop} />}

      {/* ── the graph: found, not guessed; physics back to maths; it grows ── */}
      {inBeat(drop - 0.05, assumes + 0.4) && (
        <Graph t={t} drop={drop} guides={guides} found={found} generic={generic} guess={guess} physics={physics} comes={comes} maths={maths} grows={grows} growsWord={growsWord} leave={assumes - 0.1} />
      )}

      {/* ── the grades fall away ── */}
      {t >= assumes - 0.2 && <Grades t={t} assumes={assumes} student={student} grade={grade} />}

      <At x={960} y={990}>
        {inBeat(attempt - 0.2, guides) && <Spoken id="kernel-1" t={t} phrases={[0]} size={64} color="#fff" accent={["attempt"]} accentColor={CYAN} out={fastOf(t)} maxWidth={1820} />}
        {inBeat(guides - 0.2, generic) && <Spoken id="kernel-2" t={t} size={56} color="#fff" accent={["found"]} accentColor={CYAN} out={generic - 0.3} maxWidth={1820} />}
        {inBeat(physics - 0.6, grows) && <Spoken id="kernel-4" t={t} size={60} color="#fff" accent={["physics", "maths"]} accentColor={PAL.amber} out={grows - 0.3} maxWidth={1820} />}
        {inBeat(grows - 0.2, assumes) && <Spoken id="kernel-5" t={t} size={60} color="#fff" accent={["grows"]} accentColor={CYAN} out={assumes - 0.3} maxWidth={1820} />}
      </At>
    </Reveal>
  );
}

/* ───────────────────────────── the layers ───────────────────────────── */

function Layers({ t, layer, oneLayer, theKernel, leave }: { t: number; layer: number; oneLayer: number; theKernel: number; leave: number }) {
  const out = span(t, leave, leave + 0.4, EASE.leave);
  const dive = span(t, theKernel - 0.1, leave + 0.3, EASE.move);
  const floors = [
    { label: "RAYA", color: PAL.blue, y: -230 },
    { label: "SCHOOLS", color: PAL.amber, y: -40 },
    { label: "KERNEL", color: CYAN, y: 150 },
  ];
  const lit = span(t, oneLayer - 0.2, oneLayer + 0.3, EASE.arrive);
  return (
    <AbsoluteFill style={{ opacity: 1 - out }}>
      <AbsoluteFill style={{ transform: `scale(${mix(1, 2.2, dive).toFixed(3)}) translateY(${(-dive * 150).toFixed(1)}px)`, transformOrigin: "50% 66%" }}>
        {floors.map((f, k) => {
          const p = span(t, layer - 0.4 + k * 0.15, layer + 0.3 + k * 0.15, EASE.arrive);
          const isKernel = k === 2;
          const dim = isKernel ? 1 : 1 - lit * 0.6 - dive;
          return (
            <At key={f.label} x={960} y={540 + f.y} style={{ ...tilt({ rx: 62, rz: -30, s: mix(0.7, 1, p), o: p * Math.max(0, dim) }) }}>
              <div style={{ width: 900, height: 900, borderRadius: 40, background: isKernel ? `radial-gradient(circle, rgba(56,225,255,${(0.18 + 0.3 * lit).toFixed(2)}), rgba(56,225,255,0.04))` : `${f.color}22`, border: `3px solid ${f.color}`, boxShadow: isKernel ? `0 0 ${(40 + 120 * lit).toFixed(0)}px rgba(56,225,255,${(0.3 + 0.5 * lit).toFixed(2)}), inset 0 0 80px rgba(56,225,255,0.25)` : `0 0 40px ${f.color}55`, backgroundImage: isKernel ? "linear-gradient(rgba(56,225,255,0.25) 2px, transparent 2px), linear-gradient(90deg, rgba(56,225,255,0.25) 2px, transparent 2px)" : undefined, backgroundSize: isKernel ? "60px 60px" : undefined }}>
                <div style={{ ...TYPE.mono(64, f.color, 800), padding: 40 }}>{f.label}</div>
              </div>
            </At>
          );
        })}
      </AbsoluteFill>
      <At x={960} y={160}>
        <Spoken id="kernel-0" t={t} phrases={[0, 1]} size={70} color="#fff" accent={["one"]} accentColor={CYAN} out={theKernel - 0.15} maxWidth={1700} />
      </At>
      <At x={960} y={540} style={{ opacity: span(t, theKernel - 0.05, theKernel + 0.3) }}>
        <div style={{ ...TYPE.mono(220, "#ffffff", 800), letterSpacing: "0.12em", textShadow: `0 0 30px ${CYAN}, 0 0 80px ${CYAN}`, transform: `translateX(${(Math.sin(t * 90) * 6 * (1 - span(t, theKernel, theKernel + 0.4))).toFixed(1)}px)` }}>KERNEL</div>
      </At>
    </AbsoluteFill>
  );
}

/* ───────────────────────────── four instruments ───────────────────────────── */

function Panel({ x, y, p, title, letter, color, children }: { x: number; y: number; p: number; title: string; letter: string; color: string; children: React.ReactNode }) {
  return (
    <div style={{ position: "absolute", left: x, top: y, width: 760, height: 330, ...tilt({ s: mix(0.85, 1, p), o: p, y: (1 - p) * 30 }) }}>
      <div style={{ width: "100%", height: "100%", borderRadius: 26, background: "rgba(10,18,48,0.75)", border: `2px solid ${color}66`, boxShadow: `0 0 40px ${color}33, inset 0 0 50px ${color}11`, padding: "24px 30px", boxSizing: "border-box", position: "relative" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <span style={{ ...TYPE.mono(40, color, 800), width: 58, height: 58, borderRadius: 14, border: `2px solid ${color}`, display: "flex", alignItems: "center", justifyContent: "center" }}>{letter}</span>
          <span style={TYPE.display(36, 600, "#fff")}>{title}</span>
        </div>
        {children}
      </div>
    </div>
  );
}

function Instruments({ t, attempt, know, fast, sticks, mindset, drop }: { t: number; attempt: number; know: number; fast: number; sticks: number; mindset: number; drop: number }) {
  const fold = span(t, drop - 0.25, drop + 0.15, EASE.leave);
  const pK = span(t, know - 0.15, know + 0.35, EASE.arrive);
  const pV = span(t, fast - 0.15, fast + 0.35, EASE.arrive);
  const pR = span(t, sticks - 0.15, sticks + 0.35, EASE.arrive);
  const pM = span(t, mindset - 0.15, mindset + 0.35, EASE.arrive);
  const needle = mix(-120, 40, span(t, fast + 0.1, fast + 1.0, EASE.arrive)) + Math.sin(t * 7) * 2;
  return (
    <AbsoluteFill style={{ transform: `scale(${mix(1, 0.05, fold).toFixed(3)})`, opacity: 1 - span(t, drop - 0.05, drop + 0.15) }}>
      {/* attempts streaming in */}
      <Svg>
        {Array.from({ length: 14 }, (_, k) => {
          const at = attempt + k * 0.07;
          const p = span(t, at, at + 0.6, EASE.move);
          if (p <= 0 || p >= 1) return null;
          const a = rand(k, 51) * Math.PI * 2;
          return <circle key={k} cx={960 + Math.cos(a) * 900 * (1 - p)} cy={520 + Math.sin(a) * 600 * (1 - p)} r={7} fill={CYAN} opacity={1 - p * 0.5} />;
        })}
        <Pulse t={t} at={attempt + 0.6} x={960} y={520} color={CYAN} r0={20} r1={300} />
      </Svg>
      <Panel x={170} y={120} p={pK} title="What you know" letter="K" color={CYAN}>
        <svg width={700} height={190} style={{ marginTop: 20 }}>
          {[0.62, 0.8, 0.45, 0.91, 0.7, 0.86, 0.55].map((v, k) => {
            const h = 160 * v * span(t, know + k * 0.06, know + 0.6 + k * 0.06, EASE.arrive);
            return <rect key={k} x={10 + k * 96} y={180 - h} width={64} height={h} rx={10} fill={CYAN} opacity={0.35 + 0.65 * v} />;
          })}
        </svg>
      </Panel>
      <Panel x={990} y={120} p={pV} title="How fast you're moving" letter="V" color={PAL.mint}>
        <svg width={700} height={200} viewBox="0 0 700 200" style={{ marginTop: 10 }}>
          <path d="M200 190 A 150 150 0 0 1 500 190" fill="none" stroke="rgba(52,211,153,0.25)" strokeWidth={22} strokeLinecap="round" />
          <path d="M200 190 A 150 150 0 0 1 500 190" fill="none" stroke={PAL.mint} strokeWidth={22} strokeLinecap="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - span(t, fast + 0.1, fast + 1.0, EASE.arrive) * 0.82} />
          <line x1={350} y1={190} x2={350 + Math.sin((needle * Math.PI) / 180) * 130} y2={190 - Math.cos((needle * Math.PI) / 180) * 130} stroke="#fff" strokeWidth={6} strokeLinecap="round" />
          <circle cx={350} cy={190} r={12} fill="#fff" />
        </svg>
      </Panel>
      <Panel x={170} y={500} p={pR} title="What really sticks" letter="R" color={VIOLET}>
        <svg width={700} height={190} style={{ marginTop: 20 }}>
          <Draw d="M10 30 C 90 120, 140 150, 200 160 L 210 40 C 290 110, 340 130, 400 135 L 410 40 C 490 85, 560 100, 690 105" p={span(t, sticks, sticks + 1.1)} stroke={VIOLET} width={6} glow={VIOLET} />
        </svg>
      </Panel>
      <Panel x={990} y={500} p={pM} title="Your mindset" letter="M" color={PAL.amber}>
        <svg width={700} height={190} style={{ marginTop: 20 }}>
          <Draw
            d={Array.from({ length: 70 }, (_, k) => `${k ? "L" : "M"}${10 + k * 10} ${100 - Math.sin(k * 0.35 + t * 4) * 50 * Math.min(1, k / 20) * (0.6 + 0.4 * Math.sin(k * 0.11))}`).join(" ")}
            p={span(t, mindset, mindset + 0.7)}
            stroke={PAL.amber}
            width={5}
            glow={PAL.amber}
          />
        </svg>
      </Panel>
    </AbsoluteFill>
  );
}

/* ───────────────────────────── the graph ───────────────────────────── */

function Graph({ t, drop, guides, found, generic, guess, physics, comes, maths, grows, growsWord, leave }: { t: number; drop: number; guides: number; found: number; generic: number; guess: number; physics: number; comes: number; maths: number; grows: number; growsWord: number; leave: number }) {
  const out = span(t, leave, leave + 0.4, EASE.leave);
  const burst = span(t, drop, drop + 0.8, EASE.arrive);
  const sweep = span(t, guides + 0.2, found + 0.1, EASE.linear);
  const lock = span(t, found - 0.1, found + 0.3, EASE.arrive);
  const growth = span(t, grows, growsWord + 1.6, EASE.move);
  const zoom = mix(1, 0.72, growth);
  // Raya travelling to the node it was sent to.
  const path = [0, Math.floor(rand(FOUND, 41) * FOUND), FOUND];
  const travel = span(t, found + 0.2, generic - 0.1, EASE.move);
  const seg = Math.min(path.length - 2, Math.floor(travel * (path.length - 1)));
  const segP = travel * (path.length - 1) - seg;
  const rx = mix(NODES[path[seg]].x, NODES[path[seg + 1]].x, segP);
  const ry = mix(NODES[path[seg]].y, NODES[path[seg + 1]].y, segP);
  // Physics → maths, along one edge.
  const phys = { x: 1460, y: 330, label: "Physics · Acceleration" };
  const math = { x: 520, y: 690, label: "Maths · Derivatives" };
  const chain = envelope(t, physics - 0.3, physics, grows - 0.2, grows + 0.2, EASE.arrive);
  const trace = span(t, comes - 0.1, maths + 0.1, EASE.move);
  // Extra nodes the graph grows.
  const sprouts = Array.from({ length: 22 }, (_, k) => {
    const base = NODES[k % NODES.length];
    const a = rand(k, 61) * Math.PI * 2;
    const d = 140 + rand(k, 62) * 120;
    return { from: base, x: base.x + Math.cos(a) * d * 1.3, y: base.y + Math.sin(a) * d, at: growsWord - 0.3 + k * 0.06 };
  });
  return (
    <AbsoluteFill style={{ opacity: 1 - out }}>
      <AbsoluteFill style={{ transform: `scale(${(zoom * mix(0.2, 1, burst)).toFixed(3)})`, transformOrigin: "50% 48%" }}>
        <Svg>
          {/* radar sweep */}
          {sweep > 0 && sweep < 1 && (
            <g transform={`rotate(${sweep * 360} 960 520)`}>
              <path d="M960 520 L2100 520 A 1140 1140 0 0 0 1950 -50 Z" fill="url(#sweep)" opacity={0.55} />
            </g>
          )}
          <defs>
            <linearGradient id="sweep" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor={CYAN} stopOpacity="0" />
              <stop offset="1" stopColor={CYAN} stopOpacity="0.35" />
            </linearGradient>
          </defs>
          {EDGES.map(([a, b], k) => (
            <Draw key={k} d={`M${NODES[a].x} ${NODES[a].y} L${NODES[b].x} ${NODES[b].y}`} p={span(t, drop + 0.1 + k * 0.03, drop + 0.6 + k * 0.03)} stroke="rgba(56,225,255,0.35)" width={2.5} />
          ))}
          {sprouts.map((s, k) => (
            <g key={k}>
              <Draw d={`M${s.from.x} ${s.from.y} L${s.x} ${s.y}`} p={span(t, s.at, s.at + 0.4)} stroke="rgba(139,92,246,0.5)" width={2} />
              <circle cx={s.x} cy={s.y} r={10 * span(t, s.at + 0.3, s.at + 0.5, EASE.arrive)} fill={VIOLET} style={{ filter: `drop-shadow(0 0 10px ${VIOLET})` }} />
            </g>
          ))}
          {NODES.map((n, k) => {
            const p = span(t, drop + k * 0.03, drop + 0.4 + k * 0.03, EASE.arrive);
            const hot = k === FOUND && lock > 0;
            return <circle key={k} cx={n.x} cy={n.y} r={(hot ? 26 : 16) * p} fill={hot ? PAL.coral : "#0a1030"} stroke={hot ? PAL.coral : CYAN} strokeWidth={4} style={{ filter: `drop-shadow(0 0 ${hot ? 20 : 10}px ${hot ? PAL.coral : CYAN})` }} />;
          })}
          {lock > 0 && (
            <g transform={`translate(${NODES[FOUND].x} ${NODES[FOUND].y}) rotate(${mix(120, 0, lock)}) scale(${mix(2.5, 1, lock)})`} opacity={lock * (1 - span(t, generic - 0.2, generic + 0.2))}>
              <circle r={56} fill="none" stroke={PAL.coral} strokeWidth={4} />
              {[0, 90, 180, 270].map((a) => (
                <line key={a} x1={0} y1={-76} x2={0} y2={-44} stroke={PAL.coral} strokeWidth={5} strokeLinecap="round" transform={`rotate(${a})`} />
              ))}
            </g>
          )}
          <Burst t={t} at={drop} x={960} y={520} color={CYAN} rays={30} r0={20} r1={900} width={2} dur={0.9} salt={21} />
          <Pulse t={t} at={found} x={NODES[FOUND].x} y={NODES[FOUND].y} color={PAL.coral} r0={30} r1={260} width={4} />
        </Svg>
        {travel > 0 && travel < 1 && (
          <At x={rx} y={ry}>
            <div style={{ width: 84, height: 84, borderRadius: "50%", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 0 40px ${CYAN}` }}>
              <RayaMark size={64} turn={t * 90} />
            </div>
          </At>
        )}
      </AbsoluteFill>

      {/* generic advice and guesses, blown away */}
      {inRange(t, generic - 0.2, physics - 0.3) && (
        <AbsoluteFill>
          <AbsoluteFill style={{ background: "rgba(3,6,15,0.55)" }} />
          {["Study more!", "Try harder.", "Watch a video.", "Practise daily."].map((s, k) => {
            const p = span(t, generic - 0.1 + k * 0.1, generic + 0.25 + k * 0.1, EASE.arrive);
            const blow = span(t, guess - 0.2 + k * 0.05, guess + 0.4 + k * 0.05, EASE.leave);
            const x = 360 + k * 400;
            return (
              <div key={s} style={{ position: "absolute", left: x - 170, top: 330 + (k % 2) * 90, ...tilt({ rz: (k - 1.5) * 6 + blow * 40 * (k % 2 ? 1 : -1), o: p * (1 - blow), x: blow * (k - 1.5) * 300, y: -blow * 400 }) }}>
                <div style={{ width: 340, padding: "30px 26px", background: "#fff59d", borderRadius: 6, boxShadow: "0 18px 40px rgba(0,0,0,0.4)", ...TYPE.display(40, 700, "#3d3500"), textAlign: "center", position: "relative" }}>
                  {s}
                  <svg width={340} height={120} style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}>
                    <Draw d="M20 70 L320 50" p={span(t, generic + 0.5 + k * 0.08, generic + 0.7 + k * 0.08)} stroke={PAL.coral} width={8} />
                  </svg>
                </div>
              </div>
            );
          })}
          <At x={960} y={760} style={tilt({ o: envelope(t, guess - 0.1, guess + 0.2, physics - 0.6, physics - 0.3), rz: (t - guess) * 200 })}>
            <div style={{ ...TYPE.heavy(150, "#fff"), opacity: 0.85 }}>🎲</div>
          </At>
          <At x={960} y={180}>
            <Spoken id="kernel-3" t={t} size={88} color="#fff" accent={["guess"]} accentColor={PAL.coral} out={physics - 0.5} maxWidth={1800} />
          </At>
        </AbsoluteFill>
      )}

      {/* physics, traced back to maths */}
      {chain > 0 && (
        <AbsoluteFill style={{ opacity: chain }}>
          <AbsoluteFill style={{ background: "rgba(3,6,15,0.6)" }} />
          <Svg>
            <Draw d={`M${phys.x} ${phys.y} C 1200 380, 820 640, ${math.x} ${math.y}`} p={1} stroke="rgba(255,255,255,0.18)" width={4} />
            <Draw d={`M${phys.x} ${phys.y} C 1200 380, 820 640, ${math.x} ${math.y}`} p={trace} stroke={PAL.amber} width={7} glow={PAL.amber} />
            <Pulse t={t} at={maths} x={math.x} y={math.y} color={PAL.amber} r0={40} r1={320} width={5} />
          </Svg>
          <At x={phys.x} y={phys.y}>
            <div style={{ whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 18, padding: "20px 30px", borderRadius: 999, background: "rgba(255,107,91,0.15)", border: `3px solid ${PAL.coral}`, ...TYPE.display(38, 700, "#fff"), boxShadow: `0 0 40px ${PAL.coral}66` }}>
              <span style={{ color: PAL.coral }}>✗</span>
              {phys.label}
            </div>
          </At>
          <At x={math.x} y={math.y} style={tilt({ s: mix(1, 1.12, span(t, maths, maths + 0.3, EASE.arrive)) })}>
            <div style={{ whiteSpace: "nowrap", padding: "20px 30px", borderRadius: 999, background: trace > 0.95 ? PAL.amber : "rgba(255,181,71,0.15)", border: `3px solid ${PAL.amber}`, ...TYPE.display(38, 700, trace > 0.95 ? "#3d2600" : "#fff"), boxShadow: `0 0 ${trace > 0.95 ? 70 : 20}px ${PAL.amber}` }}>
              {math.label} — the real gap
            </div>
          </At>
        </AbsoluteFill>
      )}
      <Glow x={960} y={520} r={600} color="rgba(56,225,255,0.10)" opacity={growth} />
    </AbsoluteFill>
  );
}
const inRange = (t: number, a: number, b: number) => t >= a && t < b;
const fastOf = (_t: number) => phrase("kernel-1", 2).start - 0.2;

/* ───────────────────────────── the grades fall away ───────────────────────────── */

function Grades({ t, assumes, student, grade }: { t: number; assumes: number; student: number; grade: number }) {
  const p = span(t, assumes - 0.2, assumes + 0.4, EASE.arrive);
  const fall = span(t, grade - 0.1, grade + 1.4, EASE.leave);
  const you = span(t, student - 0.2, student + 0.5, EASE.arrive);
  const marks = ["A+", "B", "C−", "F", "17/20", "B+", "D", "62%"];
  return (
    <AbsoluteFill style={{ opacity: p }}>
      <AbsoluteFill style={{ background: "radial-gradient(circle at 50% 50%, rgba(56,225,255,0.12), transparent 60%)" }} />
      {marks.map((m, k) => {
        const a = (k / marks.length) * Math.PI * 2 + t * 0.3;
        const r = 380;
        const x = 960 + Math.cos(a) * r * 1.3;
        const y = 500 + Math.sin(a) * r * 0.6 + fall * (600 + k * 60);
        return (
          <At key={m} x={x} y={y} style={tilt({ o: span(t, assumes + k * 0.06, assumes + 0.3 + k * 0.06) * (1 - fall), rz: fall * (k % 2 ? 60 : -60) })}>
            <div style={{ ...TYPE.mono(76, "rgba(255,255,255,0.75)", 800), padding: "10px 24px", border: "3px solid rgba(255,255,255,0.35)", borderRadius: 18 }}>{m}</div>
          </At>
        );
      })}
      <Svg>
        <Pulse t={t} at={student} x={960} y={500} color={CYAN} r0={80} r1={460} width={4} />
        <Pulse t={t} at={grade + 0.3} x={960} y={500} color={PAL.white} r0={80} r1={520} width={3} dur={1.2} />
      </Svg>
      <At x={960} y={500} style={tilt({ s: mix(0.6, 1.1, you) })}>
        <div style={{ width: 220, height: 220, borderRadius: "50%", background: `radial-gradient(circle at 40% 35%, #ffffff, ${PAL.sky})`, boxShadow: `0 0 ${(60 + 80 * you).toFixed(0)}px ${CYAN}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <svg width="120" height="120" viewBox="0 0 24 24">
            <circle cx="12" cy="8" r="4" fill={PAL.deep} />
            <path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7" fill={PAL.deep} />
          </svg>
        </div>
      </At>
      <At x={960} y={170}>
        <Title t={t} at={assumes - 0.05} out={student - 0.6} style={TYPE.heavy(96, "#fff")}>It assumes nothing,</Title>
      </At>
      <At x={960} y={860}>
        <Spoken id="kernel-6" t={t} phrases={[1]} size={78} color="#fff" accent={["student", "matters"]} accentColor={CYAN} out={MUSIC.full - 0.3} maxWidth={1800} />
      </At>
    </AbsoluteFill>
  );
}
