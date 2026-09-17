import { AbsoluteFill } from "remotion";
import { KernelShot, SocraticShot, ToolsShot } from "@/components/site/ProductShots";
import { IconChat, IconKernel, IconQuiz, IconRooms, IconTools } from "@/components/ui/icons";
import { FONTS } from "../brand";
import { RayaWheel, RayaWordmark } from "../Marks";
import { EASE, envelope, handheld, keys, keysOf, mix, span, steady, useTime, warp } from "../motion";
import { Halo, Plate, spot, textWidth, toFrame, World, type Pose } from "../Plate";
import { ROOM_PANEL, ROOM_PANEL_AT, ROOM_SHOT, RoomWithPanel } from "../RoomPanel";
import { line, MUSIC, phrase, wordAt } from "../timeline";

/**
 * "Here's a quick look at Raya, which is more than an AI: it's a platform of
 * its own."
 *
 * The wheel rolls in on the groove and unrolls its name; the platform's own
 * sections line up under it. Then the tour, the camera always on the thing
 * being said: the composer ("ask Raya anything"), the thread as Raya leads
 * the student to it, My Kernel at dusk, the Tools Studio tile by tile on
 * "quizzes, flashcards and mind maps", and the Study Room in daylight —
 * the room, who's in it, the chat, the shared document, the challenges,
 * Raya in the thread, the button that asks her.
 */

/**
 * The platform's sections, and where each one is in the app's own sidebar —
 * `py` from scripts/measure.mjs, at the width the plate is drawn at. The title
 * card does not dissolve into the screen: each card flies to the row it names
 * and becomes it, so the two pictures are never two pictures at once.
 */
const NAV = [
  { label: "Chat", Icon: IconChat, py: 94, active: true },
  { label: "Rooms", Icon: IconRooms, py: 294 },
  { label: "Tools", Icon: IconTools, py: 335 },
  { label: "Assignments", Icon: IconQuiz, py: 376 },
  { label: "My Kernel", Icon: IconKernel, py: 417 },
];

/** The sidebar, in the shot's own pixels (measure.mjs, socratic @ 1500). */
const RAIL = { labelX: 62, iconCx: 38.3, font: 16.64, icon: 20, markCx: 40, markSize: 36.6, markCy: 38, nameX: 68, nameFont: 18.3 };
/** The title card's own type, and the pill geometry built on it. */
const PILL = { font: 30, icon: 30, padX: 24, gap: 12, h: 66, top: 690, gapBetween: 18 };

// Screen sizes at the widths used here (scripts/measure.mjs).
const SOC = { w: 1500, h: 643 };
const KER = { w: 1000, crop: { top: 0, height: 470 } };
const TOOLS = { w: 1500, crop: { top: 0, height: 900 } };
/** The room with its right panel (src/RoomPanel.tsx): the shot's points are unchanged, measured from its left edge. */
export const ROOM = { w: ROOM_SHOT.w + ROOM_PANEL.w, h: ROOM_SHOT.h };
/** Where the Study Room is when the Raya tour ends and Schools begins — further
 *  left than the thread alone needed, so the panel is not over the dashboard. */
export const ROOM_HANDOFF = { x: -600, y: 30, ry: 12, s: 0.6, o: 1, focus: 1 };

export function Raya() {
  const t = useTime();
  const from = MUSIC.groove - 1.0;
  // Schools picks the room plate up on this very frame, in this very pose.
  const to = MUSIC.warm;
  if (t < from || t > to) return null;

  const rayaWord = wordAt("raya-0", "Raya");
  const platform = phrase("raya-0", 2).start;
  const ask = line("raya-1").start;
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

  /* ── the wheel and its name ── */
  const rollFrom = -300;
  const wheelStop = 700;
  const roll = (at: number) => keys(at, [[from + 0.3, rollFrom], [rayaWord + 0.3, wheelStop]], EASE.arrive);
  const wheelX = roll(t);
  const wheelSpeed = (roll(t + 1 / 60) - wheelX) * 60;
  const nameReveal = span(t, rayaWord - 0.05, rayaWord + 0.9, EASE.move);
  // The title card folds into the screen it names, and hands over once the
  // real rows have drawn themselves underneath it.
  const fold = span(t, ask - 1.25, ask - 0.2, EASE.move);
  const handOver = span(t, ask - 0.15, ask + 0.45, EASE.soft);
  const lockupOut = handOver;

  /* ── Socratic: the whole app, then the composer, the thread, My Kernel ── */
  const socPose: Pose = keysOf(t, [
    [ask - 1.3, { x: 0, y: 40, s: 0.96, o: 0, focus: 0.3 }],
    [ask - 0.2, { x: 0, y: 0, s: 1.1, o: 1, focus: 1 }],
    [kernelWord - 0.2, { x: 0, y: 0, s: 1.1, o: 1, focus: 1 }],
    [kernelWord + 0.7, { x: 0, y: 0, s: 1.1, o: 0, focus: 0.3 }],
  ]);
  const socAt = (px: number, py: number) => spot({ s: 1.1 }, SOC.w, SOC.h, px, py);
  const composer = socAt(671, 628);
  const thread = socAt(674, 330);
  const found = socAt(995, 551);
  const myKernel = socAt(143, 417);
  // The sidebar draws itself under the cards landing on it, so the rail is
  // finished at the moment they hand over.
  const socMs = warp(t, [
    [ask - 0.35, 0],
    [ask + 0.45, 720],
    [instead + 0.2, 1150],
    [findIt + 0.35, 1720],
    [explore + 0.6, 2300],
  ]);

  /* ── My Kernel, at dusk ── */
  const kerPose: Pose = keysOf(t, [
    [kernelWord - 0.3, { x: 0, y: 60, s: 1.12, o: 0, focus: 0.2 }],
    [kernelWord + 0.5, { x: 0, y: 0, s: 1.22, o: 1, focus: 1 }],
    [turn + 0.2, { x: 0, y: -30, s: 1.26, o: 1, focus: 1 }],
    [turn + 0.9, { x: 0, y: -60, s: 1.2, o: 0, focus: 0.3 }],
  ]);

  /* ── Tools Studio: the lessons, then each format as it is named ── */
  const toolsPose: Pose = keysOf(t, [
    [turn + 0.1, { x: 0, y: 80, s: 0.95, o: 0, focus: 0.2 }],
    [turn + 0.9, { x: 0, y: 0, s: 1, o: 1, focus: 1 }],
    [better - 0.2, { x: 0, y: 0, s: 1, o: 1, focus: 1 }],
    [better + 0.6, { x: -120, y: 0, s: 0.95, o: 0, focus: 0.2 }],
  ]);
  const toolAt = (px: number, py: number) => spot({ s: 1 }, TOOLS.w, TOOLS.crop.height, px, py);
  const tile = { quiz: toolAt(570, 250), flash: toolAt(928, 250), mind: toolAt(1287, 250), lessons: toolAt(560, 539), library: toolAt(700, 800) };
  const toolsMs = warp(t, [
    [turn + 0.3, 0],
    [practise, 1670],
  ]);

  /* ── Study Room, in daylight ── */
  const roomPose: Pose = keysOf(t, [
    [better - 0.4, { x: 140, y: 40, ry: 0, s: 0.92, o: 0, focus: 0.2 }],
    [better + 0.5, { x: 0, y: 0, ry: 0, s: 1, o: 1, focus: 1 }],
    [help + 0.8, { x: 0, y: 0, ry: 0, s: 1, o: 1, focus: 1 }],
    [MUSIC.warm, ROOM_HANDOFF],
  ]);
  const roomAt = (px: number, py: number) => spot({ s: 1 }, ROOM.w, ROOM.h, px, py);
  const room = {
    title: roomAt(300, 52),
    online: roomAt(750, 52),
    thread: roomAt(650, 470),
    doc: roomAt(650, 215),
    challenges: roomAt(534, 124),
    raya: roomAt(611, 636),
    askRaya: roomAt(1176, 910),
    members: roomAt(ROOM_SHOT.w + ROOM_PANEL_AT.members.x, ROOM_PANEL_AT.members.y),
  };
  // The room is already running when it opens: an empty white screen arriving
  // on "open a Study Room" is a blank page, not a room.
  const roomMs = warp(t, [
    [better - 0.5, 300],
    [better + 0.5, 700],
    [chat + 0.1, 900],
    [share + 0.2, 1150],
    [rightThere + 0.1, 1560],
    [help + 0.6, 2600],
    [MUSIC.warm, 5440],
  ]);

  /* ── the camera, one continuous take ── */
  const c = (x: number, y: number, zoom: number) => ({ x, y, zoom });
  const drift = handheld(t);
  const cam = steady(t, (u) => keysOf(u, [
    [from, c(0, 0, 1)],
    [ask - 0.1, c(0, 0, 1)],
    [ask + 0.8, c(0, 0, 1)],
    [ask + 1.9, c(composer.x, composer.y - 60, 1.55)],
    [instead + 0.3, c(thread.x, thread.y, 1.4)],
    [findIt + 0.1, c(thread.x + 80, thread.y + 60, 1.45)],
    [findIt + 0.8, c(found.x - 60, found.y - 30, 1.6)],
    [explore + 0.2, c(found.x - 60, found.y - 30, 1.6)],
    [kernelWord - 0.35, c(myKernel.x + 60, myKernel.y, 2.0)],
    [kernelWord + 0.5, c(0, 0, 1)],
    [turn, c(0, -20, 1.04)],
    [turn + 1.0, c(tile.lessons.x, tile.lessons.y, 1.45)],
    [quizzes - 0.1, c(tile.quiz.x, tile.quiz.y + 40, 1.55)],
    [flashcards - 0.1, c(tile.flash.x, tile.flash.y + 40, 1.55)],
    [mindMaps - 0.1, c(tile.mind.x, tile.mind.y + 40, 1.55)],
    [practise + 0.5, c(tile.library.x, tile.library.y - 60, 1.3)],
    [better - 0.1, c(0, 0, 1)],
    [better + 0.6, c(0, 0, 0.96)],
    [studyRoom + 0.3, c(room.title.x, room.title.y + 40, 1.7)],
    // "with your friends": back far enough to show the panel, and who is in
    // the room, held until "chat" — at a word's length it did not register.
    [friends - 0.5, c(room.members.x - 540, room.members.y - 160, 1.12)],
    [friends + 0.35, c(room.members.x - 540, room.members.y - 160, 1.12)],
    [chat + 0.45, c(room.thread.x, room.thread.y, 1.2)],
    [share + 0.3, c(room.doc.x, room.doc.y, 1.7)],
    [challenge, c(room.challenges.x, room.challenges.y + 30, 1.8)],
    [rightThere + 0.1, c(room.raya.x, room.raya.y, 1.45)],
    [help + 0.1, c(room.askRaya.x - 80, room.askRaya.y - 40, 1.7)],
    [help + 1.2, c(room.askRaya.x - 80, room.askRaya.y - 40, 1.7)],
    [MUSIC.warm, c(0, 0, 1)],
  ]));
  const camera = { x: cam.x + drift.x, y: cam.y + drift.y, zoom: cam.zoom, roll: drift.r };

  const halo = {
    myKernel: envelope(t, kernelWord - 0.6, kernelWord - 0.25, kernelWord + 0.1, kernelWord + 0.5),
    flash: envelope(t, flashcards - 0.15, flashcards + 0.2, mindMaps - 0.2, mindMaps + 0.05),
    mind: envelope(t, mindMaps - 0.15, mindMaps + 0.2, practise + 0.2, practise + 0.6),
    members: envelope(t, friends - 0.5, friends - 0.1, friends + 0.3, friends + 0.6),
    doc: envelope(t, share + 0.1, share + 0.5, challenge - 0.3, challenge),
    challenges: envelope(t, challenge - 0.1, challenge + 0.3, rightThere - 0.2, rightThere + 0.1),
    askRaya: envelope(t, help, help + 0.35, MUSIC.warm - 1.2, MUSIC.warm - 0.6),
  };

  return (
    <AbsoluteFill>
      <World camera={camera}>
        {t < kernelWord + 0.8 && (
          <Plate width={SOC.w} url="raya.thebluestift.com" pose={socPose} ms={socMs}>
            {(th) => <SocraticShot theme={th} />}
          </Plate>
        )}
        <Halo x={myKernel.x} y={myKernel.y} w={190} h={44} strength={halo.myKernel} />

        {t > kernelWord - 0.4 && t < turn + 1 && (
          <Plate dark className="vid-kernel" width={KER.w} url="raya.thebluestift.com/kernel" pose={kerPose} crop={KER.crop} ms={warp(t, [[kernelWord - 0.2, 0], [turn - 0.2, 1590]])}>
            {(th) => <KernelShot theme={th} />}
          </Plate>
        )}

        {t > turn && t < better + 0.7 && (
          <>
            <Plate dark width={TOOLS.w} url="raya.thebluestift.com/tools" pose={toolsPose} crop={TOOLS.crop} ms={toolsMs}>
              {(th) => <ToolsShot theme={th} />}
            </Plate>
            {/* No ring on the quiz tile: the studio already draws its own selection there. */}
            <Halo x={tile.flash.x} y={tile.flash.y} w={346} h={184} radius={22} strength={halo.flash * (toolsPose.o ?? 1)} color="120,170,255" />
            <Halo x={tile.mind.x} y={tile.mind.y} w={346} h={184} radius={22} strength={halo.mind * (toolsPose.o ?? 1)} color="120,170,255" />
          </>
        )}

        {t > better - 0.5 && (
          <>
            <Plate width={ROOM.w} url="raya.thebluestift.com/rooms" pose={roomPose} ms={roomMs}>
              {(th) => <RoomWithPanel theme={th} ms={roomMs} />}
            </Plate>
            <Halo x={room.members.x} y={room.members.y} w={400} h={340} radius={18} strength={halo.members} />
            <Halo x={room.doc.x} y={room.doc.y} w={930} h={70} radius={35} strength={halo.doc} />
            <Halo x={room.challenges.x} y={room.challenges.y} w={186} h={62} radius={31} strength={halo.challenges} />
            <Halo x={room.askRaya.x} y={room.askRaya.y} w={184} h={76} radius={38} strength={halo.askRaya} />
          </>
        )}
      </World>

      {/* The wheel, its name and the platform's sections: a title card, outside
          the camera — until it folds into the screen and becomes its rail. */}
      {lockupOut < 1 && (
        <AbsoluteFill style={{ opacity: 1 - lockupOut }}>
          {(() => {
            /* Where each piece has to land: the plate's own pixels, through the
               pose it is in right now and the camera looking at it. */
            const k = (socPose.s ?? 1) * camera.zoom;
            const at = (px: number, py: number) => toFrame({ x: (socPose.x ?? 0) + (socPose.s ?? 1) * (px - SOC.w / 2), y: (socPose.y ?? 0) + (socPose.s ?? 1) * (43 + py - (43 + SOC.h) / 2) }, camera);

            /* ── the wheel becomes the app's mark ── */
            const mark = at(RAIL.markCx, RAIL.markCy);
            const wheelSize = 240;
            const wheelHome = { x: wheelX, y: 480 };
            const wheelScale = mix(1, (RAIL.markSize * k) / wheelSize, fold);
            // It rolls the rest of the way: leftwards, so anticlockwise, and it
            // arrives upright — the way the mark sits in the rail.
            const restAngle = (((wheelX - rollFrom) / ((wheelSize * 0.92) / 2)) * (180 / Math.PI)) % 360;
            const wheelNow = { x: mix(wheelHome.x, mark.x, fold), y: mix(wheelHome.y, mark.y, fold) };

            /* ── the wordmark becomes the name beside it ── */
            const name = at(RAIL.nameX, RAIL.markCy);
            const nameScale = mix(1, (RAIL.nameFont * k) / 170, fold);
            const nameHome = { x: wheelStop + 150, y: 485 };

            /* ── each card becomes its row ── */
            const labelFont = `600 ${PILL.font}px ${FONTS.display}`;
            const widths = NAV.map((n) => textWidth(n.label, labelFont));
            const total = widths.reduce((a, w) => a + w + PILL.padX * 2 + PILL.icon + PILL.gap + 2, 0) + PILL.gapBetween * (NAV.length - 1);
            let x = 960 - total / 2;
            const cards = NAV.map((n, i) => {
              const left = x;
              x += widths[i] + PILL.padX * 2 + PILL.icon + PILL.gap + 2 + PILL.gapBetween;
              return { ...n, left, width: widths[i] + PILL.padX * 2 + PILL.icon + PILL.gap + 2 };
            });

            return (
              <>
                <div style={{ position: "absolute", left: 0, top: 0, transform: `translate(${(wheelNow.x - wheelHome.x).toFixed(2)}px, ${(wheelNow.y - wheelHome.y).toFixed(2)}px) scale(${wheelScale.toFixed(4)})`, transformOrigin: `${wheelHome.x}px ${wheelHome.y}px`, width: 1920, height: 1080 }}>
                  <RayaWheel
                    x={wheelX}
                    x0={rollFrom}
                    groundY={480}
                    size={wheelSize}
                    speed={wheelSpeed}
                    shadow={fold < 0.3}
                    turn={fold > 0 ? mix(restAngle, 0, fold) : undefined}
                  />
                </div>

                {/* A box of known height, so its middle — not a line box the
                    face decides — is what travels and what the scale pins. */}
                <div
                  style={{
                    position: "absolute",
                    left: nameHome.x,
                    top: nameHome.y - 85,
                    height: 170,
                    display: "flex",
                    alignItems: "center",
                    clipPath: `inset(-30% ${((1 - nameReveal) * 100).toFixed(2)}% -30% 0)`,
                    transform: `translate(${(mix(0, name.x - nameHome.x, fold) + (1 - nameReveal) * -40).toFixed(2)}px, ${mix(0, name.y - nameHome.y, fold).toFixed(2)}px) scale(${nameScale.toFixed(4)})`,
                    transformOrigin: "0 50%",
                  }}
                >
                  <RayaWordmark size={170} />
                </div>

                {cards.map(({ label, Icon, py, active, left, width }, i) => {
                  const rise = span(t, platform + 0.05 + i * 0.16, platform + 0.65 + i * 0.16, EASE.arrive);
                  const row = at(RAIL.labelX, py);
                  const scale = mix(1, (RAIL.font * k) / PILL.font, fold);
                  const originX = PILL.padX + PILL.icon + PILL.gap + 1;
                  // In the card's own units: where the rail would put its icon.
                  const iconGap = mix(PILL.gap + PILL.icon / 2, ((RAIL.labelX - RAIL.iconCx) * k) / scale, fold);
                  const iconSize = mix(PILL.icon, (RAIL.icon * k) / scale, fold);
                  const chrome = (1 - fold) * rise;
                  return (
                    <div
                      key={label}
                      style={{
                        position: "absolute",
                        left,
                        top: PILL.top,
                        width,
                        height: PILL.h,
                        boxSizing: "border-box",
                        borderRadius: 999,
                        background: `rgba(255,255,255,${(0.78 * chrome).toFixed(3)})`,
                        border: `1px solid rgba(15,23,42,${(0.07 * chrome).toFixed(3)})`,
                        boxShadow: `0 1px 2px rgba(15,23,42,${(0.06 * chrome).toFixed(3)}), 0 12px 30px rgba(15,23,42,${(0.08 * chrome).toFixed(3)})`,
                        opacity: rise,
                        transform: `translate(${mix(0, row.x - left - originX, fold).toFixed(2)}px, ${(mix(0, row.y - PILL.top - PILL.h / 2, fold) + (1 - rise) * 22 * (1 - fold)).toFixed(2)}px) scale(${scale.toFixed(4)})`,
                        transformOrigin: `${originX}px 50%`,
                      }}
                    >
                      <span style={{ position: "absolute", left: originX - iconGap, top: PILL.h / 2, transform: "translate(-50%,-50%)", display: "flex", color: active || fold < 0.5 ? "#2f7fe0" : "#44546a" }}>
                        <Icon size={iconSize} style={{ width: iconSize, height: iconSize }} />
                      </span>
                      <span
                        style={{
                          position: "absolute",
                          left: originX,
                          top: PILL.h / 2,
                          transform: "translateY(-50%)",
                          whiteSpace: "nowrap",
                          fontFamily: FONTS.display,
                          fontWeight: active ? 600 : mix(600, 420, fold),
                          fontSize: PILL.font,
                          color: active ? "#0b1220" : fold > 0.6 ? "#44546a" : "#0b1220",
                        }}
                      >
                        {label}
                      </span>
                    </div>
                  );
                })}
              </>
            );
          })()}
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
}
