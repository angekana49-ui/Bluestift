/**
 * The Archive record's shape, and the rule that narrows it.
 *
 * Lives apart from `lib/school-admin.ts` (which is `server-only`) so the client
 * tab and the server builder share one definition of what filtering means —
 * and so the rule can be tested without a database.
 */

export type ArchiveBasis = "year" | "class" | "period";

/** The dimensions a section's entries can be narrowed on. */
export type ArchiveFacet = "class" | "subject";

export type ArchiveItem = {
  id: string;
  title: string;
  detail: string | null;
  at: string | null;
  /**
   * Filter keys. Held apart from `title`/`detail` on purpose: those are prose
   * for a human, and two classes named alike across years would make a
   * text-matched filter quietly wrong.
   */
  classId?: string | null;
  subjectId?: string | null;
};

export type ArchiveSection = {
  key: string;
  label: string;
  basis: ArchiveBasis;
  count: number;
  /** Capped at ARCHIVE_ITEM_CAP; `count` is the real total. */
  items: ArchiveItem[];
  /** Which filters apply here at all. A payment has no class. */
  facets: ArchiveFacet[];
};

export type ArchiveFacetOption = { id: string; label: string };

export type YearArchive = {
  year: {
    id: string;
    label: string;
    startDate: string | null;
    endDate: string | null;
    isCurrent: boolean;
    classCount: number;
  };
  sections: ArchiveSection[];
  /** The values actually present in this year — the filter bar's options. */
  facets: { classes: ArchiveFacetOption[]; subjects: ArchiveFacetOption[] };
  /** What this record deliberately does not contain. Shown verbatim. */
  notes: string[];
};

export type ArchiveFilter = {
  classId: string;
  subjectId: string;
  basis: "" | ArchiveBasis;
  /** Free text, matched against the entry's title and detail. */
  q: string;
};

export const EMPTY_ARCHIVE_FILTER: ArchiveFilter = { classId: "", subjectId: "", basis: "", q: "" };

export const isFiltering = (f: ArchiveFilter) =>
  Boolean(f.classId || f.subjectId || f.basis || f.q.trim());

/**
 * A section under an active filter.
 *
 * `applies` is the honest part: a class filter says nothing about payments or
 * admin logs, which carry no class. Those sections are reported as out of the
 * filter's reach rather than shown as "0" — a zero would read as "this school
 * took no payments that year", which is a different and false claim.
 */
export type FilteredSection = ArchiveSection & { applies: boolean; hiddenByCap: boolean };

function matchesText(item: ArchiveItem, q: string): boolean {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  return `${item.title} ${item.detail ?? ""}`.toLowerCase().includes(needle);
}

/**
 * Narrow one section. Pure.
 *
 * A facet the section doesn't carry is not a match failure — it puts the whole
 * section out of scope (`applies: false`, no items). Within a section that does
 * carry it, an entry missing the value IS filtered out.
 */
export function filterSection(s: ArchiveSection, f: ArchiveFilter): FilteredSection {
  const outOfScope =
    (f.classId !== "" && !s.facets.includes("class")) ||
    (f.subjectId !== "" && !s.facets.includes("subject")) ||
    (f.basis !== "" && s.basis !== f.basis);
  if (outOfScope) return { ...s, items: [], count: 0, applies: false, hiddenByCap: false };

  const items = s.items.filter(
    (i) =>
      (f.classId === "" || i.classId === f.classId) &&
      (f.subjectId === "" || i.subjectId === f.subjectId) &&
      matchesText(i, f.q),
  );
  return {
    ...s,
    items,
    count: items.length,
    applies: true,
    // The section was capped upstream, so a filtered count is a count of what
    // was listed, not of the year. Saying so beats reporting a wrong total.
    hiddenByCap: s.count > s.items.length,
  };
}

export function filterArchiveSections(
  sections: ArchiveSection[],
  f: ArchiveFilter,
): FilteredSection[] {
  if (!isFiltering(f)) return sections.map((s) => ({ ...s, applies: true, hiddenByCap: false }));
  return sections.map((s) => filterSection(s, f));
}
