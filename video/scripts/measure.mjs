import path from "node:path";
import { fileURLToPath } from "node:url";
import { bundle } from "@remotion/bundler";
import { getCompositions, renderStill } from "@remotion/renderer";
import { makeWebpackOverride } from "../webpack-override.mjs";

/**
 * Where things are inside a site shot at a given width, so a camera move can
 * be aimed at them rather than guessed. Dev only. Usage:
 *   node scripts/measure.mjs <shot> <width> "Text one" "Text two" … [--dark] [--ms=60000]
 * Each spec may also be `shot:width:Text|Text` to measure several shots in one bundle.
 */
const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, "..");
const args = process.argv.slice(2);
const dark = args.includes("--dark");
const ms = Number(args.find((a) => a.startsWith("--ms="))?.slice(5) ?? 60000);
const plain = args.filter((a) => !a.startsWith("--"));

const jobs = plain[0]?.includes(":")
  ? plain.map((spec) => {
      const [shot, width, texts] = spec.split(":");
      return { shot, width: Number(width), texts: texts.split("|") };
    })
  : [{ shot: plain[0], width: Number(plain[1]), texts: plain.slice(2) }];

const serveUrl = await bundle({ entryPoint: path.join(root, "src", "index.ts"), webpackOverride: makeWebpackOverride(root) });
const composition = (await getCompositions(serveUrl, { inputProps: { shot: "kernel", dark, ms, width: 1000 } })).find((c) => c.id === "Gallery");

for (const job of jobs) {
  console.log(`— ${job.shot} @ ${job.width}px ${dark ? "dark" : "light"}`);
  const inputProps = { shot: job.shot, dark, ms, width: job.width, measure: job.texts };
  await renderStill({
    composition: { ...composition, props: inputProps },
    serveUrl,
    frame: 0,
    output: path.join(root, "out", "gallery", `measure-${job.shot}.png`),
    inputProps,
    onBrowserLog: (l) => {
      const m = l.text.match(/\[measure\] .*/);
      if (m && !l.text.startsWith("[Tab")) console.log("  " + m[0].slice(10));
    },
  });
}
