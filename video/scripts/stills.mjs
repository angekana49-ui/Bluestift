import path from "node:path";
import { fileURLToPath } from "node:url";
import { bundle } from "@remotion/bundler";
import { getCompositions, renderStill } from "@remotion/renderer";
import { makeWebpackOverride } from "../webpack-override.mjs";

/**
 * Renders a handful of stills from one bundle — the quick way to look at the
 * video without rendering two minutes of it. Usage:
 *   node scripts/stills.mjs 120 520 900        (frame numbers)
 */
const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, "..");
const frames = process.argv.slice(2).map(Number).filter((n) => Number.isFinite(n));
if (frames.length === 0) {
  console.error("usage: node scripts/stills.mjs <frame> [frame...]");
  process.exit(1);
}

const serveUrl = await bundle({ entryPoint: path.join(root, "src", "index.ts"), webpackOverride: makeWebpackOverride(root) });
const compositions = await getCompositions(serveUrl);
const composition = compositions.find((c) => c.id === "HowItWorks");
console.log(`HowItWorks: ${composition.durationInFrames} frames (${(composition.durationInFrames / composition.fps).toFixed(1)}s)`);

for (const frame of frames) {
  const output = path.join(root, "out", "stills", `frame-${String(frame).padStart(4, "0")}.png`);
  await renderStill({
    composition,
    serveUrl,
    frame,
    output,
    imageFormat: "png",
    onBrowserLog: (log) => {
      if (log.text.includes("[FrozenShot]")) console.log(`  ${log.text}`);
    },
  });
  console.log(`still ${frame} → ${path.relative(root, output)}`);
}
