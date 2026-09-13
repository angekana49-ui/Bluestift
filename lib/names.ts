/**
 * The one rule for names, shared by the browser and the server: at least
 * MIN_NAME_LENGTH characters, and nothing else.
 *
 * It covers every name a person types — a username, a display name, a school
 * name — and it deliberately stops at length. No required letter, no banned
 * digit or symbol: "Lycée n°3", "李明", "O'Neil", "École 2000" and "@lex" are
 * all names someone really has, and a rule about character types would refuse
 * exactly the people least like whoever wrote it (owner decision, 2026-09-13).
 *
 * Length is counted in characters as a reader sees them, not UTF-16 units, so
 * "李明友" is 3 and an emoji is 1.
 */
export const MIN_NAME_LENGTH = 3;

export function nameLength(value: string | null | undefined): number {
  return [...(value ?? "").trim()].length;
}

export function isNameTooShort(value: string | null | undefined): boolean {
  return nameLength(value) < MIN_NAME_LENGTH;
}

/**
 * A comparable form of a name, for spotting duplicates: accents dropped, case
 * folded, runs of whitespace collapsed. "Lycée  Victor-Hugo" and "lycee victor-hugo"
 * compare equal; punctuation is kept, since "Saint-Louis" and "Saint Louis" may
 * really be two schools.
 */
export function normalizeName(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}
