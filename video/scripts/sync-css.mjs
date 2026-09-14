import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * What the video borrows from the site, refreshed before every studio/render.
 *
 * The product shots are styled by app/globals.css — their keyframes, the
 * `pub-shot-*` classes, the font role properties. The video reads the same file
 * rather than a copy that would drift, minus the three `@tailwind` directives:
 * the shots use no utility classes, and Remotion has no PostCSS step for them.
 * The Bluestift mark comes along for the end card.
 */
const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, "..", "..");
const video = join(here, "..");

// Root-relative asset URLs (the hero clouds) are site pages' business, not the
// shots'; left in, the bundler tries to resolve them from this package and fails.
const css = readFileSync(join(repo, "app", "globals.css"), "utf8")
  .replace(/^@tailwind\s+\w+;\s*$/gm, "")
  .replace(/url\(\s*["']?\/[^)"']*["']?\s*\)/g, "none");
const cssTarget = join(video, "src", "generated", "site.css");
mkdirSync(dirname(cssTarget), { recursive: true });
writeFileSync(cssTarget, css);

// The marks: the end card's, and the ones the shots load by root-relative path
// (`/raya-mark.png`), which Remotion serves from this package's public/.
const marks = ["bluestift-mark.png", "raya-mark.png", "raya-mark-dark.png"];
for (const mark of marks) {
  const target = join(video, "public", mark);
  mkdirSync(dirname(target), { recursive: true });
  copyFileSync(join(repo, "public", mark), target);
}
const brandTarget = join(video, "public", "brand", "bluestift-mark.png");
mkdirSync(dirname(brandTarget), { recursive: true });
copyFileSync(join(repo, "public", "bluestift-mark.png"), brandTarget);

console.log(`site synced: globals.css (${Math.round(css.length / 1024)} KB), ${marks.join(", ")}`);
