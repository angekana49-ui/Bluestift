import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * How long each voice line lasts, read from the WAV headers in public/voice/.
 *
 * The timeline is built from these numbers, so swapping the draft voices for the
 * final recordings re-times every scene and caption on its own: replace the
 * files, run this, render.
 */
const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const script = JSON.parse(readFileSync(join(root, "src", "script.json"), "utf8"));

function wavSeconds(path) {
  const buf = readFileSync(path);
  if (buf.toString("ascii", 0, 4) !== "RIFF" || buf.toString("ascii", 8, 12) !== "WAVE") {
    throw new Error(`${path} is not a WAV file`);
  }
  let offset = 12;
  let byteRate = 0;
  while (offset + 8 <= buf.length) {
    const id = buf.toString("ascii", offset, offset + 4);
    const size = buf.readUInt32LE(offset + 4);
    if (id === "fmt ") byteRate = buf.readUInt32LE(offset + 16);
    if (id === "data") {
      if (!byteRate) throw new Error(`${path}: data before fmt`);
      return size / byteRate;
    }
    offset += 8 + size + (size % 2);
  }
  throw new Error(`${path}: no data chunk`);
}

const manifest = {};
for (const scene of script.scenes) {
  scene.lines.forEach((_, i) => {
    const name = `${scene.id}-${i}`;
    manifest[name] = Math.round(wavSeconds(join(root, "public", "voice", `${name}.wav`)) * 1000) / 1000;
  });
}

const target = join(root, "src", "generated", "voice-manifest.json");
mkdirSync(dirname(target), { recursive: true });
writeFileSync(target, JSON.stringify(manifest, null, 2));
const total = Object.values(manifest).reduce((a, b) => a + b, 0);
console.log(`voice manifest: ${Object.keys(manifest).length} lines, ${total.toFixed(1)}s of speech`);
