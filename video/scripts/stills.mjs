import path from "node:path";
import { fileURLToPath } from "node:url";
import { bundle } from "@remotion/bundler";
import { getCompositions, renderStill } from "@remotion/renderer";
import { makeWebpackOverride } from "../webpack-override.mjs";

/**
 * Renders a handful of stills from one bundle — the quick way to look at the
 * film without rendering three minutes of it. Times in seconds. Usage:
 *   node scripts/stills.mjs 7.5 12 16.3 [--scale=1]
 */
const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, "..");
const args = process.argv.slice(2);
const scale = Number(args.find((a) => a.startsWith("--scale="))?.slice(8) ?? 1);
const times = args.filter((a) => !a.startsWith("--")).map(Number).filter((n) => Number.isFinite(n));
if (times.length === 0) {
  console.error("usage: node scripts/stills.mjs <seconds> [seconds...] [--scale=1]");
  process.exit(1);
}

const serveUrl = await bundle({ entryPoint: path.join(root, "src", "index.ts"), webpackOverride: makeWebpackOverride(root) });
const compositions = await getCompositions(serveUrl);
const composition = compositions.find((c) => c.id === "HowItWorks");
console.log(`HowItWorks: ${composition.durationInFrames} frames (${(composition.durationInFrames / composition.fps).toFixed(1)}s)`);

for (const seconds of times) {
  const frame = Math.min(composition.durationInFrames - 1, Math.round(seconds * composition.fps));
  const output = path.join(root, "out", "stills", `t${seconds.toFixed(2).padStart(6, "0")}.png`);
  const started = Date.now();
  await renderStill({ composition, serveUrl, frame, output, imageFormat: "png", scale });
  console.log(`${seconds}s (frame ${frame}) → ${path.relative(root, output)} in ${Date.now() - started} ms`);
}
