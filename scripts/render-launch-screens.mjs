/**
 * Render the iOS launch screens into public/. Needs Playwright and Pillow, and a
 * dev server already up (override with LAUNCH_ORIGIN). Run from the repo root:
 *
 *   npm run dev &            # or next dev -p 3000
 *   node scripts/render-launch-screens.mjs
 *
 * AFTER RUNNING THIS, BUMP `VERSION` IN public/sw.js. The files keep their
 * names, and the worker caches /public images cache-first with no revalidation,
 * so returning visitors — and an already-installed home screen — would otherwise
 * keep the previous launch screen forever.
 *
 * Why a browser rather than scripts/process-logos.py, which makes everything
 * else: these carry the "BlueStift" wordmark, and it has to be the one the
 * landing page shows — IBM Plex Sans at 800 (which Plex resolves to Bold, since
 * it stops at 700), letter-spacing -0.02em, "Blue" and "Stift" in two different
 * blues. The only copy of that face in the repo is the woff2 next/font caches
 * under a content hash, and its name table reports weight 400 for every weight,
 * so there is no reliable way to pick the right file for Pillow. Loading a real
 * page and reading `var(--font-plex)` sidesteps the guess entirely: the browser
 * resolves the family, the weight fallback and the kerning exactly as it does
 * for the site.
 *
 * Two sets, because there are two installable apps (see app/manifest.ts and
 * app/raya-manifest/route.ts):
 *   launch-<w>x<h>.png       Bluestift — the bird over the wordmark
 *   launch-raya-<w>x<h>.png  Raya — its own mark, no word
 *
 * The gradient is the one /onboarding paints, which is also the site's light
 * `pageBg`, so the launch screen dissolves into the product's first screen
 * rather than cutting to it.
 *
 * On the encoding: Chromium writes full-colour PNGs with no optimisation pass,
 * which came out at 80-130 KB each, 2 MB for the set. They go through Pillow
 * afterwards, and HOW matters. A gradient looks like the one thing quantisation
 * would ruin, and the usual metric says otherwise — 256 colours cut an earlier
 * version from 46 KB to 16 KB for a worst per-channel error of 5, which reads as
 * nothing. It is not nothing. An error of 5 means a STEP of 10 between
 * neighbouring levels, and a step of 10 held across 400px of near-flat colour is
 * a visible edge; measured, that ramp had collapsed from 75 levels to six bands.
 * Average error is the wrong instrument here. Band count and step size are the
 * right ones, and an adaptive palette with Floyd-Steinberg keeps both intact:
 * 2130 levels at a maximum step of 1, identical to the browser's own output, for
 * 33 KB instead of 82.
 */

import { chromium } from "playwright";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, statSync } from "node:fs";
import { join } from "node:path";

const ORIGIN = process.env.LAUNCH_ORIGIN ?? "http://localhost:3000";
const OUT = join(process.cwd(), "public");

/** Must stay in step with lib/launch-screens.ts — test/pwa-manifest.test.ts checks. */
const DEVICES = [
  [375, 667, 2],
  [414, 736, 3],
  [375, 812, 3],
  [414, 896, 2],
  [414, 896, 3],
  [390, 844, 3],
  [428, 926, 3],
  [393, 852, 3],
  [430, 932, 3],
  [402, 874, 3],
  [440, 956, 3],
];

/** components/site/theme.ts — light `pageBg`, the gradient /onboarding paints. */
const GRADIENT = "linear-gradient(180deg,#eef3f9 0%,#dde8f3 45%,#c9d9ea 100%)";
/** components/site/theme.ts — wordmarkA and wordmarkB. */
const WORDMARK_A = "#173d8a";
const WORDMARK_B = "#2f7fe0";

const APPS = [
  {
    prefix: "launch",
    mark: "bluestift-mark.png",
    // "avec le mot bluestift" — the wordmark as the navbar writes it.
    word: true,
    markShare: 0.2,
  },
  {
    prefix: "launch-raya",
    mark: "raya-mark.png",
    // The tutor's mark stands alone: "Raya" is set in a serif the container has
    // no copy of (Cambria Math, falling back to Times New Roman), so baking the
    // word here would ship whatever this machine happens to have rather than
    // what a phone shows. The mark is the identity either way.
    word: false,
    markShare: 0.26,
  },
];

const dataUri = (file) =>
  `data:image/png;base64,${readFileSync(join(OUT, file)).toString("base64")}`;

/**
 * Re-encode in place with an adaptive, dithered palette — see the note on
 * encoding above. Pillow rather than a JS quantiser because the repo's image
 * pipeline already requires it (scripts/process-logos.py) and adding a Node
 * dependency to save a subprocess is a bad trade.
 */
function optimize(path) {
  execFileSync("python3", [
    "-c",
    [
      "import sys",
      "from PIL import Image",
      "p = sys.argv[1]",
      "im = Image.open(p).convert('RGB')",
      "im.convert('P', palette=Image.Palette.ADAPTIVE, colors=256,",
      "           dither=Image.Dither.FLOYDSTEINBERG).save(p, 'PNG', optimize=True)",
    ].join("\n"),
    path,
  ]);
}

const browser = await chromium.launch();
let total = 0;

for (const app of APPS) {
  const markSrc = dataUri(app.mark);

  for (const [cssW, cssH, ratio] of DEVICES) {
    const context = await browser.newContext({
      viewport: { width: cssW, height: cssH },
      deviceScaleFactor: ratio,
    });
    const page = await context.newPage();

    // A real page first, so next/font has defined --font-plex on <html>. Reading
    // the variable is the whole reason this runs in a browser.
    await page.goto(ORIGIN, { waitUntil: "networkidle", timeout: 60000 });
    await page.evaluate(() => document.fonts.ready);

    await page.evaluate(
      ({ gradient, markSrc, word, markShare, a, b }) => {
        document.documentElement.style.background = gradient;
        document.body.style.cssText =
          `margin:0;height:100vh;display:flex;flex-direction:column;` +
          `align-items:center;justify-content:center;gap:22px;background:${gradient};`;
        document.body.innerHTML =
          `<img src="${markSrc}" style="width:${markShare * 100}vw;display:block">` +
          (word
            ? `<div style="font-family:var(--font-plex),'IBM Plex Sans',sans-serif;` +
              `font-weight:800;letter-spacing:-0.02em;font-size:7.5vw;line-height:1">` +
              `<span style="color:${a}">Blue</span><span style="color:${b}">Stift</span></div>`
            : "");
      },
      {
        gradient: GRADIENT,
        markSrc,
        word: app.word,
        markShare: app.markShare,
        a: WORDMARK_A,
        b: WORDMARK_B,
      },
    );
    await page.evaluate(() => document.fonts.ready);

    const name = `${app.prefix}-${cssW * ratio}x${cssH * ratio}.png`;
    const path = join(OUT, name);
    const buf = await page.screenshot({ type: "png" });
    writeFileSync(path, buf);
    optimize(path);
    const kb = statSync(path).size / 1024;
    total += kb;
    console.log(
      `${name.padEnd(28)} ${cssW}x${cssH}@${ratio}x -> ${cssW * ratio}x${cssH * ratio}  ` +
        `${(buf.length / 1024).toFixed(0)} -> ${kb.toFixed(1)} KB`,
    );
    await context.close();
  }
}

await browser.close();
console.log(`\n${APPS.length * DEVICES.length} launch screens, ${total.toFixed(0)} KB total`);
