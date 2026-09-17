import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * The film's soundtrack, built from the two recordings in narration/.
 *
 * The narration is one continuous take and the music one continuous piece, and
 * neither was made to the other's clock. This lays them onto one:
 *
 *  0. Plays both `speed` times faster, at the same pitch.
 *  1. Aligns every script line to the narration, on the pauses the voice
 *     actually leaves (a line boundary is always a real pause).
 *  2. Places each section of the narration at the time soundtrack.json gives
 *     its first word, so a section starts just after the music turns, and
 *     never lets one voice follow another by less than `minSpeakerGap`.
 *  3. Re-edits the music in whole bars (it runs at a fixed tempo), cutting or
 *     repeating bars so its changes fall where the story changes.
 *  4. Corrects the music's tone (it was recorded through a phone: a boxy low
 *     mid, little air) and carves room for the voice.
 *  5. Mixes: the music sits low under speech, breathes between sections, and
 *     comes up when it plays alone; then the whole is set to web loudness.
 *
 * Writes public/audio/soundtrack.wav (the film plays this one file),
 * src/generated/soundtrack.json (every line and section on the film's clock,
 * and where the music changes) and out/soundtrack-preview.mp4 to listen to.
 */
const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const script = JSON.parse(readFileSync(join(root, "src", "script.json"), "utf8"));
const config = JSON.parse(readFileSync(join(root, "src", "soundtrack.json"), "utf8"));
const RATE = 48000;

/* ── ffmpeg (Remotion ships one) ───────────────────────────────────────── */

function ffmpegPath() {
  const dir = join(root, "node_modules", "@remotion");
  const pkg = readdirSync(dir).find((d) => d.startsWith("compositor-"));
  const bin = pkg && ["ffmpeg.exe", "ffmpeg"].map((b) => join(dir, pkg, b)).find(existsSync);
  if (!bin) throw new Error("Remotion's ffmpeg was not found — run npm install in video/");
  return bin;
}
const FF = ffmpegPath();

function ffmpeg(args) {
  const r = spawnSync(FF, ["-hide_banner", "-nostdin", ...args], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  if (r.status !== 0) throw new Error(`ffmpeg ${args.join(" ")}\n${r.stderr.slice(-1500)}`);
  return r.stderr;
}

const tmp = join(root, "out", "soundtrack-work");
mkdirSync(tmp, { recursive: true });

/**
 * Any audio file → mono float samples at 48 kHz, played `config.speed` times
 * faster at the same pitch. Everything after this works on the film's clock.
 */
function decode(file, name) {
  const wav = join(tmp, `${name}.wav`);
  ffmpeg(["-y", "-i", join(root, file), "-af", `atempo=${config.speed}`, "-acodec", "pcm_s16le", "-ac", "1", "-ar", String(RATE), wav]);
  return { samples: readWav(wav).channels[0], wav };
}

function readWav(path) {
  const buf = readFileSync(path);
  let offset = 12;
  let fmt = null;
  while (offset + 8 <= buf.length) {
    const id = buf.toString("ascii", offset, offset + 4);
    const size = buf.readUInt32LE(offset + 4);
    if (id === "fmt ") fmt = { channels: buf.readUInt16LE(offset + 10), rate: buf.readUInt32LE(offset + 12) };
    if (id === "data") {
      const frames = Math.floor(size / 2 / fmt.channels);
      const channels = Array.from({ length: fmt.channels }, () => new Float32Array(frames));
      for (let i = 0; i < frames; i++)
        for (let c = 0; c < fmt.channels; c++) channels[c][i] = buf.readInt16LE(offset + 8 + (i * fmt.channels + c) * 2) / 32768;
      return { rate: fmt.rate, channels };
    }
    offset += 8 + size + (size % 2);
  }
  throw new Error(`${path}: no data chunk`);
}

function writeWav(path, channels) {
  const frames = channels[0].length;
  const n = channels.length;
  const buf = Buffer.alloc(44 + frames * n * 2);
  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + frames * n * 2, 4);
  buf.write("WAVE", 8);
  buf.write("fmt ", 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(n, 22);
  buf.writeUInt32LE(RATE, 24);
  buf.writeUInt32LE(RATE * n * 2, 28);
  buf.writeUInt16LE(n * 2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write("data", 36);
  buf.writeUInt32LE(frames * n * 2, 40);
  for (let i = 0; i < frames; i++)
    for (let c = 0; c < n; c++) buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, channels[c][i])) * 32767), 44 + (i * n + c) * 2);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, buf);
}

/* ── 1. Align the script to the narration ──────────────────────────────── */

const lines = script.scenes.flatMap((scene) =>
  scene.lines.map((line, i) => ({ id: `${scene.id}-${i}`, section: scene.id, speaker: line.speaker, text: line.text })),
);

/** A rough spoken length: syllables, plus a little for each comma or colon. */
function weight(text) {
  const words = text.replace(/thebluestift\.com/g, "the blue stift dot com").replace(/\bAI\b/g, "ay eye").split(/\s+/);
  const syllables = words.reduce((n, w) => n + Math.max(1, (w.toLowerCase().replace(/e\b/, "").match(/[aeiouy]+/g) || []).length), 0);
  return syllables + 0.6 * (text.match(/[,:]/g) || []).length;
}

function align({ samples, wav }) {
  const duration = samples.length / RATE;
  const log = ffmpeg(["-i", wav, "-af", "silencedetect=noise=-40dB:d=0.12", "-f", "null", "-"]);
  const starts = [...log.matchAll(/silence_start: ([\d.]+)/g)].map((m) => +m[1]);
  const ends = [...log.matchAll(/silence_end: ([\d.]+)/g)].map((m) => +m[1]);
  const gaps = starts.map((s, i) => ({ s, e: ends[i] ?? duration })).filter((g) => g.s > 0.05);
  const segs = [];
  let t = 0;
  for (const g of gaps) {
    segs.push([t, g.s]);
    t = g.e;
  }
  if (t < duration - 0.05) segs.push([t, duration]);
  const gapAfter = (k) => (k < gaps.length ? gaps[k].e - gaps[k].s : 1);

  const K = segs.length;
  const N = lines.length;
  if (K < N) throw new Error(`The narration has ${K} spoken stretches for ${N} script lines — is it the right take?`);
  const w = lines.map((l) => weight(l.text));

  let best = null;
  for (let rate = 0.17; rate <= 0.3; rate += 0.002) {
    const dp = Array.from({ length: N + 1 }, () => new Float64Array(K + 1).fill(Infinity));
    const from = Array.from({ length: N + 1 }, () => new Int32Array(K + 1).fill(-1));
    dp[0][0] = 0;
    for (let j = 1; j <= N; j++) {
      const expected = rate * w[j - 1];
      for (let k = j; k <= K - (N - j); k++) {
        // A sentence rarely ends on a very short pause.
        const pause = j < N ? (0.6 * Math.max(0, 0.3 - gapAfter(k - 1))) / 0.3 : 0;
        for (let a = j - 1; a < k; a++) {
          if (dp[j - 1][a] === Infinity) continue;
          const e = Math.log((segs[k - 1][1] - segs[a][0]) / expected);
          const c = dp[j - 1][a] + e * e * Math.sqrt(w[j - 1]) + pause;
          if (c < dp[j][k]) {
            dp[j][k] = c;
            from[j][k] = a;
          }
        }
      }
    }
    if (!best || dp[N][K] < best.cost) best = { cost: dp[N][K], rate, from };
  }

  const cues = new Array(N);
  let k = K;
  for (let j = N; j >= 1; j--) {
    const a = best.from[j][k];
    cues[j - 1] = { start: segs[a][0], end: segs[k - 1][1], pause: gapAfter(k - 1), stretch: (segs[k - 1][1] - segs[a][0]) / (best.rate * w[j - 1]) };
    k = a;
  }
  const odd = cues.map((c, i) => [c, lines[i]]).filter(([c]) => c.stretch < 0.6 || c.stretch > 1.7);
  for (const [c, l] of odd) console.warn(`  ! ${l.id} is ${c.stretch.toFixed(2)}× its expected length — check it by ear`);
  return { cues, duration };
}

/* ── 2. Place the narration on the film's clock ────────────────────────── */

const fmt = (s) => `${Math.floor(s / 60)}:${(s % 60).toFixed(2).padStart(5, "0")}`;

/**
 * The narration is cut into chunks, one per run of the same voice in a section.
 * A section's first chunk starts where soundtrack.json puts its first word (on
 * the music); a later chunk in the same section — a hand-over from one voice to
 * the other — keeps its recorded pause, lengthened to `minSpeakerGap` if the
 * take ran the two voices closer than that.
 */
function placeVoice(samples, cues, sourceDuration, filmDuration) {
  const { firstWordAt, minSpeakerGap } = config.voice;
  const chunks = [];
  lines.forEach((l, i) => {
    const last = chunks[chunks.length - 1];
    if (last && last.section === l.section && last.speaker === l.speaker) last.idx.push(i);
    else chunks.push({ section: l.section, speaker: l.speaker, idx: [i] });
  });

  for (const [c, chunk] of chunks.entries()) {
    const first = cues[chunk.idx[0]];
    const prev = chunks[c - 1];
    if (!prev || prev.section !== chunk.section) {
      const target = firstWordAt[chunk.section];
      if (target == null) throw new Error(`soundtrack.json has no firstWordAt for "${chunk.section}"`);
      chunk.shift = target - first.start;
    } else {
      const recorded = first.start - cues[prev.idx[prev.idx.length - 1]].end;
      chunk.shift = prev.shift + Math.max(0, minSpeakerGap - recorded);
    }
    if (prev) {
      const gap = first.start + chunk.shift - (cues[prev.idx[prev.idx.length - 1]].end + prev.shift);
      if (gap < minSpeakerGap - 1e-3) {
        throw new Error(
          `"${chunk.section}" starts ${gap.toFixed(2)}s after the voice before it (minimum ${minSpeakerGap}s) — move its firstWordAt later in soundtrack.json`,
        );
      }
    }
  }

  const out = new Float32Array(Math.ceil(filmDuration * RATE));
  const placed = [];
  const fade = Math.round(0.01 * RATE);
  for (const [c, chunk] of chunks.entries()) {
    const i0 = chunk.idx[0];
    const i1 = chunk.idx[chunk.idx.length - 1];
    // Cut in the middle of the pause on the film's clock, kept inside the
    // recorded pause, so no breath is clipped and no two chunks overlap.
    let cutIn = 0;
    if (c > 0) {
      const prev = chunks[c - 1];
      const middle = (cues[i0 - 1].end + prev.shift + cues[i0].start + chunk.shift) / 2;
      cutIn = Math.min(cues[i0].start, Math.max(cues[i0 - 1].end, middle - chunk.shift));
    }
    let cutOut = sourceDuration;
    if (c < chunks.length - 1) {
      const next = chunks[c + 1];
      const middle = (cues[i1].end + chunk.shift + cues[i1 + 1].start + next.shift) / 2;
      cutOut = Math.max(cues[i1].end, Math.min(cues[i1 + 1].start, middle - chunk.shift));
    }
    const a = Math.round(cutIn * RATE);
    const b = Math.round(cutOut * RATE);
    const at = Math.round((cutIn + chunk.shift) * RATE);
    for (let i = a; i < b && at + i - a < out.length; i++) {
      if (at + i - a < 0) continue;
      const edge = Math.min(1, (i - a) / fade, (b - i) / fade);
      out[at + i - a] += samples[i] * edge;
    }
    for (const i of chunk.idx) placed[i] = { ...lines[i], start: cues[i].start + chunk.shift, end: cues[i].end + chunk.shift };
  }
  return { voice: out, placed };
}

/* ── 2b. Phrases and words inside each line ─────────────────────────────── */

/**
 * Where each phrase of a line starts and ends, and roughly when each word is
 * said — so the picture can land on "quizzes", not just on the sentence.
 *
 * A line is split at its punctuation; the recording breathes at most of those
 * marks, so each boundary is put at the quietest moment near where the
 * syllable count expects it. Words are then spread by syllables over the
 * voiced part of their phrase. Accurate to a syllable or so, which on a
 * picture is on time.
 */
function phrasesAndWords(voice, line) {
  const hop = Math.round(0.01 * RATE);
  const i0 = Math.round(line.start * RATE);
  const n = Math.max(1, Math.floor((line.end - line.start) * RATE / hop));
  const energy = new Float64Array(n);
  for (let f = 0; f < n; f++) {
    let s = 0;
    for (let i = i0 + f * hop; i < i0 + (f + 1) * hop; i++) s += voice[i] * voice[i];
    energy[f] = 10 * Math.log10(s / hop + 1e-10);
  }
  // 50 ms smoothing, so a stop consonant is not mistaken for a breath.
  const smooth = energy.map((_, f) => {
    let s = 0;
    let c = 0;
    for (let g = Math.max(0, f - 2); g <= Math.min(n - 1, f + 2); g++, c++) s += energy[g];
    return s / c;
  });
  const loud = [...smooth].sort((a, b) => a - b)[Math.floor(n * 0.8)];
  const at = (f) => line.start + f * 0.01;

  const texts = line.text.split(/(?<=[,:;])\s+|\s+(?=—)/).filter(Boolean);
  const weights = texts.map(weight);
  const total = weights.reduce((a, b) => a + b, 0);
  const cuts = [];
  let acc = 0;
  let floor = 0;
  for (let k = 0; k < texts.length - 1; k++) {
    acc += weights[k];
    const expected = Math.round((n * acc) / total);
    const reach = Math.max(35, Math.round(n * 0.12));
    let bestF = -1;
    let bestScore = Infinity;
    for (let f = Math.max(floor + 15, expected - reach); f <= Math.min(n - 15, expected + reach); f++) {
      const score = smooth[f] + (Math.abs(f - expected) * 0.01 * 12);
      if (score < bestScore) {
        bestScore = score;
        bestF = f;
      }
    }
    if (bestF < 0) bestF = Math.min(n - 1, Math.max(floor + 1, expected));
    // The quiet stretch around it: the end of one phrase and the start of the next.
    let a = bestF;
    let b = bestF;
    while (a > floor && smooth[a - 1] < smooth[bestF] + 4 && smooth[a - 1] < loud - 10) a--;
    while (b < n - 1 && smooth[b + 1] < smooth[bestF] + 4 && smooth[b + 1] < loud - 10) b++;
    cuts.push([a, b]);
    floor = b;
  }

  const phrases = texts.map((text, k) => {
    const from = k === 0 ? 0 : cuts[k - 1][1];
    const to = k === texts.length - 1 ? n : cuts[k][0];
    return { text, start: +at(from).toFixed(3), end: +at(Math.max(from + 1, to)).toFixed(3) };
  });

  const words = [];
  for (const p of phrases) {
    const tokens = p.text.split(/\s+/).filter(Boolean);
    const w = tokens.map((t) => Math.max(0.5, weight(t.replace(/[,:;.!?]/g, "")) - 0));
    const sum = w.reduce((a, b) => a + b, 0);
    let t = p.start;
    tokens.forEach((token, j) => {
      words.push({ word: token.replace(/^[^\w']+|[^\w'.]+$/g, "").replace(/\.$/, ""), at: +t.toFixed(3) });
      t += ((p.end - p.start) * w[j]) / sum;
    });
  }
  return { phrases, words };
}

/* ── 3. Re-edit the music in whole bars ────────────────────────────────── */

function editMusic(samples) {
  const { bpm, beatsPerBar, firstDownbeat, edit, marks } = config.music;
  // bpm and firstDownbeat are measured on the recording; the edit works on the sped-up copy.
  const bar = ((60 / bpm) * beatsPerBar) / config.speed;
  const barAt = (n) => firstDownbeat / config.speed + n * bar;
  const sourceEnd = samples.length / RATE;

  const pieces = [];
  let clock = 0;
  edit.forEach(([fromBar, toBar], i) => {
    const from = i === 0 && fromBar === 0 ? 0 : barAt(fromBar);
    const to = toBar === "end" ? sourceEnd : barAt(toBar);
    if (to > sourceEnd + 1e-3) throw new Error(`music edit ${i}: bar ${toBar} is past the end of the recording`);
    pieces.push({ fromBar, toBar, from, to, at: clock });
    clock += to - from;
  });

  // Equal-power crossfade across each splice, centred on the downbeat.
  const X = Math.round(0.03 * RATE);
  const out = new Float32Array(Math.ceil(clock * RATE) + X);
  for (const [i, p] of pieces.entries()) {
    const a = Math.round(p.from * RATE);
    const b = Math.round(p.to * RATE);
    const at = Math.round(p.at * RATE);
    const head = i > 0 ? X : 0;
    const tail = i < pieces.length - 1 ? X : 0;
    for (let j = -head; j < b - a + tail; j++) {
      const src = a + j;
      if (src < 0 || src >= samples.length || at + j < 0) continue;
      let g = 1;
      if (j < head) g = Math.sin((Math.PI / 2) * ((j + head) / (2 * head)));
      if (j >= b - a - tail) g = Math.min(g, Math.cos((Math.PI / 2) * ((j - (b - a - tail)) / (2 * tail))));
      out[at + j] += samples[src] * g;
    }
  }

  /** Where a bar of the original piece lands in the edit (its first occurrence). */
  const barToFilm = (n) => {
    const p = pieces.find((q) => n >= q.fromBar && (q.toBar === "end" || n < q.toBar));
    if (!p) return null;
    return p.at + (barAt(n) - p.from);
  };
  const changes = Object.fromEntries(Object.entries(marks).map(([name, n]) => [name, barToFilm(n)]));
  const splices = pieces.slice(1).map((p) => p.at);
  return { music: out.subarray(0, Math.round(clock * RATE)), duration: clock, bar, changes, splices };
}

/* ── 4. Tone ───────────────────────────────────────────────────────────── */

/** RBJ cookbook biquads. */
function biquad(type, f0, q, gainDb = 0) {
  const w0 = (2 * Math.PI * f0) / RATE;
  const cos = Math.cos(w0);
  const sin = Math.sin(w0);
  const A = Math.pow(10, gainDb / 40);
  let alpha = sin / (2 * q);
  let b0, b1, b2, a0, a1, a2;
  if (type === "highpass") {
    [b0, b1, b2] = [(1 + cos) / 2, -(1 + cos), (1 + cos) / 2];
    [a0, a1, a2] = [1 + alpha, -2 * cos, 1 - alpha];
  } else if (type === "peak") {
    [b0, b1, b2] = [1 + alpha * A, -2 * cos, 1 - alpha * A];
    [a0, a1, a2] = [1 + alpha / A, -2 * cos, 1 - alpha / A];
  } else if (type === "highshelf") {
    alpha = (sin / 2) * Math.SQRT2;
    const s = 2 * Math.sqrt(A) * alpha;
    [b0, b1, b2] = [A * (A + 1 + (A - 1) * cos + s), -2 * A * (A - 1 + (A + 1) * cos), A * (A + 1 + (A - 1) * cos - s)];
    [a0, a1, a2] = [A + 1 - (A - 1) * cos + s, 2 * (A - 1 - (A + 1) * cos), A + 1 - (A - 1) * cos - s];
  } else throw new Error(type);
  return { b0: b0 / a0, b1: b1 / a0, b2: b2 / a0, a1: a1 / a0, a2: a2 / a0 };
}

function filter(samples, chain) {
  let x = samples;
  for (const f of chain) {
    const y = new Float32Array(x.length);
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    for (let i = 0; i < x.length; i++) {
      const v = f.b0 * x[i] + f.b1 * x1 + f.b2 * x2 - f.a1 * y1 - f.a2 * y2;
      x2 = x1; x1 = x[i]; y2 = y1; y1 = v;
      y[i] = v;
    }
    x = y;
  }
  return x;
}

// Measured on the phone recording against a clean mix's slope: about +10 dB
// too much at 250–500 Hz (the speaker and the room), 20 dB+ missing above 4 kHz.
const MUSIC_TONE = [
  biquad("highpass", 32, 0.707),
  biquad("peak", 190, 1.1, -3.5),
  biquad("peak", 360, 0.9, -8),
  biquad("peak", 2600, 0.8, -3), // the voice's presence band, left to the voice
  biquad("highshelf", 5500, 0.707, 6),
];
const VOICE_TONE = [biquad("highpass", 70, 0.707)];

/* ── 5. Mix ────────────────────────────────────────────────────────────── */

const db = (v) => Math.pow(10, v / 20);

function rms(x, spans) {
  let sum = 0;
  let n = 0;
  for (const [a, b] of spans) {
    for (let i = Math.max(0, Math.round(a * RATE)); i < Math.min(x.length, Math.round(b * RATE)); i++) {
      sum += x[i] * x[i];
      n++;
    }
  }
  return Math.sqrt(sum / Math.max(1, n));
}

function mix(voice, music, placed, duration) {
  const { underVoiceDb, betweenSectionsDb, aloneDb } = config.mix;
  const speech = placed.map((l) => [l.start, l.end]);
  // Pauses shorter than this stay ducked, so the music does not pump between sentences.
  const merged = [];
  for (const [a, b] of speech) {
    const last = merged[merged.length - 1];
    if (last && a - last[1] < 1.0) last[1] = b;
    else merged.push([a, b]);
  }
  const firstWord = speech[0][0];
  const lastWord = speech[speech.length - 1][1];

  // Both set to the same level first, so the dB offsets mean what they say.
  const voiceGain = 0.1 / rms(voice, speech);
  const musicGain = 0.1 / rms(music, [[0, duration]]);

  const n = Math.ceil(duration * RATE);
  const out = new Float32Array(n);
  const step = Math.round(RATE / 200);
  let gain = 0;
  for (let i = 0; i < n; i += step) {
    const t = i / RATE;
    let dist = Infinity;
    for (const [a, b] of merged) dist = Math.min(dist, t < a ? a - t : t > b ? t - b : 0);
    const alone = t < firstWord || t > lastWord;
    // Down fast just before a word, up slowly after it.
    const before = merged.some(([a]) => a >= t && a - t === dist);
    const ramp = before ? Math.min(1, Math.max(0, (dist - 0.05) / 0.35)) : Math.min(1, Math.max(0, (dist - 0.15) / 0.7));
    const shaped = ramp * ramp * (3 - 2 * ramp);
    const lift = alone ? aloneDb : betweenSectionsDb;
    let g = db(underVoiceDb + (lift - underVoiceDb) * shaped);
    g *= Math.min(1, t / 1.2); // in from nothing
    g *= Math.min(1, Math.max(0, (duration - t) / 2.5)); // out to nothing
    for (let j = i; j < Math.min(n, i + step); j++) {
      const frac = (j - i) / step;
      const gj = gain + (g - gain) * frac;
      out[j] = (voice[j] ?? 0) * voiceGain + (music[j] ?? 0) * musicGain * gj;
    }
    gain = g;
  }
  return out;
}

/**
 * Web loudness with one gain, and a peak limiter for the few peaks that gain
 * would push over the ceiling.
 *
 * Not ffmpeg's loudnorm: when a single gain cannot meet its true-peak target it
 * silently switches to dynamic mode and compresses, which evened the music
 * playing alone up to the level of the voice and flattened the mix's shape.
 * loudnorm is used here only to measure.
 */
function loudness(samples, inWav) {
  const { loudnessLufs, truePeakDb } = config.mix;
  const log = ffmpeg(["-i", inWav, "-af", `loudnorm=I=${loudnessLufs}:TP=${truePeakDb}:print_format=json`, "-f", "null", "-"]);
  const measured = JSON.parse(log.slice(log.lastIndexOf("{"), log.lastIndexOf("}") + 1));
  const gain = db(loudnessLufs - Number(measured.input_i));
  const ceiling = db(truePeakDb - 0.5); // sample peaks, with room for inter-sample overs

  const n = samples.length;
  const need = new Float32Array(n);
  for (let i = 0; i < n; i++) need[i] = Math.min(1, ceiling / (Math.abs(samples[i] * gain) + 1e-12));
  // Lowest gain needed anywhere in the next 5 ms (monotonic deque).
  const L = Math.round(0.005 * RATE);
  const ahead = new Float32Array(n);
  const q = new Int32Array(n);
  let head = 0, tail = 0;
  for (let i = n - 1; i >= 0; i--) {
    while (tail > head && need[q[tail - 1]] >= need[i]) tail--;
    q[tail++] = i;
    while (q[head] > i + L) head++;
    ahead[i] = need[q[head]];
  }
  // Recover over 80 ms, reach each reduction over the 5 ms before it.
  const release = 1 - Math.exp(-1 / (0.08 * RATE));
  const env = new Float32Array(n);
  let g = 1;
  for (let i = 0; i < n; i++) {
    g = Math.min(ahead[i], g + (1 - g) * release);
    env[i] = g;
  }
  for (let i = n - 2; i >= 0; i--) env[i] = Math.min(env[i], env[i + 1] + 1 / L);

  const out = new Float32Array(n);
  let limited = 0;
  for (let i = 0; i < n; i++) {
    out[i] = samples[i] * gain * env[i];
    if (env[i] < db(-1)) limited++;
  }
  return { out, measured, gainDb: loudnessLufs - Number(measured.input_i), limitedMs: (limited / RATE) * 1000 };
}

/* ── Run ───────────────────────────────────────────────────────────────── */

console.log("decoding…");
const narration = decode(config.voice.file, "narration");
const musicSource = decode(config.music.file, "music");

console.log("aligning the script to the narration…");
const { cues, duration: narrationDuration } = align(narration);

console.log("editing the music…");
const edited = editMusic(musicSource.samples);
const filmDuration = edited.duration;

const { voice, placed } = placeVoice(filter(narration.samples, VOICE_TONE), cues, narrationDuration, filmDuration);
const lastWord = placed[placed.length - 1].end;
if (lastWord > filmDuration - 2) throw new Error(`The last word ends at ${fmt(lastWord)}, too close to the music's end (${fmt(filmDuration)})`);

console.log("mixing…");
const music = filter(edited.music, MUSIC_TONE);
writeWav(join(tmp, "music-edited.wav"), [music]); // to check the edit and the tone on their own
const mixed = mix(voice, music, placed, filmDuration);
const raw = join(tmp, "mix.wav");
writeWav(raw, [mixed]);
const final = join(root, "public", "audio", "soundtrack.wav");
const levelled = loudness(mixed, raw);
const measured = levelled.measured;
writeWav(final, [levelled.out, levelled.out]);
// Remotion's ffmpeg has no m4a muxer; an audio-only .mp4 plays everywhere.
const preview = join(root, "out", "soundtrack-preview.mp4");
ffmpeg(["-y", "-i", final, "-c:a", "aac", "-b:a", "192k", "-f", "mp4", preview]);

const sections = script.scenes.map((s) => {
  const ls = placed.filter((l) => l.section === s.id);
  return { id: s.id, start: ls[0].start, end: ls[ls.length - 1].end };
});
const generated = join(root, "src", "generated", "soundtrack.json");
mkdirSync(dirname(generated), { recursive: true });
writeFileSync(
  generated,
  JSON.stringify(
    {
      duration: Math.round(filmDuration * 1000) / 1000,
      bar: edited.bar,
      musicChanges: edited.changes,
      musicSplices: edited.splices,
      sections,
      lines: placed.map((l) => ({
        id: l.id,
        section: l.section,
        speaker: l.speaker,
        text: l.text,
        start: +l.start.toFixed(3),
        end: +l.end.toFixed(3),
        ...phrasesAndWords(voice, l),
      })),
    },
    null,
    2,
  ),
);

console.log(
  `\nfilm ${fmt(filmDuration)} · mix at ${measured.input_i} LUFS, +${levelled.gainDb.toFixed(1)} dB to ${config.mix.loudnessLufs} · limiter over 1 dB for ${levelled.limitedMs.toFixed(0)} ms in all`,
);
console.log("music changes:", Object.entries(edited.changes).map(([k, v]) => `${k} ${v == null ? "cut" : fmt(v)}`).join(" · "));
for (const s of sections) {
  const gapBefore = s.start - (sections[sections.indexOf(s) - 1]?.end ?? 0);
  console.log(`  ${s.id.padEnd(10)} ${fmt(s.start)} → ${fmt(s.end)}  (${gapBefore.toFixed(2)}s before)`);
}
const handovers = placed.slice(1).map((l, i) => [placed[i], l]).filter(([a, b]) => a.speaker !== b.speaker);
console.log("voice changes:", handovers.map(([a, b]) => `${a.speaker}→${b.speaker} ${fmt(b.start)} after ${(b.start - a.end).toFixed(2)}s`).join(" · "));
if (edited.changes.final != null) console.log(`last word → final chord: ${(edited.changes.final - lastWord).toFixed(2)}s`);
console.log(`\n→ public/audio/soundtrack.wav · src/generated/soundtrack.json · out/soundtrack-preview.mp4`);
