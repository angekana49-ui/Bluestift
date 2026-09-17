import { AbsoluteFill } from "remotion";
import { EASE, envelope, handheld, keys, keysOf, span, steady, useTime } from "../motion";
import { Plate, spot, World, type Pose } from "../Plate";
import { LOGIN, LoginScreen, SETTINGS, SettingsScreen, SUBPROCESSORS, SubprocessorsScreen } from "../screens";
import { TexturePlate } from "../Texture";
import { line, MUSIC, phrase, wordAt } from "../timeline";

/**
 * "Bluestift isn't just an AI tool, it's a whole ecosystem. And the people in
 * it stay in control."
 *
 * Morning, and every screen the film has shown so far, at once, in the air —
 * the ecosystem, revealed as the camera pulls back on the full band. Then the
 * controls themselves, each on the word that names it: starting without an
 * email, the recovery key and its replacement, the consent banner that says
 * no ads and asks before measuring, the row an under-18 sees instead, the one
 * switch an adult has, the download, the delete, and the public list of
 * everyone who touches the data.
 */

const CONSTELLATION: { name: string; x: number; y: number; z: number; ry: number; s: number }[] = [
  { name: "socratic-light", x: 0, y: -10, z: 0, ry: 0, s: 0.5 },
  { name: "room-light", x: -700, y: -40, z: -120, ry: 20, s: 0.4 },
  { name: "dashboard-light", x: 700, y: -30, z: -120, ry: -20, s: 0.44 },
  { name: "kernel-dark", x: -430, y: -330, z: -260, ry: 12, s: 0.36 },
  { name: "loop-dark", x: 430, y: -335, z: -260, ry: -12, s: 0.3 },
  { name: "tools-dark", x: -460, y: 330, z: -200, ry: 12, s: 0.3 },
  { name: "return-light", x: 450, y: 320, z: -200, ry: -12, s: 0.36 },
  { name: "focus-dark", x: -1020, y: 280, z: -420, ry: 26, s: 0.34 },
  { name: "guided-light", x: 1020, y: 270, z: -420, ry: -26, s: 0.36 },
];

export function Control() {
  const t = useTime();
  const from = MUSIC.full - 0.4;
  const to = line("outro-0").start - 1.4;
  if (t < from || t > to) return null;

  const ecosystem = phrase("control-0", 1).start;
  const people = line("control-1").start;
  const start = line("control-2").start;
  const email = wordAt("control-2", "email");
  const recovery = phrase("control-2", 1).start;
  const replace = phrase("control-2", 2).start;
  const noAds = line("control-3").start;
  const neverSell = phrase("control-3", 1).start;
  const analytics = line("control-4").start;
  const yes = wordAt("control-4", "yes");
  const eighteen = phrase("control-4", 1).start;
  const minorLine = line("control-5").start;
  const adults = phrase("control-5", 1).start;
  const switchWord = wordAt("control-5", "switch");
  const download = line("control-6").start;
  const del = phrase("control-6", 1).start;
  const whenever = phrase("control-6", 2).start;
  const listed = line("control-7").start;

  /* ── the ecosystem ── */
  const cloud = keysOf(t, [
    [from, { o: 0, spread: 0.7, focus: 0.4 }],
    [MUSIC.full + 0.4, { o: 1, spread: 0.82, focus: 1 }],
    [ecosystem + 1.2, { o: 1, spread: 1, focus: 1 }],
    [people + 0.6, { o: 1, spread: 1.04, focus: 0.8 }],
    [people + 1.5, { o: 0, spread: 1.1, focus: 0.3 }],
  ]);
  const turn = keys(t, [[from, -4], [people + 1.5, 4]], EASE.linear);

  /* ── the screens ── */
  const loginPose: Pose = keysOf(t, [
    [people + 0.4, { x: 0, y: 80, s: 0.86, o: 0, focus: 0.2 }],
    [people + 1.4, { x: 0, y: 0, s: 1.0, o: 1, focus: 1 }],
    [recovery - 0.3, { x: 0, y: 0, s: 1.0, o: 1, focus: 1 }],
    [recovery + 0.4, { x: -700, y: 0, s: 0.9, o: 0, focus: 0.3 }],
  ]);
  const setPose: Pose = keysOf(t, [
    [recovery - 0.4, { x: 700, y: 0, s: 0.96, o: 0, focus: 0.3 }],
    [recovery + 0.3, { x: 0, y: 0, s: 1.0, o: 1, focus: 1 }],
    [listed - 0.2, { x: 0, y: 0, s: 1.0, o: 1, focus: 1 }],
    [listed + 0.5, { x: -700, y: 0, s: 0.92, o: 0, focus: 0.3 }],
  ]);
  const subPose: Pose = keysOf(t, [
    [listed - 0.3, { x: 700, y: 40, s: 0.96, o: 0, focus: 0.3 }],
    [listed + 0.4, { x: 0, y: 0, s: 1.02, o: 1, focus: 1 }],
    [to - 1.2, { x: 0, y: -20, s: 0.98, o: 1, focus: 1 }],
    [to, { x: 0, y: -160, s: 0.84, o: 0, focus: 0.4 }],
  ]);

  const set = (k: keyof typeof SETTINGS) => {
    const p = SETTINGS[k] as { x: number; y: number };
    return spot({ s: 1 }, SETTINGS.w, SETTINGS.h, p.x, p.y);
  };
  const anon = spot({ s: 1 }, LOGIN.w, LOGIN.h, LOGIN.anon.x, LOGIN.anon.y);

  const press = (at: number) => span(t, at, at + 0.35, EASE.linear);
  const state = {
    keyShown: span(t, recovery + 0.2, recovery + 1.1, EASE.linear),
    keySwap: span(t, replace + 0.55, replace + 1.35, EASE.linear),
    generatePressed: press(replace + 0.25),
    banner: envelope(t, noAds - 0.35, noAds + 0.15, yes + 0.25, yes + 0.65),
    markNoAds: span(t, noAds + 0.05, noAds + 0.6, EASE.move),
    markNeverSell: span(t, neverSell + 0.05, neverSell + 1.2, EASE.move),
    acceptPressed: press(yes - 0.1),
    analyticsOn: span(t, yes + 0.55, yes + 0.8, EASE.move),
    minor: envelope(t, eighteen + 0.3, eighteen + 0.8, adults, adults + 0.45),
    markMinor: span(t, minorLine + 0.3, minorLine + 1.9, EASE.move),
    trainingOn: 1 - span(t, switchWord, switchWord + 0.25, EASE.move),
    downloadPressed: press(download + 0.25),
    fileChip: envelope(t, download + 0.5, download + 0.8, whenever + 0.4, whenever + 0.8),
    deleteTyped: span(t, del + 0.3, del + 1.0, EASE.linear),
  };

  const c = (p: { x: number; y: number }, zoom: number, dx = 0, dy = 0) => ({ x: p.x + dx, y: p.y + dy, zoom });
  const drift = handheld(t);
  const cam = steady(t, (u) => keysOf(u, [
    [from, { x: 0, y: 0, zoom: 2.1 }],
    [MUSIC.full + 0.6, { x: 0, y: 0, zoom: 1.7 }],
    [ecosystem + 1.2, { x: 0, y: 0, zoom: 0.98 }],
    [people, { x: 0, y: 0, zoom: 1.0 }],
    [people + 1.5, { x: 0, y: 0, zoom: 1.0 }],
    [start + 0.4, { x: 0, y: 0, zoom: 1.15 }],
    [email, c(anon, 1.6)],
    [recovery - 0.2, c(anon, 1.6)],
    [recovery + 0.5, c(set("key"), 1.75)],
    [replace + 0.1, c(set("generate"), 1.7, 120)],
    [noAds - 0.4, c(set("generate"), 1.6, 120)],
    [noAds + 0.2, c(set("banner"), 1.75)],
    [yes - 0.3, c(set("banner"), 1.75)],
    [yes + 0.5, c(set("analytics"), 1.7, -60)],
    [eighteen + 0.4, c(set("minor"), 1.6, -80)],
    [adults, c(set("minor"), 1.6, -80)],
    [switchWord - 0.4, c(set("training"), 1.75, -60)],
    [download, c(set("training"), 1.75, -60)],
    [download + 0.4, c(set("download"), 1.75, -60, 20)],
    [del + 0.3, c(set("remove"), 1.65, -60)],
    [whenever + 0.4, { x: 0, y: 0, zoom: 1.0 }],
    [listed - 0.2, { x: 0, y: 0, zoom: 1.0 }],
    [listed + 0.6, { x: 0, y: -60, zoom: 1.12 }],
    [to - 1.2, { x: 0, y: 80, zoom: 1.12 }],
    [to, { x: 0, y: -120, zoom: 0.9 }],
  ]));
  const camera = { x: cam.x + drift.x, y: cam.y + drift.y, zoom: cam.zoom, roll: drift.r };

  return (
    <AbsoluteFill>
      <World camera={camera} perspective={2000}>
        {cloud.o > 0.001 &&
          CONSTELLATION.map((p) => (
            <TexturePlate
              key={p.name}
              name={p.name}
              pose={{ x: p.x * cloud.spread, y: p.y * cloud.spread, z: p.z, ry: p.ry + turn, s: p.s, o: cloud.o, focus: p.z < -300 ? cloud.focus * 0.75 : cloud.focus }}
            />
          ))}

        {t > people + 0.3 && t < recovery + 0.5 && (
          <Plate width={LOGIN.w} url="raya.thebluestift.com/login" pose={loginPose}>
            {() => <LoginScreen pressed={press(email - 0.1)} />}
          </Plate>
        )}
        {t > recovery - 0.5 && t < listed + 0.6 && (
          <Plate width={SETTINGS.w} url="raya.thebluestift.com/settings" pose={setPose}>
            {() => <SettingsScreen {...state} />}
          </Plate>
        )}
        {t > listed - 0.4 && (
          <Plate width={SUBPROCESSORS.w} url="thebluestift.com/legal/subprocessors" pose={subPose}>
            {() => <SubprocessorsScreen rows={span(t, listed + 0.3, listed + 2.2, EASE.linear)} />}
          </Plate>
        )}
      </World>

      {/* The Kernel's closing light, clearing to show the morning. */}
      {t < MUSIC.full + 1.2 && (
        <AbsoluteFill style={{ background: "#fbfdff", opacity: keys(t, [[from, 0], [MUSIC.full - 0.1, 1], [MUSIC.full + 0.15, 1], [MUSIC.full + 1.1, 0]], EASE.soft) }} />
      )}
    </AbsoluteFill>
  );
}
