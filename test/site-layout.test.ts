import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import {
  MEASURE,
  LEAD,
  PAGE_TOP,
  PAGE_TOP_MIN,
  PAGE_BOTTOM,
  SECTION_Y,
  SECTION_Y_MIN,
  GUTTER,
  pageTop,
  sectionY,
} from "@/components/site/layout";

/**
 * The public site's page template is a decision, and decisions decay silently.
 *
 * Every measure on the site used to be a literal typed into whichever file was
 * open at the time. That produced ten different content widths (560 / 640 / 720
 * / 760 / 820 / 900 / 940 / 1000 / 1080 / 1100), six of them on the landing page
 * alone, so the content edge moved under the visitor as they scrolled. Page tops
 * split into 140 and 150 for no reason at all.
 *
 * Nothing about that was visible in review — each individual number looked
 * reasonable next to the content it wrapped. It was only visible in aggregate.
 * So the aggregate is what gets asserted here: a new `maxWidth: 900` typed into
 * a section fails this test rather than quietly re-opening the drift.
 */

const SITE_DIR = join(process.cwd(), "components", "site");

/**
 * Component-internal caps that are deliberately NOT page measures. Each one
 * constrains a single element inside an already-constrained column, so it
 * answers to that element's own legibility, not to the page template.
 *
 * Adding to this list is allowed — it is a claim that the number is local. If
 * the number is really a column width, it belongs in MEASURE instead.
 */
const ALLOWED_LOCAL_CAPS: Record<number, string> = {
  220: "Footer — the tagline sitting under the wordmark",
  520: "LanguagePrompt — a bar floating over the page, sized to hold a label and four chips",
  620: "LadderSection — body copy inside a rung card",
  640: "FeaturesSection — the only two-line heading on the site, needs a break point",
};

function tsxFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return tsxFiles(full);
    return entry.endsWith(".tsx") ? [full] : [];
  });
}

describe("public site layout template", () => {
  const files = tsxFiles(SITE_DIR).filter((f) => !f.endsWith(`${join("site", "layout.tsx")}`));

  it("finds the site components (guards against the walk silently returning nothing)", () => {
    expect(files.length).toBeGreaterThan(15);
  });

  it("declares four measures, in ascending order, and nothing between them", () => {
    const values = Object.values(MEASURE);
    expect(values).toEqual([...values].sort((a, b) => a - b));
    expect(new Set(values).size).toBe(values.length);
    expect(values).toEqual([560, 680, 820, 1080]);
  });

  it("uses no numeric maxWidth outside the allowed local caps", () => {
    const offenders: string[] = [];

    for (const file of files) {
      const src = readFileSync(file, "utf8");
      src.split("\n").forEach((line, i) => {
        for (const m of line.matchAll(/maxWidth: ?(\d+)/g)) {
          const value = Number(m[1]);
          if (!(value in ALLOWED_LOCAL_CAPS)) {
            offenders.push(`${file.replace(process.cwd(), "")}:${i + 1} → maxWidth: ${value}`);
          }
        }
      });
    }

    expect(offenders, `Use MEASURE/LEAD from components/site/layout.tsx:\n${offenders.join("\n")}`).toEqual([]);
  });

  it("uses no hard-coded page or section padding", () => {
    // The four values the template owns. A literal `150px 24px` in a section is
    // the exact shape the drift took last time.
    const banned = [
      new RegExp(`padding: ?"${PAGE_TOP}px`),
      new RegExp(`padding: ?"${SECTION_Y}px`),
      new RegExp(`paddingTop: ?${PAGE_TOP}\\b`),
      new RegExp(`paddingBottom: ?${PAGE_BOTTOM}\\b`),
      /padding: ?"140px/,
      /padding: ?"112px/,
    ];
    const offenders: string[] = [];

    for (const file of files) {
      const src = readFileSync(file, "utf8");
      src.split("\n").forEach((line, i) => {
        if (banned.some((re) => re.test(line))) {
          offenders.push(`${file.replace(process.cwd(), "")}:${i + 1} → ${line.trim().slice(0, 90)}`);
        }
      });
    }

    expect(offenders, `Use pageSection/bandSection from components/site/layout.tsx:\n${offenders.join("\n")}`).toEqual([]);
  });

  it("keeps the lead paragraph narrower than the text column it sits in", () => {
    // A lead wider than its column would silently stop being a lead.
    expect(LEAD).toBeLessThan(MEASURE.text);
    expect(LEAD).toBe(MEASURE.form);
  });

  it("keeps the gutter small enough that the narrowest column still fits a phone", () => {
    // 320px is the narrowest viewport worth supporting.
    expect(GUTTER * 2).toBeLessThan(320);
  });

  /**
   * `clamp(min, preferred, max)` with min above max does not error — CSS just
   * resolves it to min, silently pinning the page to its phone rhythm at every
   * width. Nothing about that is visible in review, and it is the one way these
   * two constants can be edited into nonsense.
   */
  it("keeps each responsive rhythm's floor below the desktop value it reaches", () => {
    expect(SECTION_Y_MIN).toBeLessThan(SECTION_Y);
    expect(PAGE_TOP_MIN).toBeLessThan(PAGE_TOP);
    expect(sectionY).toBe(`clamp(${SECTION_Y_MIN}px, 8vw, ${SECTION_Y}px)`);
    expect(pageTop).toBe(`clamp(${PAGE_TOP_MIN}px, 12vw, ${PAGE_TOP}px)`);
    // The page top's whole job is clearing the sticky navbar (top:12, ~60 tall).
    expect(PAGE_TOP_MIN).toBeGreaterThan(12 + 60);
  });

  /**
   * The inverted band is punctuation, and punctuation only works if it is rare.
   *
   * Measured before it existed, every band on the landing page was one of two
   * near-white shades — which is precisely how a page ends up with ten screens
   * that read as one. The fix was a single dark band at the Kernel. The failure
   * mode from here is the opposite one: `ink` looks good, so it gets reached for
   * again, and a second one turns an accent into a stripe.
   *
   * One is the ceiling. This is where it is written down.
   *
   * It is currently zero. The Kernel band gave `ink` up when it grew its two
   * diagrams: an ink band renders identically in light and dark by design, so
   * half of the site's visitors would have seen neither drawing in the palette
   * their own page was in. If a dark moment is wanted back here, the band to
   * give it to is a text-only one — the assertion below is a ceiling, not a
   * requirement to have one.
   */
  it("inverts at most one band", () => {
    const inkBands = files.flatMap((file) => {
      const src = readFileSync(file, "utf8");
      return [...src.matchAll(/bandTone\([^)]*"ink"\)/g)].map(() => file.replace(process.cwd(), ""));
    });

    expect(
      inkBands.length,
      `At most one band may use tone "ink": ${inkBands.join(", ")}`,
    ).toBeLessThanOrEqual(1);
  });
});
