import { AbsoluteFill } from "remotion";
import { FocusShot, GuidedShot } from "@/components/site/ProductShots";
import { crossing, Flock, type Bird } from "../Birds";
import { StudentAI, TeacherAI } from "../Elsewhere";
import { EASE, envelope, handheld, keys, keysOf, mix, span, useTime } from "../motion";
import { Plate, World, type Pose } from "../Plate";
import { TexturePlate } from "../Texture";
import { line, MUSIC, phrase, wordAt } from "../timeline";

/**
 * Liam's hook, as a picture.
 *
 * An establishing shot of the sky and the birds while he says hello. Then the
 * two AIs, each in its own world: the student's on the left in daylight, the
 * teacher's on the right at night — "and the two never meet" is the seam
 * between two themes, and each side's attempt to reach the other dies on it.
 * They are the assistants each already uses (src/Elsewhere.tsx), not ours:
 * drawn as Raya, the problem was being illustrated with its own answer.
 *
 * On "finally do" the seam breaks: the two screens slide together and become
 * Bluestift's — the student's Raya, the teacher's instructions to her — a link
 * lights up between them and carries traffic both ways — and then the camera
 * pulls back and that single link turns out to be one edge of a network. The
 * rest of the product arrives around them, every node wired to the same
 * centre, until the whole ecosystem collapses into the light that becomes the
 * Bluestift mark on the music's first theme.
 */

const flockIn = crossing({ from: 0.4, duration: 13, count: 6, top: 210, spread: 300, size: 46, rise: -90, salt: 3 });

/** The ecosystem, once the two worlds are one: where each surface sits. */
const RING: { name: string; x: number; y: number; s: number }[] = [
  { name: "kernel-dark", x: 0, y: -380, s: 0.28 },
  { name: "socratic-light", x: -640, y: -330, s: 0.2 },
  { name: "dashboard-light", x: 650, y: -330, s: 0.22 },
  { name: "room-light", x: -660, y: 350, s: 0.22 },
  { name: "tools-dark", x: 660, y: 340, s: 0.19 },
  { name: "return-light", x: 0, y: 400, s: 0.22 },
];

export function Intro() {
  const t = useTime();
  if (t > MUSIC.theme + 1.2) return null;

  const students = line("intro-1").start;
  const teachers = line("intro-2").start;
  const neverMeet = line("intro-3").start;
  const introduce = line("intro-4").start;
  const platform = phrase("intro-4", 1).start;
  const meet = wordAt("intro-4", "finally") + 0.15;

  // The escaping birds leave from where the two screens touch.
  const burst: Bird[] = [
    { from: meet + 0.1, to: meet + 3.6, start: [960, 560], end: [420, -80], size: 40, amp: 10, period: 1.2, arc: 40, depth: 0.95, seed: 11 },
    { from: meet + 0.25, to: meet + 3.9, start: [960, 580], end: [1540, -60], size: 34, amp: 12, period: 1.4, arc: 70, depth: 0.8, seed: 12 },
    { from: meet + 0.45, to: meet + 4.3, start: [960, 540], end: [1180, -120], size: 26, amp: 8, period: 1.1, arc: 20, depth: 0.55, seed: 13 },
    { from: meet + 0.6, to: meet + 4.6, start: [960, 600], end: [700, -120], size: 22, amp: 9, period: 1.5, arc: 30, depth: 0.4, seed: 14 },
  ];

  /* ── the ecosystem: the link becomes a network, then a single light ── */
  // Two seconds between "finally do" and the downbeat the mark lands on, so
  // the network has to build in one breath and collapse on the next.
  const linked = span(t, meet - 0.05, meet + 0.35, EASE.soft);
  const eco = span(t, meet + 0.3, meet + 1.2, EASE.move);
  const converge = span(t, MUSIC.theme - 0.8, MUSIC.theme - 0.05, EASE.move);
  const nodesOut = span(t, MUSIC.theme - 0.6, MUSIC.theme - 0.05, EASE.soft);
  /** A node's resting place, pulled in as everything collapses into the mark. */
  const drawIn = (v: number) => v * (1 - converge * 0.9);

  const side = (sign: number) =>
    keysOf(t, [
      [(sign < 0 ? students : teachers) - 0.35, { x: sign * 470, y: 150, ry: sign * 16, s: 0.9, o: 0, focus: 0 }],
      [(sign < 0 ? students : teachers) + 0.75, { x: sign * 470, y: 0, ry: sign * 16, s: 0.9, o: 1, focus: 1 }],
      [neverMeet + 0.1, { x: sign * 470, y: 0, ry: sign * 16, s: 0.9, o: 1, focus: 1 }],
      [introduce - 0.1, { x: sign * 520, y: 6, ry: sign * 24, s: 0.88, o: 1, focus: 1 }],
      [platform, { x: sign * 470, y: 0, ry: sign * 10, s: 0.88, o: 1, focus: 1 }],
      [meet, { x: sign * 318, y: 0, ry: 0, s: 0.84, o: 1, focus: 1 }],
      [meet + 0.3, { x: sign * 318, y: 0, ry: 0, s: 0.84, o: 1, focus: 1 }],
    ]);
  /** Where a screen is, once the ring has it. */
  const inRing = (p: ReturnType<typeof side>, rx: number, ry: number, rs: number): Pose => ({
    x: mix(p.x, drawIn(rx), eco),
    y: mix(p.y, drawIn(ry), eco),
    s: mix(p.s, rs * (1 - converge * 0.7), eco),
    ry: p.ry,
    o: p.o * (1 - nodesOut),
    focus: p.focus,
  });
  const student = inRing(side(-1), -730, 25, 0.38);
  const teacher = inRing(side(1), 730, 25, 0.38);

  // The night half: in on "Teachers have theirs", out as they come together.
  const night = Math.min(span(t, teachers - 0.3, teachers + 0.9, EASE.soft), 1 - span(t, platform + 0.2, meet + 0.2, EASE.soft));
  // Once there is only one world, both screens are Bluestift's, and the
  // teacher's takes the day's colours. The new screen dissolves in OVER the old
  // one, which stays opaque until it is covered: two plates each at half
  // opacity let the sky through both, and the pair went pale mid-change.
  const daylight = span(t, meet - 0.25, meet + 0.55, EASE.soft);
  const before = daylight < 0.999 ? 1 : 0;
  // A hairline of light down the seam while they are apart.
  const seam = envelope(t, neverMeet - 0.2, neverMeet + 0.6, platform, meet - 0.1);
  // Where they touch, the light that becomes the mark.
  const bloom = Math.max(
    envelope(t, meet - 0.2, meet + 0.35, meet + 0.5, MUSIC.theme - 1.0) * 0.32,
    envelope(t, MUSIC.theme - 1.0, MUSIC.theme - 0.05, MUSIC.theme + 0.1, MUSIC.theme + 1.1) * 0.95,
  );

  const drift = handheld(t);
  const camera = {
    x: drift.x,
    y: keys(t, [[0, -46], [students, 0], [meet + 1.2, 0], [MUSIC.theme, -10]]) + drift.y,
    zoom: keys(t, [
      [0, 1.07],
      [students, 1],
      [introduce, 0.97],
      [meet, 1.03],
      // Back, far enough that the ring is one object rather than eight.
      [meet + 1.25, 0.8],
      [MUSIC.theme - 0.2, 0.86],
      [MUSIC.theme + 0.5, 1.12],
    ]),
    roll: drift.r,
  };

  /* ── what each side tries to send while the seam is still there ── */
  const blocked = [0, 1, 2, 3].map((i) => {
    const sign = i % 2 === 0 ? -1 : 1;
    const run = span(t, neverMeet + 0.1 + i * 0.34, neverMeet + 0.85 + i * 0.34, EASE.linear);
    return { sign, run, x: mix(sign * 430, sign * 46, run), fade: Math.sin(Math.min(1, run) * Math.PI) * (run < 1 ? 1 : 0) };
  });

  /* ── the network, once there is one ── */
  const nodes = [
    { x: student.x ?? 0, y: student.y ?? 0, at: 0 },
    { x: teacher.x ?? 0, y: teacher.y ?? 0, at: 0 },
    ...RING.map((r, i) => ({ x: drawIn(r.x), y: drawIn(r.y), at: 0.12 + i * 0.07 })),
  ];

  return (
    <AbsoluteFill>
      {/* Night, on the teacher's side of the frame. */}
      {night > 0.001 && (
        <AbsoluteFill
          style={{
            opacity: night,
            background: "linear-gradient(90deg, transparent 0%, transparent 48.5%, rgba(11,17,34,0.96) 51.5%, #0b1122 100%)",
          }}
        />
      )}
      {night > 0.001 && (
        <div
          style={{
            position: "absolute",
            left: "52%",
            right: 0,
            top: 0,
            bottom: 0,
            opacity: night,
            background: "radial-gradient(ellipse 70% 60% at 60% 45%, rgba(79,70,229,0.22), transparent 70%)",
          }}
        />
      )}

      <Flock birds={flockIn} color="#2f7fe0" farColor="#7aa7e3" />

      <World camera={camera}>
        {/* The wiring, under the screens it connects. */}
        {linked > 0.001 && nodesOut < 1 && (
          <svg width={1920} height={1080} style={{ position: "absolute", inset: 0, overflow: "visible" }}>
            <defs>
              <radialGradient id="introHub">
                <stop offset="0%" stopColor="rgba(255,255,255,0.95)" />
                <stop offset="45%" stopColor="rgba(160,205,255,0.5)" />
                <stop offset="100%" stopColor="rgba(160,205,255,0)" />
              </radialGradient>
            </defs>
            {nodes.map((n, i) => {
              // Each edge draws itself from the centre outwards, in turn.
              const draw = i < 2 ? linked : span(t, meet + 0.35 + n.at * 1.9, meet + 0.85 + n.at * 1.9, EASE.move);
              if (draw <= 0.001) return null;
              const x = 960 + n.x;
              const y = 540 + n.y;
              const len = Math.hypot(n.x, n.y) || 1;
              // Traffic, both ways: what a shared layer looks like from outside.
              const phase = (t * 0.55 + i * 0.37) % 1;
              const back = (t * 0.55 + i * 0.37 + 0.5) % 1;
              const out = 1 - nodesOut;
              return (
                <g key={i} opacity={out}>
                  <line
                    x1={960}
                    y1={540}
                    x2={mix(960, x, draw)}
                    y2={mix(540, y, draw)}
                    stroke={i < 2 ? "rgba(120,175,245,0.75)" : "rgba(120,175,245,0.5)"}
                    strokeWidth={i < 2 ? 3 : 2}
                    strokeLinecap="round"
                  />
                  {draw > 0.98 && (
                    <>
                      <circle cx={mix(960, x, phase)} cy={mix(540, y, phase)} r={5} fill="rgba(255,255,255,0.95)" />
                      <circle cx={mix(x, 960, back)} cy={mix(y, 540, back)} r={4} fill="rgba(90,160,240,0.9)" />
                    </>
                  )}
                  <circle cx={x} cy={y} r={Math.min(9, len * 0.02)} fill="rgba(255,255,255,0.9)" opacity={draw} />
                </g>
              );
            })}
            <circle cx={960} cy={540} r={mix(60, 150, eco)} fill="url(#introHub)" opacity={(0.5 + 0.5 * eco) * (1 - nodesOut)} />
          </svg>
        )}

        {/* The rest of the product, arriving around the two it started with. */}
        {eco > 0.001 &&
          nodesOut < 1 &&
          RING.map((r, i) => {
            const k = span(t, meet + 0.4 + i * 0.09, meet + 1.1 + i * 0.09, EASE.arrive);
            return (
              <TexturePlate
                key={r.name}
                name={r.name}
                pose={{
                  x: drawIn(r.x) * k,
                  y: drawIn(r.y) * k,
                  z: mix(-700, 0, k),
                  s: r.s * (1 - converge * 0.7),
                  o: k * (1 - nodesOut),
                  focus: mix(0.25, 1, k),
                }}
              />
            );
          })}

        <Plate width={760} pose={{ ...student, o: (student.o ?? 1) * before }} crop={{ top: 0, height: 470 }}>
          {() => <StudentAI t={t} from={students} />}
        </Plate>
        {daylight > 0.001 && (
          <Plate width={760} pose={{ ...student, o: (student.o ?? 1) * daylight }} crop={{ top: 0, height: 470 }} ms={1700}>
            {(th) => <GuidedShot theme={th} />}
          </Plate>
        )}
        <Plate dark width={760} pose={{ ...teacher, o: (teacher.o ?? 1) * before }} crop={{ top: 0, height: 470 }}>
          {() => <TeacherAI t={t} from={teachers} />}
        </Plate>
        {daylight > 0.001 && (
          <Plate width={760} pose={{ ...teacher, o: (teacher.o ?? 1) * daylight }} crop={{ top: 0, height: 470 }} ms={4000}>
            {(th) => <FocusShot theme={th} />}
          </Plate>
        )}
      </World>

      {seam > 0.001 && (
        <>
          <div
            style={{
              position: "absolute",
              left: 959,
              width: 2,
              top: 170,
              height: 740,
              opacity: seam * 0.9,
              background: "linear-gradient(180deg, transparent, rgba(255,255,255,0.95) 30%, rgba(255,255,255,0.95) 70%, transparent)",
              boxShadow: "0 0 24px 6px rgba(160,200,255,0.55)",
            }}
          />
          {/* Each side reaches for the other and dies on the seam. */}
          {blocked.map((b, i) =>
            b.fade > 0.01 ? (
              <div
                key={i}
                style={{
                  position: "absolute",
                  left: 960 + b.x - 7,
                  top: 470 + i * 34,
                  width: 14,
                  height: 14,
                  borderRadius: "50%",
                  opacity: b.fade * seam,
                  background: b.sign < 0 ? "rgba(47,127,224,0.95)" : "rgba(167,139,250,0.95)",
                  boxShadow: `0 0 16px 4px ${b.sign < 0 ? "rgba(47,127,224,0.45)" : "rgba(167,139,250,0.45)"}`,
                  transform: `scale(${(1 - b.run * 0.45).toFixed(3)})`,
                }}
              />
            ) : null,
          )}
        </>
      )}
      {bloom > 0.001 && (
        <AbsoluteFill
          style={{
            opacity: bloom,
            // It rises from where the screens touch to where the mark will be.
            background: `radial-gradient(circle at 50% ${keys(t, [[meet, 50], [MUSIC.theme, 35]], EASE.soft).toFixed(2)}%, rgba(255,255,255,1) 0%, rgba(240,247,255,0.85) 18%, rgba(220,235,252,0.35) 42%, transparent 70%)`,
          }}
        />
      )}

      <Flock birds={burst} color="#2f7fe0" />
    </AbsoluteFill>
  );
}
