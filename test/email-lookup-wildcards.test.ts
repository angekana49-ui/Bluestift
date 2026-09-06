import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * `ilike` is a pattern match, not a spelling-tolerant equals.
 *
 * Two endpoints look an account up by an email somebody typed, and both used
 * `ilike` to be forgiving about capitals. `%` and `_` are wildcards to it, so
 * `%@%` stops meaning "this address" and starts meaning "the first account
 * there is" — on one endpoint that hands a stranger a paid plan, on the other
 * it puts a stranger on a school's team list, which shows their address.
 *
 * Neither character belongs in an unquoted address, so both routes refuse them
 * rather than escaping them into a filter grammar. These tests hold that,
 * because the failure is silent: the query still runs and still returns a row.
 */
const routes = [
  ["app/api/ops/billing/activate/route.ts", "the operator's manual activation"],
  ["app/api/school/profs/route.ts", "adding a teacher to a school"],
] as const;

describe.each(routes)("%s", (file, what) => {
  const src = readFileSync(join(process.cwd(), file), "utf8");

  it(`refuses LIKE wildcards before looking anyone up (${what})`, () => {
    expect(src).toContain("/[%_]/.test(");
    // The refusal has to come first — a guard after the query guards nothing.
    expect(src.indexOf("/[%_]/.test(")).toBeLessThan(src.indexOf(".ilike("));
  });
});

describe("the school lookup", () => {
  const src = readFileSync(join(process.cwd(), "app/api/school/profs/route.ts"), "utf8");

  it("is by email only — a username must not resolve to an address", () => {
    expect(src).not.toContain('.eq("username", identifier)');
    expect(src).toContain('identifier.includes("@")');
  });

  it("still tries an exact match before the case-insensitive one", () => {
    expect(src.indexOf('.eq("email", identifier)')).toBeLessThan(src.indexOf('.ilike("email"'));
  });

  it("is rate-limited, because each attempt answers whether an account exists", () => {
    expect(src).toContain("checkStrictUserRateLimit");
    expect(src.indexOf("checkStrictUserRateLimit")).toBeLessThan(src.indexOf('.eq("email", identifier)'));
  });
});
