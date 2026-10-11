import type { ReactNode } from "react";
import { AbsoluteFill } from "remotion";
import { BluestiftMark } from "../Marks";
import { EASE, envelope, mix, span, useTime } from "../motion";
import { line, MUSIC, phrase, wordAt } from "../timeline";
import { At, Burst, Card, Draw, Field, PAL, Pulse, RayaMark, Reveal, Spoken, Svg, tilt, TYPE } from "./kit";

/**
 * "Bluestift isn't just an AI tool, it's a whole ecosystem. And the people
 * in it stay in control."
 *
 * Dawn after the Kernel's night. The ecosystem as a little solar system round
 * the mark; then one promise per beat, each with a drawing that acts it out:
 * the @ struck off, a key that opens and is cut anew, ads popped, data that
 * is not for sale, a switch that only turns on with a yes and a shield for
 * under-eighteens, a barrier between a minor's writing and training, a
 * download and a bin, and the list of who we work with, unrolled.
 */

const GREEN = "#10b981";

function Toggle({ on, size = 1 }: { on: number; size?: number }) {
  return (
    <div style={{ width: 220 * size, height: 120 * size, borderRadius: 999, background: on > 0.5 ? GREEN : "#cbd5e1", padding: 12 * size, boxSizing: "border-box", boxShadow: on > 0.5 ? `0 0 60px ${GREEN}88` : "inset 0 2px 6px rgba(0,0,0,0.15)" }}>
      <div style={{ width: 96 * size, height: 96 * size, borderRadius: "50%", background: "#fff", transform: `translateX(${(on * 100 * size).toFixed(1)}px)`, boxShadow: "0 6px 16px rgba(0,0,0,0.25)" }} />
    </div>
  );
}

/** One promise: a tinted field, a drawing on the left, the line on the right. */
function Beat({ t, a, b, tint, art, children }: { t: number; a: number; b: number; tint: string; art: ReactNode; children: ReactNode }) {
  if (t < a - 0.02 || t >= b) return null;
  const punch = 1 + 0.05 * (1 - span(t, a, a + 0.35, EASE.arrive));
  return (
    <AbsoluteFill style={{ background: tint }}>
      <At x={560} y={500} style={{ transform: `scale(${punch.toFixed(3)})` }}>{art}</At>
      <div style={{ position: "absolute", left: 1020, top: 300, width: 820 }}>{children}</div>
    </AbsoluteFill>
  );
}

export function FilmControl() {
  const t = useTime();
  const from = MUSIC.full;
  const to = line("outro-0").start - 1.6;
  if (t < from || t > to + 0.9) return null;

  const tool = line("control-0").start;
  const eco = phrase("control-0", 1).start;
  const people = line("control-1").start;
  const email = line("control-2").start;
  const key = phrase("control-2", 1).start;
  const replace = phrase("control-2", 2).start;
  const ads = line("control-3").start;
  const sell = phrase("control-3", 1).start;
  const analytics = line("control-4").start;
  const yes = wordAt("control-4", "yes");
  const under = phrase("control-4", 1).start;
  const minor = line("control-5").start;
  const adults = phrase("control-5", 1).start;
  const sw = wordAt("control-5", "switch");
  const download = line("control-6").start;
  const del = phrase("control-6", 1).start;
  const whenever = phrase("control-6", 2).start;
  const listed = line("control-7").start;

  return (
    <Reveal t={t} at={from} dur={0.9} x={50} y={55}>
      <Field from="#fffaf0" to="#e9f2ff" angle={180} light="rgba(255,214,140,0.65)" lightAt={[50, 100]} />

      {/* ── an AI tool → a whole ecosystem → people in control ── */}
      {t < email + 0.1 && <Ecosystem t={t} tool={tool} eco={eco} people={people} leave={email - 0.15} />}

      {/* ── no email: a key, cut anew ── */}
      <Beat
        t={t}
        a={email}
        b={ads}
        tint="#f3f7ff"
        art={
          <div style={{ position: "relative", width: 700, height: 600 }}>
            <div style={{ position: "absolute", left: 120, top: 40, ...TYPE.heavy(300, "#94a3b8"), opacity: 1 - span(t, key - 0.3, key + 0.1), transform: `translateY(${(span(t, email + 0.6, key, EASE.leave) * 300).toFixed(1)}px) rotate(${(span(t, email + 0.6, key) * 30).toFixed(1)}deg)` }}>
              @
              <svg width={300} height={300} style={{ position: "absolute", left: -10, top: 30, overflow: "visible" }}>
                <Draw d="M10 260 L260 20" p={span(t, email + 0.25, email + 0.55)} stroke={PAL.coral} width={16} />
              </svg>
            </div>
            <svg width={700} height={600} style={{ position: "absolute", inset: 0, overflow: "visible" }}>
              {(() => {
                const cut = span(t, replace - 0.1, replace + 0.6, EASE.move);
                const teeth = cut > 0.5 ? "L420 300 L420 340 L450 340 L450 300 L480 300 L480 360 L510 360 L510 300" : "L420 300 L420 350 L450 350 L450 300 L490 300 L490 330 L520 330 L520 300";
                return (
                  <g transform={`translate(${mix(-200, 0, span(t, key - 0.1, key + 0.5, EASE.arrive))} 0) rotate(${(Math.sin(cut * Math.PI) * 180).toFixed(1)} 330 290)`} opacity={span(t, key - 0.1, key + 0.3)}>
                    <Draw d={`M200 290 A 70 70 0 1 1 200 291 M270 290 L540 290 ${teeth} L540 300`} p={span(t, key, key + 0.7)} stroke={PAL.amber} width={14} glow={PAL.amber} />
                  </g>
                );
              })()}
              <Pulse t={t} at={replace + 0.6} x={330} y={290} color={PAL.amber} r0={60} r1={320} width={5} />
            </svg>
            <div style={{ position: "absolute", left: 120, top: 470, padding: "14px 26px", borderRadius: 16, background: "#0b1220", ...TYPE.mono(34, "#ffd58a", 700), opacity: span(t, key + 0.4, key + 0.8), letterSpacing: "0.12em" }}>
              {span(t, replace, replace + 0.6) > 0.5 ? "K7QD-2MRX-9FWA" : "B4TN-8LHE-3ZPC"}
            </div>
          </div>
        }
      >
        <Spoken id="control-2" t={t} size={70} align="left" accent={["email", "key", "anytime"]} accentColor={PAL.blue} maxWidth={820} />
      </Beat>

      {/* ── no ads, data not for sale ── */}
      <Beat
        t={t}
        a={ads}
        b={analytics}
        tint="#fff4f2"
        art={
          <div style={{ position: "relative", width: 700, height: 600 }}>
            {[0, 1, 2].map((k) => {
              const p = span(t, ads - 0.05 + k * 0.08, ads + 0.25 + k * 0.08, EASE.arrive);
              const pop = span(t, ads + 0.45 + k * 0.08, ads + 0.6 + k * 0.08, EASE.leave);
              return (
                <div key={k} style={{ position: "absolute", left: 60 + k * 190, top: 40 + (k % 2) * 80, ...tilt({ s: p * (1 + pop * 0.5), o: p * (1 - pop), rz: (k - 1) * 8 }) }}>
                  <div style={{ width: 210, height: 150, borderRadius: 18, background: ["#fde047", "#f472b6", "#60a5fa"][k], display: "flex", alignItems: "center", justifyContent: "center", ...TYPE.heavy(70, "#1f2937"), boxShadow: "0 16px 40px rgba(0,0,0,0.2)" }}>AD</div>
                </div>
              );
            })}
            <svg width={700} height={600} style={{ position: "absolute", inset: 0, overflow: "visible" }}>
              {[0, 1, 2].map((k) => (
                <Burst key={k} t={t} at={ads + 0.45 + k * 0.08} x={165 + k * 190} y={115 + (k % 2) * 80} color={PAL.coral} rays={12} r0={30} r1={170} salt={k + 30} />
              ))}
            </svg>
            {/* data, with a price tag struck off */}
            <div style={{ position: "absolute", left: 200, top: 300, ...tilt({ o: span(t, sell - 0.2, sell + 0.2), y: (1 - span(t, sell - 0.2, sell + 0.3, EASE.arrive)) * 40 }) }}>
              <svg width={300} height={260} viewBox="0 0 300 260">
                <ellipse cx={120} cy={50} rx={100} ry={34} fill="#dbeafe" stroke={PAL.blue} strokeWidth={6} />
                <path d="M20 50 L20 190 A100 34 0 0 0 220 190 L220 50" fill="#dbeafe" stroke={PAL.blue} strokeWidth={6} />
                <path d="M20 100 A100 34 0 0 0 220 100 M20 145 A100 34 0 0 0 220 145" fill="none" stroke={PAL.blue} strokeWidth={6} />
                <g transform="translate(180 120) rotate(18)">
                  <rect x={0} y={0} width={110} height={70} rx={14} fill="#fff" stroke={PAL.coral} strokeWidth={6} />
                  <text x={55} y={50} textAnchor="middle" style={{ fontFamily: "Inter", fontWeight: 900, fontSize: 44, fill: PAL.coral }}>$</text>
                </g>
                <Draw d="M170 120 L300 220" p={span(t, sell + 0.6, sell + 0.9)} stroke={PAL.coral} width={12} />
              </svg>
            </div>
          </div>
        }
      >
        <Spoken id="control-3" t={t} size={110} align="left" accent={["never"]} accentColor={PAL.coral} maxWidth={820} />
      </Beat>

      {/* ── analytics on a yes, never under eighteen ── */}
      <Beat
        t={t}
        a={analytics}
        b={minor}
        tint="#f0fbf6"
        art={
          <div style={{ position: "relative", width: 700, height: 600 }}>
            <div style={{ position: "absolute", left: 60, top: 40 }}>
              <Card w={560} style={{ padding: "30px 34px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={TYPE.display(40, 700)}>Analytics</span>
                <Toggle on={span(t, yes - 0.05, yes + 0.25, EASE.move)} size={0.7} />
              </Card>
            </div>
            <div style={{ position: "absolute", left: 60, top: 260, ...tilt({ o: span(t, under - 0.2, under + 0.2), x: (1 - span(t, under - 0.2, under + 0.3, EASE.arrive)) * -40 }) }}>
              <Card w={560} style={{ padding: "30px 34px", display: "flex", alignItems: "center", justifyContent: "space-between", background: "#f8fafc" }}>
                <span style={TYPE.display(40, 700, "#64748b")}>Under 18</span>
                <div style={{ position: "relative" }}>
                  <Toggle on={0} size={0.7} />
                  <svg width={60} height={60} viewBox="0 0 16 16" style={{ position: "absolute", left: 50, top: 12 }}>
                    <path d="M5 7V5a3 3 0 0 1 6 0v2h.5A1.5 1.5 0 0 1 13 8.5v4A1.5 1.5 0 0 1 11.5 14h-7A1.5 1.5 0 0 1 3 12.5v-4A1.5 1.5 0 0 1 4.5 7H5Zm1.5 0h3V5a1.5 1.5 0 0 0-3 0v2Z" fill="#475569" />
                  </svg>
                </div>
              </Card>
            </div>
            <svg width={700} height={600} style={{ position: "absolute", inset: 0, overflow: "visible" }}>
              <Pulse t={t} at={yes + 0.2} x={520} y={110} color={GREEN} r0={40} r1={220} width={5} />
              <g transform="translate(560 440)" opacity={span(t, under + 0.4, under + 0.8)}>
                <Draw d="M0 -70 L60 -45 L60 10 C60 50 30 70 0 85 C-30 70 -60 50 -60 10 L-60 -45 Z" p={span(t, under + 0.4, under + 1.0)} stroke={PAL.blue} width={8} fill="rgba(47,127,224,0.12)" glow={PAL.blue} />
                <text x={0} y={22} textAnchor="middle" style={{ fontFamily: "Inter", fontWeight: 900, fontSize: 46, fill: PAL.deep }}>18</text>
              </g>
            </svg>
          </div>
        }
      >
        <Spoken id="control-4" t={t} size={84} align="left" accent={["yes", "eighteen"]} accentColor={GREEN} maxWidth={820} />
      </Beat>

      {/* ── a minor's writing never trains; adults, one switch ── */}
      <Beat
        t={t}
        a={minor}
        b={download}
        tint="#f6f3ff"
        art={
          <div style={{ position: "relative", width: 700, height: 600 }}>
            <div style={{ position: "absolute", left: 20, top: 60 }}>
              <Card w={300} style={{ padding: 26, height: 340 }}>
                <div style={TYPE.mono(20, PAL.violet, 700)}>MY ESSAY</div>
                {Array.from({ length: 7 }, (_, k) => (
                  <div key={k} style={{ height: 12, borderRadius: 6, background: "#e9e5ff", marginTop: 22, width: `${(60 + ((k * 37) % 35)) * Math.min(1, span(t, minor + k * 0.12, minor + 0.3 + k * 0.12) * 1.2)}%` }} />
                ))}
              </Card>
            </div>
            <svg width={700} height={600} style={{ position: "absolute", inset: 0, overflow: "visible" }}>
              <Draw d="M340 230 L560 230" p={span(t, minor + 0.6, minor + 1.2)} stroke="#94a3b8" width={8} />
              <g opacity={span(t, minor + 1.1, minor + 1.4)}>
                <circle cx={460} cy={230} r={60} fill="#fff" stroke={PAL.coral} strokeWidth={10} />
                <line x1={418} y1={272} x2={502} y2={188} stroke={PAL.coral} strokeWidth={10} strokeLinecap="round" />
              </g>
              <g transform="translate(620 230)" opacity={span(t, minor + 0.5, minor + 0.9)}>
                <circle r={70} fill="#ede9fe" stroke={PAL.violet} strokeWidth={6} />
                <text x={0} y={16} textAnchor="middle" style={{ fontFamily: "Space Grotesk", fontWeight: 700, fontSize: 30, fill: PAL.violet }}>training</text>
              </g>
            </svg>
            <div style={{ position: "absolute", left: 200, top: 460, ...tilt({ o: span(t, adults - 0.2, adults + 0.2), s: mix(0.8, 1, span(t, adults - 0.2, adults + 0.3, EASE.arrive)) }) }}>
              <Toggle on={span(t, sw - 0.05, sw + 0.3, EASE.move)} />
            </div>
          </div>
        }
      >
        <Spoken id="control-5" t={t} size={78} align="left" accent={["Nothing", "single"]} accentColor={PAL.violet} maxWidth={820} />
      </Beat>

      {/* ── download, delete, whenever ── */}
      <Beat
        t={t}
        a={download}
        b={listed}
        tint="#f2f8ff"
        art={
          <div style={{ position: "relative", width: 700, height: 600 }}>
            <svg width={700} height={600} style={{ overflow: "visible" }}>
              <g opacity={1 - span(t, del - 0.2, del + 0.1) * 0.5}>
                <Draw d="M200 60 L200 300 M120 220 L200 300 L280 220" p={span(t, download, download + 0.5)} stroke={PAL.blue} width={16} glow={PAL.blue} />
                <Draw d="M60 330 L60 420 L340 420 L340 330" p={span(t, download + 0.3, download + 0.8)} stroke={PAL.blue} width={14} />
                {[0, 1, 2].map((k) => {
                  const p = span(t, download + 0.4 + k * 0.15, download + 0.9 + k * 0.15, EASE.arrive);
                  return <rect key={k} x={120 + k * 60} y={mix(60, 340, p)} width={46} height={60} rx={8} fill="#dbeafe" stroke={PAL.blue} strokeWidth={4} opacity={p} />;
                })}
              </g>
              <g transform="translate(520 260)" opacity={span(t, del - 0.15, del + 0.15)}>
                <g transform={`rotate(${(-28 * span(t, del + 0.2, del + 0.5, EASE.arrive)).toFixed(1)} -70 -90)`}>
                  <rect x={-80} y={-110} width={160} height={22} rx={8} fill={PAL.coral} />
                  <rect x={-25} y={-130} width={50} height={22} rx={8} fill={PAL.coral} />
                </g>
                <path d="M-65 -80 L65 -80 L50 110 L-50 110 Z" fill="#fff1ee" stroke={PAL.coral} strokeWidth={8} />
                <line x1={-20} y1={-40} x2={-15} y2={80} stroke={PAL.coral} strokeWidth={6} />
                <line x1={20} y1={-40} x2={15} y2={80} stroke={PAL.coral} strokeWidth={6} />
              </g>
              <g transform="translate(350 520)" opacity={span(t, whenever - 0.1, whenever + 0.2)}>
                <circle r={60} fill="#fff" stroke={PAL.text} strokeWidth={6} />
                <line x1={0} y1={0} x2={0} y2={-40} stroke={PAL.text} strokeWidth={6} strokeLinecap="round" transform={`rotate(${(t - whenever) * 360})`} />
                <line x1={0} y1={0} x2={28} y2={0} stroke={PAL.text} strokeWidth={6} strokeLinecap="round" transform={`rotate(${(t - whenever) * 30})`} />
              </g>
            </svg>
          </div>
        }
      >
        <Spoken id="control-6" t={t} size={96} align="left" accent={["everything", "whenever"]} accentColor={PAL.blue} maxWidth={820} />
      </Beat>

      {/* ── every third party, listed ── */}
      {t >= listed - 0.02 && (
        <AbsoluteFill style={{ background: "#f7f9fc", opacity: 1 - span(t, to, to + 0.6) }}>
          <At x={960} y={430} style={tilt({ rx: mix(20, 0, span(t, listed, listed + 0.6, EASE.arrive)), o: span(t, listed - 0.05, listed + 0.3) })}>
            <Card w={1240} style={{ padding: "36px 46px" }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 16 }}>
                <span style={TYPE.display(42, 700)}>Who we work with</span>
                <span style={TYPE.mono(24, "#64748b", 500)}>/legal/subprocessors</span>
              </div>
              {[
                ["Hosting and database", "where your account lives"],
                ["AI models", "the tutor's replies"],
                ["Email", "only the messages you ask for"],
                ["Payments", "only if you subscribe"],
                ["Product analytics", "only after a yes"],
              ].map(([a, b], k) => {
                const p = span(t, listed + 0.2 + k * 0.22, listed + 0.5 + k * 0.22, EASE.arrive);
                return (
                  <div key={a} style={{ display: "flex", alignItems: "center", gap: 20, padding: "18px 0", borderTop: "1px solid #e2e8f0", ...tilt({ o: p, x: (1 - p) * -30 }) }}>
                    <span style={{ width: 40, height: 40, borderRadius: "50%", background: "#dcfce7", color: GREEN, display: "flex", alignItems: "center", justifyContent: "center", ...TYPE.display(26, 700, GREEN) }}>✓</span>
                    <span style={{ ...TYPE.display(32, 700), width: 440 }}>{a}</span>
                    <span style={TYPE.body(28, 500, "#64748b")}>{b}</span>
                  </div>
                );
              })}
            </Card>
          </At>
          <At x={960} y={930}>
            <Spoken id="control-7" t={t} size={62} accent={["publicly"]} accentColor={PAL.blue} maxWidth={1800} />
          </At>
        </AbsoluteFill>
      )}
    </Reveal>
  );
}

/* ───────────────────────────── the ecosystem ───────────────────────────── */

function Ecosystem({ t, tool, eco, people, leave }: { t: number; tool: number; eco: number; people: number; leave: number }) {
  const out = span(t, leave, leave + 0.4, EASE.leave);
  const toolCard = envelope(t, tool - 0.2, tool + 0.3, eco - 0.2, eco + 0.2, EASE.arrive);
  const open = span(t, eco - 0.2, eco + 1.0, EASE.move);
  const planets = [
    { label: "Raya", r: 230, speed: 0.5, phase: 0, color: PAL.blue, mark: true },
    { label: "Schools", r: 330, speed: 0.36, phase: 2, color: PAL.amber },
    { label: "Kernel", r: 430, speed: 0.28, phase: 4, color: PAL.cyan },
    { label: "Rooms", r: 330, speed: 0.36, phase: 5.1, color: PAL.violet },
    { label: "Tools", r: 430, speed: 0.28, phase: 1.2, color: GREEN },
  ];
  const ctl = span(t, people - 0.2, people + 0.6, EASE.move);
  return (
    <AbsoluteFill style={{ opacity: 1 - out }}>
      {toolCard > 0 && (
        <At x={960} y={460} style={tilt({ s: mix(0.7, 1, toolCard) * (1 - open * 0.6), o: toolCard })}>
          <Card w={420} style={{ padding: "34px 40px", display: "flex", alignItems: "center", gap: 22 }}>
            <svg width={70} height={70} viewBox="0 0 24 24"><path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.6 2.6-2.4-.6-.6-2.4z" fill="none" stroke={PAL.text} strokeWidth={1.8} strokeLinejoin="round" /></svg>
            <span style={TYPE.display(46, 700)}>an AI tool</span>
          </Card>
        </At>
      )}
      <AbsoluteFill style={{ opacity: open, transform: `scale(${mix(0.5, 1, open) * mix(1, 0.86, ctl)}) translateY(${(-ctl * 40).toFixed(1)}px)` }}>
        <Svg>
          {[230, 330, 430].map((r) => (
            <ellipse key={r} cx={960} cy={480} rx={r * 1.45} ry={r * 0.6} fill="none" stroke="rgba(15,23,42,0.12)" strokeWidth={2.5} strokeDasharray="6 10" />
          ))}
          <Pulse t={t} at={eco} x={960} y={480} color={PAL.blue} r0={90} r1={600} width={4} dur={1.1} />
        </Svg>
        <At x={960} y={480}>
          <div style={{ width: 200, height: 200, borderRadius: "50%", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 30px 80px rgba(47,127,224,0.3)" }}>
            <BluestiftMark size={140} />
          </div>
        </At>
        {planets.map((p, k) => {
          const a = p.phase + t * p.speed;
          const arrive = span(t, eco + k * 0.1, eco + 0.6 + k * 0.1, EASE.arrive);
          return (
            <At key={p.label} x={960 + Math.cos(a) * p.r * 1.45 * arrive} y={480 + Math.sin(a) * p.r * 0.6 * arrive} style={tilt({ o: arrive, s: mix(0.4, 1, arrive) })}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 22px 12px 12px", borderRadius: 999, background: "#fff", boxShadow: `0 12px 30px ${p.color}44`, border: `3px solid ${p.color}`, whiteSpace: "nowrap" }}>
                <span style={{ width: 52, height: 52, borderRadius: "50%", background: p.mark ? "#fff" : p.color, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {p.mark ? <RayaMark size={48} /> : null}
                </span>
                <span style={TYPE.display(30, 700)}>{p.label}</span>
              </div>
            </At>
          );
        })}
      </AbsoluteFill>
      <At x={960} y={890}>
        <Spoken id="control-0" t={t} size={72} accent={["ecosystem"]} accentColor={PAL.blue} out={people - 0.25} maxWidth={1800} />
      </At>
      <At x={960} y={900}>
        <Spoken id="control-1" t={t} size={100} accent={["control"]} accentColor={GREEN} out={leave - 0.1} maxWidth={1800} />
      </At>
      <Svg>
        <Burst t={t} at={wordAt("control-1", "control")} x={960} y={900} color={GREEN} rays={20} r0={180} r1={520} salt={50} />
      </Svg>
    </AbsoluteFill>
  );
}
