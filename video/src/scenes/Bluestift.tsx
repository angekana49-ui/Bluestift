import { AbsoluteFill } from "remotion";
import DashboardMockup from "@/components/site/DashboardMockup";
import { KernelShot, RungShot } from "@/components/site/ProductShots";
import { BluestiftMark, BluestiftWordmark, RayaWheel, RayaWordmark } from "../Marks";
import { EASE, envelope, handheld, keys, keysOf, span, useTime } from "../motion";
import { Plate, World } from "../Plate";
import { dashboardCss } from "../reveal";
import { CHALLENGE, ChallengeScreen, QUIZ, QuizScreen } from "../study";
import { line, MUSIC, phrase, wordAt } from "../timeline";

/**
 * "Bluestift is a collaborative platform, built around Raya…"
 *
 * The mark forms out of the light the intro ended on, on the first downbeat
 * of the theme, and its name writes itself as it is said. Raya rolls in
 * underneath on "built around Raya" — the wheel the brief asked for. Then the
 * student's side in three sessions (learn, fail, challenge) and the Kernel
 * card that says where they are stuck; then the camera pulls back and the
 * school's dashboard is the whole picture, its gauge landing on "better".
 */
export function Bluestift() {
  const t = useTime();
  const from = MUSIC.theme - 0.3;
  const to = MUSIC.groove + 0.9;
  if (t < from || t > to) return null;

  const name = line("bluestift-0").start;
  const around = phrase("bluestift-0", 1).start;
  const raya = wordAt("bluestift-0", "Raya");
  const learn = phrase("bluestift-1", 0).start;
  const fail = phrase("bluestift-1", 1).start;
  const challenge = phrase("bluestift-1", 2).start;
  const stuck = phrase("bluestift-1", 3).start;
  const stuckWord = wordAt("bluestift-1", "stuck");
  const notAlone = line("bluestift-2").start;
  const picture = wordAt("bluestift-2", "whole");
  const easier = line("bluestift-3").start;
  const better = wordAt("bluestift-4", "better");

  /* ── the lockup ── */
  const markIn = span(t, MUSIC.theme - 0.15, MUSIC.theme + 1.0, EASE.arrive);
  const nameIn = span(t, name - 0.05, name + 0.75, EASE.move);
  const lift = span(t, around - 0.15, around + 0.85, EASE.move);
  const lockupOut = span(t, learn - 0.75, learn + 0.1, EASE.leave);

  /* ── Raya, rolling in on a line ── */
  const rollFrom = -260;
  const stopAt = 960;
  const rollX = keys(t, [[around - 0.1, rollFrom], [raya + 0.35, stopAt]], EASE.arrive);
  const rollOff = keys(t, [[learn - 0.7, 0], [learn + 0.5, 1500]], EASE.leave);
  const wheelX = rollX + rollOff;
  const wheelSpeed = (keys(t + 1 / 60, [[around - 0.1, rollFrom], [raya + 0.35, stopAt]], EASE.arrive) + keys(t + 1 / 60, [[learn - 0.7, 0], [learn + 0.5, 1500]], EASE.leave) - wheelX) * 60;
  const wheelIn = span(t, around - 0.1, around + 0.2, EASE.soft);
  const rayaName = envelope(t, raya + 0.15, raya + 0.75, learn - 0.8, learn - 0.2);

  /* ── the student's side ──
     One card per verb, and each one a different screen: the session where they
     learn, the quiz they get wrong, the challenge they take with the room.
     `k` is what scales a wider drawing down to the same card. */
  const card = (enter: number, x: number, y: number, ry: number, k = 1) =>
    keysOf(t, [
      [enter - 0.3, { x: x + 90, y: y + 60, ry, s: 0.7 * k, o: 0, focus: 0.2 }],
      [enter + 0.55, { x, y, ry, s: 0.72 * k, o: 1, focus: 1 }],
      [stuck - 0.1, { x, y, ry, s: 0.72 * k, o: 1, focus: 1 }],
      [stuck + 0.7, { x: x * 1.12, y: y - 30, ry, s: 0.66 * k, o: 0.85, focus: 0.35 }],
      [notAlone + 0.8, { x: x * 1.3, y: y - 40, ry, s: 0.62 * k, o: 0, focus: 0.1 }],
    ]);
  // 1200-wide screens, drawn to the same size on screen as the 860 session.
  const WIDE = 860 / QUIZ.w;
  const kernel = keysOf(t, [
    [stuck - 0.35, { x: 60, y: 120, ry: 0, s: 0.78, o: 0, focus: 0.3 }],
    [stuck + 0.6, { x: 0, y: 10, ry: 0, s: 0.84, o: 1, focus: 1 }],
    [stuckWord + 0.9, { x: 0, y: -20, ry: 0, s: 0.9, o: 1, focus: 1 }],
    [notAlone + 0.9, { x: -560, y: 30, ry: 14, s: 0.56, o: 1, focus: 1 }],
    [picture, { x: -600, y: 40, ry: 16, s: 0.52, o: 1, focus: 0.55 }],
    [easier + 0.6, { x: -660, y: 50, ry: 18, s: 0.48, o: 0, focus: 0.3 }],
  ]);

  /* ── the school's side ── */
  const dash = keysOf(t, [
    [notAlone + 0.1, { x: 520, y: 40, ry: -10, s: 0.6, o: 0, focus: 0.2 }],
    [picture - 0.2, { x: 230, y: 10, ry: -8, s: 0.74, o: 1, focus: 1 }],
    [easier + 0.4, { x: 40, y: 0, ry: -2, s: 0.8, o: 1, focus: 1 }],
    [better + 0.6, { x: -80, y: 40, ry: 0, s: 0.92, o: 1, focus: 1 }],
    [MUSIC.groove - 0.6, { x: -60, y: 40, ry: 0, s: 0.93, o: 1, focus: 1 }],
    [MUSIC.groove + 0.7, { x: 520, y: 40, ry: -6, s: 0.86, o: 0, focus: 0.2 }],
  ]);
  const dashReveal = keys(t, [[picture - 0.5, 0], [better + 0.1, 1]], EASE.linear);

  const drift = handheld(t);
  const camera = {
    x: drift.x,
    y: drift.y,
    zoom: keys(t, [[from, 1.1], [MUSIC.theme + 1.2, 1.0], [learn, 1.0], [stuck, 1.02], [notAlone, 1.0], [better + 1, 1.05]]),
    roll: drift.r,
  };

  return (
    <AbsoluteFill>
      <style>{dashboardCss("vid-dash-b", dashReveal)}</style>
      <World camera={camera}>
        {/* The three sessions, fanned. */}
        {t < notAlone + 1 && (
          <>
            {/* Each session already under way when it arrives: an empty thread says nothing. */}
            <Plate width={860} pose={card(learn, -600, 20, 16)} ms={keys(t, [[learn, 900], [learn + 3, 3600]], EASE.linear)}>
              {(th) => <RungShot theme={th} rung={0} />}
            </Plate>
            <Plate width={QUIZ.w} url="raya.thebluestift.com/tools" pose={card(fail, 0, -30, 0, WIDE)}>
              {() => <QuizScreen reveal={span(t, fail + 0.2, fail + 0.95, EASE.move)} />}
            </Plate>
            <Plate width={CHALLENGE.w} url="raya.thebluestift.com/rooms" pose={card(challenge, 600, 20, -16, WIDE)}>
              {() => <ChallengeScreen rows={span(t, challenge + 0.15, challenge + 1.35, EASE.linear)} />}
            </Plate>
          </>
        )}
        {t > stuck - 0.4 && t < easier + 0.7 && (
          // The whole profile page, not a band of it: cropped, it arrived with
          // an empty half, because the crop ran off the bottom of the drawing.
          <Plate className="vid-kernel" width={980} url="raya.thebluestift.com/kernel" pose={kernel} ms={keys(t, [[stuck, 500], [stuckWord + 0.4, 1590]], EASE.linear)}>
            {(th) => <KernelShot theme={th} />}
          </Plate>
        )}
        {t > notAlone && (
          <Plate className="vid-dash-b" width={1500} url="schools.thebluestift.com" pose={dash}>
            {(th) => <DashboardMockup theme={th} />}
          </Plate>
        )}
      </World>

      {/* The lockup and the wheel sit outside the camera: they are titles, not objects in the room. */}
      {lockupOut < 1 && (
        <AbsoluteFill
          style={{
            alignItems: "center",
            opacity: markIn * (1 - lockupOut),
            transform: `translateY(${keys(lift, [[0, 0], [1, -150]], EASE.linear) - lockupOut * 60}px) scale(${1 - lift * 0.32})`,
          }}
        >
          <div style={{ position: "absolute", top: 250, left: 960 - 125 }}>
            <BluestiftMark
              size={250}
              style={{ transform: `scale(${0.84 + markIn * 0.16})`, filter: markIn < 0.98 ? `blur(${((1 - markIn) * 14).toFixed(2)}px)` : undefined }}
            />
          </div>
          <div style={{ position: "absolute", top: 540, width: 1920, textAlign: "center", clipPath: `inset(-20% ${((1 - nameIn) * 100).toFixed(2)}% -20% 0)` }}>
            <BluestiftWordmark size={132} />
          </div>
        </AbsoluteFill>
      )}
      {wheelIn > 0 && wheelX < 2300 && (
        <AbsoluteFill style={{ opacity: wheelIn }}>
          <RayaWheel x={wheelX} x0={rollFrom} groundY={790} size={210} speed={wheelSpeed} />
          <div style={{ position: "absolute", top: 930, width: 1920, textAlign: "center", opacity: rayaName, transform: `translateY(${(1 - rayaName) * 12}px)` }}>
            <RayaWordmark size={78} />
          </div>
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
}
