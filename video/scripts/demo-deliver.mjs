import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * The demo's deliverable, from the pieces scripts/master.mjs rendered.
 *
 *  1. join the 1080p pieces — a stream copy, so the master is untouched;
 *  2. lay the final mix on (bluestift_demo_audio_mix.mp3), never re-encoded;
 *  3. two passes at a bitrate computed from a target size: the YC brief has a
 *     hard 100 MB ceiling and "crf and hope" does not respect ceilings.
 *
 * The master stays 1080p on purpose (brief §1): 100 MB over 148.7 s leaves
 * ~5 Mbps, where 1080p looks sharp and 4K would look worse.
 *
 *   node scripts/demo-deliver.mjs [--chunks=demo-chunks] [--name=bluestift_demo_final] [--poster-at=67.6] [--mb=90] [--audio=192]
 */
const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, "..");
const arg = (name, fallback) => Number(process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=")[1] ?? fallback);
const targetMB = arg("mb", 90);
const audioKbps = arg("audio", 192);

const ffmpeg = path.join(root, "node_modules", "@remotion", "compositor-win32-x64-msvc", "ffmpeg.exe");
const ffprobe = path.join(root, "node_modules", "@remotion", "compositor-win32-x64-msvc", "ffprobe.exe");
if (!existsSync(ffmpeg)) throw new Error(`no bundled ffmpeg at ${ffmpeg} — run npm install first`);
const run = (bin, args) => execFileSync(bin, args, { stdio: ["ignore", "pipe", "inherit"] }).toString();

const opt = (name, fallback) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=")[1] ?? fallback;
const chunks = path.join(root, "out", opt("chunks", "demo-chunks"));
const name = opt("name", "bluestift_demo_final");
const posterAt = opt("poster-at", "67.6");
const master = path.join(root, "out", `${name}-master.mp4`);
const final = path.join(root, "out", `${name}.mp4`);
const mix = path.join(root, "bluestift_demo_audio_mix.mp3");
if (!existsSync(mix)) throw new Error(`missing audio mix: ${mix}`);

/* ── 1. join ── */
const files = readdirSync(chunks).filter((f) => f.startsWith("chunk-") && f.endsWith(".mp4") && !f.endsWith(".part.mp4")).sort();
if (files.length === 0) throw new Error("no chunks: run node scripts/master.mjs --comp=BluestiftDemo --chunks=demo-chunks --scale=1 --crf=16 first");
const list = path.join(chunks, "list.txt");
writeFileSync(list, files.map((f) => `file '${f}'`).join("\n") + "\n");
if (existsSync(master)) rmSync(master);
run(ffmpeg, ["-nostdin", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", list, "-c", "copy", master]);
const duration = Number(run(ffprobe, ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", master]).trim());
console.log(`master: ${files.length} pieces, ${duration.toFixed(2)}s, ${(statSync(master).size / 1048576).toFixed(1)} MB`);

/* ── 2–3. the deliverable ── */
const totalKbps = (targetMB * 8388.608) / duration;
const videoKbps = Math.min(4800, Math.floor(totalKbps - audioKbps - 8));
console.log(`target ${targetMB} MB → video ${videoKbps} kbps + audio ${audioKbps} kbps`);
if (videoKbps > 4800) console.log("note: video bitrate capped at 4800 kbps per the brief");

const vf = ["scale=-2:1080:flags=lanczos+accurate_rnd+full_chroma_int", "format=yuv420p"].join(",");
const common = [
  "-nostdin", "-y", "-loglevel", "error", "-stats",
  "-i", master,
  "-i", mix,
  "-map", "0:v:0", "-map", "1:a:0",
  "-vf", vf,
  "-c:v", "libx264", "-preset", process.argv.includes("--fast") ? "veryfast" : "slow", "-b:v", `${videoKbps}k`,
  "-maxrate", `${Math.round(videoKbps * 1.5)}k`, "-bufsize", `${videoKbps * 3}k`,
  "-color_range", "tv", "-color_primaries", "bt709", "-color_trc", "bt709", "-colorspace", "bt709",
  "-x264-params", "colormatrix=bt709",
  "-movflags", "+faststart",
];
const passlog = path.join(root, "out", "x264demo");
if (process.argv.includes("--fast")) {
  run(ffmpeg, [...common, "-c:a", "aac", "-b:a", `${audioKbps}k`, "-ar", "48000", "-ac", "2", "-t", "148.71", final]);
} else {
  run(ffmpeg, [...common, "-pass", "1", "-passlogfile", passlog, "-an", "-f", "mp4", process.platform === "win32" ? "NUL" : "/dev/null"]);
  run(ffmpeg, [...common, "-pass", "2", "-passlogfile", passlog, "-c:a", "aac", "-b:a", `${audioKbps}k`, "-ar", "48000", "-ac", "2", "-t", "148.71", final]);
  for (const f of readdirSync(path.join(root, "out"))) if (f.startsWith("x264demo")) rmSync(path.join(root, "out", f));
}

/* ── the poster, from the key moment ── */
const poster = path.join(root, "out", `${name}-poster.jpg`);
run(ffmpeg, ["-nostdin", "-y", "-loglevel", "error", "-ss", posterAt, "-i", master, "-frames:v", "1", "-vf", "scale=-2:1080:flags=lanczos", "-q:v", "3", poster]);

console.log(run(ffprobe, ["-v", "error", "-show_entries", "format=size,duration,bit_rate", "-show_entries", "stream=codec_name,width,height,pix_fmt,color_range,r_frame_rate,bit_rate", "-of", "default=noprint_wrappers=1", final]));
console.log(`${path.relative(root, final)}: ${(statSync(final).size / 1048576).toFixed(1)} MB`);
console.log(`${path.relative(root, poster)}: ${(statSync(poster).size / 1024).toFixed(0)} KB`);
