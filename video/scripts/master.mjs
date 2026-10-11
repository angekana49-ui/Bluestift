import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { bundle } from "@remotion/bundler";
import { getCompositions, renderMedia } from "@remotion/renderer";
import { makeWebpackOverride } from "../webpack-override.mjs";

/**
 * The final render, in chunks.
 *
 * Three hours of rendering behind a single process is three hours that one
 * hiccup throws away — and one did: the static server 404'd a mark at frame
 * 5094 of 5398 and Remotion, rightly, cancelled the whole thing. So the film
 * is rendered in pieces from ONE bundle (the public dir is copied once), each
 * piece retried on its own, each piece kept. A piece that is already on disk is
 * not rendered again, so an interrupted run picks up where it stopped.
 *
 * Silent on purpose: the pieces carry no audio, which is one less thing to go
 * wrong at a seam. scripts/deliver.mjs joins them and lays the soundtrack on.
 *
 * Interruptions cost at most one piece, never the film:
 *  - a piece is written as `.part.mp4` and renamed only once it is complete,
 *    so a piece cut off mid-write (power, sleep, a killed process) is never
 *    taken for a finished one — it is simply rendered again;
 *  - finished pieces are listed in `done.json` with their frame ranges, so a
 *    run with a different --chunk picks up from the last finished frame
 *    instead of re-cutting the film;
 *  - a lock file stops two renders (the logon task and a manual run, say)
 *    from working on the same pieces at once.
 *
 *   node scripts/master.mjs [--scale=2] [--chunk=150] [--crf=12]
 */
const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, "..");
const arg = (name, fallback) => Number(process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=")[1] ?? fallback);
const scale = arg("scale", 2);
const chunkSize = arg("chunk", 150);
const crf = arg("crf", 12);

const out = path.join(root, "out", "chunks");
mkdirSync(out, { recursive: true });

/* One render at a time: a second one exits quietly while the first is alive. */
const lock = path.join(out, ".lock");
if (existsSync(lock)) {
  const pid = Number(readFileSync(lock, "utf8"));
  let alive = false;
  try {
    process.kill(pid, 0);
    alive = pid !== process.pid;
  } catch {}
  if (alive) {
    console.log(`another render (pid ${pid}) is already running — leaving it to finish`);
    process.exit(3);
  }
}
writeFileSync(lock, String(process.pid));
process.on("exit", () => {
  try {
    if (readFileSync(lock, "utf8") === String(process.pid)) rmSync(lock);
  } catch {}
});

/* What is already rendered, by frame range. */
const doneFile = path.join(out, "done.json");
const done = existsSync(doneFile) ? JSON.parse(readFileSync(doneFile, "utf8")) : [];
const saveDone = () => writeFileSync(doneFile, JSON.stringify(done, null, 1));

const serveUrl = await bundle({ entryPoint: path.join(root, "src", "index.ts"), webpackOverride: makeWebpackOverride(root) });

/**
 * The bundle's copy of public/, kept honest.
 *
 * The bundler copies public/ into the bundle and the render server serves it
 * from there — and between the first piece and the second, the seven files at
 * the ROOT of that copy went missing (the subfolders stayed). Every mark in the
 * film is one of those seven, so `<Img>` 404'd and the render was cancelled.
 * Rather than trust the copy, it is checked before each piece; a missing file
 * is copied back, which costs a stat per file.
 */
function syncPublic(dir = "") {
  const from = path.join(root, "public", dir);
  const to = path.join(serveUrl, "public", dir);
  mkdirSync(to, { recursive: true });
  let restored = 0;
  for (const entry of readdirSync(from, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      restored += syncPublic(path.join(dir, entry.name));
      continue;
    }
    const src = path.join(from, entry.name);
    const dest = path.join(to, entry.name);
    if (existsSync(dest) && statSync(dest).size === statSync(src).size) continue;
    copyFileSync(src, dest);
    restored++;
  }
  return restored;
}
const composition = (await getCompositions(serveUrl)).find((c) => c.id === "HowItWorks");
const total = composition.durationInFrames;
console.log(`HowItWorks: ${total} frames at ${composition.width * scale}×${composition.height * scale}`);

// Walk the film from frame 0: a finished piece that starts here is kept,
// whatever size it was cut at; otherwise a new piece of --chunk frames.
const pieces = [];
for (let start = 0; start < total; ) {
  const have = done.find((d) => d.start === start && existsSync(path.join(out, d.file)));
  const end = have ? have.end : Math.min(total - 1, start + chunkSize - 1);
  const name = have ? have.file : `chunk-${String(start).padStart(5, "0")}-${String(end).padStart(5, "0")}.mp4`;
  pieces.push({ start, end, file: path.join(out, name), have: Boolean(have) });
  start = end + 1;
}

for (const { start, end, file, have } of pieces) {
  if (have) {
    console.log(`${path.basename(file)}: already rendered`);
    continue;
  }
  const part = file.replace(/\.mp4$/, ".part.mp4");
  if (existsSync(part)) rmSync(part);
  for (let attempt = 1; ; attempt++) {
    const began = Date.now();
    const restored = syncPublic();
    if (restored) console.log(`  restored ${restored} file(s) in the bundle's public dir`);
    try {
      await renderMedia({
        composition,
        serveUrl,
        codec: "h264",
        // The default is JPEG at quality 80 — a generation of loss before the
        // encoder has seen a pixel. These frames are the master.
        imageFormat: "png",
        crf,
        scale,
        muted: true,
        frameRange: [start, end],
        concurrency: 3,
        colorSpace: "bt709",
        outputLocation: part,
        onProgress: ({ renderedFrames }) => {
          if (renderedFrames % 100 === 0) process.stdout.write(`\r  ${path.basename(file)}: ${renderedFrames}/${end - start + 1}   `);
        },
      });
      renameSync(part, file);
      done.push({ start, end, file: path.basename(file) });
      saveDone();
      console.log(`\r${path.basename(file)}: frames ${start}–${end} in ${Math.round((Date.now() - began) / 1000)}s`);
      break;
    } catch (err) {
      // A 404 from the static server, a tab that died: the piece is worth
      // retrying, and only the piece.
      console.error(`\n${path.basename(file)} attempt ${attempt} failed: ${err.message.split("\n")[0]}`);
      if (existsSync(part)) rmSync(part);
      if (attempt >= 3) throw err;
    }
  }
}

writeFileSync(
  path.join(out, "list.txt"),
  pieces.map((p) => `file '${path.basename(p.file)}'`).join("\n") + "\n",
);
console.log(`\n${pieces.length} pieces in ${path.relative(root, out)} — join them with scripts/deliver.mjs`);
