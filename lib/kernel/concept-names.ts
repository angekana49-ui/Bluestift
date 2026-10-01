import { LOCALES, type Locale } from "@/lib/locale";

/**
 * What a person reads for a Kernel concept.
 *
 * A concept's `label` is its identity in the Kernel, and it is French
 * snake_case on purpose: the Kernel maps a conversation in any language onto
 * the same labels, so the graph does not split by language. It was never meant
 * to be read — yet it was shown as-is, and a teacher in Ohio read
 * "resoudre_equations_lineaires". `kernel.concept_nodes.display_names` (Kernel
 * migration 013) holds the readable name per locale.
 *
 * Framework-neutral: the server loader (`concept-names-server.ts`) and the
 * client hook (`components/ui/concept-name.tsx`) both resolve through here.
 */

export type ConceptNameSet = Partial<Record<Locale, string>>;
/** Keyed by label, lower-cased as the Kernel stores it. */
export type ConceptNames = Record<string, ConceptNameSet>;

const KNOWN = new Set<string>(LOCALES.map((l) => l.code));
const MAX_NAME_LENGTH = 80;
const UNSAFE = /[<>{}[\]`\\\u0000-\u001f\u007f]/g;
const SNAKE = /^[a-z0-9]+(?:_[a-z0-9]+)*$/;

/** A label made readable: "resoudre_equations_lineaires" → "Resoudre equations lineaires". */
export function readableLabel(label: string): string {
  const s = label.trim();
  // Free text (a recommendation, an older insight) is already for people.
  if (!SNAKE.test(s)) return s;
  const words = s.replace(/_/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/**
 * The name to show for `label`: the reader's language, then English, then the
 * label made readable. Never blank for a non-blank label.
 */
export function conceptName(
  label: string | null | undefined,
  locale: Locale,
  names?: ConceptNames | null,
): string {
  if (!label) return "";
  const entry = names?.[label.trim().toLowerCase()];
  return entry?.[locale] || entry?.en || readableLabel(label);
}

/**
 * One row's `display_names`, as read from the database. The Kernel cleans them
 * on the way in; this does it again, because they are LLM output and they
 * reach both screens and prompts.
 */
export function cleanNameSet(raw: unknown): ConceptNameSet {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: ConceptNameSet = {};
  for (const [locale, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!KNOWN.has(locale) || typeof value !== "string") continue;
    const name = value.replace(UNSAFE, " ").replace(/\s+/g, " ").trim().slice(0, MAX_NAME_LENGTH).trim();
    if (name) out[locale as Locale] = name;
  }
  return out;
}
