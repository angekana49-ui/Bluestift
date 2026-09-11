import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

/**
 * The product has ONE display face, named in ONE place, with ONE exception.
 *
 * Before this, the display face was IBM Plex Sans spelled out as a literal
 * font stack at some twenty call sites — `"var(--font-plex),'IBM Plex
 * Sans',sans-serif"` — copied from wherever it was copied from. Changing the
 * face meant finding all twenty, and the real cost was not the finding: it was
 * that nobody could tell, from any one of them, whether the string was a
 * decision or an inheritance. A design system that can only be changed by
 * search-and-replace is not a system.
 *
 * So the face now has a name (`--font-display` in globals.css, `display` in
 * tokens.ts) and the literals are gone. These tests are what keeps them gone.
 */

const read = (rel: string) =>
  readFileSync(join(process.cwd(), rel), "utf8").split("\r\n").join("\n");

/**
 * Strip comments before asserting on code.
 *
 * Every one of these rules is worth a paragraph explaining WHY, and those
 * paragraphs necessarily quote the very thing being forbidden — the note in
 * globals.css says the word "@font-face", the billing cards say "IBM Plex
 * Sans" in explaining why they kept it. A check that cannot tell a rule from
 * a sentence about the rule punishes the comment, and the comment is the part
 * that stops this being re-broken by someone who never read the test.
 */
const code = (src: string) =>
  src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

const css = code(read("app/globals.css"));
const tokens = read("components/ui/tokens.ts");

/** Every source file that could name a font, app and marketing site alike. */
function sources(): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const p = join(dir, entry);
      if (statSync(p).isDirectory()) {
        if (entry !== "node_modules" && !entry.startsWith(".")) walk(p);
      } else if (/\.(tsx?|css)$/.test(entry)) {
        out.push(relative(process.cwd(), p).split(sep).join("/"));
      }
    }
  };
  walk(join(process.cwd(), "app"));
  walk(join(process.cwd(), "components"));
  return out;
}

describe("the display face is named once", () => {
  it("is declared as a role, not as a family, in the stylesheet", () => {
    expect(css).toMatch(/--font-display:/);
    expect(css).toMatch(/--font-editorial:/);
    // The tracking that makes display type look set rather than defaulted.
    expect(css).toMatch(/--track-display: -0\.045em/);
  });

  it("agrees with the token that mirrors it for inline styles", () => {
    // Two declarations of the same thing is the arrangement we are stuck with
    // — CSS rules cannot read a TS module, inline styles cannot read a CSS
    // custom property without naming it. What they must not do is disagree
    // about WHICH face, so both are checked to lead with the same one.
    const fromCss = /--font-display:\s*"([^"]+)"/.exec(css)?.[1];
    const fromToken = /export const display =\s*\n?\s*"'([^']+)'/.exec(tokens)?.[1];
    expect(fromCss).toBe("ABC Favorit");
    expect(fromToken).toBe("ABC Favorit");
  });

  it("ships no font it has not licensed", () => {
    /*
     * ABC Favorit (Dinamo) and Domaine Display (Klim) are retail faces. They
     * lead their stacks because naming a face costs nothing and makes a bought
     * licence a drop-in — but naming is ALL we do. The moment one of them turns
     * up in an @font-face rule or a file under public/, this repo is
     * redistributing a commercial font, and that is a bill, not a bug.
     *
     * next/font/google is the only loader, and it can only serve Google Fonts.
     */
    expect(css).not.toMatch(/@font-face\s*\{/);
    // next/font/google is the only loader in the app, and it can serve nothing
    // but Google Fonts — so a paid face could only arrive as a local file.
    const layout = code(read("app/layout.tsx"));
    expect(layout).not.toMatch(/localFont/);
    for (const paid of ["ABC_Favorit", "Domaine_Display"]) {
      expect(layout, `${paid} must not be loaded as a file`).not.toContain(paid);
    }
  });
});

describe("IBM Plex Sans is the billing exception and nothing else", () => {
  /**
   * The one surface that did not change face. A price list that restyles
   * itself while its owner is deciding whether to pay reads as a page that was
   * edited — so the billing cards keep the face they were last seen in.
   *
   * An exception that is not enforced is just a file somebody forgot, so it is
   * spelled out here: these two, by name, and no others.
   */
  const ALLOWED = new Set([
    "components/ui/tokens.ts", // where `billingDisplay` is defined
  ]);

  it("is reached through the token, never spelled out as a stack", () => {
    // `var(--font-plex)` in a file's CODE is the tell: it means somebody wrote
    // the old face out by hand instead of asking for a role. Saying the words
    // "IBM Plex Sans" in a comment is not that, and is welcome.
    const offenders = sources().filter(
      (rel) => !ALLOWED.has(rel) && code(read(rel)).includes("var(--font-plex)"),
    );
    expect(
      offenders,
      `these name IBM Plex Sans directly. The display face is \`display\` from ` +
        `components/ui/tokens.ts (or var(--font-display) in CSS); the old face is ` +
        `\`billingDisplay\` and belongs to the billing cards alone.`,
    ).toEqual([]);
  });

  it("is loaded in exactly one place, the way every face is", () => {
    const loaders = sources().filter((rel) => code(read(rel)).includes("IBM_Plex_Sans"));
    expect(loaders).toEqual(["app/layout.tsx"]);
  });

  it("is actually applied by both billing cards, not merely available", () => {
    for (const rel of [
      "components/raya/settings-billing-card.tsx", // b2c: Settings > Billing
      "components/school-billing.tsx", // b2b: the school's Billing tab
    ]) {
      const src = code(read(rel));
      // Either way of handing the face down counts — the b2c card passes it as
      // a prop to SettingsCard, the b2b tab sets it on its own root — but
      // IMPORTING the token and never applying it does not.
      expect(src, `${rel} no longer pins the billing face`).toMatch(
        /fontFamily(: | *= *\{)billingDisplay/,
      );
    }
  });

  it("stays out of the critical path, being a two-card face", () => {
    // Preloading puts a font in the critical path of EVERY page whether that
    // page uses it or not. Plex stopped being the display face; it must not
    // keep the display face's budget.
    const layout = read("app/layout.tsx");
    const plexBlock = /const plex = IBM_Plex_Sans\(\{([\s\S]*?)\}\);/.exec(layout)?.[1];
    expect(plexBlock).toBeDefined();
    expect(plexBlock).toMatch(/preload: false/);
  });
});
