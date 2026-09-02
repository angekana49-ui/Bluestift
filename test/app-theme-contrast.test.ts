import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { getTheme, type AppTheme } from "@/components/ui/tokens";

/**
 * The app palette, held to the two things that actually went wrong.
 *
 * 1. SURFACES MUST DIFFER. `cardBg` and the content ground used to be the same
 *    value in both themes (#ffffff / #0b111f), so a card, a modal and a popover
 *    were told apart from the page behind them by a ~1.2:1 hairline and nothing
 *    else. That is what made whole dashboards read as one undifferentiated
 *    field. `contentBg` exists to keep them apart, and a later "tidy-up" that
 *    collapses them back would undo the fix invisibly — nothing would break, it
 *    would just go flat again.
 *
 * 2. SECONDARY INK MUST PASS ON THE DARKEST SURFACE IT LANDS ON, not merely on
 *    white. `mutedLight` passed on white and failed on `cardBg2`, which is
 *    where it is mostly used. A tone is only as legible as its worst ground.
 */

/** WCAG 2.x relative luminance for an #rrggbb colour. */
function luminance(hex: string): number {
  const m = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) throw new Error(`not a solid hex colour: ${hex}`);
  const [r, g, b] = [0, 2, 4].map((i) => {
    const c = parseInt(m[1].slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const themes: [string, AppTheme][] = [
  ["light", getTheme(false)],
  ["dark", getTheme(true)],
];

describe("surfaces are distinguishable from the ground they sit on", () => {
  for (const [name, t] of themes) {
    it(`${name}: a card is not the same colour as the content zone`, () => {
      expect(t.cardBg).not.toBe(t.contentBg);
      // Not just "different": far enough apart to be seen without a shadow,
      // which the flat design language rules out.
      expect(contrast(t.cardBg, t.contentBg)).toBeGreaterThan(1.05);
    });

    it(`${name}: a card is not the same colour as the page base`, () => {
      // pageBase backs the shell itself — a popover landing on it needs an edge
      // for the same reason.
      expect(t.cardBg).not.toBe(t.pageBase);
    });

    it(`${name}: the second card tone is distinct from the first`, () => {
      expect(t.cardBg2).not.toBe(t.cardBg);
    });

    it(`${name}: an input is distinguishable from the card it sits in`, () => {
      expect(t.inputBg).not.toBe(t.cardBg2);
    });
  }
});

describe("text tones clear AA on every surface they land on", () => {
  for (const [name, t] of themes) {
    // The four grounds body/secondary copy is actually rendered on.
    const grounds = [t.contentBg, t.cardBg, t.cardBg2, t.pageBase];

    it(`${name}: primary text clears 7:1 everywhere (AAA)`, () => {
      for (const bg of grounds) {
        expect(contrast(t.text, bg), `text on ${bg}`).toBeGreaterThanOrEqual(7);
      }
    });

    it(`${name}: secondary text clears 4.5:1 everywhere`, () => {
      for (const bg of grounds) {
        expect(contrast(t.muted, bg), `muted on ${bg}`).toBeGreaterThanOrEqual(4.5);
      }
    });

    it(`${name}: tertiary text clears 4.5:1 everywhere — including cardBg2`, () => {
      // The regression this test exists for: mutedLight was 4.8:1 on white and
      // 3.96:1 on cardBg2, and cardBg2 is where most of it actually renders.
      for (const bg of grounds) {
        expect(contrast(t.mutedLight, bg), `mutedLight on ${bg}`).toBeGreaterThanOrEqual(4.5);
      }
    });

    it(`${name}: a link reads as text, not decoration`, () => {
      expect(contrast(t.link, t.cardBg)).toBeGreaterThanOrEqual(4.5);
    });

    it(`${name}: CTA label reads on the CTA fill`, () => {
      expect(contrast(t.ctaText, t.ctaBg)).toBeGreaterThanOrEqual(4.5);
    });
  }
});

describe("interactive outlines are findable", () => {
  for (const [name, t] of themes) {
    it(`${name}: controlBorder is stronger than the structural cardBorder`, () => {
      // Both are rgba() over an unknown ground, so this is a claim about the
      // alpha, not a contrast ratio: an input or a secondary button needs a
      // heavier edge than a card does, because on a control the edge IS the
      // hit area. ghostButton/textInput read controlBorder for exactly this.
      const alpha = (c: string) => Number(/([\d.]+)\s*\)$/.exec(c)?.[1] ?? NaN);
      expect(alpha(t.controlBorder)).toBeGreaterThan(alpha(t.cardBorder));
    });
  }
});

describe("the app shell publishes its interaction tokens", () => {
  const shell = readFileSync(join(process.cwd(), "components/ui/shell.tsx"), "utf8");
  const themeFile = readFileSync(join(process.cwd(), "components/ui/theme.tsx"), "utf8");
  const css = readFileSync(join(process.cwd(), "app/globals.css"), "utf8");

  it("defines the hover filter and focus colour for its own subtree", () => {
    expect(shell).toMatch(/--app-hover-filter/);
    expect(shell).toMatch(/--app-focus/);
  });

  it("also sets them on the document root, for portalled menus and modals", () => {
    // Menus and modals are portalled into <body>, outside .app-shell, so a
    // subtree-only definition leaves them on the light-mode fallback — which
    // darkens a dark popover on hover and reads as disabled.
    expect(themeFile).toMatch(/documentElement[\s\S]{0,200}--app-hover-filter/);
    expect(themeFile).toMatch(/--app-focus/);
  });

  it("flips the hover filter with the theme rather than hardcoding one", () => {
    expect(shell).toMatch(/t\.dark \? "brightness\(1\.\d+\)" : "brightness\(0\.\d+\)"/);
  });

  it("gives keyboard users a visible focus ring", () => {
    expect(css).toMatch(/:focus-visible/);
    expect(css).toMatch(/outline: 2px solid var\(--app-focus/);
  });
});

describe("the two button roles stay told apart", () => {
  for (const [name, t] of themes) {
    it(`${name}: the primary action and the neutral are not the same fill`, () => {
      // Create/Generate is blue, Choose file is the neutral solid. If a later
      // change collapses them, every card goes back to having two identical
      // buttons and nothing saying which one is the point.
      expect(t.ctaBg).not.toBe(t.neutralBg);
      expect(contrast(t.ctaBg, t.neutralBg)).toBeGreaterThan(1.6);
    });

    it(`${name}: both carry their own label at AA`, () => {
      expect(contrast(t.ctaText, t.ctaBg)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(t.neutralText, t.neutralBg)).toBeGreaterThanOrEqual(4.5);
    });

    it(`${name}: both are findable against the content ground`, () => {
      // 3:1 is the floor for a UI component's boundary. A neutral that matched
      // the page would be a hole rather than a button — which is exactly why
      // `neutralBg` inverts in dark mode instead of staying #0b1220.
      expect(contrast(t.ctaBg, t.contentBg)).toBeGreaterThanOrEqual(3);
      expect(contrast(t.neutralBg, t.contentBg)).toBeGreaterThanOrEqual(3);
    });

    it(`${name}: the primary action is not the body ink`, () => {
      // The bug being fixed: ctaBg was #0b1220, the same value as `text`.
      expect(t.ctaBg).not.toBe(t.text);
    });

    it(`${name}: the learner's bubble is decoupled from the action colour`, () => {
      // Its own token. Joined to ctaBg, recolouring the primary button silently
      // recoloured half of every conversation.
      expect(t.bubbleMineBg).toBeTruthy();
      expect(contrast(t.bubbleMineText, t.bubbleMineBg)).toBeGreaterThanOrEqual(4.5);
    });
  }
});

describe("actions sit on the trailing edge", () => {
  const forms = readFileSync(join(process.cwd(), "components/ui/forms.tsx"), "utf8");

  it("there is one shared action row, and it is right-aligned", () => {
    expect(forms).toMatch(/export const formActions/);
    const block = /export const formActions: CSSProperties = \{([^}]*)\}/.exec(forms)?.[1] ?? "";
    expect(block).toMatch(/justifyContent:\s*"flex-end"/);
  });

  it("no card pins its primary action to the leading edge", () => {
    // `alignSelf: "flex-start"` on a cta button is the old habit: it puts the
    // commit at the START of the reading order instead of at its end.
    for (const p of ["components/school-link.tsx", "components/rooms-list.tsx"]) {
      const src = readFileSync(join(process.cwd(), p), "utf8");
      expect(src, p).not.toMatch(/\.\.\.btn, alignSelf: "flex-start"/);
    }
  });
});
