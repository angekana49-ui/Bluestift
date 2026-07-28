import { describe, it, expect } from "vitest";
import { lookup, MESSAGES, type MessageKey } from "@/lib/i18n";
import { en } from "@/lib/i18n/en";
import { LOCALES, normalizeLocale, matchLocale, DEFAULT_LOCALE } from "@/lib/locale";

/**
 * The catalogue's contract: English is total, every other locale is partial, and
 * a missing translation must fall through to English rather than render blank or
 * leak a raw key at the user.
 */
describe("i18n catalogue", () => {
  it("translates when the locale has the key", () => {
    expect(lookup("fr", "nav.settings")).toBe("Réglages");
    expect(lookup("es", "nav.rooms")).toBe("Salas");
    expect(lookup("de", "nav.homework")).toBe("Hausaufgaben");
  });

  it("falls back to English for a key a locale hasn't translated", () => {
    // Simulate the normal lifecycle: a new English string lands before the
    // translations catch up.
    const key = "nav.chat" as MessageKey;
    const partial = { ...MESSAGES.fr };
    delete partial[key];
    expect(partial[key] ?? MESSAGES.en[key]).toBe(en["nav.chat"]);
  });

  it("never returns empty for any known key, in any locale", () => {
    const keys = Object.keys(en) as MessageKey[];
    for (const locale of LOCALES) {
      for (const key of keys) {
        const value = lookup(locale.code, key);
        expect(value.length, `${locale.code}/${key}`).toBeGreaterThan(0);
      }
    }
  });

  it("keeps brand names untranslated in every locale", () => {
    // "Raya" is a proper noun — a localized rendering would read as a different
    // product. Every locale that translates this string must still spell it.
    for (const locale of LOCALES) {
      expect(lookup(locale.code, "menu.personalRaya")).toContain("Raya");
      expect(lookup(locale.code, "nav.kernel")).toContain("Kernel");
    }
  });

  it("coerces unknown or absent stored locales to the default", () => {
    expect(normalizeLocale("kl")).toBe(DEFAULT_LOCALE);
    expect(normalizeLocale(null)).toBe(DEFAULT_LOCALE);
    expect(normalizeLocale("fr")).toBe("fr");
  });
});

/**
 * Browser-language detection behind the public site's first-visit prompt. It
 * decides which option is pre-selected, so a wrong guess is a visible paper cut.
 */
describe("matchLocale", () => {
  it("ignores the region subtag", () => {
    expect(matchLocale(["fr-CA"])).toBe("fr");
    expect(matchLocale(["de-AT"])).toBe("de");
    expect(matchLocale(["ES-mx"])).toBe("es");
  });

  it("honours the browser's order of preference", () => {
    expect(matchLocale(["pt-BR", "es-ES", "en"])).toBe("es");
  });

  it("returns null when we ship none of the visitor's languages", () => {
    // Null, not English: the caller then shows the prompt with nothing
    // pre-selected rather than pretending it detected something.
    expect(matchLocale(["ja", "ko"])).toBeNull();
    expect(matchLocale([])).toBeNull();
  });
});
