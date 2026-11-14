import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Sync, without Whisper and without installing anything.
 *
 * The narration mix is voice over a continuous music bed, so plain silence
 * detection drowns. Instead: frame energies → Otsu split on log-energy →
 * speech runs separated by real pauses. The script's own pause markers
 * ([short pause] × 5, paragraph breaks × 3, "…"/"..." × 2) anchor to the
 * longest detected gaps in order; words spread across the speech between
 * them by weight (punctuation buys extra time).
 *
 * Outputs (committed, like the other generated files):
 *   src/demo/generated/alignment.json — every script word, timed
 *   src/demo/generated/phrases.json   — the 55 caption phrases, timed
 *   src/demo/generated/cues.json      — cue starts re-timed (brief Phase 2)
 *
 *   node scripts/demo-align.mjs
 */
const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, "..");
const norm = (s) =>
  s
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/…/g, "...")
    .replace(/[^\p{L}\p{N}]/gu, "");

/* ── 1. frame energies of the 16 kHz mono mix ── */
const wav = readFileSync(path.join(root, "narration_mix_16k.wav"));
const dataAt = wav.indexOf(Buffer.from("data")) + 8;
const samples = new Int16Array(wav.buffer, wav.byteOffset + dataAt, Math.floor((wav.length - dataAt) / 2));
const SR = 16000;
const FRAME = 320;
const HOP = 160;
const energies = [];
for (let i = 0; i + FRAME <= samples.length; i += HOP) {
  let sum = 0;
  for (let j = 0; j < FRAME; j++) {
    const v = samples[i + j] / 32768;
    sum += v * v;
  }
  energies.push(Math.sqrt(sum / FRAME));
}
// Smooth (~50 ms) so plosives don't split words.
const W = 5;
const smooth = energies.map((_, i) => {
  let a = 0;
  let n = 0;
  for (let k = -W; k <= W; k++) {
    if (i + k >= 0 && i + k < energies.length) {
      a += energies[i + k];
      n++;
    }
  }
  return a / n;
});

/* ── 2. Adaptive split: voice is ~+8 dB over the LOCAL bed ──
 * A global threshold drowns the [softly] passage and lets music swells
 * through. The bed is the rolling 10th percentile over ±3 s. */
const toSec = (i) => (i * HOP) / SR;
const R = Math.round(3000 / ((HOP / SR) * 1000)); // ±3 s in frames
const floor = smooth.map((_, i) => {
  const win = [];
  for (let k = -R; k <= R; k += 4) {
    if (i + k >= 0 && i + k < smooth.length) win.push(smooth[i + k]);
  }
  win.sort((a, b) => a - b);
  return win[Math.floor(win.length * 0.1)];
});
const FACTOR = 2.4;
const ABS_MIN = 0.012;
const speech = smooth.map((e, i) => e > ABS_MIN && e >= floor[i] * FACTOR);
// Merge speech across gaps < 0.25 s; drop speech runs < 0.15 s.
const MIN_GAP = 0.25;
const MIN_SPEECH = 0.15;
const segs = [];
let start = null;
for (let i = 0; i <= speech.length; i++) {
  const s = i < speech.length ? speech[i] : false;
  if (s && start == null) start = i;
  if (!s && start != null) {
    segs.push([toSec(start), toSec(i)]);
    start = null;
  }
}
const merged = [];
for (const [a, b] of segs) {
  const last = merged[merged.length - 1];
  if (last && a - last[1] < MIN_GAP) last[1] = b;
  else merged.push([a, b]);
}
// Drop bed-level runs (mean < 0.025): breaths and the fading tail bed.
// Voice runs average 0.05+ even in the [softly] passage. (A CV rule was
// tried here and ate real voice — energy alone is the safer cut.)
// And nothing voice-like survives past 145.5 s: the bin analysis shows the
// tail from there is bed + fade (means ≤0.020, flat), so runs starting
// beyond it are the bed leaking through the adaptive floor.
const runs = merged
  .map(([a, b]) => [a, Math.min(b, 145.5)])
  .filter(([a, b]) => {
    if (b - a < MIN_SPEECH) return false;
    const i0 = Math.round((a * SR) / HOP);
    const i1 = Math.round((b * SR) / HOP);
    const slice = smooth.slice(i0, i1);
    const m = slice.reduce((x, v) => x + v, 0) / slice.length;
    return m >= 0.025;
  });
const gaps = [];
for (let i = 0; i < runs.length; i++) {
  const prevEnd = i === 0 ? 0 : runs[i - 1][1];
  gaps.push({ from: prevEnd, to: runs[i][0], dur: runs[i][0] - prevEnd, beforeRun: i });
}
const totalSpeech = runs.reduce((a, [x, y]) => a + y - x, 0);
console.log(`adaptive ×${FACTOR} → ${runs.length} speech runs, voice ${totalSpeech.toFixed(1)}s of ${(samples.length / SR).toFixed(1)}s, last speech ${runs.at(-1)?.[1].toFixed(2)}s`);

/* ── 3. the script: words + pause anchors ── */
const script = readFileSync(path.join(root, "narration", "demo-script.txt"), "utf8");
const tokens = []; // {w, orig} | {pause: "short"|"para"|"micro"}
for (const para of script.split("\n").map((p) => p.trim()).filter(Boolean)) {
  const parts = para.split(/(\[[^\]]+\])/g);
  for (const part of parts) {
    const tag = part.match(/^\[([^\]]+)\]$/);
    if (tag) {
      if (tag[1] === "short pause") tokens.push({ pause: "short" });
      continue; // delivery tags ([happy]…) carry no time
    }
    for (const w of part.split(/\s+/).filter(Boolean)) {
      tokens.push({ w: w, n: norm(w) });
      if (/[.]{3}$|…$/.test(w)) tokens.push({ pause: "micro" });
    }
  }
  tokens.push({ pause: "para" });
}
if (tokens.at(-1)?.pause === "para") tokens.pop(); // no trailing pause
const words = tokens.filter((t) => t.w);
console.log(`${words.length} script words, ${tokens.filter((t) => t.pause).length} pause markers`);

/* ── 4. anchor the 8 major pauses to gaps ──
 * Fully automatic assignment kept misfiring (pause lengths overlap sentence
 * breaths), so the windows below are set from the measured energy trace and
 * cross-checked three ways: per-run speech rate must land in 0.22–0.45 s/word
 * (English narration physics), paragraph breaks must sit on long gaps, and
 * "Meanwhile" must land on the brief's 93.0 (it does: 92.97). Each anchor
 * takes the longest gap ≥0.3 s inside its window — robust to segmentation
 * jitter, and it throws if a window is empty. */
const anchors = [];
tokens.forEach((t, i) => {
  if (t.pause === "short" || t.pause === "para") anchors.push(i);
});
const weight = (w) => 1 + (/[,;:]$/.test(w) ? 0.5 : 0) + (/[.?!…]$/.test(w) ? 0.8 : 0);
const WINDOWS = [
  [1.5, 3.0], // P1 …Bluestift. ‖ Meet…
  [18.5, 21.5], // B1 …how. ‖ It's… (16.16 is mid-run; physics rejects it)
  [35.0, 37.5], // P2 …stuck. ‖ Still…
  [50.0, 53.0], // P3 …corner. ‖ Then…
  [91.0, 94.0], // B2 …independent. ‖ Meanwhile,…
  [108.0, 111.0], // P4 …herself. ‖ One…
  [127.5, 129.5], // B3 …start. ‖ One…
  [129.8, 131.5], // P5 …teacher. ‖ One…
];
const majorGaps = WINDOWS.map(([a, b], i) => {
  const cands = gaps.filter((g) => g.dur >= 0.3 && g.from >= a && g.from <= b);
  if (!cands.length) throw new Error(`no gap in anchor window ${i} [${a}, ${b}]`);
  return cands.sort((x, y) => y.dur - x.dur)[0];
});
majorGaps.forEach((g, a) => {
  const tokIdx = anchors[a];
  const prev = tokens[tokIdx - 1]?.w ?? "∅";
  const next = tokens[tokIdx + 1]?.w ?? "∅";
  console.log(`anchor ${a}: gap ${g.from.toFixed(2)}→${g.to.toFixed(2)} (${g.dur.toFixed(2)}s) …${prev} ‖ ${next}…`);
});
// Script runs between anchors → audio runs between the chosen gaps.
// Words spread across SPEECH time only (internal small gaps skipped).
const timed = new Array(words.length);
let wi = 0;
let prevEnd = 0;
for (let a = 0; a <= anchors.length; a++) {
  const tokFrom = a === 0 ? 0 : anchors[a - 1] + 1;
  const tokTo = a === anchors.length ? tokens.length : anchors[a];
  const runWords = [];
  for (let i = tokFrom; i < tokTo; i++) if (tokens[i].w) runWords.push(tokens[i]);
  const winStart = Math.max(prevEnd, a === 0 ? (runs[0]?.[0] ?? 0) : (majorGaps[a - 1]?.to ?? prevEnd));
  const gapAfter = a === anchors.length ? null : majorGaps[a];
  const winEnd = gapAfter ? Math.max(winStart + 0.3, gapAfter.from) : (runs.at(-1)?.[1] ?? winStart + 1);
  // Speech sub-segments inside the window.
  const speech = [];
  for (const [s, e] of runs) {
    const a0 = Math.max(s, winStart);
    const b0 = Math.min(e, winEnd);
    if (b0 - a0 > 0.05) speech.push([a0, b0]);
  }
  const speechDur = speech.reduce((s, [x, y]) => s + y - x, 0);
  const totalW = runWords.reduce((s, t) => s + weight(t.w), 0) || 1;
  let seg = 0;
  let offset = speech[0]?.[0] ?? winStart;
  const advance = (dur) => {
    let t = offset;
    let remaining = dur;
    while (remaining > 1e-6 && seg < speech.length) {
      const [s0, s1] = speech[seg];
      if (t < s0) t = s0;
      const room = s1 - t;
      if (room >= remaining) {
        t += remaining;
        remaining = 0;
      } else {
        remaining -= room;
        seg++;
        t = speech[seg]?.[0] ?? s1;
      }
    }
    offset = t;
    return t;
  };
  for (const t of runWords) {
    const at = seg < speech.length ? advance(0) : offset;
    timed[wi++] = { w: t.w, at };
    advance(speechDur > 0 ? (speechDur * weight(t.w)) / totalW : 0.3);
  }
  prevEnd = offset;
  const label = runWords.length ? `"${runWords[0].w}…${runWords.at(-1).w}"` : "(empty)";
  console.log(`run ${a}: ${runWords.length}w ${winStart.toFixed(2)}→${winEnd.toFixed(2)} speech=${speechDur.toFixed(2)}s ${label}`);
}

/* ── 5. phrases + cues ── */
const phrases = JSON.parse(readFileSync(path.join(root, "narration", "demo-phrases.json"), "utf8"));
const out = [];
let cursor = 0;
for (const p of phrases) {
  const want = p.text.split(/\s+/).map(norm);
  const found = [];
  for (const w of want) {
    let ok = false;
    while (cursor < timed.length) {
      if (norm(timed[cursor].w) === w) {
        found.push(timed[cursor]);
        cursor++;
        ok = true;
        break;
      }
      cursor++;
    }
    if (!ok) throw new Error(`phrase not found in order: "${p.text}" (stuck on "${w}")`);
  }
  const startT = found[0].at;
  const nextAt = cursor < timed.length ? timed[cursor].at : startT + 1;
  out.push({
    start: +startT.toFixed(3),
    end: +Math.min(nextAt - 0.05, startT + found.length * 0.6).toFixed(3),
    text: p.text,
    keyword: p.keyword,
    words: found.map((f) => ({ word: f.w, at: +f.at.toFixed(3) })),
  });
}
const cuesFile = JSON.parse(readFileSync(path.join(root, "bluestift_demo_cues.json"), "utf8"));
const alignedCues = [];
let cCursor = 0;
for (const cue of cuesFile.cues) {
  if (cue.id === 1) {
    alignedCues.push({ id: 1, startSec: 0, startFrame: 0 });
    continue;
  }
  const want = cue.alignPhrase.split(/\s+/).map(norm).filter(Boolean);
  let at = null;
  outer: for (let i = cCursor; i + want.length <= timed.length; i++) {
    for (let j = 0; j < want.length; j++) {
      if (norm(timed[i + j].w) !== want[j]) continue outer;
    }
    at = timed[i].at;
    cCursor = i;
    break;
  }
  if (at == null) {
    console.log(`WARNING: alignPhrase not found for cue ${cue.id} ("${cue.alignPhrase}") — keeping estimate ${cue.startSec}`);
    alignedCues.push({ id: cue.id, startSec: cue.startSec, startFrame: cue.startFrame });
  } else {
    alignedCues.push({ id: cue.id, startSec: +at.toFixed(3), startFrame: Math.round(at * 30) });
    console.log(`cue ${cue.id}: ${cue.startSec.toFixed(1)} → ${at.toFixed(2)} ("${cue.alignPhrase.slice(0, 42)}…")`);
  }
}

const dir = path.join(root, "src", "demo", "generated");
mkdirSync(dir, { recursive: true });
writeFileSync(path.join(dir, "alignment.json"), JSON.stringify({ words: timed.map((t) => ({ w: t.w, at: +t.at.toFixed(3) })), gaps: gaps.map((g) => ({ from: +g.from.toFixed(2), to: +g.to.toFixed(2) })) }, null, 1) + "\n");
writeFileSync(path.join(dir, "phrases.json"), JSON.stringify(out, null, 1) + "\n");
writeFileSync(path.join(dir, "cues.json"), JSON.stringify(alignedCues, null, 1) + "\n");
console.log(`wrote generated/alignment.json (${timed.length} words), phrases.json (${out.length}), cues.json (${alignedCues.length})`);
console.log(`first word ${timed[0].at.toFixed(2)}s, last word ${timed.at(-1).at.toFixed(2)}s`);
