import { AbsoluteFill, Html5Audio, interpolate, Sequence, staticFile } from "remotion";
import { GuidedShot, KernelShot, RoomShot, SocraticShot, ToolsShot } from "@/components/site/ProductShots";
import { ConceptGraphShot } from "@/components/site/KernelDiagrams";
import { Backdrop } from "./Backdrop";
import { Captions } from "./Captions";
import { FONT_VARS, theme } from "./brand";
import { ShotScene } from "./ShotScene";
import { IntroScene, OutroScene } from "./TitleScenes";
import { FPS, SCENES, TOTAL_SECONDS, sec, type TimedScene } from "./timeline";
import "./generated/site.css";

/**
 * The shots loop on their own on the site; here the scene decides. A shot that
 * ended would sit still for the rest of a long scene, so `ShotScene` can replay
 * it — nothing here waits on a real timer.
 */
const SHOT_RESET = `.pub-shot-anim.is-live.is-cycling{animation:none!important}`;

const scene = (id: string): TimedScene => {
  const s = SCENES.find((x) => x.id === id);
  if (!s) throw new Error(`script.json has no scene "${id}"`);
  return s;
};

function SceneBody({ s }: { s: TimedScene }) {
  switch (s.id) {
    case "intro":
      return <IntroScene scene={s} />;
    case "chat":
      return (
        <ShotScene
          scene={s}
          layout="wide"
          beats={[{ at: 0.3, url: "raya.thebluestift.com/chat", node: <SocraticShot theme={theme} />, speed: 0.55 }]}
        />
      );
    case "rooms":
      return (
        <ShotScene
          scene={s}
          layout="side"
          beats={[{ at: 0.3, url: "raya.thebluestift.com/rooms", node: <RoomShot theme={theme} />, speed: 0.7 }]}
        />
      );
    case "tools":
      return (
        <ShotScene
          scene={s}
          layout="side"
          beats={[
            { at: 0.3, url: "raya.thebluestift.com/tools", node: <ToolsShot theme={theme} />, speed: 0.4 },
            // What the material is for: the session that uses it.
            { at: s.duration * 0.5, url: "raya.thebluestift.com/chat", node: <GuidedShot theme={theme} />, speed: 0.6 },
          ]}
        />
      );
    case "kernel":
      return (
        <ShotScene
          scene={s}
          layout="side"
          beats={[
            { at: 0.3, url: "raya.thebluestift.com/profile", node: <KernelShot theme={theme} />, speed: 0.45 },
            { at: s.duration * 0.42, url: "raya.thebluestift.com/profile", node: <ConceptGraphShot theme={theme} />, speed: 1 },
          ]}
        />
      );
    case "outro":
      return <OutroScene scene={s} />;
    default:
      throw new Error(`No picture for scene "${s.id}"`);
  }
}

/** Every voice line, flattened onto the video's clock, for ducking the music under it. */
const SPEECH = SCENES.flatMap((s) => s.lines.map((l) => [s.start + l.start, s.start + l.start + l.duration] as const));

/**
 * The music sits under the voice: it dips while someone is speaking and lifts
 * in the gaps, with short ramps so the change is felt rather than heard.
 */
function musicVolume(frame: number) {
  const t = frame / FPS;
  const distance = SPEECH.reduce((best, [a, b]) => Math.min(best, t < a ? a - t : t > b ? t - b : 0), Infinity);
  const duck = interpolate(distance, [0, 0.4], [0.09, 0.2], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const fades = Math.min(
    interpolate(t, [0, 1.5], [0, 1], { extrapolateRight: "clamp" }),
    interpolate(t, [TOTAL_SECONDS - 2.5, TOTAL_SECONDS], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
  );
  return duck * fades;
}

export function HowItWorks() {
  return (
    <AbsoluteFill>
      <style>{FONT_VARS + SHOT_RESET}</style>
      <Backdrop />

      {SCENES.map((s) => (
        <Sequence key={s.id} from={sec(s.start)} durationInFrames={sec(s.duration)} name={s.id}>
          <SceneBody s={scene(s.id)} />
          {s.lines.map((line, i) => (
            <Sequence key={i} from={sec(line.start)} name={`${s.id} · ${line.speaker}`}>
              <Html5Audio src={staticFile(line.file)} />
            </Sequence>
          ))}
        </Sequence>
      ))}

      <Html5Audio src={staticFile("music/bed.wav")} volume={musicVolume} />
      <Captions />
    </AbsoluteFill>
  );
}
