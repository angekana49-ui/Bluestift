import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * The narration take, made from src/script.json with ElevenLabs.
 *
 * One request per line, in that line's voice (script.json `voices.*.elevenlabs`),
 * with the lines either side passed as context so a run of one voice keeps its
 * intonation from sentence to sentence. Each line is cached under
 * out/narration-lines/ by a hash of its text, voice and settings, so editing one
 * sentence re-records that sentence only.
 *
 * The lines are then laid end to end with clean silences — short inside a run
 * of one voice, longer where the voice or the section changes — into
 * narration/narration-en.mp3: one take, which is what scripts/soundtrack.mjs
 * aligns on (a line boundary is always a real pause).
 *
 *   node scripts/narrate.mjs            # needs ELEVENLABS_API_KEY (read from ../.env.local)
 */
const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const script = JSON.parse(readFileSync(join(root, "src", "script.json"), "utf8"));

const MODEL = "eleven_multilingual_v2";
const SETTINGS = { stability: 0.45, similarity_boost: 0.8, style: 0.25, use_speaker_boost: true, speed: 1.0 };
/** Silence after a line: inside a run of one voice / where the voice changes / between sections. */
const GAP = { line: 0.45, speaker: 1.0, section: 1.6 };

function apiKey() {
  if (process.env.ELEVENLABS_API_KEY) return process.env.ELEVENLABS_API_KEY;
  const env = join(root, "..", ".env.local");
  if (existsSync(env)) {
    const m = readFileSync(env, "utf8").match(/^ELEVENLABS_API_KEY=(.*)$/m);
    if (m) return m[1].trim().replace(/^["']|["']$/g, "");
  }
  throw new Error("ELEVENLABS_API_KEY is not set (env or ../.env.local)");
}

function ffmpegPath() {
  const dir = join(root, "node_modules", "@remotion");
  const pkg = readdirSync(dir).find((d) => d.startsWith("compositor-"));
  const bin = pkg && ["ffmpeg.exe", "ffmpeg"].map((b) => join(dir, pkg, b)).find(existsSync);
  if (!bin) throw new Error("Remotion's ffmpeg was not found — run npm install in video/");
  return bin;
}
const FF = ffmpegPath();
function ffmpeg(args) {
  const r = spawnSync(FF, ["-hide_banner", "-nostdin", "-loglevel", "error", ...args], { encoding: "utf8" });
  if (r.status !== 0) throw new Error(`ffmpeg ${args.join(" ")}\n${r.stderr}`);
}

/** What the voice is given to say — the written line, with what a reader would expand. */
const spoken = (text) => text.replace(/thebluestift\.com/g, "the bluestift dot com");

const lines = script.scenes.flatMap((scene) =>
  scene.lines.map((l, i) => ({ id: `${scene.id}-${i}`, section: scene.id, speaker: l.speaker, text: l.text })),
);

const cache = join(root, "out", "narration-lines");
mkdirSync(cache, { recursive: true });
const key = apiKey();

async function record(l, i) {
  const voice = script.voices[l.speaker]?.elevenlabs;
  if (!voice) throw new Error(`voice ${l.speaker} has no elevenlabs id in script.json`);
  // Context only from the same voice in the same section: that is one breath of narration.
  const prev = lines[i - 1]?.speaker === l.speaker && lines[i - 1]?.section === l.section ? spoken(lines[i - 1].text) : undefined;
  const next = lines[i + 1]?.speaker === l.speaker && lines[i + 1]?.section === l.section ? spoken(lines[i + 1].text) : undefined;
  const body = { text: spoken(l.text), model_id: MODEL, voice_settings: SETTINGS, previous_text: prev, next_text: next };
  const hash = createHash("sha1").update(JSON.stringify({ voice, body })).digest("hex").slice(0, 10);
  const file = join(cache, `${l.id}-${hash}.mp3`);
  if (existsSync(file)) return file;
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}?output_format=mp3_44100_128`, {
      method: "POST",
      headers: { "xi-api-key": key, "content-type": "application/json", accept: "audio/mpeg" },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      writeFileSync(file, Buffer.from(await res.arrayBuffer()));
      console.log(`  recorded ${l.id}`);
      return file;
    }
    const err = await res.text();
    if (attempt >= 3 || res.status < 500 && res.status !== 429) throw new Error(`${l.id}: ElevenLabs ${res.status} ${err.slice(0, 300)}`);
    await new Promise((r) => setTimeout(r, 2000 * attempt));
  }
}

const files = [];
for (const [i, l] of lines.entries()) files.push(await record(l, i));

// Each line → 48 kHz mono samples with its own leading/trailing silence trimmed
// (in JS: Remotion's ffmpeg has no silenceremove), then the chosen gap after it,
// so every pause in the take is one we chose.
const RATE = 48000;
const work = join(root, "out", "narration-work");
mkdirSync(work, { recursive: true });

function readPcm(path) {
  const buf = readFileSync(path);
  let offset = 12;
  while (offset + 8 <= buf.length) {
    const id = buf.toString("ascii", offset, offset + 4);
    const size = buf.readUInt32LE(offset + 4);
    if (id === "data") {
      const n = Math.floor(Math.min(size, buf.length - offset - 8) / 2);
      const out = new Float32Array(n);
      for (let i = 0; i < n; i++) out[i] = buf.readInt16LE(offset + 8 + i * 2) / 32768;
      return out;
    }
    offset += 8 + size + (size % 2);
  }
  throw new Error(`${path}: no data chunk`);
}

/** Drop the silence a TTS clip carries at either end, keeping a breath of it. */
function trim(x) {
  const win = Math.round(0.01 * RATE);
  const threshold = Math.pow(10, -45 / 20);
  const loudAt = (i) => {
    let m = 0;
    for (let j = i; j < Math.min(x.length, i + win); j++) m = Math.max(m, Math.abs(x[j]));
    return m > threshold;
  };
  let a = 0;
  while (a < x.length && !loudAt(a)) a += win;
  let b = x.length - win;
  while (b > a && !loudAt(b)) b -= win;
  return x.subarray(Math.max(0, a - Math.round(0.03 * RATE)), Math.min(x.length, b + win + Math.round(0.08 * RATE)));
}

const parts = [];
// Where each line sits in the take — written beside it, so the soundtrack
// does not have to guess the line boundaries from the pauses.
const cues = [];
let clock = 0;
for (const [i, l] of lines.entries()) {
  const wav = join(work, `${l.id}.wav`);
  ffmpeg(["-y", "-i", files[i], "-ac", "1", "-ar", String(RATE), "-c:a", "pcm_s16le", wav]);
  const said = trim(readPcm(wav));
  parts.push(said);
  cues.push({ id: l.id, start: +(clock / RATE).toFixed(4), end: +((clock + said.length) / RATE).toFixed(4) });
  clock += said.length;
  const nextLine = lines[i + 1];
  const gap = !nextLine ? 0.5 : nextLine.section !== l.section ? GAP.section : nextLine.speaker !== l.speaker ? GAP.speaker : GAP.line;
  parts.push(new Float32Array(Math.round(gap * RATE)));
  clock += Math.round(gap * RATE);
}
const total = parts.reduce((n, p) => n + p.length, 0);
const pcm = Buffer.alloc(44 + total * 2);
pcm.write("RIFF", 0);
pcm.writeUInt32LE(36 + total * 2, 4);
pcm.write("WAVEfmt ", 8);
pcm.writeUInt32LE(16, 16);
pcm.writeUInt16LE(1, 20);
pcm.writeUInt16LE(1, 22);
pcm.writeUInt32LE(RATE, 24);
pcm.writeUInt32LE(RATE * 2, 28);
pcm.writeUInt16LE(2, 32);
pcm.writeUInt16LE(16, 34);
pcm.write("data", 36);
pcm.writeUInt32LE(total * 2, 40);
let o = 44;
for (const p of parts) for (const v of p) {
  pcm.writeInt16LE(Math.round(Math.max(-1, Math.min(1, v)) * 32767), o);
  o += 2;
}
const take = join(work, "take.wav");
writeFileSync(take, pcm);
const out = join(root, "narration", "narration-en.mp3");
ffmpeg(["-y", "-i", take, "-c:a", "libmp3lame", "-b:a", "192k", out]);
writeFileSync(join(root, "narration", "narration-en.cues.json"), JSON.stringify({ lines: cues }, null, 1) + "\n");
console.log(`take: ${(total / RATE).toFixed(1)} s`);

// The written script beside the take, for reading and for the record.
const text = script.scenes
  .map((s) => `## ${s.id}\n\n` + s.lines.map((l) => `**${script.voices[l.speaker]?.name ?? l.speaker}:** ${l.text}`).join("\n\n"))
  .join("\n\n");
writeFileSync(join(root, "narration", "script-en.md"), `# ${script.title} — narration script\n\n${text}\n`);
console.log(`narration → ${out}`);
