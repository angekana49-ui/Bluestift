import { describe, it, expect } from "vitest";
import {
  EMPTY_ARCHIVE_FILTER,
  filterSection,
  filterArchiveSections,
  isFiltering,
  type ArchiveSection,
} from "@/lib/archive-filter";

// The archive is a record an admin is meant to interrogate ("what did we do in
// maths in 3e B last year?"). A filter that quietly drops the entries it can't
// interpret would turn that record into a wrong answer, so the boundary between
// "no match" and "this filter doesn't apply here" is what these tests pin down.

const sec = (over: Partial<ArchiveSection> = {}): ArchiveSection => ({
  key: "resources",
  label: "Teacher resources",
  basis: "class",
  facets: ["class", "subject"],
  count: 3,
  items: [
    { id: "1", title: "Fractions drill", detail: "3e B · Maths", at: "2025-10-02", classId: "c1", subjectId: "s1" },
    { id: "2", title: "Verb tenses", detail: "3e B · French", at: "2025-10-03", classId: "c1", subjectId: "s2" },
    { id: "3", title: "Geometry recap", detail: "6e A · Maths", at: "2025-11-01", classId: "c2", subjectId: "s1" },
  ],
  ...over,
});

const payments = (): ArchiveSection => ({
  key: "payments",
  label: "Payments",
  basis: "period",
  facets: [],
  count: 1,
  items: [{ id: "p1", title: "50000 XAF", detail: "paid · card", at: "2025-09-12" }],
});

describe("isFiltering", () => {
  it("treats the untouched bar as no filter at all", () => {
    expect(isFiltering(EMPTY_ARCHIVE_FILTER)).toBe(false);
  });

  it("ignores whitespace typed into the search box", () => {
    // Otherwise a stray space would put the whole screen in "filtered" mode and
    // start reporting sections as out of scope.
    expect(isFiltering({ ...EMPTY_ARCHIVE_FILTER, q: "   " })).toBe(false);
  });
});

describe("filterSection", () => {
  it("keeps only the chosen class", () => {
    const out = filterSection(sec(), { ...EMPTY_ARCHIVE_FILTER, classId: "c2" });
    expect(out.items.map((i) => i.id)).toEqual(["3"]);
    expect(out.count).toBe(1);
    expect(out.applies).toBe(true);
  });

  it("intersects class and subject rather than unioning them", () => {
    const out = filterSection(sec(), { ...EMPTY_ARCHIVE_FILTER, classId: "c1", subjectId: "s1" });
    expect(out.items.map((i) => i.id)).toEqual(["1"]);
  });

  it("searches the detail line, not just the title", () => {
    // The class and subject names live in `detail`, so a typed word has to reach
    // it for free-text search to be any use here.
    const out = filterSection(sec(), { ...EMPTY_ARCHIVE_FILTER, q: "french" });
    expect(out.items.map((i) => i.id)).toEqual(["2"]);
  });

  it("sets a section aside when the filter has no meaning for it", () => {
    // A payment has no class. Reporting "0 payments" under a class filter would
    // read as "this school took no payments that year" — a different, false claim.
    const out = filterSection(payments(), { ...EMPTY_ARCHIVE_FILTER, classId: "c1" });
    expect(out.applies).toBe(false);
    expect(out.count).toBe(0);
  });

  it("still filters a section that carries the facet, dropping entries without it", () => {
    const s = sec({ items: [...sec().items, { id: "4", title: "Stray", detail: null, at: null }] });
    const out = filterSection(s, { ...EMPTY_ARCHIVE_FILTER, classId: "c1" });
    expect(out.items.map((i) => i.id)).toEqual(["1", "2"]);
  });

  it("narrows by how an entry was attributed to the year", () => {
    expect(filterSection(sec(), { ...EMPTY_ARCHIVE_FILTER, basis: "class" }).applies).toBe(true);
    expect(filterSection(sec(), { ...EMPTY_ARCHIVE_FILTER, basis: "period" }).applies).toBe(false);
  });

  it("flags a section whose list was capped upstream", () => {
    // 400 rows, 200 listed: a filtered count is a count of what was listed, and
    // the screen has to say so rather than imply a complete total.
    const out = filterSection(sec({ count: 400 }), { ...EMPTY_ARCHIVE_FILTER, classId: "c1" });
    expect(out.hiddenByCap).toBe(true);
    expect(out.count).toBe(2);
  });
});

describe("filterArchiveSections", () => {
  it("hands back every section untouched when nothing is filtered", () => {
    const sections = [sec(), payments()];
    const out = filterArchiveSections(sections, EMPTY_ARCHIVE_FILTER);
    expect(out.map((s) => s.count)).toEqual([3, 1]);
    expect(out.every((s) => s.applies)).toBe(true);
  });

  it("never drops a section from the list, only empties it", () => {
    // The screen accounts for all 19 sections in every state — matched, empty,
    // or out of scope. A missing one would look like data that vanished.
    const out = filterArchiveSections([sec(), payments()], {
      ...EMPTY_ARCHIVE_FILTER,
      classId: "nope",
    });
    expect(out.map((s) => s.key)).toEqual(["resources", "payments"]);
    expect(out.map((s) => s.applies)).toEqual([true, false]);
  });
});
