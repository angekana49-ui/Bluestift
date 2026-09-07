import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const src = readFileSync(join(process.cwd(), "lib/compliance/export.ts"), "utf8");

/**
 * An article 15 export may be refused, and it may be partial — but it may never
 * be partial while presenting itself as whole.
 *
 * PostgREST applies a `db.max_rows` ceiling per project and a select that
 * reaches it returns a SHORT answer with no error. Nothing in this repository
 * can read that setting, and it can be changed from a dashboard without a
 * commit, so the export cannot be made correct by checking it once. It asks the
 * database how many rows there are and compares.
 */
describe("the data export cannot be silently truncated", () => {
  it("asks for the exact count beside every list it reads", () => {
    expect(src).toContain('const COUNTED = { count: "exact" } as const;');
    // Every list read goes through `.select("*", COUNTED)` or `.select("id", COUNTED)`.
    const bare = src.match(/\.select\("\*"\)|\.select\("id"\)/g) ?? [];
    expect(bare).toEqual([]);
  });

  it("compares what came back against what the database says it holds", () => {
    expect(src).toContain("count > list.length");
    expect(src).toContain(":incomplete:");
  });

  it("routes every helper through that comparison", () => {
    // rows() covers the eighteen uniform sections; the three hand-written ones
    // (conversation_ids, messages, conversation_files) each call it directly,
    // which is why the count of call sites is four and not one.
    expect(src.match(/whole\(/g)?.length).toBeGreaterThanOrEqual(4);
  });

  it("still returns the rows it did get, and reports the shortfall", () => {
    // Throwing would hand the subject nothing at all. A partial answer they
    // know is partial is more useful than a refusal, and far more useful than
    // a silent one.
    expect(src).toContain("errors.push(");
    expect(src).toContain("_errors: errors");
    const whole = src.slice(src.indexOf("const whole ="), src.indexOf("const rows ="));
    expect(whole).not.toContain("throw");
    expect(whole).toContain("return list;");
  });
});

/**
 * The one optimisation that must not be applied to `getAdminMembership`.
 *
 * It is two queries and a /school render makes three or four of them, so React's
 * `cache()` is the obvious win. It is also wrong: app/school/page.tsx runs
 * `ensureCurrentSchoolYear` between two of those calls, and that write repoints
 * the school's current year. A per-request memo would serve the dashboard the
 * pre-rollover year and render last year's classes — once a year, per school,
 * silently. This test is here so the next person to spot the easy win finds the
 * reason before the bug.
 */
describe("the school membership read stays unmemoised on purpose", () => {
  const admin = readFileSync(join(process.cwd(), "lib/school-admin.ts"), "utf8");
  const page = readFileSync(join(process.cwd(), "app/school/page.tsx"), "utf8");

  it("is not wrapped in React's cache()", () => {
    expect(admin).not.toMatch(/cache\(\s*async\s*\(/);
    expect(admin).toContain("export async function getAdminMembership(");
  });

  it("says why, where someone would look", () => {
    expect(admin).toContain("blanket-");
    expect(admin).toContain("ensureCurrentSchoolYear");
  });

  it("keeps the rollover ordered before the dashboard read that depends on it", () => {
    expect(page.indexOf("ensureCurrentSchoolYear(")).toBeLessThan(
      page.indexOf("getSchoolDashboard("),
    );
  });
});
