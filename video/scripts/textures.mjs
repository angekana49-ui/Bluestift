import path from "node:path";
import { fileURLToPath } from "node:url";
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
import { makeWebpackOverride } from "../webpack-override.mjs";

/**
 * Renders the finished screens the film's wide shots use as pictures
 * (src/Texture.tsx), at twice their layout size, into public/textures/.
 * Part of `npm run prepare:assets`; re-run when a site shot changes.
 * The names are TEXTURES in src/Texture.tsx.
 */
const NAMES = ["socratic-light", "room-light", "tools-dark", "kernel-dark", "focus-dark", "return-light", "dashboard-light", "loop-dark", "guided-light"];

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, "..");
const serveUrl = await bundle({ entryPoint: path.join(root, "src", "index.ts"), webpackOverride: makeWebpackOverride(root) });

for (const name of NAMES) {
  const composition = await selectComposition({ serveUrl, id: "Texture", inputProps: { name } });
  const output = path.join(root, "public", "textures", `${name}.png`);
  await renderStill({ composition, serveUrl, frame: 0, output, imageFormat: "png", scale: 2, inputProps: { name } });
  console.log(`texture ${name} (${composition.width}×${composition.height} @2x) → ${path.relative(root, output)}`);
}
