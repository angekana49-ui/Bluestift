import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  compareNames,
  filterBySearch,
  foldForSearch,
  matchesTokens,
  searchTokens,
  sortByName,
} from "@/lib/search";

/**
 * List search, tested where it can actually be wrong.
 *
 * The input box is not the risky part — the matching is. A search that
 * under-matches does not look broken: it returns "no results", which an admin
 * reads as "this teacher is not in my school". So the cases below are the real
 * strings this product handles — French accents, Ivorian and Cameroonian names,
 * class labels — and each one is a way the naive `title.includes(query)` this
 * replaces would have quietly lied.
 */

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

describe("folding", () => {
  it("makes accented French findable by its unaccented spelling", () => {
    // Nobody types the accents into a search box, and on a phone keyboard most
    // people cannot. This is the single most common miss.
    expect(foldForSearch("Éloïse Kouamé")).toBe("eloise kouame");
    expect(foldForSearch("6ᵉ année · Élève")).toBe("6e annee eleve");
    expect(foldForSearch("Adèle Ngô Thị")).toBe("adele ngo thi");
  });

  it("keeps the superscript ordinal French class names are written with", () => {
    // The bug this caught. "6ᵉ" is U+1D49, which has no CANONICAL decomposition
    // but is flagged Diacritic=Yes — so under NFD it reached the diacritic strip
    // intact and was deleted, folding "6ᵉ A" to "6 a". Searching "6e" then found
    // nothing in a school whose classes are all named that way. NFKD turns it
    // into a plain "e" before anything can remove it.
    expect(foldForSearch("6ᵉ A")).toBe("6e a");
    expect(foldForSearch("1ʳᵉ S")).toBe("1re s");
    expect(matchesTokens(searchTokens("6e"), ["6ᵉ A"])).toBe(true);
  });

  it("expands the ligatures even NFKD leaves alone", () => {
    // "ß" is a letter in its own right, not a decorated one, and no
    // normalization touches it — these have to be spelled out or "Straße" is
    // unreachable from "strasse".
    expect(foldForSearch("Straße")).toBe("strasse");
    expect(foldForSearch("cœur")).toBe("coeur");
    expect(foldForSearch("Sørensen")).toBe("sorensen");
    expect(foldForSearch("Wojciech Ławicki")).toBe("wojciech lawicki");
  });

  it("drops apostrophes rather than splitting on them", () => {
    // "N'Guessan" and "Nguessan" are the same name typed two ways, and both
    // spellings appear in the same school's records.
    expect(foldForSearch("N'Guessan")).toBe("nguessan");
    expect(foldForSearch("N’Guessan")).toBe("nguessan"); // curly quote
    expect(foldForSearch("Côte d'Ivoire")).toBe("cote divoire");
  });

  it("treats a hyphen as a word break, because it is one", () => {
    // The opposite call from the apostrophe, and deliberately so: "Jean-Baptiste"
    // is two given names and each must be findable alone.
    expect(foldForSearch("Jean-Baptiste")).toBe("jean baptiste");
    expect(foldForSearch("marie.dupont@ecole.ci")).toBe("marie dupont ecole ci");
  });

  it("never leaves a combining mark stranded as its own word", () => {
    // The ordering bug this guards: after NFD an "é" is two code points, and if
    // punctuation were folded first the combining acute — not a letter — would
    // become a SPACE and split "élève" into "e" and "leve".
    expect(foldForSearch("élève")).toBe("eleve");
    expect(foldForSearch("élève").split(" ")).toHaveLength(1);
  });
});

describe("tokens", () => {
  it("requires every term, in any order", () => {
    // AND, not OR. Typing a second word must NARROW — which is exactly what a
    // user does when the first word returned too much, and what OR gets
    // backwards on precisely that query.
    const fields = ["Marie Dupont", "marie.dupont@ecole.ci"];
    expect(matchesTokens(searchTokens("marie dupont"), fields)).toBe(true);
    expect(matchesTokens(searchTokens("dupont marie"), fields)).toBe(true);
    expect(matchesTokens(searchTokens("marie kouassi"), fields)).toBe(false);
  });

  it("an empty or punctuation-only query matches everything", () => {
    expect(searchTokens("   ")).toEqual([]);
    expect(matchesTokens(searchTokens(""), ["anything"])).toBe(true);
    expect(matchesTokens(searchTokens("!!!"), ["anything"])).toBe(true);
  });

  it("no token can straddle two fields", () => {
    // Fields are joined with a space and tokens never contain one, so a match is
    // always inside a single field — "marieecole" must not be manufactured out
    // of a name ending in "marie" and an email starting with "ecole".
    expect(matchesTokens(searchTokens("marieecole"), ["Marie", "ecole.ci"])).toBe(false);
    expect(matchesTokens(searchTokens("marie ecole"), ["Marie", "ecole.ci"])).toBe(true);
  });

  it("ignores null and empty fields instead of throwing on them", () => {
    // Half these records have a null email.
    expect(matchesTokens(searchTokens("kouame"), ["Kouamé", null, undefined, ""])).toBe(true);
  });
});

describe("filterBySearch", () => {
  const staff = [
    { name: "Éloïse Kouamé", email: "eloise@ecole.ci" },
    { name: "Jean-Baptiste N'Guessan", email: null },
    { name: "Marie Dupont", email: "marie.dupont@lycee.fr" },
  ];
  const find = (q: string) => filterBySearch(staff, q, (p) => [p.name, p.email]).map((p) => p.name);

  it("finds an accented name from an unaccented query", () => {
    expect(find("eloise")).toEqual(["Éloïse Kouamé"]);
    expect(find("kouame")).toEqual(["Éloïse Kouamé"]);
  });

  it("finds a hyphenated name by either half", () => {
    expect(find("baptiste")).toEqual(["Jean-Baptiste N'Guessan"]);
    expect(find("nguessan")).toEqual(["Jean-Baptiste N'Guessan"]);
  });

  it("searches the email as readily as the name", () => {
    expect(find("lycee")).toEqual(["Marie Dupont"]);
  });

  it("returns everything for a blank query, and a copy rather than the input", () => {
    const all = filterBySearch(staff, "", (p) => [p.name]);
    expect(all).toHaveLength(3);
    expect(all).not.toBe(staff);
  });
});

describe("ordering", () => {
  it("sorts class names by number, not by digit", () => {
    // The reason `numeric` is not a nicety: lexicographically "10ème B" sorts
    // between "1ère A" and "2nde C", which is how a 25-class list becomes
    // unreadable even after it is sorted.
    const classes = ["2nde C", "10ème B", "1ère A", "6ème A"];
    expect(sortByName(classes, (c) => c)).toEqual(["1ère A", "2nde C", "6ème A", "10ème B"]);
  });

  it("files accented names with their unaccented neighbours", () => {
    // Not past Z, which is where a byte-order sort puts every "É".
    expect(sortByName(["Fabre", "Élodie", "Dupont"], (n) => n)).toEqual([
      "Dupont",
      "Élodie",
      "Fabre",
    ]);
  });

  it("puts unnamed rows last", () => {
    // An "Untitled" block at the top is the first thing read and the least
    // worth reading.
    expect(sortByName(["Zoe", null, "Ana"], (n) => n)).toEqual(["Ana", "Zoe", null]);
    expect(compareNames(null, "a")).toBeGreaterThan(0);
    expect(compareNames(null, null)).toBe(0);
  });

  it("does not mutate its input — these arrays are React state", () => {
    const original = ["Zoe", "Ana"];
    sortByName(original, (n) => n);
    expect(original).toEqual(["Zoe", "Ana"]);
  });
});

/**
 * The wiring. One primitive, applied at the places a hundred-row list actually
 * appears — the complaint was "imagine l'admin chercher dans un staff de plus de
 * 100 enseignants, 25 classes ou autres".
 */
describe("the long lists are wired to it", () => {
  it("every list that can reach a hundred rows has a search", () => {
    for (const [file, count] of [
      // Team: teachers, subjects, assignments, join requests.
      ["components/school-team.tsx", 4],
      // Schools: classes & codes, the overview, the roster, the at-risk list.
      ["components/school-admin.tsx", 4],
    ] as const) {
      const src = read(file);
      expect(src.match(/useListSearch\(/g)?.length ?? 0, file).toBeGreaterThanOrEqual(count);
    }
    for (const file of [
      "components/rooms-list.tsx",
      "components/kernel-memory.tsx",
      "components/chat/chat-history-list.tsx",
    ]) {
      expect(read(file), file).toMatch(/useListSearch\(|filterBySearch\(/);
    }
  });

  it("the roster's filter and the roster's rows are ONE component", () => {
    // It renders in two places (the admin's class drill-down and the teacher's
    // "Focus on a student"). Two copies of a filtered list is two chances for
    // them to disagree about what "needs attention" means.
    const src = read("components/school-admin.tsx");
    expect(src.match(/<RosterList\b/g)?.length ?? 0).toBe(2);
    // And nothing renders roster rows around the filter.
    expect(src.match(/<RosterRow\b/g)?.length ?? 0).toBe(1);
  });

  it("nothing re-implements the matching itself", () => {
    // A second `toLowerCase().includes()` somewhere is a list that silently
    // stops finding accented names while its neighbour still does.
    const offenders: string[] = [];
    for (const file of [
      "components/school-team.tsx",
      "components/school-admin.tsx",
      "components/rooms-list.tsx",
      "components/kernel-memory.tsx",
      "components/chat/chat-history-list.tsx",
    ]) {
      if (/toLowerCase\(\)\s*\.includes\(/.test(read(file))) offenders.push(file);
    }
    expect(offenders).toEqual([]);
  });

  it("the sidebar's own field still shares the matcher", () => {
    // It draws itself (the rail has its own palette), but the part that must
    // not diverge — what counts as a match — comes from lib/search.
    const src = read("components/chat/chat-history-list.tsx");
    expect(src).toMatch(/filterBySearch/);
    expect(src).toMatch(/LIST_SEARCH_MIN/);
  });

  it("a query reaches ARCHIVED threads, and opens the section holding them", () => {
    // Otherwise "archive" is a synonym for "delete": kept in the database,
    // unreachable in the product. This is what makes the distinction real.
    const src = read("components/chat/chat-history-list.tsx");
    expect(src).toMatch(/const archived = matching\.filter/);
    expect(src).toMatch(/archivedOpen = showArchived \|\| \(q\.length > 0 && archived\.length > 0\)/);
  });
});

describe("the empty states stay distinguishable", () => {
  it('"nothing here" and "nothing matched" are different messages', () => {
    // Showing an admin who mistyped a name the copy written for an admin who
    // has not added any staff tells them their school is empty. That is the
    // version of this bug that gets reported as data loss.
    const src = read("components/ui/list-filter.tsx");
    expect(src).toMatch(/export function ListNoMatch/);
    // It names the query back, so a typo is visible.
    expect(src).toMatch(/\{search\.query\.trim\(\)\}/);
    expect(src).toMatch(/Clear search/);
  });

  it("a query cannot outlive the field that set it", () => {
    // Delete rows until the list drops under the threshold and the input
    // disappears — without this the text stays applied, hiding rows behind a
    // control that is no longer on screen.
    for (const file of ["components/ui/list-filter.tsx", "components/chat/chat-history-list.tsx"]) {
      expect(read(file), file).toMatch(/if \(!(enabled|searchable)\) setQuery\(""\)/);
    }
  });

  it("the native WebKit clear button is suppressed where ours is drawn", () => {
    // type="search" gets the right mobile keyboard, and with it a grey ✕ that
    // ignores the theme — two clear buttons, one of them invisible on a dark
    // card.
    const css = read("app/globals.css");
    expect(css).toMatch(/\.list-search-input::-webkit-search-cancel-button/);
    expect(read("components/ui/list-filter.tsx")).toMatch(/className="list-search-input"/);
    expect(read("components/chat/chat-history-list.tsx")).toMatch(/className="list-search-input"/);
  });
});
