import { describe, expect, it } from "vitest";
import { en } from "@/lib/i18n/en";
import { fr } from "@/lib/i18n/fr";
import { de } from "@/lib/i18n/de";
import { es } from "@/lib/i18n/es";

/**
 * Translations say the same thing in about the same room.
 *
 * The first translations were close to word for word, and word for word runs
 * long: "Retry" became "Erneut versuchen", "Start free" became "Commencer
 * gratuitement", "Recovery key" became a 27-letter German word with nowhere to
 * break. In a pill, a KPI tile or a comparison-table row that text overflows or
 * ellipsises, and the fix is not to widen the UI — it is to translate the
 * meaning ("Wiederholen", "Essai gratuit", "Notfallschlüssel").
 *
 * The budget applies where the text sits in a box that cannot grow: navigation,
 * menus, tabs, chips, KPI and status labels, plan-comparison rows, tool names.
 * Running prose — legal pages, error sentences, descriptions — wraps, and is
 * deliberately out of scope.
 */

const SCOPE =
  /^(nav\.|menu\.|site\.nav\.|settings\.row\.[^.]+$|settings\.group\.|plan\.chip\.|research\.hub\.tab\.|school\.role\.|ent\.row\.[^.]+\.label$|school\.overview\.kpi|dm\.|shot\.status\.|school\.roster\.filter|room\.panel|tools\.tool\.|kernel\.sim\.focus\.|upgrade\.(quotaTitle|featureTitle|seePlans|notNow)$)/;

/** Half as long again as the English, or eight characters more — whichever is roomier. */
const budget = (english: string) => Math.max(Math.ceil(english.length * 1.5), english.length + 8);

const LOCALES = { fr, de, es } as const;
const scoped = (Object.keys(en) as (keyof typeof en)[]).filter((k) => SCOPE.test(k));

describe("labels in fixed-size UI stay concise in every language", () => {
  it("covers a meaningful set of labels", () => {
    // A renamed namespace would otherwise empty the scope and pass silently.
    expect(scoped.length).toBeGreaterThan(100);
  });

  for (const [locale, messages] of Object.entries(LOCALES)) {
    it(`${locale}: no label is more than half as long again as the English`, () => {
      const over = scoped
        .map((k) => ({ k, english: en[k] as string, text: (messages as Record<string, string | undefined>)[k] }))
        .filter(({ english, text }) => text != null && text.length > budget(english))
        .map(({ k, english, text }) => `${k}: "${english}" → "${text}" (${text!.length}/${budget(english)})`);
      expect(over, "translate the meaning, not the words").toEqual([]);
    });

    it(`${locale}: no label holds a word too long to wrap`, () => {
      const long = scoped
        .map((k) => ({ k, text: (messages as Record<string, string | undefined>)[k] ?? "" }))
        // A hyphen is a break opportunity, so "Audio-Zusammenfassung" can wrap.
        .flatMap(({ k, text }) => text.split(/[\s/–—(),.:;!?·-]+/).filter((w) => w.length > 20).map((w) => `${k}: ${w}`));
      expect(long).toEqual([]);
    });
  }
});
