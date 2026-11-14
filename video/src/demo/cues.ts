import cuesFile from "../../bluestift_demo_cues.json";
import alignedFile from "./generated/cues.json";

/**
 * The demo's master clock, read from bluestift_demo_cues.json.
 *
 * The picture never sets a time of its own: scene switches happen on cue
 * starts, and every accent (cracks, pulses, tags, glows) is pinned to a word
 * of the transcript. When the Whisper pass (brief, Phase 2) overwrites the
 * cue starts, the picture moves with them — nothing here is timed by eye.
 */

export const FPS = 30;
export const WIDTH = 1920;
export const HEIGHT = 1080;
export const TOTAL_FRAMES = 4461;
export const DURATION_SEC = 148.71;
export const VOICE_ENDS_AT = 145.7;

export type BackgroundState =
  | "graph_gray"
  | "graph_gray_crack"
  | "graph_dim"
  | "graph_soft"
  | "graph_path_lit"
  | "graph_physics_green"
  | "graph_class_wide"
  | "graph_same_node_lit"
  | "graph_two_nodes_linked"
  | "graph_regroup";

export interface Cue {
  id: number;
  startSec: number;
  alignPhrase: string;
  section: string;
  source: string | null;
  transitionIn: { type: string; durationFrames: number; notes: string };
  background: BackgroundState;
  overlays: string[];
  holdSec?: number;
  holdUntil?: string;
  startFrame: number;
}

interface CuesFile {
  meta: { fps: number; width: number; height: number; audioDurationSec: number; totalFrames: number; voiceEndsAtSec: number };
  cues: Cue[];
}

const data = cuesFile as unknown as CuesFile;
// Measured starts (scripts/demo-align.mjs) override the brief's estimates.
const aligned = alignedFile as unknown as { id: number; startSec: number; startFrame: number }[];
const byId = new Map(aligned.map((c) => [c.id, c]));
export const CUES: Cue[] = [...data.cues]
  .map((c) => {
    const a = byId.get(c.id);
    return a ? { ...c, startSec: a.startSec, startFrame: a.startFrame } : c;
  })
  .sort((a, b) => a.startSec - b.startSec);

/** The cue on screen at film time `t` (seconds). */
export function cueAt(t: number): Cue {
  let active = CUES[0];
  for (const cue of CUES) {
    if (t >= cue.startSec - 1e-4) active = cue;
    else break;
  }
  return active;
}

export function cueIndexAt(t: number): number {
  return CUES.indexOf(cueAt(t));
}

/** End of a cue = start of the next one (or the film's end). */
export function cueEnd(cue: Cue): number {
  const i = CUES.indexOf(cue);
  return i + 1 < CUES.length ? CUES[i + 1].startSec : DURATION_SEC;
}

/** 0 → 1 over the cue's entry transition. */
export function cueEntry(t: number, cue: Cue): number {
  const dur = cue.transitionIn.durationFrames / FPS;
  return Math.min(1, Math.max(0, (t - cue.startSec) / dur));
}

/** The narration second a frame-exact time lands on (for slates' timecode). */
export function timecode(t: number): string {
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  const f = Math.floor((t * FPS) % FPS);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}:${String(f).padStart(2, "0")}`;
}
