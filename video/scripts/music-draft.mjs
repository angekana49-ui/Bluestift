import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * DRAFT background music, synthesised here so it carries no licence question.
 *
 * A soft pad over a four-chord loop (Cmaj7 – Am7 – Fmaj9 – G6) with a quiet
 * plucked arpeggio on top: warm, gently moving, and meant to sit well under a
 * voice. It is a placeholder for a licensed track; drop that file in at
 * public/music/bed.wav under the same name.
 */
const here = dirname(fileURLToPath(import.meta.url));
const target = join(here, "..", "public", "music", "bed.wav");

const RATE = 44100;
const SECONDS = 126;
const BPM = 92;
const BEAT = 60 / BPM;
const BAR = BEAT * 4;
const N = Math.floor(RATE * SECONDS);

const hz = (midi) => 440 * Math.pow(2, (midi - 69) / 12);
// Voicings kept low and close: bright enough to feel optimistic, soft enough to disappear under speech.
const CHORDS = [
  [48, 55, 59, 64, 67], // Cmaj7
  [45, 52, 55, 60, 64], // Am7
  [41, 48, 55, 57, 64], // Fmaj9
  [43, 50, 55, 59, 64], // G6
];

const L = new Float32Array(N);
const R = new Float32Array(N);

// Pad: each chord lasts one bar with long crossfading envelopes.
for (let bar = 0; bar * BAR < SECONDS; bar++) {
  const chord = CHORDS[bar % CHORDS.length];
  const start = bar * BAR - 0.6;
  const end = start + BAR + 1.6;
  const s0 = Math.max(0, Math.floor(start * RATE));
  const s1 = Math.min(N, Math.floor(end * RATE));
  chord.forEach((note, v) => {
    const f = hz(note);
    const pan = (v / (chord.length - 1) - 0.5) * 0.6;
    for (let s = s0; s < s1; s++) {
      const t = s / RATE - start;
      const len = end - start;
      const env = Math.min(1, t / 1.2) * Math.min(1, (len - t) / 1.4);
      const vib = 1 + 0.0018 * Math.sin(2 * Math.PI * 0.21 * (s / RATE) + v);
      const ph = 2 * Math.PI * f * vib * (s / RATE);
      const tone = Math.sin(ph) + 0.18 * Math.sin(2 * ph + 0.4) + 0.06 * Math.sin(3 * ph);
      const x = tone * env * 0.05;
      L[s] += x * (1 - pan);
      R[s] += x * (1 + pan);
    }
  });
}

// Plucks: an eighth-note arpeggio over the chord tones, very quiet, decaying fast.
const eighth = BEAT / 2;
for (let k = 0; k * eighth < SECONDS - 1; k++) {
  const time = k * eighth;
  const chord = CHORDS[Math.floor(time / BAR) % CHORDS.length];
  const pattern = [2, 3, 4, 3, 2, 4, 3, 1];
  const note = chord[pattern[k % pattern.length]] + 12;
  const f = hz(note);
  const s0 = Math.floor(time * RATE);
  const s1 = Math.min(N, s0 + Math.floor(RATE * 1.1));
  const pan = k % 2 === 0 ? -0.25 : 0.25;
  const accent = k % 4 === 0 ? 1 : 0.7;
  for (let s = s0; s < s1; s++) {
    const t = (s - s0) / RATE;
    const env = Math.min(1, t / 0.004) * Math.exp(-t * 5.5);
    const ph = 2 * Math.PI * f * t;
    const x = (Math.sin(ph) + 0.25 * Math.sin(2 * ph)) * env * 0.028 * accent;
    L[s] += x * (1 - pan);
    R[s] += x * (1 + pan);
  }
}

// Master: fades, gentle saturation, normalise to a quiet peak.
let peak = 0;
for (let s = 0; s < N; s++) {
  const t = s / RATE;
  const fade = Math.min(1, t / 3) * Math.min(1, (SECONDS - t) / 4);
  L[s] = Math.tanh(L[s] * 1.4) * fade;
  R[s] = Math.tanh(R[s] * 1.4) * fade;
  peak = Math.max(peak, Math.abs(L[s]), Math.abs(R[s]));
}
const gain = 0.5 / (peak || 1);

const data = Buffer.alloc(N * 4);
for (let s = 0; s < N; s++) {
  data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, L[s] * gain)) * 32767), s * 4);
  data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, R[s] * gain)) * 32767), s * 4 + 2);
}
const header = Buffer.alloc(44);
header.write("RIFF", 0);
header.writeUInt32LE(36 + data.length, 4);
header.write("WAVE", 8);
header.write("fmt ", 12);
header.writeUInt32LE(16, 16);
header.writeUInt16LE(1, 20);
header.writeUInt16LE(2, 22);
header.writeUInt32LE(RATE, 24);
header.writeUInt32LE(RATE * 4, 28);
header.writeUInt16LE(4, 32);
header.writeUInt16LE(16, 34);
header.write("data", 36);
header.writeUInt32LE(data.length, 40);

mkdirSync(dirname(target), { recursive: true });
writeFileSync(target, Buffer.concat([header, data]));
console.log(`music bed: ${SECONDS}s at ${BPM} bpm`);
