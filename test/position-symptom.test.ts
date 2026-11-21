import { describe, it, expect } from "vitest";

import { lookup, MESSAGES } from "@/lib/i18n";
import { en } from "@/lib/i18n/en";
import { LOCALES } from "@/lib/locale";

/**
 * The "why now" band stages the symptom as two homework copies answering one
 * exercise — wrong-and-readable vs right-and-mute. The copy contract:
 *
 * - the full key set ships in English (the catalogue's canonical locale);
 * - every locale translates it (a fallback to English mid-comparison would
 *   read as a bug, not as a missing string);
 * - the equation is the shared control of the experiment, so it stays
 *   verbatim everywhere — a translated paraphrase would unmatch the two
 *   copies' working;
 * - the close names Raya, in every locale (a proper noun, never localized);
 * - the retired drawing left nothing behind: no `ps.*` key, no
 *   `site.pos.note.*` key.
 */

const KEYS = [
  "site.pos.eyebrow",
  "site.pos.title.a",
  "site.pos.title.em",
  "site.pos.sub",
  "site.pos.exercise",
  "site.pos.card.attempt",
  "site.pos.verdict.attempt",
  "site.pos.card.returned",
  "site.pos.verdict.returned",
  "site.pos.close",
] as const;

const EQUATION = "2(x − 3) = 8";

describe("symptom section copy", () => {
  it("ships the full key set in English", () => {
    for (const key of KEYS) {
      expect(en[key].length, key).toBeGreaterThan(0);
    }
  });

  it("is translated in every locale, not fallen back to English", () => {
    for (const locale of LOCALES) {
      if (locale.code === "en") continue;
      for (const key of KEYS) {
        expect(MESSAGES[locale.code]?.[key], `${locale.code}/${key}`).toBeTruthy();
      }
    }
  });

  it("keeps the shared equation verbatim in every locale", () => {
    for (const locale of LOCALES) {
      expect(lookup(locale.code, "site.pos.exercise"), locale.code).toContain(EQUATION);
    }
  });

  it("names Raya in the close, in every locale", () => {
    for (const locale of LOCALES) {
      expect(lookup(locale.code, "site.pos.close"), locale.code).toContain("Raya");
    }
  });

  it("retired the old drawing's keys with the drawing", () => {
    expect(Object.keys(en).filter((k) => k.startsWith("ps."))).toEqual([]);
    expect("site.pos.note.model" in en).toBe(false);
    expect("site.pos.note.privacy" in en).toBe(false);
  });
});
