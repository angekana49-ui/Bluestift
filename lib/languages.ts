/**
 * The reply-language options offered in every chat surface's language menu, and
 * the single source of truth the backend uses to build the "reply in X" prompt
 * directive. Framework-neutral (imported by both client menus and server routes)
 * so the list can never drift between the picker and the instruction.
 *
 * English is the default. A user's pick OVERRIDES Raya's usual "detect the
 * student's language" behaviour, so the choice is honoured verbatim.
 */

export type LangCode = "en" | "fr" | "es" | "de";

export type LanguageOption = {
  code: LangCode;
  /** Native label shown in the menu (e.g. "Français"). */
  label: string;
  /** Two-letter tag shown on the compact menu trigger. */
  short: string;
  /** English name used in the LLM instruction. */
  englishName: string;
  /** Native name used in the LLM instruction. */
  nativeName: string;
};

export const LANGUAGES: LanguageOption[] = [
  { code: "en", label: "English", short: "EN", englishName: "English", nativeName: "English" },
  { code: "fr", label: "Français", short: "FR", englishName: "French", nativeName: "français" },
  { code: "es", label: "Español", short: "ES", englishName: "Spanish", nativeName: "español" },
  { code: "de", label: "Deutsch", short: "DE", englishName: "German", nativeName: "Deutsch" },
];

export const DEFAULT_LANG: LangCode = "en";

/** Coerce any client-supplied value to a known language code (default English). */
export function normalizeLang(value: unknown): LangCode {
  return LANGUAGES.some((l) => l.code === value) ? (value as LangCode) : DEFAULT_LANG;
}

/**
 * The reply-language block appended to a Raya system prompt. It overrides the
 * "detect the student's language" rule so the picked language wins, while still
 * letting the user ask, in-message, to switch.
 */
export function languageDirective(value: unknown): string {
  const l = LANGUAGES.find((x) => x.code === normalizeLang(value)) ?? LANGUAGES[0];
  return (
    `# Reply language (overrides language auto-detection)\n` +
    `Always write your replies in ${l.englishName} (${l.nativeName}), regardless of the ` +
    `language the user writes in — unless the user explicitly asks you to switch to another language.`
  );
}
