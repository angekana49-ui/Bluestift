import path from "node:path";
import { fileURLToPath } from "node:url";
import { bundle } from "@remotion/bundler";
import { getCompositions, renderStill } from "@remotion/renderer";
import { makeWebpackOverride } from "../webpack-override.mjs";

/**
 * A contact sheet of the site's drawings, light and dark — for choosing shots
 * and checking a moment of their choreography. Dev only. Usage:
 *   node scripts/gallery.mjs [shot[@ms|@still] ...] [--light|--dark] [--width=1500]
 */
const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, "..");
const all = ["socratic", "room", "tools", "kernel", "focus", "guided", "return", "rung", "dashboard", "loop", "graph"];
const args = process.argv.slice(2);
const flags = args.filter((a) => a.startsWith("--"));
const picks = args.filter((a) => !a.startsWith("--"));
const themes = flags.includes("--light") ? [false] : flags.includes("--dark") ? [true] : [false, true];
const width = Number(flags.find((f) => f.startsWith("--width="))?.slice(8) ?? 1500);

const serveUrl = await bundle({ entryPoint: path.join(root, "src", "index.ts"), webpackOverride: makeWebpackOverride(root) });
const compositions = await getCompositions(serveUrl, { inputProps: { shot: "kernel", dark: false, ms: 0, width } });
const composition = compositions.find((c) => c.id === "Gallery");

for (const pick of picks.length ? picks : all) {
  const [shot, when = "60000"] = pick.split("@");
  for (const dark of themes) {
    const still = when === "still";
    const inputProps = { shot, dark, ms: still ? 0 : Number(when), width, still };
    const output = path.join(root, "out", "gallery", `${shot}-${when}-${dark ? "dark" : "light"}.png`);
    const started = Date.now();
    await renderStill({
      composition: { ...composition, props: inputProps },
      serveUrl,
      frame: 0,
      output,
      imageFormat: "png",
      inputProps,
      onBrowserLog: (l) => l.text.includes("[FrozenShot]") && console.log(l.text),
    });
    console.log(`${path.basename(output)}: ${Date.now() - started} ms`);
  }
}
