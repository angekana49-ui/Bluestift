import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * The public navbar has no room to spare on a phone, and the ways it can break
 * are all invisible in review.
 *
 * Below 900px the five nav pills are gone and the bar is brand + theme + CTA,
 * every label `white-space: nowrap`. Nothing there can shrink, so anything that
 * grows pushes "Open app" out past the pill's rounded edge — where the radius
 * hides the first few pixels of the overflow. That is how the 66px Day/Night
 * switch came to sit in a bar that could not hold it.
 *
 * Two invariants keep the fix standing:
 *   1. the pill and the icon are MUTUALLY EXCLUSIVE, on the same boundary the
 *      nav links already use. Two visible theme controls is the overflow again;
 *      zero visible is no way to change the theme at all.
 *   2. the CTA's label is never what gets sacrificed for width.
 */

const css = readFileSync(join(process.cwd(), "app/globals.css"), "utf8");
const navbar = readFileSync(join(process.cwd(), "components/site/Navbar.tsx"), "utf8");
const toggle = readFileSync(join(process.cwd(), "components/site/ThemeToggle.tsx"), "utf8");

/**
 * Every block written at a given query, concatenated.
 *
 * Not the first one: a stylesheet may state the same breakpoint more than once,
 * and this file does — the nav links and the theme controls each keep their own
 * block so each keeps its own reason next to it. Taking only the first would
 * make this test assert against whichever happened to be written higher up.
 */
function mediaBlock(query: string): string {
  const out: string[] = [];
  let from = 0;
  for (;;) {
    const at = css.indexOf(`@media ${query}`, from);
    if (at < 0) return out.join("\n");
    let depth = 0;
    let end = css.length;
    for (let i = css.indexOf("{", at); i < css.length; i++) {
      if (css[i] === "{") depth++;
      else if (css[i] === "}" && --depth === 0) {
        end = i + 1;
        break;
      }
    }
    out.push(css.slice(at, end));
    from = end;
  }
}

describe("the theme control swaps shape instead of overflowing", () => {
  const compact = mediaBlock("(max-width: 899px)");

  it("hides the wide pill and shows the icon below the nav breakpoint", () => {
    expect(compact).toMatch(/\.pub-theme-pill\s*\{[^}]*display:\s*none\s*!important/);
    expect(compact).toMatch(/\.pub-theme-icon\s*\{[^}]*display:\s*flex\s*!important/);
  });

  it("uses the SAME boundary as the nav links, not a new one", () => {
    // A gap between the two breakpoints is a viewport showing both controls, or
    // neither. 899/900 is the cutoff the pills and the brand menu already use.
    expect(mediaBlock("(max-width: 899px)")).toMatch(/\.pub-nav-links/);
    expect(mediaBlock("(min-width: 900px)")).toMatch(/\.pub-nav-chevron/);
  });

  it("renders both controls so CSS can choose, rather than measuring in JS", () => {
    // `window.innerWidth` at render has no answer on the server and would
    // correct itself visibly after hydration.
    expect(navbar).toMatch(/className="pub-theme-pill"/);
    expect(navbar).toMatch(/className="pub-theme-icon"/);
    expect(navbar).not.toMatch(/innerWidth[^)]*\?\s*<ThemeToggle/);
  });

  it("gives both controls the same handler, so neither can go inert", () => {
    const actions = navbar.slice(navbar.indexOf('className="pub-nav-actions"'));
    const region = actions.slice(0, actions.indexOf("</div>"));
    const handlers = region.match(/onToggle=\{onToggleTheme\}/g) ?? [];
    expect(handlers.length).toBe(2);
  });

  it("keeps the compact button a real button with an accessible name", () => {
    const compactSrc = toggle.slice(toggle.indexOf("export function ThemeToggleCompact"));
    expect(compactSrc).toMatch(/type="button"/);
    expect(compactSrc).toMatch(/aria-label=\{tr\("theme\.switchAria"\)\}/);
  });
});

describe("the 320px rules buy width from decoration, not from the CTA", () => {
  const tiny = mediaBlock("(max-width: 359px)");

  it("exists and shrinks the mark rather than dropping it", () => {
    expect(tiny).toMatch(/\.pub-nav-mark\s*\{[^}]*width:\s*30px/);
    expect(tiny).not.toMatch(/\.pub-nav-mark\s*\{[^}]*display:\s*none/);
  });

  it("never hides the CTA", () => {
    // "Start free" / "Open app" is the one element in this bar with a job. A
    // narrow screen is not a reason to remove the way in.
    expect(tiny).not.toMatch(/\.pub-press\s*\{[^}]*display:\s*none/);
    expect(tiny).toMatch(/\.pub-press\s*\{[^}]*padding/);
  });

  it("drops the section suffix, which is the one unbounded item", () => {
    // "· Research" is decorative here and its width depends on the page name,
    // so it can blow past any budget the fixed items are tuned to.
    expect(tiny).toMatch(/\.pub-nav-section\s*\{[^}]*display:\s*none/);
    expect(navbar).toMatch(/className="pub-nav-section"/);
  });

  it("sits below the compact breakpoint, not across it", () => {
    expect(css.indexOf("@media (max-width: 359px)")).toBeGreaterThan(
      css.indexOf("@media (max-width: 899px)"),
    );
  });
});
