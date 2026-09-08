// Turn the vector brand marks in brand/ into the PNG marks and home-screen
// icons in public/. Run from the repo root:
//   node scripts/render-brand-icons.mjs
// Needs Playwright (already a devDependency) and sharp (already pulled in by
// Next.js). No Python step here — see brand/README.md for how the five SVGs
// in brand/ were themselves produced from the archived raw crops; that part
// needed a real bitmap-to-vector tracer (vtracer) and is not re-run by this
// script, only the "place the vector, pad it, export a PNG" part is.
//
// AFTER RUNNING THIS, BUMP `VERSION` IN public/sw.js — see the comment on
// that constant for why: the shell cache never revalidates a stable asset
// that keeps its filename, so a bytes-only change needs the cache renamed or
// a returning visitor keeps the old mark (and an installed PWA keeps the old
// home-screen icon) forever.
//
// Sizing math: each SVG in brand/ already carries a small margin from how it
// was traced (the artwork's long edge fills ~89.3% of the SVG's own square
// canvas — see brand/README.md). `F_*` below is the ADDITIONAL scale applied
// on top of that so the artwork's long edge ends up filling the fraction a
// given output actually wants: solving f * 0.893 = 1/(1+2*margin) for f.
// This mirrors the `margin` parameter process-logos.py used for the same
// five artworks, so a mark looks the same size relative to its canvas
// whichever pipeline produced it.
import { chromium } from "playwright";
import sharp from "sharp";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BRAND = path.join(ROOT, "brand");
const OUT = path.join(ROOT, "public");

const NAVY = "#0B1220"; // theme.ts's ctaBg — the installed icon and the product agree on what "dark" is
const BAKED_IN_FILL = 0.8929; // long edge / canvas side, as traced (1 / 1.12)
const F_ANY = (1 / 1.2) / BAKED_IN_FILL; // overall margin 0.10 — marks, and "any"-purpose icons
const F_MASK = (1 / 1.8) / BAKED_IN_FILL; // overall margin 0.40 — maskable icons need a big safe zone
const F_APPLE = (1 / 1.5) / BAKED_IN_FILL; // overall margin 0.25 — iOS applies its own rounded-rect, no safe zone

const JOBS = [
  // [source svg, output png, size, scale factor, background (null = transparent)]
  ["bluestift-mark.svg", "bluestift-mark.png", 256, F_ANY, null],
  ["bluestift-mark-white.svg", "bluestift-mark-dark.png", 256, F_ANY, null],
  ["raya-mark.svg", "raya-mark.png", 256, F_ANY, null],
  ["raya-mark-white.svg", "raya-mark-dark.png", 256, F_ANY, null],
  ["raya-mark-black.svg", "raya-mark-black.png", 256, F_ANY, null],

  ["bluestift-mark.svg", "icon-192.png", 192, F_ANY, null],
  ["bluestift-mark.svg", "icon-512.png", 512, F_ANY, null],
  ["bluestift-mark-white.svg", "icon-maskable-512.png", 512, F_MASK, NAVY],
  ["bluestift-mark-white.svg", "apple-touch-icon.png", 180, F_APPLE, NAVY],

  ["raya-mark.svg", "icon-raya-192.png", 192, F_ANY, null],
  ["raya-mark.svg", "icon-raya-512.png", 512, F_ANY, null],
  ["raya-mark-white.svg", "icon-raya-maskable-512.png", 512, F_MASK, NAVY],
  ["raya-mark-white.svg", "apple-touch-icon-raya.png", 180, F_APPLE, NAVY],
];

const SUPERSAMPLE = 4; // render this many times bigger, then downscale -- cheap anti-aliasing insurance

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();

for (const [svgFile, outName, size, f, bg] of JOBS) {
  const svg = readFileSync(path.join(BRAND, svgFile), "utf8");
  const svgDataUri = `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
  const artPx = Math.round(size * f);
  const html = `<!doctype html><html><body style="margin:0">
    <div id="box" style="width:${size}px;height:${size}px;display:flex;align-items:center;justify-content:center;background:${bg ?? "transparent"}">
      <img src="${svgDataUri}" width="${artPx}" height="${artPx}"/>
    </div>
  </body></html>`;

  const page = await browser.newPage({
    viewport: { width: size, height: size },
    deviceScaleFactor: SUPERSAMPLE,
  });
  await page.setContent(html);
  const raw = await page.locator("#box").screenshot({ omitBackground: !bg });
  await page.close();

  let pipeline = sharp(raw).resize(size, size, { kernel: "lanczos3" });
  if (bg) pipeline = pipeline.flatten({ background: bg }); // drop the alpha channel -- iOS/Android composite these onto black otherwise
  // Flat/banded artwork: 64 colours is visually lossless here and cuts the
  // file size roughly 4x, same trade the raw-crop pipeline makes and for the
  // same reason (docs/performance.md — this product targets 2G/3G).
  const png = await pipeline.png({ palette: true, colors: 64 }).toBuffer();

  // Write the already-quantised buffer as-is -- piping it through another
  // sharp().toFile() re-encodes it (losing the palette output this deliberately
  // asked for) and comes out ~1.5x bigger for no visual gain.
  const dest = path.join(OUT, outName);
  writeFileSync(dest, png);
  console.log(`${svgFile.padEnd(26)} -> ${outName.padEnd(26)} ${size}x${size} art=${artPx}px bg=${bg ?? "transparent"} ${(png.length / 1024).toFixed(1)} KB`);
}

await browser.close();
