import type { ReactNode } from "react";
import { AbsoluteFill } from "remotion";
import { IconChat, IconKernel, IconQuiz, IconRooms, IconTools } from "@/components/ui/icons";
import { RayaWordmark } from "../Marks";
import { EASE, envelope, mix, rand, span, useTime } from "../motion";
import { line, MUSIC, phrase, wordAt } from "../timeline";
import { At, Burst, Card, count, Draw, Field, Glow, Motes, PAL, Pulse, RayaMark, Reveal, Spoken, Svg, tilt, Title, TYPE } from "./kit";

/**
 * "Here's a quick look at Raya, which is more than an AI: it's a platform of
 * its own."
 *
 * A blue world opened by the flower itself. The app's five spaces fan out of
 * the mark; the composer arrives as a slab the width of the frame and types
 * its question; an ANSWER card is turned over to show a question mark, and
 * three hints climb to the moment the student finds it, over a neon graph
 * being drawn and worked; My Kernel's three gauges fill; a lesson breaks
 * into a quiz, a deck of flashcards and a mind map; and a Study Room gathers
 * its friends in a ring, chats, passes documents, races, with Raya landing in
 * the middle of them.
 */

const SPACES = [
  { label: "Chat", Icon: IconChat },
  { label: "Rooms", Icon: IconRooms },
  { label: "Tools", Icon: IconTools },
  { label: "Assignments", Icon: IconQuiz },
  { label: "My Kernel", Icon: IconKernel },
];

const FRIENDS = [
  { i: "AS", c: "#6366f1", name: "Amira" },
  { i: "LD", c: "#2f7fe0", name: "Léa" },
  { i: "NK", c: "#16a34a", name: "Noah" },
  { i: "TB", c: "#d97706", name: "Tomás" },
  { i: "YO", c: "#db2777", name: "You" },
];

function Chip({ children, tone = "#fff", bg = "rgba(255,255,255,0.14)", style }: { children: ReactNode; tone?: string; bg?: string; style?: React.CSSProperties }) {
  return (
    <div style={{ whiteSpace: "nowrap", display: "inline-flex", alignItems: "center", gap: 14, padding: "16px 26px", borderRadius: 999, background: bg, border: "1px solid rgba(255,255,255,0.22)", backdropFilter: "blur(8px)", ...TYPE.display(30, 600, tone), ...style }}>
      {children}
    </div>
  );
}

export function FilmRaya() {
  const t = useTime();
  const from = MUSIC.groove;
  if (t < from || t > MUSIC.warm + 0.8) return null;

  const rayaWord = wordAt("raya-0", "Raya");
  const moreThan = phrase("raya-0", 1).start;
  const aiWord = wordAt("raya-0", "AI");
  const platform = phrase("raya-0", 2).start;
  const ask = line("raya-1").start;
  const askEnd = line("raya-1").end;
  const instead = line("raya-2").start;
  const findIt = phrase("raya-2", 1).start;
  const explore = line("raya-3").start;
  const kernelWord = wordAt("raya-3", "Kernel");
  const turn = line("raya-4").start;
  const quizzes = wordAt("raya-4", "quizzes");
  const flashcards = wordAt("raya-4", "flashcards");
  const mindMaps = wordAt("raya-4", "mind");
  const practise = phrase("raya-4", 2).start;
  const better = line("raya-5").start;
  const studyRoom = wordAt("raya-5", "Study");
  const friends = wordAt("raya-5", "friends");
  const chat = phrase("raya-5", 2).start;
  const share = phrase("raya-5", 3).start;
  const challenge = wordAt("raya-5", "challenge");
  const rightThere = phrase("raya-5", 4).start;
  const help = phrase("raya-5", 5).start;

  const inBeat = (a: number, b: number) => t >= a && t < b;

  return (
    <Reveal t={t} at={from} dur={0.8} x={50} y={50}>
      <Field from="#0d2a6b" to="#3b3fd8" angle={145} light="rgba(56,225,255,0.28)" lightAt={[78, 18]} />
      <Motes t={t} count={45} seed={3} color="#cfe6ff" opacity={0.45} />

      {/* the flower that opens the scene, huge, turning under the reveal */}
      {t < moreThan + 0.4 && (
        <At x={960} y={540} style={{ opacity: 1 - span(t, from + 0.6, rayaWord - 0.1), transform: `scale(${mix(5.5, 3.2, span(t, from, rayaWord))})` }}>
          <RayaMark size={300} turn={(t - from) * 60} dark style={{ opacity: 0.18 }} />
        </At>
      )}

      {/* ── Raya, more than an AI, a platform ── */}
      {t < ask + 0.3 && (
        <AbsoluteFill style={{ opacity: 1 - span(t, ask - 0.35, ask, EASE.leave) }}>
          <Svg>
            <Burst t={t} at={rayaWord - 0.05} x={960} y={420} color={PAL.sky} rays={24} r0={170} r1={560} salt={7} />
            <Pulse t={t} at={rayaWord} x={960} y={420} color={PAL.cyan} r0={150} r1={520} />
          </Svg>
          {(() => {
            const p = span(t, rayaWord - 0.3, rayaWord + 0.5, EASE.arrive);
            const up = span(t, platform - 0.2, platform + 0.4);
            return (
              <At x={960} y={mix(420, 300, up)} style={{ display: "flex", alignItems: "center", gap: 36, opacity: p, transform: `scale(${mix(0.7, 1, p) * mix(1, 0.8, up)})` }}>
                <div style={{ width: 230, height: 230, borderRadius: "50%", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 90px rgba(56,225,255,0.45)" }}>
                  <RayaMark size={180} turn={(t - rayaWord) * 30 - (1 - p) * 180} />
                </div>
                <RayaWordmark size={190} color="#ffffff" />
              </At>
            );
          })()}
          {/* "more than an AI" — the word struck through */}
          <At x={960} y={660} style={{ opacity: 1 - span(t, platform - 0.25, platform) }}>
            <div style={{ position: "relative" }}>
              <Title t={t} at={moreThan - 0.05} style={TYPE.heavy(96, "#ffffff")}>
                more than an <span style={{ position: "relative" }}>AI</span>
              </Title>
              <svg width={360} height={40} style={{ position: "absolute", right: -20, top: 52, overflow: "visible" }}>
                <Draw d="M10 20 L230 14" p={span(t, aiWord + 0.2, aiWord + 0.5)} stroke={PAL.coral} width={10} />
              </svg>
            </div>
          </At>
          {/* the five spaces, fanned out of the mark */}
          {SPACES.map(({ label, Icon }, k) => {
            const p = span(t, platform + 0.05 + k * 0.1, platform + 0.6 + k * 0.1, EASE.arrive);
            const a = (k - 2) * 15;
            return (
              <At key={label} x={960 + (k - 2) * 330 * p} y={mix(420, 700, p) + Math.abs(k - 2) * 26 * p} style={{ ...tilt({ rz: a * 0.3 * p, s: mix(0.4, 1, p), o: p }), transformOrigin: "50% 50%" }}>
                <Chip style={{ padding: "22px 30px" }}>
                  <Icon size={34} style={{ width: 34, height: 34 }} />
                  {label}
                </Chip>
              </At>
            );
          })}
          <At x={960} y={900}>
            <Spoken id="raya-0" t={t} phrases={[2]} size={72} color="#fff" accent={["own"]} accentColor={PAL.cyan} out={ask - 0.4} />
          </At>
        </AbsoluteFill>
      )}

      {/* ── ask Raya anything: the composer, the width of the frame ── */}
      {inBeat(ask - 0.4, findIt + 0.3) && <Composer t={t} ask={ask} end={askEnd} leave={instead - 0.1} />}

      {/* ── not the answer: a question, then the student finds it ── */}
      {inBeat(instead - 0.2, explore + 0.2) && <FindIt t={t} instead={instead} findIt={findIt} leave={explore - 0.35} />}

      {/* ── My Kernel ── */}
      {inBeat(explore - 0.05, turn + 0.3) && <KernelGauges t={t} at={explore + 0.15} kernelWord={kernelWord} leave={turn - 0.2} />}

      {/* ── a lesson into quizzes, flashcards, mind maps ── */}
      {inBeat(turn - 0.3, better + 0.3) && <LessonInto t={t} turn={turn} quizzes={quizzes} flashcards={flashcards} mindMaps={mindMaps} practise={practise} leave={better - 0.15} />}

      {/* ── the Study Room ── */}
      {t >= better - 0.3 && (
        <StudyRoom t={t} better={better} studyRoom={studyRoom} friends={friends} chat={chat} share={share} challenge={challenge} rightThere={rightThere} help={help} />
      )}

      <At x={960} y={985}>
        {inBeat(ask - 0.2, instead) && <Spoken id="raya-1" t={t} size={58} color="#fff" accent={["anything"]} accentColor={PAL.cyan} out={instead - 0.3} />}
        {inBeat(instead - 0.2, explore) && <Spoken id="raya-2" t={t} size={58} color="#fff" accent={["find"]} accentColor={PAL.amber} out={explore - 0.3} />}
        {inBeat(explore - 0.2, turn) && <Spoken id="raya-3" t={t} size={58} color="#fff" accent={["insights"]} accentColor={PAL.cyan} out={turn - 0.3} />}
        {inBeat(turn - 0.2, better) && <Spoken id="raya-4" t={t} size={58} color="#fff" accent={["way"]} accentColor={PAL.amber} out={better - 0.3} />}
      </At>
    </Reveal>
  );
}

/* ───────────────────────────── the composer ───────────────────────────── */

function Composer({ t, ask, end, leave }: { t: number; ask: number; end: number; leave: number }) {
  const q = "How do plants turn sunlight into food?";
  const p = span(t, ask - 0.35, ask + 0.25, EASE.arrive);
  const out = span(t, leave, leave + 0.45, EASE.leave);
  const typed = q.slice(0, Math.round(q.length * span(t, ask + 0.1, end - 0.1, EASE.linear)));
  const send = span(t, end - 0.05, end + 0.25, EASE.arrive);
  return (
    <AbsoluteFill style={{ opacity: 1 - out }}>
      {/* the dashboard behind it, as a silhouette */}
      <At x={960} y={520} style={{ ...tilt({ rx: 18, s: mix(0.92, 1, p), o: 0.55 * p, y: out * -60 }) }}>
        <div style={{ width: 1600, height: 820, borderRadius: 34, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.18)", display: "flex", overflow: "hidden" }}>
          <div style={{ width: 300, borderRight: "1px solid rgba(255,255,255,0.12)", padding: 30 }}>
            {[0.7, 0.5, 0.6, 0.45, 0.55].map((w, k) => (
              <div key={k} style={{ height: 22, width: `${w * 100}%`, borderRadius: 11, background: "rgba(255,255,255,0.16)", marginBottom: 26 }} />
            ))}
          </div>
          <div style={{ flex: 1, padding: 50 }}>
            <div style={{ ...TYPE.serif(80, "rgba(255,255,255,0.85)"), marginTop: 120, textAlign: "center" }}>What are we cracking today?</div>
          </div>
        </div>
      </At>
      <At x={960} y={mix(760, 600, p) - out * 120} style={{ opacity: p }}>
        <div style={{ width: 1380, height: 128, borderRadius: 64, background: "#fff", boxShadow: "0 30px 90px rgba(5,9,19,0.45), 0 0 0 6px rgba(255,255,255,0.12)", display: "flex", alignItems: "center", padding: "0 22px 0 52px", gap: 20 }}>
          <span style={{ flex: 1, ...TYPE.display(44, 500, typed ? PAL.text : "#94a3b8") }}>
            {typed || "Write your reply to Raya…"}
            {typed.length < q.length && typed && <span style={{ display: "inline-block", width: 4, height: 46, background: PAL.blue, marginLeft: 4, verticalAlign: "middle" }} />}
          </span>
          <div style={{ width: 88, height: 88, borderRadius: "50%", background: PAL.blue, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 44, transform: `scale(${(1 + 0.18 * Math.sin(send * Math.PI)).toFixed(3)})`, boxShadow: `0 0 ${(send * 60).toFixed(0)}px rgba(56,225,255,0.8)` }}>↑</div>
        </div>
      </At>
    </AbsoluteFill>
  );
}

/* ───────────────────────────── the question, then the find ───────────────────────────── */

function FindIt({ t, instead, findIt, leave }: { t: number; instead: number; findIt: number; leave: number }) {
  const arrive = span(t, instead - 0.2, instead + 0.4, EASE.arrive);
  const flip = span(t, findIt - 0.55, findIt - 0.1, EASE.move);
  const out = span(t, leave, leave + 0.4, EASE.leave);
  const hints = ["What does a leaf need?", "Where does the energy come from?", "So what does the plant make?"];
  const found = span(t, findIt + 0.85, findIt + 1.15, EASE.arrive);
  // The graph Raya draws, behind everything: a curve in neon, worked.
  const curve = (() => {
    const pts: string[] = [];
    for (let i = 0; i <= 60; i++) {
      const x = -3 + (8 * i) / 60;
      const y = x * x - 2 * x - 3;
      pts.push(`${i ? "L" : "M"}${(980 + (x + 3) * 110).toFixed(1)},${(780 - (y + 4) * 52).toFixed(1)}`);
    }
    return pts.join(" ");
  })();
  return (
    <AbsoluteFill style={{ opacity: 1 - out }}>
      <Svg>
        <g opacity={0.9}>
          {Array.from({ length: 9 }, (_, k) => (
            <line key={`v${k}`} x1={980 + k * 110} y1={160} x2={980 + k * 110} y2={880} stroke="rgba(255,255,255,0.07)" />
          ))}
          {Array.from({ length: 8 }, (_, k) => (
            <line key={`h${k}`} x1={980} y1={160 + k * 104} x2={1860} y2={160 + k * 104} stroke="rgba(255,255,255,0.07)" />
          ))}
          <Draw d={curve} p={span(t, findIt - 0.4, findIt + 0.9)} stroke={PAL.cyan} width={6} glow={PAL.cyan} />
          {[-1, 3].map((x, k) => (
            <g key={x}>
              <Pulse t={t} at={findIt + 0.8 + k * 0.15} x={980 + (x + 3) * 110} y={780 - 4 * 52} color={PAL.amber} r0={8} r1={70} />
              <circle cx={980 + (x + 3) * 110} cy={780 - 4 * 52} r={12 * span(t, findIt + 0.8 + k * 0.15, findIt + 1.0 + k * 0.15, EASE.arrive)} fill={PAL.amber} />
            </g>
          ))}
        </g>
      </Svg>
      {/* formulas drifting in the field */}
      {["x² − 2x − 3 = 0", "F = m·a", "(x − 3)(x + 1) = 0", "∫ f(x) dx"].map((f, k) => {
        const p = span(t, findIt - 0.2 + k * 0.18, findIt + 0.4 + k * 0.18, EASE.arrive);
        return (
          <div key={f} style={{ position: "absolute", left: 1040 + (k % 2) * 380, top: 190 + k * 150, ...TYPE.serif(44, "rgba(255,255,255,0.75)"), opacity: p * 0.9, transform: `translateY(${((1 - p) * 30 - (t - findIt) * 10).toFixed(1)}px)` }}>
            {f}
          </div>
        );
      })}
      <div style={{ position: "absolute", right: 70, top: 120, opacity: span(t, findIt + 0.2, findIt + 0.6) }}>
        <Chip bg="rgba(255,255,255,0.92)" tone={PAL.blue} style={{ fontSize: 24, padding: "12px 22px" }}>
          <span style={{ fontFamily: "Instrument Serif", fontWeight: 700, fontSize: 28 }}>W</span> Source: Wikipedia
        </Chip>
      </div>

      {/* the answer card, turned over into a question */}
      <At x={520} y={420} style={{ ...tilt({ s: mix(0.6, 1, arrive) * (1 - span(t, findIt - 0.1, findIt + 0.3) * 0.35), o: arrive, x: -span(t, findIt - 0.1, findIt + 0.3) * 120, y: -span(t, findIt - 0.1, findIt + 0.3) * 150 }) }}>
        <div style={{ position: "relative", width: 520, height: 320, transformStyle: "preserve-3d", transform: `perspective(1400px) rotateY(${(flip * 180).toFixed(1)}deg)` }}>
          <Card w={520} style={{ position: "absolute", inset: 0, height: 320, display: "flex", alignItems: "center", justifyContent: "center", backfaceVisibility: "hidden", background: "linear-gradient(135deg,#ffe8b8,#ffc970)" }}>
            <span style={TYPE.heavy(86, "#7a4a00")}>ANSWER</span>
          </Card>
          <Card w={520} style={{ position: "absolute", inset: 0, height: 320, display: "flex", alignItems: "center", justifyContent: "center", backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}>
            <span style={TYPE.serif(240, PAL.blue)}>?</span>
          </Card>
        </div>
      </At>
      {/* three hints, climbing */}
      {hints.map((h, k) => {
        const p = span(t, findIt + k * 0.24, findIt + 0.35 + k * 0.24, EASE.arrive);
        return (
          <div key={h} style={{ position: "absolute", left: 120 + k * 40, top: 470 + k * 110, ...tilt({ o: p, x: (1 - p) * -60 }) }}>
            <Chip bg="rgba(255,255,255,0.95)" tone={PAL.text} style={{ fontSize: 30 }}>
              <span style={{ ...TYPE.mono(22, PAL.blue, 700) }}>0{k + 1}</span>
              {h}
            </Chip>
          </div>
        );
      })}
      <div style={{ position: "absolute", left: 200, top: 820, ...tilt({ o: found, s: mix(0.7, 1, found) }) }}>
        <Chip bg={PAL.mint} tone="#053d2a" style={{ fontSize: 34 }}>✓ Photosynthesis — you found it</Chip>
      </div>
    </AbsoluteFill>
  );
}

/* ───────────────────────────── My Kernel ───────────────────────────── */

function KernelGauges({ t, at, kernelWord, leave }: { t: number; at: number; kernelWord: number; leave: number }) {
  const p = span(t, at - 0.2, at + 0.4, EASE.arrive);
  const out = span(t, leave, leave + 0.4, EASE.leave);
  const rings = [
    { label: "Knowledge", v: 0.91, c: PAL.cyan, r: 300 },
    { label: "Retention", v: 0.84, c: PAL.violet, r: 240 },
    { label: "Application", v: 0.88, c: PAL.mint, r: 180 },
  ];
  return (
    <AbsoluteFill style={{ opacity: p * (1 - out) }}>
      <AbsoluteFill style={{ background: "radial-gradient(circle at 50% 45%, rgba(5,9,19,0.25), rgba(5,9,19,0.75))" }} />
      <Svg>
        {rings.map((g, k) => {
          const fill = span(t, at + 0.2 + k * 0.2, kernelWord + 0.9 + k * 0.15, EASE.move) * g.v;
          const c = 2 * Math.PI * g.r;
          return (
            <g key={g.label} transform="translate(700 470) rotate(-90)">
              <circle r={g.r} fill="none" stroke="rgba(255,255,255,0.09)" strokeWidth={34} />
              <circle r={g.r} fill="none" stroke={g.c} strokeWidth={34} strokeLinecap="round" strokeDasharray={`${c * fill} ${c}`} style={{ filter: `drop-shadow(0 0 14px ${g.c})` }} />
            </g>
          );
        })}
      </Svg>
      <At x={700} y={470}>
        <div style={{ textAlign: "center" }}>
          <div style={TYPE.mono(30, "rgba(255,255,255,0.7)", 500)}>MY KERNEL</div>
          <div style={TYPE.heavy(110, "#fff")}>{count(t, at + 0.3, kernelWord + 1.0, 68)}%</div>
        </div>
      </At>
      {rings.map((g, k) => (
        <div key={g.label} style={{ position: "absolute", left: 1150, top: 300 + k * 130, display: "flex", alignItems: "center", gap: 24, ...tilt({ o: span(t, at + 0.3 + k * 0.2, at + 0.7 + k * 0.2), x: (1 - span(t, at + 0.3 + k * 0.2, at + 0.7 + k * 0.2)) * 60 }) }}>
          <span style={{ width: 22, height: 22, borderRadius: "50%", background: g.c, boxShadow: `0 0 18px ${g.c}` }} />
          <span style={{ ...TYPE.display(46, 600, "#fff"), width: 300 }}>{g.label}</span>
          <span style={TYPE.mono(46, g.c, 700)}>{count(t, at + 0.2 + k * 0.2, kernelWord + 0.9 + k * 0.15, Math.round(g.v * 100))}%</span>
        </div>
      ))}
    </AbsoluteFill>
  );
}

/* ───────────────────────────── lesson → quiz, flashcards, mind map ───────────────────────────── */

function LessonInto({ t, turn, quizzes, flashcards, mindMaps, practise, leave }: { t: number; turn: number; quizzes: number; flashcards: number; mindMaps: number; practise: number; leave: number }) {
  const pageIn = span(t, turn - 0.25, turn + 0.35, EASE.arrive);
  const split = span(t, quizzes - 0.3, quizzes + 0.2, EASE.move);
  const out = span(t, leave, leave + 0.4, EASE.leave);
  const trio = span(t, practise - 0.1, practise + 0.6, EASE.move);
  // Where each format sits: alone when named, side by side for "practise your way".
  const slot = (k: number, alone: { x: number; y: number }) => ({ x: mix(alone.x, 420 + k * 540, trio), y: mix(alone.y, 520, trio), s: mix(1, 0.78, trio) });

  const quiz = slot(0, { x: 1260, y: 470 });
  const deck = slot(1, { x: 1260, y: 470 });
  const map = slot(2, { x: 1260, y: 470 });
  const quizP = span(t, quizzes - 0.1, quizzes + 0.4, EASE.arrive) * (trio > 0 ? 1 : 1 - span(t, flashcards - 0.35, flashcards - 0.05));
  const deckP = span(t, flashcards - 0.1, flashcards + 0.4, EASE.arrive) * (trio > 0 ? 1 : 1 - span(t, mindMaps - 0.35, mindMaps - 0.05));
  const mapP = span(t, mindMaps - 0.1, mindMaps + 0.5, EASE.arrive);

  return (
    <AbsoluteFill style={{ opacity: 1 - out }}>
      {/* the lesson */}
      <At x={mix(960, 470, split)} y={470} style={tilt({ ry: mix(0, 18, split), s: mix(0.85, 0.82, split) * mix(1, 0.7, trio), o: pageIn * (1 - trio) })}>
        <Card w={600} style={{ padding: "44px 50px", height: 640 }}>
          <div style={TYPE.mono(22, PAL.blue, 700)}>LESSON 4</div>
          <div style={{ ...TYPE.display(46, 700), marginTop: 10 }}>Photosynthesis</div>
          {Array.from({ length: 11 }, (_, k) => (
            <div key={k} style={{ height: 14, borderRadius: 7, background: "#e7edf5", marginTop: 26, width: `${60 + rand(k, 8) * 38}%` }} />
          ))}
        </Card>
      </At>
      {/* quiz: four answers */}
      {quizP > 0 && (
        <At x={quiz.x} y={quiz.y} style={tilt({ s: quiz.s, o: quizP })}>
          <Card w={520} style={{ padding: 34 }}>
            <div style={TYPE.mono(20, PAL.blue, 700)}>QUIZ</div>
            <div style={{ ...TYPE.display(30, 700), margin: "10px 0 18px" }}>What is the light used for?</div>
            {["Splitting water", "Heating the leaf", "Opening stomata", "Making roots"].map((a, k) => {
              const p = span(t, quizzes + 0.05 + k * 0.08, quizzes + 0.35 + k * 0.08, EASE.arrive);
              const right = k === 0 && t > quizzes + 0.9;
              return (
                <div key={a} style={{ ...tilt({ o: p, x: (1 - p) * 40 }), display: "flex", gap: 14, alignItems: "center", padding: "14px 18px", marginTop: 10, borderRadius: 16, background: right ? "rgba(52,211,153,0.18)" : "#f3f6fa", border: `2px solid ${right ? PAL.mint : "transparent"}`, ...TYPE.display(26, 600) }}>
                  <span style={{ ...TYPE.mono(22, PAL.blue, 700) }}>{"ABCD"[k]}</span>
                  {a}
                </div>
              );
            })}
          </Card>
        </At>
      )}
      {/* flashcards: a deck, the top one turning */}
      {deckP > 0 && (
        <At x={deck.x} y={deck.y} style={tilt({ s: deck.s, o: deckP })}>
          <div style={{ position: "relative", width: 500, height: 320 }}>
            {[2, 1].map((k) => (
              <Card key={k} w={500} style={{ position: "absolute", inset: 0, height: 320, transform: `translate(${k * 18}px, ${k * 18}px) rotate(${k * 3}deg)`, opacity: 0.85 }}>
                <div />
              </Card>
            ))}
            {(() => {
              const f = span(t, flashcards + 0.4, flashcards + 0.9, EASE.move);
              return (
                <div style={{ position: "absolute", inset: 0, transformStyle: "preserve-3d", transform: `perspective(1400px) rotateY(${(f * 180).toFixed(1)}deg)` }}>
                  <Card w={500} style={{ position: "absolute", inset: 0, height: 320, display: "flex", alignItems: "center", justifyContent: "center", backfaceVisibility: "hidden", padding: 30, textAlign: "center" }}>
                    <span style={TYPE.display(40, 700)}>Chlorophyll</span>
                  </Card>
                  <Card w={500} style={{ position: "absolute", inset: 0, height: 320, display: "flex", alignItems: "center", justifyContent: "center", backfaceVisibility: "hidden", transform: "rotateY(180deg)", padding: 36, textAlign: "center", background: "linear-gradient(135deg,#e8f1fd,#fff)" }}>
                    <span style={TYPE.body(32, 600)}>The green pigment that captures light energy</span>
                  </Card>
                </div>
              );
            })()}
          </div>
        </At>
      )}
      {/* mind map: steps branching out */}
      {mapP > 0 && (
        <At x={map.x} y={map.y} style={tilt({ s: map.s, o: mapP })}>
          <div style={{ position: "relative", width: 560, height: 460 }}>
            <svg width={560} height={460} style={{ position: "absolute", inset: 0, overflow: "visible" }}>
              {[0, 1, 2, 3, 4, 5].map((k) => {
                const a = (k / 6) * Math.PI * 2 - Math.PI / 2;
                return <Draw key={k} d={`M280 230 L${280 + Math.cos(a) * 200} ${230 + Math.sin(a) * 170}`} p={span(t, mindMaps + 0.1 + k * 0.06, mindMaps + 0.5 + k * 0.06)} stroke="rgba(255,255,255,0.8)" width={4} />;
              })}
            </svg>
            {["☀️", "💧", "🌿", "🫧", "🍬", "🌍"].map((e, k) => {
              const a = (k / 6) * Math.PI * 2 - Math.PI / 2;
              const p = span(t, mindMaps + 0.3 + k * 0.07, mindMaps + 0.6 + k * 0.07, EASE.arrive);
              return (
                <div key={e} style={{ position: "absolute", left: 280 + Math.cos(a) * 200 - 42, top: 230 + Math.sin(a) * 170 - 42, width: 84, height: 84, borderRadius: "50%", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 44, boxShadow: "0 12px 30px rgba(5,9,19,0.3)", transform: `scale(${p.toFixed(3)})` }}>
                  {e}
                </div>
              );
            })}
            <div style={{ position: "absolute", left: 280 - 110, top: 230 - 50, width: 220, height: 100, borderRadius: 50, background: PAL.amber, display: "flex", alignItems: "center", justifyContent: "center", ...TYPE.display(30, 700, "#3d2600"), boxShadow: "0 0 40px rgba(255,181,71,0.6)" }}>
              Mind map
            </div>
          </div>
        </At>
      )}
      <Svg>
        <Burst t={t} at={quizzes - 0.05} x={960} y={470} color={PAL.sky} rays={14} r0={60} r1={320} salt={11} />
      </Svg>
    </AbsoluteFill>
  );
}

/* ───────────────────────────── the Study Room ───────────────────────────── */

function StudyRoom({ t, better, studyRoom, friends, chat, share, challenge, rightThere, help }: { t: number; better: number; studyRoom: number; friends: number; chat: number; share: number; challenge: number; rightThere: number; help: number }) {
  const warm = span(t, better - 0.3, better + 0.5, EASE.move);
  const ringIn = (k: number) => span(t, friends - 0.6 + k * 0.1, friends + 0.1 + k * 0.1, EASE.arrive);
  const center = { x: 960, y: 500 };
  const seat = (k: number) => {
    const a = (k / FRIENDS.length) * Math.PI * 2 - Math.PI / 2 + Math.sin(t * 0.4) * 0.03;
    return { x: center.x + Math.cos(a) * 520, y: center.y + Math.sin(a) * 300 };
  };
  const rayaIn = span(t, rightThere - 0.1, rightThere + 0.5, EASE.arrive);
  return (
    <AbsoluteFill style={{ opacity: warm }}>
      <Field from="#1e3a8a" to="#6d28d9" angle={135} light="rgba(255,181,71,0.25)" lightAt={[20, 85]} />
      <Motes t={t} count={30} seed={5} color="#ffe6c4" opacity={0.4} />
      {/* the room: a portal opening */}
      <Svg>
        {(() => {
          const p = span(t, better - 0.1, studyRoom + 0.4, EASE.arrive);
          return <ellipse cx={center.x} cy={center.y} rx={mix(40, 640, p)} ry={mix(20, 380, p)} fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.35)" strokeWidth={3} strokeDasharray="10 14" strokeDashoffset={-t * 30} />;
        })()}
        {/* friends linked */}
        {FRIENDS.map((_, k) => {
          const a = seat(k);
          const b = seat((k + 1) % FRIENDS.length);
          return <Draw key={k} d={`M${a.x} ${a.y} L${b.x} ${b.y}`} p={span(t, friends + 0.2 + k * 0.08, friends + 0.6 + k * 0.08)} stroke="rgba(255,255,255,0.3)" width={3} />;
        })}
        {/* documents passing */}
        {[0, 2, 3].map((k, j) => {
          const a = seat(k);
          const b = seat((k + 2) % FRIENDS.length);
          const p = span(t, share + 0.1 + j * 0.25, share + 0.9 + j * 0.25, EASE.move);
          return p > 0 && p < 1 ? <Draw key={k} d={`M${a.x} ${a.y} Q ${center.x} ${center.y - 200} ${b.x} ${b.y}`} p={p} stroke={PAL.amber} width={4} glow={PAL.amber} /> : null;
        })}
        <Pulse t={t} at={rightThere + 0.1} x={center.x} y={center.y} color={PAL.cyan} r0={100} r1={480} width={4} />
        <Pulse t={t} at={help} x={center.x} y={center.y} color={PAL.white} r0={100} r1={560} width={3} dur={1.1} />
        <Pulse t={t} at={help + 0.55} x={center.x} y={center.y} color={PAL.white} r0={100} r1={560} width={3} dur={1.1} />
      </Svg>
      {FRIENDS.map((f, k) => {
        const s = seat(k);
        const p = ringIn(k);
        return (
          <At key={f.i} x={mix(center.x, s.x, p)} y={mix(center.y, s.y, p)} style={tilt({ s: mix(0.3, 1, p), o: p })}>
            <div style={{ textAlign: "center" }}>
              <div style={{ width: 120, height: 120, borderRadius: "50%", background: f.c, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", ...TYPE.display(44, 700, "#fff"), boxShadow: `0 0 0 6px rgba(255,255,255,0.25), 0 20px 50px ${f.c}88` }}>{f.i}</div>
              <div style={{ ...TYPE.display(26, 600, "rgba(255,255,255,0.9)"), marginTop: 10 }}>{f.name}</div>
            </div>
          </At>
        );
      })}
      {/* the chat */}
      {[
        { k: 1, text: "sin(150°) is positive?", dx: 60, dy: -120 },
        { k: 4, text: "Second quadrant!", dx: -40, dy: -150 },
        { k: 2, text: "Let's test each other 🔥", dx: -260, dy: 30 },
      ].map((b, j) => {
        const s = seat(b.k);
        const p = envelope(t, chat + j * 0.3, chat + 0.25 + j * 0.3, challenge - 0.2, challenge + 0.1, EASE.arrive);
        return p > 0 ? (
          <div key={j} style={{ position: "absolute", left: s.x + b.dx, top: s.y + b.dy, ...tilt({ s: mix(0.6, 1, p), o: p }), transformOrigin: "0 100%" }}>
            <div style={{ padding: "16px 24px", borderRadius: "24px 24px 24px 6px", background: "#fff", ...TYPE.display(28, 600), boxShadow: "0 14px 40px rgba(5,9,19,0.3)", whiteSpace: "nowrap" }}>{b.text}</div>
          </div>
        ) : null;
      })}
      {/* the challenge: a race */}
      {(() => {
        const p = envelope(t, challenge - 0.1, challenge + 0.35, rightThere + 0.1, rightThere + 0.4, EASE.arrive);
        if (p <= 0) return null;
        const race = span(t, challenge + 0.2, rightThere, EASE.move);
        return (
          <At x={center.x} y={center.y} style={tilt({ s: mix(0.7, 1, p), o: p })}>
            <Card w={620} style={{ padding: "28px 34px" }}>
              <div style={{ ...TYPE.display(32, 700), marginBottom: 14 }}>🏆 Squad standings</div>
              {[["Léa", 0.92, "#2f7fe0"], ["You", 0.86, "#db2777"], ["Noah", 0.7, "#16a34a"]].map(([n, v, c]) => (
                <div key={n as string} style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 12 }}>
                  <span style={{ ...TYPE.display(26, 600), width: 90 }}>{n as string}</span>
                  <div style={{ flex: 1, height: 18, borderRadius: 9, background: "#eef2f7", overflow: "hidden" }}>
                    <div style={{ width: `${(race * (v as number) * 100).toFixed(1)}%`, height: "100%", background: c as string, borderRadius: 9 }} />
                  </div>
                </div>
              ))}
            </Card>
          </At>
        );
      })()}
      {/* Raya, in the middle of them */}
      {rayaIn > 0 && (
        <At x={center.x} y={center.y} style={tilt({ s: mix(0.4, 1, rayaIn), o: rayaIn })}>
          <div style={{ width: 200, height: 200, borderRadius: "50%", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 90px rgba(56,225,255,0.7)" }}>
            <RayaMark size={150} turn={(t - rightThere) * 40} />
          </div>
        </At>
      )}
      {rayaIn > 0 && (
        <At x={center.x} y={center.y + 190} style={{ opacity: span(t, help, help + 0.4) }}>
          <Chip bg="#ffffff" tone={PAL.blue} style={{ fontSize: 30 }}>Ask <span style={{ fontFamily: "Instrument Serif", fontWeight: 700 }}>Raya</span></Chip>
        </At>
      )}
      <At x={960} y={985}>
        <Spoken id="raya-5" t={t} phrases={[0, 1]} size={56} color="#fff" accent={["Study", "Room"]} accentColor={PAL.amber} out={chat - 0.45} maxWidth={1800} />
      </At>
      <At x={960} y={985}>
        <Spoken id="raya-5" t={t} phrases={[2, 3]} size={56} color="#fff" accent={["challenge"]} accentColor={PAL.amber} out={rightThere - 0.45} maxWidth={1800} />
      </At>
      <At x={960} y={985}>
        <Spoken id="raya-5" t={t} phrases={[4, 5]} size={56} color="#fff" accent={["help"]} accentColor={PAL.cyan} out={MUSIC.warm - 0.2} maxWidth={1800} />
      </At>
      <Glow x={center.x} y={center.y} r={420} color="rgba(255,255,255,0.10)" opacity={rayaIn} />
    </AbsoluteFill>
  );
}

