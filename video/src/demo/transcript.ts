import phrasesFile from "./generated/phrases.json";
import { DURATION_SEC } from "./cues";

/**
 * The narration, timed against the real mix (scripts/demo-align.mjs).
 *
 * Phrases come from narration/demo-phrases.json (hand-split to match the
 * cues); their starts, ends and word times are measured from the audio's own
 * pauses. Every visual accent in the film pins to these times — the crack on
 * "algebra", the pulse on "root cause", the chat beats, the Meanwhile cut.
 */

export interface Phrase {
  /** Seconds. */
  start: number;
  end: number;
  text: string;
  /** The one word of the phrase set in the accent colour. */
  keyword: string;
  words: { word: string; at: number }[];
}

export const PHRASES: Phrase[] = (phrasesFile as unknown as Phrase[]).map((p) => ({
  start: p.start,
  end: p.end,
  text: p.text,
  keyword: p.keyword,
  words: p.words.map((w) => ({ word: w.word, at: w.at })),
}));

/** The phrase being said at `t`, if any. */
export function phraseAt(t: number): Phrase | null {
  if (t < 0 || t > DURATION_SEC) return null;
  for (let i = PHRASES.length - 1; i >= 0; i--) {
    if (t >= PHRASES[i].start && t <= PHRASES[i].end + 0.35) return PHRASES[i];
  }
  return null;
}

/** When a word is said: the first match of `word` (case-insensitive, edge punctuation stripped) at or after `from`. */
export function wordAt(word: string, from = 0): number | null {
  // Strip punctuation at the edges only: inner dots belong to the word
  // ("thebluestift.com"), but a trailing "physics." must match "physics" —
  // keeping "." matched the wrong occurrence mid-film instead of the hook.
  const clean = (w: string) => w.toLowerCase().replace(/^[^a-z0-9']+|[^a-z0-9']+$/g, "");
  const want = clean(word);
  for (const p of PHRASES) {
    for (const w of p.words) {
      if (w.at >= from - 1e-3 && clean(w.word) === want) return w.at;
    }
  }
  return null;
}

/** The first phrase whose text contains `needle` (case-insensitive). */
export function phraseContaining(needle: string): Phrase {
  const found = PHRASES.find((p) => p.text.toLowerCase().includes(needle.toLowerCase()));
  if (!found) throw new Error(`transcript has no phrase containing "${needle}"`);
  return found;
}
