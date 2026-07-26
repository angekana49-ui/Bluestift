/**
 * App UI language (locale) — the interface language the user picks in Settings.
 * This is the INTERFACE language only; it is unrelated to the language Raya
 * replies in (the tutor detects the student's own language from their messages).
 *
 * Framework-neutral so both client components and any future server code can
 * share one list. English is the default. Only the language picker consumes this
 * today; the `translate` helper + dictionaries are the seam the rest of the UI
 * will grow into, screen by screen.
 */

export type Locale = "en" | "fr" | "es" | "de";

export type LocaleOption = {
  code: Locale;
  /** Native label shown in the picker (e.g. "Français"). */
  label: string;
  /** English name, for descriptions/tooltips. */
  englishName: string;
};

export const LOCALES: LocaleOption[] = [
  { code: "en", label: "English", englishName: "English" },
  { code: "fr", label: "Français", englishName: "French" },
  { code: "es", label: "Español", englishName: "Spanish" },
  { code: "de", label: "Deutsch", englishName: "German" },
];

export const DEFAULT_LOCALE: Locale = "en";

/** Shared localStorage key (Raya + Schools stay in sync, like the theme). */
export const LOCALE_KEY = "bluestift-locale";

/** Coerce any stored/supplied value to a known locale (default English). */
export function normalizeLocale(value: unknown): Locale {
  return LOCALES.some((l) => l.code === value) ? (value as Locale) : DEFAULT_LOCALE;
}

/** A per-string translation table: locale → key → text. */
export type Dict = Partial<Record<Locale, Record<string, string>>>;

/**
 * Look up `key` for `locale`, falling back to English, then to the key itself.
 * The single lookup primitive every localized surface will use.
 */
export function translate(dict: Dict, locale: Locale, key: string): string {
  return dict[locale]?.[key] ?? dict.en?.[key] ?? key;
}
