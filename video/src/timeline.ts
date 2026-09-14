import script from "./script.json";
import manifest from "./generated/voice-manifest.json";

export const FPS = 30;
export const WIDTH = 1920;
export const HEIGHT = 1080;
/** The brief: two minutes, never more. */
export const MAX_SECONDS = 120;

/** Silence before a scene's first line, between lines, and after its last. */
const LEAD = 0.8;
const GAP = 0.5;
const TAIL = 1.1;

export type Speaker = "A" | "B";

export type TimedLine = {
  file: string;
  speaker: Speaker;
  text: string;
  /** Seconds from the start of the scene. */
  start: number;
  duration: number;
};

export type TimedScene = {
  id: string;
  eyebrow?: string;
  headline?: string;
  /** Seconds from the start of the video. */
  start: number;
  duration: number;
  lines: TimedLine[];
};

const durations = manifest as Record<string, number>;

/**
 * Lays the script out on the clock from the measured voice lines.
 *
 * A scene lasts as long as its speech needs, or its minimum when the speech is
 * shorter — and then the spare time is spread between the lines rather than
 * left at the end, so the voice keeps pace with the pictures instead of
 * finishing early and waiting. Re-timed automatically when the voice files
 * change (scripts/voice-manifest.mjs).
 */
function build(): TimedScene[] {
  let clock = 0;
  return script.scenes.map((scene) => {
    const lengths = scene.lines.map((_, i) => {
      const file = `${scene.id}-${i}`;
      const d = durations[file];
      if (d == null) throw new Error(`No voice file measured for ${file} — run npm run prepare:assets`);
      return d;
    });
    const speech = LEAD + lengths.reduce((a, b) => a + b, 0) + GAP * (lengths.length - 1) + TAIL;
    const duration = Math.max(scene.minSeconds, speech);
    const spare = (duration - speech) / (lengths.length + 1);

    let t = LEAD + spare;
    const lines = scene.lines.map((line, i) => {
      const timed: TimedLine = {
        file: `voice/${scene.id}-${i}.wav`,
        speaker: line.speaker as Speaker,
        text: line.text,
        start: t,
        duration: lengths[i],
      };
      t += lengths[i] + GAP + spare;
      return timed;
    });

    const timed: TimedScene = {
      id: scene.id,
      eyebrow: "eyebrow" in scene ? scene.eyebrow : undefined,
      headline: "headline" in scene ? scene.headline : undefined,
      start: clock,
      duration,
      lines,
    };
    clock += duration;
    return timed;
  });
}

export const SCENES = build();
export const TOTAL_SECONDS = SCENES.reduce((a, s) => a + s.duration, 0);

if (TOTAL_SECONDS > MAX_SECONDS) {
  throw new Error(
    `The video runs ${TOTAL_SECONDS.toFixed(1)}s, over the ${MAX_SECONDS}s brief. Shorten a line or a scene minimum in script.json.`,
  );
}

export const TOTAL_FRAMES = Math.ceil(TOTAL_SECONDS * FPS);
export const sec = (s: number) => Math.round(s * FPS);
