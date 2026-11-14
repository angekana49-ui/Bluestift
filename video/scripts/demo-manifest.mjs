import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Which real captures exist. Scans captures/ and writes src/demo/manifest.json
 * (expected files land as false until they are captured). The frames read the
 * manifest at bundle time: a present capture plays, a missing one shows its
 * slate. Re-run after every capture session.
 *
 *   node scripts/demo-manifest.mjs
 */
const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, "..");
const capturesDir = path.join(root, "captures");
mkdirSync(capturesDir, { recursive: true });

const cues = JSON.parse(readFileSync(path.join(root, "bluestift_demo_cues.json"), "utf8"));
const expected = new Set();
for (const cue of cues.cues) {
  if (!cue.source) continue;
  for (const part of String(cue.source).split("+")) {
    const m = part.match(/[\w-]+\.mp4/);
    if (m) expected.add(m[0]);
  }
}
const present = new Set(readdirSync(capturesDir).filter((f) => f.endsWith(".mp4")));
const manifest = {};
for (const file of [...expected].sort()) manifest[file] = present.has(file);

const out = path.join(root, "src", "demo", "manifest.json");
writeFileSync(out, JSON.stringify(manifest, null, 2) + "\n");
const have = Object.values(manifest).filter(Boolean).length;
console.log(`${have}/${Object.keys(manifest).length} captures present → src/demo/manifest.json`);
if (!existsSync(path.join(root, "public", "audio", "demo-mix.mp3"))) {
  console.log("note: public/audio/demo-mix.mp3 is missing — copy bluestift_demo_audio_mix.mp3 there for Studio audio");
}
