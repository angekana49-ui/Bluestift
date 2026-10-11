import { AbsoluteFill } from "remotion";
import { Flock, type Bird } from "../Birds";
import { BluestiftMark } from "../Marks";
import { EASE, envelope, mix, rand, span, useTime } from "../motion";
import { line, MUSIC, phrase, wordAt } from "../timeline";
import { At, Burst, Card, Draw, Field, Glow, PAL, Pulse, RayaMark, Reveal, Spoken, Svg, tilt, Title, TYPE } from "./kit";

/**
 * Bluestift Schools, in warm light.
 *
 * One student, then the people around them; the school drawn behind them on
 * "has your back". The lockup, then the teacher's view: students against
 * concepts, lit column by column — "concept by concept". "Never your
 * conversations": three bubbles frost over and a lock comes down on them.
 * The teacher and Raya talk both ways — instructions out, a question about
 * the class, an answer back. Homework goes out to a class, the view widens
 * to the whole school, a summary writes itself. And the students — dots all
 * along — lift off as birds on "the students who count on them".
 */

const ROSTER = ["Maya R.", "Noah K.", "Léa D.", "Tomás B.", "Amira S."];
const CONCEPTS = ["Units", "Speed", "Acceleration", "Forces", "Energy", "Graphs"];
// Mastery per student per concept: who is stuck, and on what.
const GRID = ROSTER.map((_, r) => CONCEPTS.map((_, c) => 0.25 + 0.75 * rand(r * 7 + c, 17)));
const heat = (v: number) => (v > 0.68 ? PAL.mint : v > 0.45 ? PAL.amber : PAL.coral);

export function FilmSchools() {
  const t = useTime();
  const from = MUSIC.warm;
  const to = line("kernel-0").start;
  if (t < from || t > to + 0.6) return null;

  const learn = line("schools-0").start;
  const notAlone = phrase("schools-0", 1).start;
  const back = line("schools-1").start;
  const backWord = wordAt("schools-1", "back");
  const lockup = line("schools-2").start;
  const see = phrase("schools-2", 1).start;
  const stuck = wordAt("schools-2", "stuck");
  const concept = phrase("schools-2", 2).start;
  const never = line("schools-3").start;
  const tell = line("schools-4").start;
  const askClass = phrase("schools-4", 1).start;
  const forClass = line("schools-5").start;
  const wholeSchool = phrase("schools-5", 1).start;
  const summary = phrase("schools-5", 2).start;
  const matters = line("schools-6").start;
  const counts = phrase("schools-6", 1).start;

  const inBeat = (a: number, b: number) => t >= a && t < b;

  return (
    <Reveal t={t} at={from} dur={0.8} x={50} y={50}>
      <Field from="#fff8ee" to="#ffe4c2" angle={170} light="rgba(255,255,255,0.9)" lightAt={[50, 30]} />

      {/* ── never on your own; the school behind ── */}
      {inBeat(from, lockup + 0.4) && <NotAlone t={t} learn={learn} notAlone={notAlone} back={back} backWord={backWord} leave={lockup - 0.2} />}

      {/* ── the lockup ── */}
      {inBeat(lockup - 0.2, see + 0.5) && (
        <AbsoluteFill style={{ opacity: envelope(t, lockup - 0.15, lockup + 0.25, see + 0.05, see + 0.4) }}>
          <AbsoluteFill style={{ background: "rgba(255,248,238,0.9)" }} />
          <At x={960} y={500} style={{ display: "flex", alignItems: "center", gap: 34 }}>
            <BluestiftMark size={170} style={{ opacity: span(t, lockup - 0.1, lockup + 0.5, EASE.arrive), filter: `blur(${((1 - span(t, lockup - 0.1, lockup + 0.5)) * 12).toFixed(1)}px)` }} />
            <div>
              <Title t={t} at={wordAt("schools-2", "Bluestift") - 0.05} style={TYPE.display(130, 700, PAL.deep)}>Bluestift</Title>
              <Title t={t} at={wordAt("schools-2", "Schools") - 0.05} style={{ ...TYPE.serif(120, PAL.amber), marginTop: -20 }}>Schools</Title>
            </div>
          </At>
        </AbsoluteFill>
      )}

      {/* ── students × concepts ── */}
      {inBeat(see + 0.2, never + 0.3) && <Heatmap t={t} see={see} stuck={stuck} concept={concept} leave={never - 0.1} />}

      {/* ── never your conversations ── */}
      {inBeat(never - 0.2, tell + 0.3) && <Frosted t={t} never={never} leave={tell - 0.1} />}

      {/* ── both ways with Raya ── */}
      {inBeat(tell - 0.2, forClass + 0.3) && <BothWays t={t} tell={tell} askClass={askClass} leave={forClass - 0.1} />}

      {/* ── a class, the school, the summary ── */}
      {inBeat(forClass - 0.2, matters + 0.4) && <ClassToSchool t={t} forClass={forClass} wholeSchool={wholeSchool} summary={summary} leave={matters - 0.1} />}

      {/* ── what matters most ── */}
      {t >= matters - 0.2 && <Matters t={t} matters={matters} counts={counts} to={to} />}

      <At x={960} y={990}>
        {inBeat(learn - 0.2, back) && <Spoken id="schools-0" t={t} size={62} accent={["never"]} accentColor={PAL.amber} out={back - 0.3} />}
        {inBeat(back - 0.2, lockup) && <Spoken id="schools-1" t={t} size={62} accent={["back"]} accentColor={PAL.amber} out={lockup - 0.3} />}
        {inBeat(see - 0.2, never) && <Spoken id="schools-2" t={t} phrases={[1, 2]} size={58} accent={["concept"]} accentColor={PAL.coral} out={never - 0.3} maxWidth={1800} />}
        {inBeat(tell - 0.2, forClass) && <Spoken id="schools-4" t={t} size={56} accent={["focus"]} accentColor={PAL.amber} out={forClass - 0.3} maxWidth={1820} />}
        {inBeat(forClass - 0.2, matters) && <Spoken id="schools-5" t={t} size={56} accent={["needed"]} accentColor={PAL.coral} out={matters - 0.3} maxWidth={1820} />}
      </At>
    </Reveal>
  );
}

/* ───────────────────────────── never on your own ───────────────────────────── */

function NotAlone({ t, learn, notAlone, back, backWord, leave }: { t: number; learn: number; notAlone: number; back: number; backWord: number; leave: number }) {
  const out = span(t, leave, leave + 0.35, EASE.leave);
  const you = span(t, learn - 0.3, learn + 0.3, EASE.arrive);
  const around = Array.from({ length: 9 }, (_, k) => {
    const a = (k / 9) * Math.PI * 2 - Math.PI / 2;
    const p = span(t, notAlone - 0.1 + k * 0.06, notAlone + 0.4 + k * 0.06, EASE.arrive);
    return { x: 960 + Math.cos(a) * 300 * p, y: 520 + Math.sin(a) * 230 * p, p, teacher: k === 0 };
  });
  const school = span(t, back - 0.2, backWord + 0.6, EASE.move);
  return (
    <AbsoluteFill style={{ opacity: 1 - out, transform: `scale(${(1 + out * 0.1).toFixed(3)})` }}>
      <Svg>
        {/* the school, drawn behind them */}
        <g opacity={0.9}>
          <Draw d="M520 820 L520 470 L960 250 L1400 470 L1400 820" p={school} stroke={PAL.amber} width={6} glow={PAL.amber} />
          {[620, 760, 1160, 1300].map((x, k) => (
            <Draw key={x} d={`M${x} 820 L${x} 520`} p={span(t, back + 0.1 + k * 0.08, backWord + 0.7)} stroke="rgba(217,119,6,0.55)" width={5} />
          ))}
          <Draw d="M440 830 L1480 830" p={span(t, back, backWord + 0.3)} stroke={PAL.amber} width={6} />
        </g>
        {around.map((d, k) => (
          <Draw key={k} d={`M960 520 L${d.x} ${d.y}`} p={d.p} stroke="rgba(217,119,6,0.4)" width={3} />
        ))}
        <Pulse t={t} at={notAlone} x={960} y={520} color={PAL.amber} r0={70} r1={420} width={4} />
      </Svg>
      {around.map((d, k) => (
        <At key={k} x={d.x} y={d.y} style={tilt({ s: d.p, o: d.p })}>
          <div style={{ width: d.teacher ? 90 : 64, height: d.teacher ? 90 : 64, borderRadius: "50%", background: d.teacher ? PAL.amber : ["#6366f1", "#16a34a", "#db2777", "#0891b2", "#7c3aed", "#ea580c", "#0d9488", "#e11d48"][k - 1], boxShadow: "0 10px 26px rgba(120,70,0,0.25)", display: "flex", alignItems: "center", justifyContent: "center", ...TYPE.display(d.teacher ? 30 : 22, 700, "#fff") }}>
            {d.teacher ? "T" : ""}
          </div>
        </At>
      ))}
      <At x={960} y={520} style={tilt({ s: mix(0.5, 1, you), o: you })}>
        <div style={{ width: 130, height: 130, borderRadius: "50%", background: PAL.blue, boxShadow: "0 0 0 10px rgba(47,127,224,0.18), 0 20px 50px rgba(47,127,224,0.45)", display: "flex", alignItems: "center", justifyContent: "center", ...TYPE.display(46, 700, "#fff") }}>You</div>
      </At>
    </AbsoluteFill>
  );
}

/* ───────────────────────────── students × concepts ───────────────────────────── */

function Heatmap({ t, see, stuck, concept, leave }: { t: number; see: number; stuck: number; concept: number; leave: number }) {
  const p = span(t, see + 0.2, see + 0.8, EASE.arrive);
  const out = span(t, leave, leave + 0.35, EASE.leave);
  // "concept by concept": a band of light walks the columns.
  const col = (span(t, concept - 0.1, concept + 1.4, EASE.linear) * (CONCEPTS.length + 1)) - 0.5;
  return (
    <At x={960} y={480} style={tilt({ rx: mix(16, 6, p), s: mix(0.88, 1, p) * (1 - out * 0.08), o: p * (1 - out) })}>
      <Card w={1500} style={{ padding: "34px 44px" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 16, marginBottom: 20 }}>
          <span style={TYPE.display(36, 700)}>Year 10 · Physics</span>
          <span style={TYPE.body(24, 500, "#64748b")}>where each student is stuck</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: `220px repeat(${CONCEPTS.length}, 1fr)`, gap: 12 }}>
          <div />
          {CONCEPTS.map((c, k) => (
            <div key={c} style={{ ...TYPE.display(24, 700, Math.abs(k - col) < 0.6 ? PAL.coral : "#44546a"), textAlign: "center", transform: `translateY(${Math.abs(k - col) < 0.6 ? -4 : 0}px)` }}>{c}</div>
          ))}
          {ROSTER.map((name, r) => (
            <div key={name} style={{ display: "contents" }}>
              <div style={{ ...TYPE.display(26, 600), display: "flex", alignItems: "center" }}>{name}</div>
              {CONCEPTS.map((c, k) => {
                const v = GRID[r][k];
                const lit = span(t, see + 0.4 + (r * 6 + k) * 0.025, see + 0.7 + (r * 6 + k) * 0.025);
                const focus = Math.max(0, 1 - Math.abs(k - col) * 1.4);
                const isStuck = v < 0.45;
                return (
                  <div key={c} style={{ height: 62, borderRadius: 14, background: lit > 0 ? heat(v) : "#eef2f7", opacity: 0.25 + 0.75 * lit, transform: `scale(${(1 + 0.08 * focus).toFixed(3)})`, boxShadow: focus > 0.3 && isStuck ? `0 0 0 4px ${PAL.coral}, 0 0 24px ${PAL.coral}` : undefined, display: "flex", alignItems: "center", justifyContent: "center", ...TYPE.mono(22, "rgba(255,255,255,0.95)", 700) }}>
                    {lit > 0.5 ? `${Math.round(v * 100)}%` : ""}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </Card>
      {/* a word for the moment the voice says "stuck" */}
      <div style={{ position: "absolute", right: -30, top: -40, ...tilt({ o: envelope(t, stuck - 0.1, stuck + 0.2, concept + 1.2, concept + 1.5), s: mix(0.6, 1, span(t, stuck - 0.1, stuck + 0.3, EASE.arrive)), rz: -6 }) }}>
        <div style={{ padding: "14px 26px", borderRadius: 999, background: PAL.coral, ...TYPE.display(30, 700, "#fff"), boxShadow: "0 14px 40px rgba(255,107,91,0.45)" }}>3 stuck on Acceleration</div>
      </div>
    </At>
  );
}

/* ───────────────────────────── never your conversations ───────────────────────────── */

function Frosted({ t, never, leave }: { t: number; never: number; leave: number }) {
  const out = span(t, leave, leave + 0.35, EASE.leave);
  const frost = span(t, never + 0.35, never + 0.9, EASE.move);
  const lock = span(t, never + 0.6, never + 1.0, EASE.arrive);
  const bubbles = [
    { text: "I still don't get why sin(150°) is positive…", me: true },
    { text: "Good question — where is 150° on the circle?", me: false },
    { text: "Oh. Second quadrant. y is positive there!", me: true },
  ];
  return (
    <AbsoluteFill style={{ opacity: 1 - out }}>
      <AbsoluteFill style={{ background: "linear-gradient(170deg,#1b2440,#0b1220)", opacity: span(t, never - 0.2, never + 0.2) }} />
      <At x={960} y={430} style={{ filter: `blur(${(frost * 16).toFixed(1)}px)`, opacity: 1 - frost * 0.35 }}>
        <div style={{ width: 1000, display: "flex", flexDirection: "column", gap: 22 }}>
          {bubbles.map((b, k) => {
            const p = span(t, never - 0.2 + k * 0.12, never + 0.2 + k * 0.12, EASE.arrive);
            return (
              <div key={k} style={{ alignSelf: b.me ? "flex-end" : "flex-start", maxWidth: 700, padding: "22px 30px", borderRadius: b.me ? "30px 30px 8px 30px" : "30px 30px 30px 8px", background: b.me ? PAL.blue : "#ffffff", ...TYPE.display(34, 600, b.me ? "#fff" : PAL.text), ...tilt({ o: p, y: (1 - p) * 30 }) }}>
                {b.text}
              </div>
            );
          })}
        </div>
      </At>
      <Svg>
        <Burst t={t} at={never + 0.95} x={960} y={430} color={PAL.amber} rays={20} r0={110} r1={380} salt={13} />
      </Svg>
      <At x={960} y={430} style={tilt({ s: mix(1.8, 1, lock), o: lock, y: (1 - lock) * -80 })}>
        <div style={{ width: 200, height: 200, borderRadius: "50%", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 30px 80px rgba(0,0,0,0.45)" }}>
          <svg width="96" height="96" viewBox="0 0 16 16">
            <path d="M5 7V5a3 3 0 0 1 6 0v2h.5A1.5 1.5 0 0 1 13 8.5v4A1.5 1.5 0 0 1 11.5 14h-7A1.5 1.5 0 0 1 3 12.5v-4A1.5 1.5 0 0 1 4.5 7H5Zm1.5 0h3V5a1.5 1.5 0 0 0-3 0v2Z" fill={PAL.deep} />
          </svg>
        </div>
      </At>
      <At x={960} y={830}>
        <Spoken id="schools-3" t={t} size={120} color="#fff" accent={["Never"]} accentColor={PAL.amber} />
      </At>
    </AbsoluteFill>
  );
}

/* ───────────────────────────── both ways with Raya ───────────────────────────── */

function BothWays({ t, tell, askClass, leave }: { t: number; tell: number; askClass: number; leave: number }) {
  const out = span(t, leave, leave + 0.35, EASE.leave);
  const p = span(t, tell - 0.2, tell + 0.4, EASE.arrive);
  const teacher = { x: 380, y: 470 };
  const raya = { x: 1540, y: 470 };
  const rules = ["Focus on fractions", "Ask for the reasoning first", "Go slower on molar mass"];
  const q = span(t, askClass - 0.05, askClass + 0.5, EASE.arrive);
  const a = span(t, askClass + 0.9, askClass + 1.5, EASE.arrive);
  return (
    <AbsoluteFill style={{ opacity: p * (1 - out) }}>
      <Svg>
        <Draw d={`M${teacher.x + 110} ${teacher.y} C 900 330, 1020 330, ${raya.x - 110} ${raya.y}`} p={span(t, tell, tell + 0.8)} stroke="rgba(217,119,6,0.5)" width={4} />
        <Draw d={`M${raya.x - 110} ${raya.y + 30} C 1020 640, 900 640, ${teacher.x + 110} ${teacher.y + 30}`} p={span(t, askClass + 0.7, askClass + 1.3)} stroke="rgba(47,127,224,0.5)" width={4} />
      </Svg>
      <At x={teacher.x} y={teacher.y}>
        <div style={{ textAlign: "center" }}>
          <div style={{ width: 190, height: 190, borderRadius: "50%", background: PAL.amber, display: "flex", alignItems: "center", justifyContent: "center", ...TYPE.display(64, 700, "#fff"), boxShadow: "0 24px 60px rgba(217,119,6,0.45)" }}>T</div>
          <div style={{ ...TYPE.display(32, 700), marginTop: 16 }}>Teacher</div>
        </div>
      </At>
      <At x={raya.x} y={raya.y}>
        <div style={{ textAlign: "center" }}>
          <div style={{ width: 190, height: 190, borderRadius: "50%", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 24px 60px rgba(47,127,224,0.35)" }}>
            <RayaMark size={140} turn={t * 20} />
          </div>
          <div style={{ ...TYPE.display(32, 700), marginTop: 16 }}>Raya</div>
        </div>
      </At>
      {/* instructions, travelling teacher → Raya */}
      {rules.map((r, k) => {
        const m = span(t, tell + 0.3 + k * 0.35, tell + 1.5 + k * 0.35, EASE.move);
        if (m <= 0 || m >= 1) return null;
        const x = mix(teacher.x + 160, raya.x - 160, m);
        const y = 330 - Math.sin(m * Math.PI) * 60 + k * 10;
        return (
          <At key={r} x={x} y={y} style={tilt({ o: Math.min(1, Math.sin(m * Math.PI) * 2) })}>
            <div style={{ padding: "14px 24px", borderRadius: 999, background: "#fff", border: `2px solid ${PAL.amber}`, ...TYPE.display(28, 700), whiteSpace: "nowrap", boxShadow: "0 12px 30px rgba(120,70,0,0.18)" }}>{r}</div>
          </At>
        );
      })}
      {/* the question, and the answer back */}
      <div style={{ position: "absolute", left: 560, top: 560, ...tilt({ o: q, x: (1 - q) * -40 }) }}>
        <div style={{ padding: "20px 28px", borderRadius: "28px 28px 28px 8px", background: PAL.amber, ...TYPE.display(32, 700, "#3d2600") }}>How is Year 10 Physics doing?</div>
      </div>
      <div style={{ position: "absolute", right: 300, top: 680, maxWidth: 820, ...tilt({ o: a, x: (1 - a) * 40 }) }}>
        <div style={{ padding: "20px 28px", borderRadius: "28px 28px 8px 28px", background: PAL.blue, ...TYPE.display(30, 600, "#fff") }}>12 are stuck on acceleration — for most, it goes back to derivatives.</div>
      </div>
    </AbsoluteFill>
  );
}

/* ───────────────────────────── a class → the school → the summary ───────────────────────────── */

const CLASSES = [
  { name: "Year 9 · Maths", v: 0.88 },
  { name: "Year 10 · Physics", v: 0.71 },
  { name: "Year 8 · French", v: 0.61 },
  { name: "Year 11 · Biology", v: 0.84 },
  { name: "Year 7 · English", v: 0.79 },
  { name: "Year 12 · Chemistry", v: 0.66 },
];

function ClassToSchool({ t, forClass, wholeSchool, summary, leave }: { t: number; forClass: number; wholeSchool: number; summary: number; leave: number }) {
  const out = span(t, leave, leave + 0.35, EASE.leave);
  const homework = envelope(t, forClass - 0.2, forClass + 0.2, wholeSchool - 0.05, wholeSchool + 0.3, EASE.arrive);
  const fly = span(t, forClass + 0.35, forClass + 1.0, EASE.move);
  const school = envelope(t, wholeSchool - 0.05, wholeSchool + 0.4, summary + 0.1, summary + 0.45, EASE.arrive);
  const doc = span(t, summary + 0.05, summary + 0.5, EASE.arrive);
  const lines = [
    "Year 10 Physics: unit conversions hold back 12 students.",
    "Year 8 French: steady, essays improving week on week.",
    "School-wide: 47 students need a check-in this week.",
  ];
  return (
    <AbsoluteFill style={{ opacity: 1 - out }}>
      {/* for a class: homework, out to every student */}
      {homework > 0 && (
        <AbsoluteFill style={{ opacity: homework }}>
          <At x={960} y={450} style={tilt({ s: mix(0.8, 1, homework) })}>
            <Card w={760} style={{ padding: "32px 40px" }}>
              <div style={TYPE.mono(22, PAL.blue, 700)}>HOMEWORK · YEAR 10</div>
              <div style={{ ...TYPE.display(44, 700), marginTop: 8 }}>Acceleration and forces</div>
              <div style={{ ...TYPE.body(26, 500, "#64748b"), marginTop: 6 }}>8 questions · built on what the class gets wrong</div>
              <div style={{ marginTop: 24, display: "inline-block", padding: "16px 30px", borderRadius: 999, background: PAL.blue, ...TYPE.display(28, 700, "#fff"), transform: `scale(${(1 - 0.06 * Math.sin(span(t, forClass + 0.2, forClass + 0.4) * Math.PI)).toFixed(3)})` }}>Assign to the class</div>
            </Card>
          </At>
          {Array.from({ length: 24 }, (_, k) => {
            const a = -Math.PI * (0.05 + 0.9 * (k / 23));
            const r = 380 + (k % 4) * 80;
            const p = fly;
            return p > 0 && p < 1 ? (
              <At key={k} x={960 + Math.cos(a) * r * p * 1.4} y={560 + Math.sin(a) * r * p} style={{ opacity: Math.min(1, p * 5) * (1 - span(p, 0.7, 1)) }}>
                <div style={{ width: 46, height: 46, borderRadius: "50%", background: ["#6366f1", "#2f7fe0", "#16a34a", "#d97706", "#db2777", "#0891b2"][k % 6], boxShadow: "0 8px 20px rgba(0,0,0,0.2)" }} />
              </At>
            ) : null;
          })}
        </AbsoluteFill>
      )}
      {/* the whole school */}
      {school > 0 && (
        <AbsoluteFill style={{ opacity: school }}>
          {CLASSES.map((c, k) => {
            const p = span(t, wholeSchool + k * 0.07, wholeSchool + 0.4 + k * 0.07, EASE.arrive);
            const x = 420 + (k % 3) * 540;
            const y = 330 + Math.floor(k / 3) * 300;
            return (
              <At key={c.name} x={x} y={y} style={tilt({ s: mix(0.6, 1, p), o: p })}>
                <Card w={470} style={{ padding: "26px 30px" }}>
                  <div style={TYPE.display(30, 700)}>{c.name}</div>
                  <div style={{ marginTop: 18, height: 18, borderRadius: 9, background: "#eef2f7", overflow: "hidden" }}>
                    <div style={{ width: `${(c.v * 100 * p).toFixed(1)}%`, height: "100%", background: heat(c.v), borderRadius: 9 }} />
                  </div>
                  <div style={{ ...TYPE.mono(26, "#44546a", 700), marginTop: 10 }}>{Math.round(c.v * 100 * p)}%</div>
                </Card>
              </At>
            );
          })}
        </AbsoluteFill>
      )}
      {/* the summary */}
      {doc > 0 && (
        <At x={960} y={460} style={tilt({ s: mix(0.85, 1, doc), o: doc, rx: mix(10, 0, doc) })}>
          <Card w={1180} style={{ padding: "40px 50px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <RayaMark size={44} />
              <span style={TYPE.display(40, 700)}>This week, what's really needed</span>
            </div>
            {lines.map((l, k) => {
              const p = span(t, summary + 0.4 + k * 0.5, summary + 0.9 + k * 0.5, EASE.linear);
              return (
                <div key={l} style={{ display: "flex", gap: 16, alignItems: "baseline", marginTop: 22, opacity: p > 0 ? 1 : 0 }}>
                  <span style={{ width: 14, height: 14, borderRadius: "50%", background: [PAL.coral, PAL.mint, PAL.amber][k], flex: "none", transform: "translateY(-4px)" }} />
                  <span style={TYPE.body(32, 500)}>{l.slice(0, Math.round(l.length * p))}</span>
                </div>
              );
            })}
          </Card>
        </At>
      )}
    </AbsoluteFill>
  );
}

/* ───────────────────────────── the students who count on them ───────────────────────────── */

function Matters({ t, matters, counts, to }: { t: number; matters: number; counts: number; to: number }) {
  const p = span(t, matters - 0.2, matters + 0.6, EASE.move);
  const dusk = span(t, counts + 0.8, to + 0.4, EASE.move);
  const dots = Array.from({ length: 14 }, (_, k) => {
    const a = (k / 14) * Math.PI * 2;
    return { x: 960 + Math.cos(a) * (360 + (k % 3) * 60), y: 540 + Math.sin(a) * (230 + (k % 2) * 40) };
  });
  const lift = counts + 0.25;
  const birds: Bird[] = dots.map((d, k) => ({
    from: lift + rand(k, 31) * 0.5,
    to: lift + 3.4 + rand(k, 32) * 1.4,
    start: [d.x, d.y],
    end: [d.x + (rand(k, 33) - 0.3) * 900, -160 - rand(k, 34) * 200],
    size: 34 + rand(k, 35) * 26,
    amp: 10,
    period: 1.2 + rand(k, 36),
    arc: 80,
    depth: 0.5 + rand(k, 37) * 0.5,
    seed: 70 + k,
  }));
  return (
    <AbsoluteFill style={{ opacity: p }}>
      <Field from="#ffe0b3" to="#ff9f6b" angle={180} light="rgba(255,255,255,0.7)" lightAt={[50, 45]} />
      <AbsoluteFill style={{ background: "linear-gradient(180deg,#0b1838,#070d22)", opacity: dusk }} />
      <Glow x={960} y={540} r={520} color="rgba(255,255,255,0.65)" opacity={1 - dusk} />
      <Svg>
        {dots.map((d, k) => (
          <Draw key={k} d={`M960 540 L${d.x} ${d.y}`} p={span(t, matters + 0.2 + k * 0.04, matters + 0.7 + k * 0.04)} stroke="rgba(255,255,255,0.6)" width={2.5} opacity={1 - span(t, lift, lift + 0.6)} />
        ))}
      </Svg>
      {dots.map((d, k) => {
        const gone = t > lift + rand(k, 31) * 0.5;
        const pp = span(t, matters + k * 0.04, matters + 0.4 + k * 0.04, EASE.arrive);
        return gone ? null : (
          <At key={k} x={d.x} y={d.y} style={tilt({ s: pp, o: pp })}>
            <div style={{ width: 44, height: 44, borderRadius: "50%", background: "#fff", boxShadow: "0 8px 20px rgba(160,70,0,0.25)" }} />
          </At>
        );
      })}
      <At x={960} y={540} style={tilt({ s: mix(0.6, 1, p) })}>
        <div style={{ width: 120, height: 120, borderRadius: "50%", background: PAL.amber, display: "flex", alignItems: "center", justifyContent: "center", ...TYPE.display(42, 700, "#fff"), boxShadow: "0 0 0 10px rgba(255,255,255,0.4), 0 20px 50px rgba(160,70,0,0.35)" }}>T</div>
      </At>
      <Flock birds={birds} color="#ffffff" farColor="#fff1dc" />
      <At x={960} y={200}>
        <Spoken id="schools-6" t={t} phrases={[0]} size={80} color={PAL.text} accent={["matters"]} accentColor={PAL.deep} out={counts - 0.25} maxWidth={1800} />
      </At>
      <At x={960} y={900}>
        <Spoken id="schools-6" t={t} phrases={[1]} size={80} color="#ffffff" accent={["count"]} accentColor={PAL.white} out={to - 0.5} maxWidth={1800} />
      </At>
    </AbsoluteFill>
  );
}
