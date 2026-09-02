/**
 * Client-side list search — the matching half.
 *
 * Kept out of the component so it can be tested without a DOM, because the part
 * that is actually hard here is not the input box, it is deciding what counts as
 * a match. A school's roster is full of names the naive `includes()` gets wrong:
 *
 *   "Éloïse"        typed as "eloise"
 *   "N'Guessan"     typed as "nguessan"
 *   "Jean-Baptiste" typed as "baptiste"
 *   "Kouamé"        typed as "kouame"
 *   "6ᵉ A"          typed as "6e"
 *
 * An admin who searches "eloise" and is told there is no such student concludes
 * the student is not in the school. A search that silently under-matches is
 * worse than no search at all, so folding is the whole substance of this file.
 */

/**
 * Characters that carry no combining mark and therefore survive NFD untouched —
 * they have to be spelled out. "ß" is two letters, not a decorated one; "œ" in
 * "cœur" and "sœur" is ordinary French typography; "ø"/"ł"/"đ" show up in staff
 * lists the moment one teacher is Nordic or Polish.
 */
const LIGATURES: Record<string, string> = {
  æ: "ae",
  œ: "oe",
  ß: "ss",
  ø: "o",
  ł: "l",
  đ: "d",
  ð: "d",
  þ: "th",
};

/**
 * Reduce a string to its searchable skeleton: lower case, no accents, no
 * punctuation, single spaces.
 *
 * NFKD, not NFD, and that distinction is load-bearing: French class names are
 * written "6ᵉ", "1ʳᵉ", "2ᵈᵉ" with a superscript ordinal, and U+1D49 MODIFIER
 * LETTER SMALL E has no canonical decomposition while being flagged
 * `Diacritic=Yes`. Under NFD it therefore survived the normalizer and was then
 * deleted by the diacritic strip — "6ᵉ A" folded to "6 a", so searching "6e"
 * found nothing in a school whose classes are all named that way. Compatibility
 * decomposition is what turns those into plain letters, and it is the right
 * normalization for search folding generally (it also flattens the ﬁ/ﬂ
 * ligatures and full-width forms).
 *
 * Order matters twice over.
 *
 * 1. Ligatures expand BEFORE the accent strip, since even NFKD leaves "ß", "œ"
 *    and "ø" alone — they are letters in their own right, not decorated ones.
 * 2. Diacritics are removed BEFORE punctuation becomes whitespace. After
 *    decomposition an "é" is two code points, and the combining acute is not a
 *    letter — so the punctuation pass would turn it into a SPACE and split
 *    "élève" into "e" and "leve". Anything still marked after the diacritic pass
 *    (Devanagari matras, say) is kept attached to its base rather than exploded.
 *
 * Apostrophes vanish instead of becoming spaces, so "N'Guessan", "n'guessan" and
 * "nguessan" all fold to the same thing — the three spellings a West African
 * name gets typed with. Hyphens DO become spaces, because "Jean-Baptiste" is two
 * names and both should be findable on their own.
 */
export function foldForSearch(input: string): string {
  return input
    .toLowerCase()
    .replace(/[æœßøłđðþ]/g, (c) => LIGATURES[c] ?? c)
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/['’ʼ‘`´]/g, "")
    .replace(/[^\p{L}\p{N}\p{M}]+/gu, " ")
    .trim();
}

/**
 * Split a raw query into the terms that must ALL be present.
 *
 * AND rather than OR, and order-free: "dupont marie" and "marie dupont" both
 * find Marie Dupont, and typing a second word narrows instead of widening —
 * which is what every user expects of a search box and what OR would get
 * backwards on exactly the query they type when there are too many results.
 */
export function searchTokens(query: string): string[] {
  const folded = foldForSearch(query);
  return folded ? folded.split(" ") : [];
}

/**
 * Does one record match? Fields are folded and joined with a space, so a token
 * can never straddle two of them — searching "marie ecole" matches a teacher
 * called Marie at ecole.ci, but no token can be half-name half-email.
 */
export function matchesTokens(
  tokens: readonly string[],
  fields: readonly (string | null | undefined)[],
): boolean {
  if (tokens.length === 0) return true;
  const haystack = fields
    .filter((f): f is string => typeof f === "string" && f.length > 0)
    .map(foldForSearch)
    .join(" ");
  return tokens.every((token) => haystack.includes(token));
}

/**
 * The whole operation, for callers that just want the filtered array.
 *
 * Deliberately not memoized. Folding a hundred rows costs microseconds, and the
 * cache key would have to include the field accessor — which every call site
 * writes as an inline arrow, so the memo would miss on every render anyway while
 * looking like it worked. If a list ever gets big enough for this to show up in
 * a profile, the fix is a precomputed index, not a useMemo.
 */
export function filterBySearch<T>(
  items: readonly T[],
  query: string,
  fields: (item: T) => (string | null | undefined)[],
): T[] {
  const tokens = searchTokens(query);
  if (tokens.length === 0) return [...items];
  return items.filter((item) => matchesTokens(tokens, fields(item)));
}

/**
 * The other half of making a long list usable: an order you can predict.
 *
 * Search only helps someone who already knows the name they want. An admin
 * scanning for a teacher they cannot quite remember needs the list sorted, and
 * insertion order — which is what every one of these lists rendered — is the one
 * order that helps nobody.
 *
 * `numeric` is not a nicety here: class names are the most-sorted strings in the
 * product and plain lexicographic ordering puts "10ème B" between "1ère A" and
 * "2nde C". `sensitivity: "base"` keeps "Éloïse" next to "Elodie" instead of
 * exiling every accented name past Z.
 */
const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });

export function compareNames(a: string | null | undefined, b: string | null | undefined): number {
  // Unnamed rows sort last rather than first — an "Untitled" block at the top of
  // the list is the first thing read and the least worth reading.
  if (!a) return b ? 1 : 0;
  if (!b) return -1;
  return collator.compare(a, b);
}

/** Sort a copy by one string field. Never mutates — these arrays are React state. */
export function sortByName<T>(items: readonly T[], name: (item: T) => string | null | undefined): T[] {
  return [...items].sort((x, y) => compareNames(name(x), name(y)));
}
