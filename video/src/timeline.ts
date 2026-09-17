import soundtrack from "./generated/soundtrack.json";

/**
 * The film's clock, read from the soundtrack (scripts/soundtrack.mjs).
 *
 * The picture follows the sound, never the other way round: the voice and the
 * music were placed first, and every time below is a moment you can hear — a
 * line starting, a phrase landing, a downbeat, the music changing section.
 * Re-run `npm run soundtrack` and the picture moves with it.
 */

export const FPS = 30;
export const WIDTH = 1920;
export const HEIGHT = 1080;

export type SectionId = "intro" | "bluestift" | "raya" | "schools" | "kernel" | "control" | "outro";

export type Line = {
  id: string;
  section: SectionId;
  speaker: "M" | "A" | "B";
  text: string;
  start: number;
  end: number;
  /** Phrase boundaries inside the line, where the recording breathes. */
  phrases: { text: string; start: number; end: number }[];
  /** When each word starts, spread by syllables over its phrase. */
  words: { word: string; at: number }[];
};

export const DURATION = soundtrack.duration;
export const TOTAL_FRAMES = Math.ceil(DURATION * FPS);
export const LINES = soundtrack.lines as Line[];
export const SECTIONS = soundtrack.sections as { id: SectionId; start: number; end: number }[];
export const MUSIC = soundtrack.musicChanges as Record<"theme" | "groove" | "warm" | "breakdown" | "full" | "final", number>;

/** One bar and one beat of the music, in film seconds. */
export const BAR = soundtrack.bar;
export const BEAT = BAR / 4;
/** Every change of music section falls on a downbeat; the grid is anchored there. */
const GRID = MUSIC.theme - Math.round(MUSIC.theme / BAR) * BAR;

/** The nearest beat to a moment — so a cut can land on the music. */
export const onBeat = (t: number) => GRID + Math.round((t - GRID) / BEAT) * BEAT;
/** The last beat at or before a moment. */
export const beatBefore = (t: number) => GRID + Math.floor((t - GRID) / BEAT + 1e-6) * BEAT;

export const sec = (s: number) => Math.round(s * FPS);

export function line(id: string): Line {
  const l = LINES.find((x) => x.id === id);
  if (!l) throw new Error(`No line "${id}" in the soundtrack — run npm run soundtrack`);
  return l;
}

export function section(id: SectionId) {
  const s = SECTIONS.find((x) => x.id === id);
  if (!s) throw new Error(`No section "${id}" in the soundtrack`);
  return s;
}

/**
 * When a word is said (its first syllable, to within a syllable or so).
 * Matched case-blind on the start of the word; `nth` picks a later one when
 * the line says it twice.
 */
export function wordAt(lineId: string, word: string, nth = 1): number {
  const l = line(lineId);
  const needle = word.toLowerCase();
  const hits = l.words.filter((w) => w.word.toLowerCase().startsWith(needle));
  const hit = hits[nth - 1];
  if (!hit) throw new Error(`"${word}" (#${nth}) is not in line ${lineId}: ${l.text}`);
  return hit.at;
}

/** Start and end of the k-th phrase of a line (0-based). */
export function phrase(lineId: string, k: number) {
  const p = line(lineId).phrases[k];
  if (!p) throw new Error(`Line ${lineId} has no phrase ${k}`);
  return p;
}
