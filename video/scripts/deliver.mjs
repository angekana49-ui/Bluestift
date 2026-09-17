import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * The pieces scripts/master.mjs rendered, delivered as one film.
 *
 *  1. join the 4K pieces — a stream copy, so the master is untouched;
 *  2. lay the soundtrack on from the WAV, not from a re-encode of a re-encode;
 *  3. scale to 1080p with lanczos. This is the whole point of mastering at 4K:
 *     four pixels averaged into one is the cheapest antialiasing there is, and
 *     UI text is exactly what it flatters;
 *  4. two passes at a bitrate computed from a target size, because the brief
 *     has a ceiling and "crf and hope" does not respect ceilings.
 *
 *   node scripts/deliver.mjs [--mb=92] [--height=1080] [--audio=160]
 */
const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, "..");
const arg = (name, fallback) => Number(process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=")[1] ?? fallback);
const targetMB = arg("mb", 92);
const height = arg("height", 1080);
const audioKbps = arg("audio", 160);

const ffmpeg = path.join(root, "node_modules", "@remotion", "compositor-win32-x64-msvc", "ffmpeg.exe");
const ffprobe = path.join(root, "node_modules", "@remotion", "compositor-win32-x64-msvc", "ffprobe.exe");
const run = (bin, args) => execFileSync(bin, args, { stdio: ["ignore", "pipe", "inherit"] }).toString();

const chunks = path.join(root, "out", "chunks");
const master = path.join(root, "out", "master-4k.mp4");
const final = path.join(root, "out", "how-it-works-en.mp4");
const wav = path.join(root, "public", "audio", "soundtrack.wav");

/* ── 1. join ── */
const files = readdirSync(chunks).filter((f) => f.startsWith("chunk-") && f.endsWith(".mp4")).sort();
if (files.length === 0) throw new Error("no chunks: run scripts/master.mjs first");
const list = path.join(chunks, "list.txt");
writeFileSync(list, files.map((f) => `file '${f}'`).join("\n") + "\n");
if (existsSync(master)) rmSync(master);
run(ffmpeg, ["-nostdin", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", list, "-c", "copy", master]);
const duration = Number(run(ffprobe, ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", master]).trim());
console.log(`master: ${files.length} pieces, ${duration.toFixed(2)}s, ${(statSync(master).size / 1048576).toFixed(1)} MB`);

/* ── 2–4. the deliverable ── */
const totalKbps = (targetMB * 8388.608) / duration;
const videoKbps = Math.floor(totalKbps - audioKbps - 8);
console.log(`target ${targetMB} MB → video ${videoKbps} kbps + audio ${audioKbps} kbps`);

const vf = [
  `scale=-2:${height}:flags=lanczos+accurate_rnd+full_chroma_int`,
  "format=yuv420p",
].join(",");
const common = [
  "-nostdin", "-y", "-loglevel", "error", "-stats",
  "-i", master,
  "-i", wav,
  "-map", "0:v:0", "-map", "1:a:0",
  "-vf", vf,
  "-c:v", "libx264", "-preset", "slow", "-b:v", `${videoKbps}k`,
  "-maxrate", `${Math.round(videoKbps * 1.5)}k`, "-bufsize", `${videoKbps * 3}k`,
  // TV range, Rec. 709, tagged — the preview came out as yuvj420p, which every
  // player is then free to interpret its own way.
  "-color_range", "tv", "-color_primaries", "bt709", "-color_trc", "bt709", "-colorspace", "bt709",
  "-x264-params", "colormatrix=bt709",
  "-movflags", "+faststart",
];
const passlog = path.join(root, "out", "x264");
run(ffmpeg, [...common, "-pass", "1", "-passlogfile", passlog, "-an", "-f", "mp4", process.platform === "win32" ? "NUL" : "/dev/null"]);
run(ffmpeg, [...common, "-pass", "2", "-passlogfile", passlog, "-c:a", "aac", "-b:a", `${audioKbps}k`, "-ar", "48000", "-ac", "2", "-shortest", final]);
for (const f of readdirSync(path.join(root, "out"))) if (f.startsWith("x264")) rmSync(path.join(root, "out", f));

/* ── the poster, from the frame the film ends on ── */
const poster = path.join(root, "out", "how-it-works-poster.jpg");
run(ffmpeg, ["-nostdin", "-y", "-loglevel", "error", "-ss", "17.5", "-i", master, "-frames:v", "1", "-vf", `scale=-2:${height}:flags=lanczos`, "-q:v", "3", poster]);

console.log(run(ffprobe, ["-v", "error", "-show_entries", "format=size,duration,bit_rate", "-show_entries", "stream=codec_name,width,height,pix_fmt,color_range,r_frame_rate,bit_rate", "-of", "default=noprint_wrappers=1", final]));
console.log(`${path.relative(root, final)}: ${(statSync(final).size / 1048576).toFixed(1)} MB`);
console.log(`${path.relative(root, poster)}: ${(statSync(poster).size / 1024).toFixed(0)} KB`);
