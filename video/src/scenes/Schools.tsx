import { AbsoluteFill, Img } from "remotion";
import DashboardMockup from "@/components/site/DashboardMockup";
import { MARKS } from "../generated/marks";
import { FocusShot, GuidedShot, ReturnShot } from "@/components/site/ProductShots";
import { RAYA_FONT } from "@/components/ui/brand";
import { crossing, Flock } from "../Birds";
import { FONTS } from "../brand";
import { BluestiftMark, BluestiftWordmark, BLUE } from "../Marks";
import { EASE, envelope, handheld, keys, keysOf, span, steady, useTime, warp } from "../motion";
import { Halo, Plate, spot, World, type Pose } from "../Plate";
import { dashboardCss } from "../reveal";
import { RoomWithPanel } from "../RoomPanel";
import { line, MUSIC, phrase, wordAt } from "../timeline";
import { ROOM, ROOM_HANDOFF } from "./Raya";

/**
 * Bluestift Schools, from the student's side of the glass.
 *
 * The Study Room steps aside and the school's dashboard rises behind it —
 * "your school has your back", literally. The teacher's list of who is stuck
 * and on what; then the line the whole product is built on, "never your
 * conversations", as a conversation going frosted behind a lock. The teacher's
 * own side at night: the focus they give Raya, and a question they ask her
 * about their class. The dashboard for one class and for the whole school,
 * and the camera stepping back as the birds cross — the students who count
 * on them.
 */

// The dashboard has no `.pub-shot`, so measure.mjs reported it from the top of
// the whole frame: its screen is 640 tall and its points sit 43px lower.
const DASH = { w: 1500, h: 640 };
const RET = { w: 1150, h: 862 };
const FOC = { w: 1150, h: 862 };

const LOCK = "M5 7V5a3 3 0 0 1 6 0v2h.5A1.5 1.5 0 0 1 13 8.5v4A1.5 1.5 0 0 1 11.5 14h-7A1.5 1.5 0 0 1 3 12.5v-4A1.5 1.5 0 0 1 4.5 7H5Zm1.5 0h3V5a1.5 1.5 0 0 0-3 0v2Z";

const students = crossing({ from: 90.6, duration: 6.4, count: 8, top: 170, spread: 520, size: 44, rise: -140, salt: 21 });

/** A teacher asking Raya about their class — RAYA for Schools, in its dark theme. */
function TeacherAsks({ t, askAt, replyAt }: { t: number; askAt: number; replyAt: number }) {
  const question = "How is Year 10 Physics doing this week?";
  const answer = "12 students are stuck on acceleration — for most of them it goes back to derivatives, not to the physics.";
  const typed = question.slice(0, Math.round(question.length * span(t, askAt, askAt + 0.9, EASE.linear)));
  const sent = span(t, askAt + 0.95, askAt + 1.25, EASE.arrive);
  const composing = envelope(t, askAt + 1.2, askAt + 1.35, replyAt - 0.1, replyAt);
  const words = answer.split(" ");
  const shown = words.slice(0, Math.round(words.length * span(t, replyAt, replyAt + 1.1, EASE.linear))).join(" ");
  return (
    <div
      style={{
        width: 900,
        borderRadius: 22,
        background: "linear-gradient(180deg,#141d33,#0f1729)",
        border: "1px solid rgba(255,255,255,0.09)",
        boxShadow: "0 1px 2px rgba(0,0,0,0.5), 0 30px 80px rgba(0,0,0,0.45)",
        padding: "26px 30px 28px",
        color: "#eef2f8",
        fontFamily: FONTS.body,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 22 }}>
        <span style={{ fontFamily: RAYA_FONT, fontWeight: 700, fontSize: 30 }}>Raya</span>
        <span style={{ fontSize: 20, color: "#9aa7bd" }}>for Schools · Year 10 Physics</span>
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", minHeight: 64 }}>
        {sent > 0 ? (
          <div style={{ background: "#2f7fe0", color: "#fff", borderRadius: "22px 22px 6px 22px", padding: "14px 22px", fontSize: 25, opacity: sent, transform: `translateY(${(1 - sent) * 10}px)` }}>
            {question}
          </div>
        ) : null}
      </div>
      <div style={{ marginTop: 16, minHeight: 112, display: "flex", gap: 14, alignItems: "flex-start" }}>
        {(composing > 0 || shown) && (
          <span style={{ width: 44, height: 44, borderRadius: "50%", background: "rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
            <Img src={MARKS["raya-mark-dark.png"]} style={{ width: 30, height: 30 }} />
          </span>
        )}
        {shown ? (
          <div style={{ background: "rgba(255,255,255,0.06)", borderRadius: "6px 22px 22px 22px", padding: "14px 22px", fontSize: 25, lineHeight: 1.45, maxWidth: 720 }}>{shown}</div>
        ) : composing > 0 ? (
          <div style={{ display: "flex", gap: 7, padding: "18px 20px", background: "rgba(255,255,255,0.06)", borderRadius: 18, opacity: composing }}>
            {[0, 1, 2].map((i) => (
              <span key={i} style={{ width: 9, height: 9, borderRadius: "50%", background: "#9aa7bd", opacity: 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * 9 - i * 0.9)) }} />
            ))}
          </div>
        ) : null}
      </div>
      <div style={{ marginTop: 18, borderRadius: 16, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.03)", padding: "16px 20px", fontSize: 24, color: sent > 0 ? "#7c8aa3" : "#eef2f8" }}>
        {sent > 0 ? "Ask Raya about your class…" : typed || "Ask Raya about your class…"}
        {sent === 0 && typed && <span style={{ display: "inline-block", width: 2, height: 26, background: "#eef2f8", marginLeft: 3, verticalAlign: "middle" }} />}
      </div>
    </div>
  );
}

export function Schools() {
  const t = useTime();
  const from = MUSIC.warm;
  const to = line("kernel-0").start - 0.4;
  if (t < from || t > to) return null;

  const learn = line("schools-0").start;
  const back = line("schools-1").start;
  const backWord = wordAt("schools-1", "back");
  const schools = line("schools-2").start;
  const bluestiftWord = wordAt("schools-2", "Bluestift");
  const schoolsWord = wordAt("schools-2", "Schools");
  const see = phrase("schools-2", 1).start;
  const concept = phrase("schools-2", 2).start;
  const never = line("schools-3").start;
  const tell = line("schools-4").start;
  const focusWord = wordAt("schools-4", "focus");
  const askClass = phrase("schools-4", 1).start;
  const forClass = line("schools-5").start;
  const wholeSchool = phrase("schools-5", 1).start;
  const summary = phrase("schools-5", 2).start;
  const matters = line("schools-6").start;
  const counts = phrase("schools-6", 1).start;

  /* ── the room steps aside; the dashboard rises behind it ──
     The keys are in time order and the dashboard is sharp from "your school"
     to "With": about a second and a half to be seen. Written against the words
     once before, two keys ran backwards and it was sharp for five frames, just
     as the name card covered it. */
  const roomPose: Pose = keysOf(t, [
    [from, ROOM_HANDOFF],
    [back - 0.2, { ...ROOM_HANDOFF, x: ROOM_HANDOFF.x - 40, y: 60 }],
    // Gone 0.3 s before the name card's cue: left any longer, it sat over the
    // dashboard's first second of being sharp.
    [backWord - 0.4, { x: -800, y: 120, ry: 16, s: 0.56, o: 1, focus: 0.35 }],
    [schools - 0.3, { x: -1000, y: 160, ry: 18, s: 0.5, o: 0, focus: 0.2 }],
  ]);
  const dashA: Pose = keysOf(t, [
    [back - 0.6, { x: 300, y: -10, ry: -8, s: 0.66, o: 0, focus: 0.2 }],
    [back + 0.5, { x: 190, y: 0, ry: -5, s: 0.76, o: 1, focus: 1 }],
    [schools - 0.1, { x: 150, y: 0, ry: -3, s: 0.79, o: 1, focus: 1 }],
    // It dissolves under the name card's veil rather than before it.
    [schools + 0.6, { x: 110, y: 10, ry: -2, s: 0.82, o: 0, focus: 0.3 }],
  ]);

  /* ── who is stuck, concept by concept ── */
  const retPose: Pose = keysOf(t, [
    // Only once the name card has cleared: the two used to cross.
    [see + 0.7, { x: 80, y: 60, s: 0.86, o: 0, focus: 0.2 }],
    [see + 1.3, { x: 0, y: 0, s: 0.95, o: 1, focus: 1 }],
    [never - 0.1, { x: 0, y: 0, s: 0.95, o: 1, focus: 1 }],
    [never + 0.5, { x: -140, y: 0, s: 0.9, o: 1, focus: 0.45 }],
    [tell - 0.1, { x: -180, y: 0, s: 0.88, o: 0, focus: 0.3 }],
  ]);
  const retAt = (px: number, py: number) => spot({ s: 0.95 }, RET.w, RET.h, px, py);
  const rows = [retAt(499, 306), retAt(499, 394), retAt(499, 481), retAt(499, 569)];

  /* ── never your conversations ── */
  const convPose: Pose = keysOf(t, [
    [never - 0.35, { x: 420, y: 40, ry: -8, s: 0.76, o: 0, focus: 0.4 }],
    [never + 0.25, { x: 230, y: 0, ry: -4, s: 0.8, o: 1, focus: 1 }],
    [never + 0.6, { x: 230, y: 0, ry: -4, s: 0.8, o: 1, focus: 1 }],
    [never + 1.2, { x: 230, y: 0, ry: -4, s: 0.8, o: 1, focus: 0.08 }],
    [tell - 0.2, { x: 280, y: 0, ry: -4, s: 0.8, o: 1, focus: 0.08 }],
    [tell + 0.4, { x: 520, y: 0, ry: -8, s: 0.78, o: 0, focus: 0.05 }],
  ]);
  const frost = span(t, never + 0.5, never + 1.2, EASE.soft) * (1 - span(t, tell - 0.2, tell + 0.4, EASE.soft));
  const lock = span(t, never + 0.8, never + 1.3, EASE.arrive) * (1 - span(t, tell - 0.2, tell + 0.3, EASE.soft));

  /* ── the teacher's side, at night ── */
  const focPose: Pose = keysOf(t, [
    [tell - 0.3, { x: -60, y: 60, s: 0.84, o: 0, focus: 0.2 }],
    [tell + 0.5, { x: -80, y: 0, s: 0.9, o: 1, focus: 1 }],
    [askClass, { x: -120, y: 0, s: 0.9, o: 1, focus: 1 }],
    [askClass + 0.6, { x: -360, y: -40, s: 0.82, o: 1, focus: 0.4 }],
    [forClass - 0.2, { x: -400, y: -40, s: 0.8, o: 0, focus: 0.3 }],
  ]);
  const focAt = (px: number, py: number) => spot({ x: -80, s: 0.9 }, FOC.w, FOC.h, px, py);
  const focusInput = focAt(288, 621);
  const asks = keysOf(t, [
    [askClass - 0.3, { x: 420, y: 140, s: 0.92, o: 0 }],
    [askClass + 0.4, { x: 300, y: 60, s: 1, o: 1 }],
    [forClass - 0.2, { x: 300, y: 50, s: 1, o: 1 }],
    [forClass + 0.4, { x: 360, y: 50, s: 0.96, o: 0 }],
  ]);

  /* ── one class, the whole school, the summary ── */
  const dashB: Pose = keysOf(t, [
    [forClass - 0.3, { x: 0, y: 60, s: 0.92, o: 0, focus: 0.2 }],
    [forClass + 0.4, { x: 0, y: 0, s: 1, o: 1, focus: 1 }],
    [matters, { x: 0, y: 0, s: 1, o: 1, focus: 1 }],
    [counts, { x: 0, y: 20, s: 0.94, o: 1, focus: 0.75 }],
    [to - 0.6, { x: 0, y: 40, s: 0.9, o: 0, focus: 0.3 }],
  ]);
  const dashAt = (px: number, py: number) => spot({ s: 1 }, DASH.w, DASH.h, px, py - 43);
  // The whole "Year 10 · Physics" row, not just its label.
  const yearTen = dashAt(605, 434);
  const panel = dashAt(1253, 330);
  const alerts = dashAt(1253, 505);

  const c = (x: number, y: number, zoom: number) => ({ x, y, zoom });
  const drift = handheld(t);
  const cam = steady(t, (u) => keysOf(u, [
    [from, c(0, 0, 1)],
    [learn + 1.2, c(-120, 20, 1.04)],
    [back, c(-80, 10, 1.02)],
    [backWord + 0.3, c(150, 0, 1.08)],
    [schools + 0.9, c(0, 0, 1.0)],
    [see + 1.25, c(0, 0, 1.0)],
    [concept, c(rows[0].x - 60, rows[0].y, 1.5)],
    [concept + 1.2, c(rows[3].x - 60, rows[3].y, 1.5)],
    [never, c(80, 0, 1.0)],
    [tell + 0.3, c(-80, 0, 1.0)],
    [focusWord + 0.3, c(focusInput.x + 120, focusInput.y - 30, 1.55)],
    [askClass + 0.2, c(80, 20, 1.0)],
    [forClass + 0.1, c(80, 20, 1.0)],
    [forClass + 0.6, c(yearTen.x, yearTen.y, 1.75)],
    [wholeSchool + 0.9, c(0, 0, 1.0)],
    [summary + 0.8, c(panel.x - 60, panel.y + 60, 1.45)],
    [matters, c(panel.x - 60, panel.y + 60, 1.45)],
    [counts, c(0, 0, 0.86)],
    [to, c(0, -40, 0.78)],
  ]));
  const camera = { x: cam.x + drift.x, y: cam.y + drift.y, zoom: cam.zoom, roll: drift.r };

  // A beat of its own, gone before the next screen arrives. The veil is nearly
  // opaque, so nothing ghosts through it once it is up. The card builds the
  // way the Bluestift lockup does at the start of the film — the mark out of
  // the light, each word written as it is said — instead of arriving whole.
  const lockup = envelope(t, schools - 0.15, schools + 0.45, see + 0.35, see + 0.8);
  const markIn = span(t, schools - 0.05, schools + 0.8, EASE.arrive);
  const bluestiftIn = span(t, bluestiftWord - 0.05, bluestiftWord + 0.55, EASE.move);
  const schoolsIn = span(t, schoolsWord - 0.05, schoolsWord + 0.5, EASE.move);

  return (
    <AbsoluteFill>
      <style>{dashboardCss("vid-dash-s1", keys(t, [[back - 0.3, 0], [schools - 0.15, 1]], EASE.linear)) + dashboardCss("vid-dash-s2", 1)}</style>
      <World camera={camera}>
        {t < schools + 0.7 && (
          <Plate className="vid-dash-s1" width={DASH.w} url="schools.thebluestift.com" pose={dashA}>
            {(th) => <DashboardMockup theme={th} />}
          </Plate>
        )}
        {t < schools - 0.25 && (
          // Carries on from where the Raya tour left it, so its timer and its
          // thread keep running rather than jumping back to a finished state.
          <Plate width={ROOM.w} url="raya.thebluestift.com/rooms" pose={roomPose} ms={5440 + (t - from) * 1000}>
            {(th) => <RoomWithPanel theme={th} ms={5440 + (t - from) * 1000} />}
          </Plate>
        )}

        {t > see + 0.6 && t < tell && (
          <Plate width={RET.w} url="schools.thebluestift.com/focus" pose={retPose} ms={warp(t, [[see + 0.7, 350], [concept + 1.2, 1740]])}>
            {(th) => <ReturnShot theme={th} />}
          </Plate>
        )}
        {t > never - 0.4 && t < tell + 0.5 && (
          <>
            <Plate width={1000} url="raya.thebluestift.com/chat" pose={convPose} crop={{ top: 0, height: 480 }}>
              {(th) => <GuidedShot theme={th} />}
            </Plate>
            {frost > 0.001 && (
              <div
                style={{
                  position: "absolute",
                  left: "50%",
                  top: "50%",
                  width: 1000,
                  height: 523,
                  borderRadius: 18,
                  transform: `translate(-50%, -50%) translate(${convPose.x}px, ${convPose.y}px) rotateY(${convPose.ry}deg) scale(${convPose.s})`,
                  background: `rgba(240,246,255,${(0.55 * frost).toFixed(3)})`,
                  boxShadow: `inset 0 0 0 1px rgba(255,255,255,${(0.7 * frost).toFixed(3)})`,
                  opacity: convPose.o,
                }}
              />
            )}
            {lock > 0.001 && (
              <div
                style={{
                  position: "absolute",
                  left: "50%",
                  top: "50%",
                  width: 150,
                  height: 150,
                  borderRadius: "50%",
                  background: "#ffffff",
                  boxShadow: "0 1px 2px rgba(15,23,42,0.08), 0 20px 50px rgba(15,23,42,0.18)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transform: `translate(-50%, -50%) translate(${convPose.x}px, ${convPose.y}px) scale(${0.7 + 0.3 * lock})`,
                  opacity: lock * (convPose.o ?? 1),
                }}
              >
                <svg width="64" height="64" viewBox="0 0 16 16">
                  <path d={LOCK} fill={BLUE.deep} />
                </svg>
              </div>
            )}
          </>
        )}

        {t > tell - 0.4 && t < forClass && (
          <Plate dark width={FOC.w} url="schools.thebluestift.com/classes" pose={focPose} ms={warp(t, [[tell, 0], [focusWord + 0.4, 1880]])}>
            {(th) => <FocusShot theme={th} />}
          </Plate>
        )}
        {t > askClass - 0.35 && t < forClass + 0.5 && (
          <div style={{ position: "absolute", left: "50%", top: "50%", transform: `translate(-50%, -50%) translate(${asks.x}px, ${asks.y}px) scale(${asks.s})`, opacity: asks.o }}>
            <TeacherAsks t={t} askAt={askClass + 0.2} replyAt={askClass + 1.6} />
          </div>
        )}

        {t > forClass - 0.4 && (
          <>
            <Plate className="vid-dash-s2" width={DASH.w} url="schools.thebluestift.com" pose={dashB}>
              {(th) => <DashboardMockup theme={th} />}
            </Plate>
            <Halo x={yearTen.x} y={yearTen.y} w={786} h={60} radius={14} strength={envelope(t, forClass + 0.3, forClass + 0.7, wholeSchool + 0.1, wholeSchool + 0.5)} />
            <Halo x={alerts.x} y={alerts.y} w={452} h={96} radius={16} strength={envelope(t, summary + 0.7, summary + 1.1, matters - 0.2, matters + 0.3)} />
          </>
        )}
      </World>

      {lockup > 0.001 && (
        <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", opacity: lockup }}>
          <AbsoluteFill style={{ background: `rgba(238,244,253,${(0.94 * lockup).toFixed(3)})` }} />
          {/* Written by clipping, not by layout: the row keeps its full width
              from the first frame, so the mark never slides as the words arrive. */}
          <div style={{ display: "flex", alignItems: "center", gap: 30, transform: `translateY(${((1 - lockup) * 18).toFixed(2)}px)` }}>
            <BluestiftMark
              size={150}
              style={{ opacity: markIn, transform: `scale(${(0.84 + markIn * 0.16).toFixed(4)})`, filter: markIn < 0.98 ? `blur(${((1 - markIn) * 12).toFixed(2)}px)` : undefined }}
            />
            <span style={{ display: "block", clipPath: `inset(-20% ${((1 - bluestiftIn) * 100).toFixed(2)}% -20% 0)` }}>
              <BluestiftWordmark size={118} />
            </span>
            <span style={{ fontFamily: RAYA_FONT, fontWeight: 700, fontSize: 118, color: BLUE.deep, lineHeight: 1, clipPath: `inset(-20% ${((1 - schoolsIn) * 100).toFixed(2)}% -20% 0)` }}>Schools</span>
          </div>
        </AbsoluteFill>
      )}

      <Flock birds={students} color="#2f7fe0" farColor="#7aa7e3" />
    </AbsoluteFill>
  );
}
