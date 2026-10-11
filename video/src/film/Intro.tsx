import { AbsoluteFill } from "remotion";
import { BluestiftMark } from "../Marks";
import { EASE, envelope, keys, keysOf, mix, span, steady, useTime } from "../motion";
import { line, MUSIC, phrase, wordAt } from "../timeline";
import { At, Burst, Camera, Card, Draw, Field, Glow, Motes, PAL, Pulse, Spoken, Svg, TYPE } from "./kit";

/**
 * Two orbits in the dark — a student's and a teacher's — each with its own
 * assistant (generic, unbranded: the owner's rule for this opening), turning
 * side by side and never crossing. A wall comes down between them on "never
 * meet". On "Bluestift" the mark lands between the orbits; on "finally" the
 * two lights travel in and meet inside it, and the white of the next scene
 * opens out of that meeting.
 */

type Orbit = { cx: number; cy: number; rx: number; ry: number; rot: number };
const orbitPath = ({ cx, cy, rx, ry }: Orbit) => `M ${cx - rx} ${cy} A ${rx} ${ry} 0 1 0 ${cx + rx} ${cy} A ${rx} ${ry} 0 1 0 ${cx - rx} ${cy}`;
function onOrbit(o: Orbit, a: number) {
  const r = (o.rot * Math.PI) / 180;
  const ex = Math.cos(a) * o.rx;
  const ey = Math.sin(a) * o.ry;
  return { x: o.cx + ex * Math.cos(r) - ey * Math.sin(r), y: o.cy + ex * Math.sin(r) + ey * Math.cos(r) };
}

/** A generic AI assistant: a sparkle and a few lines of an answer. No brand. */
function Assistant({ tone, p, side }: { tone: string; p: number; side: "left" | "right" }) {
  if (p <= 0) return null;
  return (
    <div style={{ opacity: p, transform: `translateY(${((1 - p) * 30).toFixed(1)}px) scale(${(0.9 + 0.1 * p).toFixed(3)})`, transformOrigin: side === "left" ? "0% 100%" : "100% 100%" }}>
      <Card dark w={330} style={{ padding: "20px 22px", borderRadius: 22 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <svg width="26" height="26" viewBox="0 0 24 24">
            <path d="M12 2l2.2 6.6L21 11l-6.8 2.4L12 20l-2.2-6.6L3 11l6.8-2.4z" fill={tone} />
          </svg>
          <span style={TYPE.display(20, 600, "#cfd8e8")}>AI assistant</span>
        </div>
        {[0.92, 0.78, 0.55].map((w, i) => (
          <div key={i} style={{ marginTop: 14, height: 11, borderRadius: 6, width: `${w * 100 * Math.min(1, p * 1.4 - i * 0.15)}%`, background: "rgba(255,255,255,0.16)" }} />
        ))}
      </Card>
    </div>
  );
}

export function FilmIntro() {
  const t = useTime();
  if (t > MUSIC.theme + 0.8) return null;

  const hi = line("intro-0").start;
  const students = line("intro-1").start;
  const teachers = line("intro-2").start;
  const never = line("intro-3").start;
  const neverWord = wordAt("intro-3", "never");
  const intro = line("intro-4").start;
  const bluestiftWord = wordAt("intro-4", "Bluestift");
  const platform = phrase("intro-4", 1).start;
  const finallyWord = wordAt("intro-4", "finally");

  // The orbits: apart, held apart by the wall, then brought together.
  const apart = span(t, never, never + 0.8, EASE.move);
  const together = span(t, intro, bluestiftWord + 0.4, EASE.move);
  const left: Orbit = { cx: mix(mix(600, 540, apart), 960, together), cy: 560, rx: 300, ry: 118, rot: mix(-16, -28, together) };
  const right: Orbit = { cx: mix(mix(1320, 1380, apart), 960, together), cy: 560, rx: 300, ry: 118, rot: mix(16, 28, together) };
  const drawn = span(t, 0.3, 2.6, EASE.move);
  const bright = keys(t, [[0, 0.5], [hi + 0.2, 0.32], [students - 0.4, 0.32], [students, 1]]);

  // Each light runs its orbit; on "finally" both leave it for the centre.
  const meet = span(t, finallyWord - 0.3, finallyWord + 0.45, EASE.move);
  const sP = onOrbit(left, t * 0.9 + 2.2);
  const tP = onOrbit(right, -t * 0.9 + 0.9);
  const student = { x: mix(sP.x, 960, meet), y: mix(sP.y, 560, meet) };
  const teacher = { x: mix(tP.x, 960, meet), y: mix(tP.y, 560, meet) };

  // The wall: down on "never", gone into sparks on "So let us".
  const wall = span(t, never + 0.05, neverWord + 0.2, EASE.arrive) * (1 - span(t, intro - 0.1, intro + 0.5, EASE.soft));
  const flash = envelope(t, MUSIC.theme - 0.45, MUSIC.theme - 0.05, MUSIC.theme + 0.3, MUSIC.theme + 0.7);

  const cam = steady(t, (u) =>
    keysOf(u, [
      [0, { x: 0, y: 30, zoom: 0.92 }],
      [hi, { x: 0, y: 0, zoom: 1 }],
      [students - 0.2, { x: 0, y: 0, zoom: 1 }],
      [students + 0.5, { x: -210, y: -20, zoom: 1.16 }],
      [teachers - 0.1, { x: -210, y: -20, zoom: 1.16 }],
      [teachers + 0.5, { x: 210, y: -20, zoom: 1.16 }],
      [never - 0.1, { x: 210, y: -20, zoom: 1.16 }],
      [never + 0.5, { x: 0, y: 0, zoom: 1 }],
      [bluestiftWord, { x: 0, y: 0, zoom: 1.04 }],
      [finallyWord + 0.4, { x: 0, y: 0, zoom: 1.35 }],
      [MUSIC.theme, { x: 0, y: 0, zoom: 1.6 }],
    ]),
  );

  const markIn = span(t, bluestiftWord - 0.1, bluestiftWord + 0.5, EASE.arrive);

  return (
    <AbsoluteFill>
      <Field from={PAL.ink} to={PAL.navy} angle={170} light="rgba(139,92,246,0.22)" lightAt={[50, 0]} />
      <Motes t={t} count={70} seed={1} color="#cfe2ff" opacity={0.55} />
      <Camera x={cam.x} y={cam.y} zoom={cam.zoom}>
        <Glow x={student.x} y={student.y} r={170} color="rgba(75,155,255,0.55)" opacity={bright} />
        <Glow x={teacher.x} y={teacher.y} r={170} color="rgba(255,181,71,0.5)" opacity={bright} />
        <Svg>
          <g transform={`rotate(${left.rot} ${left.cx} ${left.cy})`} opacity={0.35 + 0.65 * bright}>
            <Draw d={orbitPath(left)} p={drawn} stroke={PAL.electric} width={2.5} glow={PAL.electric} />
          </g>
          <g transform={`rotate(${right.rot} ${right.cx} ${right.cy})`} opacity={0.35 + 0.65 * bright}>
            <Draw d={orbitPath(right)} p={drawn} stroke={PAL.amber} width={2.5} glow={PAL.amber} />
          </g>
          {/* the wall between them */}
          {wall > 0 && (
            <>
              <line x1={960} y1={mix(-40, -40, wall)} x2={960} y2={mix(-40, 1120, wall)} stroke={PAL.coral} strokeWidth={5} opacity={0.95} />
              <line x1={960} y1={-40} x2={960} y2={mix(-40, 1120, wall)} stroke={PAL.coral} strokeWidth={26} opacity={0.18} style={{ filter: "blur(10px)" }} />
            </>
          )}
          <Burst t={t} at={intro - 0.05} x={960} y={560} color={PAL.coral} rays={26} r0={10} r1={520} width={2} dur={0.8} salt={4} />
          <circle cx={student.x} cy={student.y} r={16 * drawn} fill={PAL.white} />
          <circle cx={student.x} cy={student.y} r={30 * drawn} fill="none" stroke={PAL.electric} strokeWidth={3} />
          <circle cx={teacher.x} cy={teacher.y} r={16 * drawn} fill={PAL.white} />
          <circle cx={teacher.x} cy={teacher.y} r={30 * drawn} fill="none" stroke={PAL.amber} strokeWidth={3} />
          <Burst t={t} at={bluestiftWord - 0.05} x={960} y={560} color={PAL.sky} rays={20} r0={110} r1={420} width={3} salt={9} />
          <Pulse t={t} at={bluestiftWord} x={960} y={560} color={PAL.sky} r0={90} r1={360} />
          <Pulse t={t} at={finallyWord + 0.35} x={960} y={560} color={PAL.sky} r0={110} r1={700} width={4} dur={1.1} />
        </Svg>

        {/* the two assistants, beside their orbits */}
        <div style={{ position: "absolute", left: sP.x - 40, top: sP.y - 260 }}>
          <Assistant tone={PAL.electric} side="left" p={span(t, students + 0.15, students + 0.7, EASE.arrive) * (1 - span(t, never + 0.4, never + 0.9))} />
        </div>
        <div style={{ position: "absolute", left: tP.x - 290, top: tP.y - 260 }}>
          <Assistant tone={PAL.amber} side="right" p={span(t, teachers + 0.15, teachers + 0.7, EASE.arrive) * (1 - span(t, never + 0.4, never + 0.9))} />
        </div>

        {markIn > 0 && (
          <At x={960} y={560} style={{ opacity: markIn, transform: `scale(${(0.6 + 0.4 * markIn).toFixed(3)})`, filter: markIn < 0.97 ? `blur(${((1 - markIn) * 14).toFixed(1)}px)` : undefined }}>
            <div style={{ width: 210, height: 210, borderRadius: "50%", background: "radial-gradient(circle, #ffffff 0%, #e6f0ff 70%)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 80px rgba(159,214,255,0.6)" }}>
              <BluestiftMark size={150} />
            </div>
          </At>
        )}
      </Camera>

      {/* the words, outside the camera */}
      <At x={960} y={540}>
        <Spoken id="intro-0" t={t} size={92} color={PAL.white} accent={["Liam"]} accentColor={PAL.sky} out={students - 0.45} maxWidth={1300} />
      </At>
      <div style={{ position: "absolute", left: 150, top: 790 }}>
        <Spoken id="intro-1" t={t} size={104} color={PAL.white} accent={["their"]} accentColor={PAL.sky} out={teachers - 0.3} align="left" />
      </div>
      <div style={{ position: "absolute", right: 150, top: 790 }}>
        <Spoken id="intro-2" t={t} size={104} color={PAL.white} accent={["theirs"]} accentColor={PAL.amber} out={never - 0.3} align="right" />
      </div>
      <At x={960} y={170}>
        <Spoken id="intro-3" t={t} size={112} color={PAL.white} accent={["never"]} accentColor={PAL.coral} out={intro - 0.2} maxWidth={1700} />
      </At>
      <At x={960} y={900}>
        <Spoken id="intro-4" t={t} phrases={[0]} size={76} color={PAL.white} accent={["Bluestift"]} accentColor={PAL.sky} out={platform - 0.15} maxWidth={1700} />
      </At>
      <At x={960} y={900}>
        <Spoken id="intro-4" t={t} phrases={[1]} size={96} color={PAL.white} accent={["finally"]} accentColor={PAL.sky} out={MUSIC.theme - 0.35} maxWidth={1700} />
      </At>

      {flash > 0 && <AbsoluteFill style={{ background: "radial-gradient(circle at 50% 52%, #ffffff, rgba(255,255,255,0.6) 40%, transparent 75%)", opacity: flash }} />}
    </AbsoluteFill>
  );
}
