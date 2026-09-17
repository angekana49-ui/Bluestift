import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Subtitles for the delivered film, from the same clock the picture follows:
 * src/generated/soundtrack.json, where every phrase of the narration has the
 * time it is heard. Cues are cut where the recording breathes (its phrases) and
 * wrapped to two balanced lines of at most 42 characters, the usual limit for a
 * line read in one glance.
 *
 * A phrase alone is often a word or two ("I'm Liam,") and would flash past, so
 * the phrases of one line are joined while the cue is still short or would have
 * to be read too fast — as long as it still fits on two lines and stays under
 * seven seconds. A cue then stays up until it can be read at that pace (and for
 * at least 1.2 s) when the silence after it allows: the narration is quicker
 * than reading, and it pauses often.
 *
 *   node scripts/subtitles.mjs  →  out/how-it-works-en.vtt + .srt
 */
const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, "..");
const soundtrack = JSON.parse(readFileSync(path.join(root, "src", "generated", "soundtrack.json"), "utf8"));

const MAX_LINE = 42;
const MIN_SHOW = 1.2;
const MAX_SHOW = 7;
/** Characters per second a cue should not ask to be read faster than. */
const MAX_CPS = 17;
const GAP = 0.08;

/**
 * One line if it fits; else two, broken after a comma or a colon when there is
 * one that leaves both lines a real length (a line reads as a unit of sense,
 * "Bluestift is a collaborative platform, / built around Raya," not "…a
 * collaborative / platform, built…"), and otherwise where the halves are most
 * even. Null if two lines cannot hold it.
 */
function tryWrap(text) {
  if (text.length <= MAX_LINE) return [text];
  const words = text.split(" ");
  let best = null;
  for (let i = 1; i < words.length; i++) {
    const a = words.slice(0, i).join(" ");
    const b = words.slice(i).join(" ");
    if (a.length > MAX_LINE || b.length > MAX_LINE) continue;
    const sense = /[,;:.!?]$/.test(a) && Math.min(a.length, b.length) >= 12;
    const score = (sense ? 0 : 100) + Math.abs(a.length - b.length);
    if (!best || score < best.score) best = { lines: [a, b], score };
  }
  return best ? best.lines : null;
}

const joined = [];
for (const line of soundtrack.lines) {
  let cue = null;
  for (const p of line.phrases) {
    const text = p.text.trim().replace(/\s+/g, " ");
    if (cue) {
      const both = `${cue.text} ${text}`;
      const duration = cue.end - cue.start;
      const tooQuick = duration < 1.6 || cue.text.length / duration > MAX_CPS;
      if (tooQuick && tryWrap(both) && p.end - cue.start <= MAX_SHOW) {
        cue = { ...cue, end: p.end, text: both };
        continue;
      }
      joined.push(cue);
    }
    cue = { start: p.start, end: p.end, text };
  }
  if (cue) joined.push(cue);
}
joined.sort((a, b) => a.start - b.start);

const cues = joined.map((c, i) => {
  const lines = tryWrap(c.text);
  if (!lines) throw new Error(`Phrase too long for two lines of ${MAX_LINE}: "${c.text}" — split it in the soundtrack`);
  const next = joined[i + 1]?.start ?? Infinity;
  const readable = Math.min(MAX_SHOW, Math.max(MIN_SHOW, c.text.length / MAX_CPS));
  let end = Math.max(c.end, Math.min(c.start + readable, next - GAP));
  // A cue that runs into the next one's gap is chained to it: a 10 ms blank
  // between two cues is a flicker in most players, not a pause.
  if (next - end < GAP) end = next;
  return { start: c.start, end, lines };
});

const stamp = (s, sep) => {
  const ms = Math.round(s * 1000);
  const pad = (n, w = 2) => String(n).padStart(w, "0");
  return `${pad(Math.floor(ms / 3600000))}:${pad(Math.floor(ms / 60000) % 60)}:${pad(Math.floor(ms / 1000) % 60)}${sep}${pad(ms % 1000, 3)}`;
};

const vtt = ["WEBVTT", "", ...cues.flatMap((c, i) => [String(i + 1), `${stamp(c.start, ".")} --> ${stamp(c.end, ".")}`, ...c.lines, ""])].join("\n");
const srt = cues.flatMap((c, i) => [String(i + 1), `${stamp(c.start, ",")} --> ${stamp(c.end, ",")}`, ...c.lines, ""]).join("\r\n");

const out = path.join(root, "out", "how-it-works-en");
writeFileSync(`${out}.vtt`, vtt + "\n");
writeFileSync(`${out}.srt`, srt + "\r\n");
console.log(`${cues.length} cues → out/how-it-works-en.vtt, out/how-it-works-en.srt`);
