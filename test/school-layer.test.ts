import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { MIN_B2B_SEATS, SCHOOL_PILOT_DAYS, pilotEndDate } from "@/lib/billing/terms";
import { MESSAGES, type MessageKey } from "@/lib/i18n";
import { en } from "@/lib/i18n/en";

/**
 * The layer between onboarding and Schools, and the rules it exists to hold.
 *
 * Mostly asserted over source, because what these protect are shapes a tidy-up
 * would undo in good faith: an inline "Create school" button put back on
 * /profile, a request-access route that helpfully says "no school found", an
 * onboarding that lets an anonymous account through to Schools.
 */
const read = (p: string) =>
  readFileSync(join(process.cwd(), p), "utf8")
    .replace(/\r\n/g, "\n")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

describe("the pilot", () => {
  it("lasts 45 days and ends on a calendar date", () => {
    expect(SCHOOL_PILOT_DAYS).toBe(45);
    expect(pilotEndDate(new Date("2026-09-12T10:00:00Z"))).toBe("2026-10-27");
    // Across a month and a year boundary, in UTC — no local-time drift.
    expect(pilotEndDate(new Date("2026-12-20T23:30:00Z"))).toBe("2027-02-03");
  });
});

describe("creating a school", () => {
  const route = read("app/api/school/create/route.ts");

  it("requires a plan and a headcount of at least the B2B minimum", () => {
    expect(MIN_B2B_SEATS).toBe(100);
    expect(route).toContain("effectif < MIN_B2B_SEATS");
    expect(route).toContain('plan.category !== "b2b"');
  });

  it("starts the pilot on the chosen terms, as a trial that ends with it", () => {
    expect(route).toContain("pilot_until: pilotUntil");
    expect(route).toMatch(/status: "trial"[\s\S]*end_date: pilotEndsAt[\s\S]*seat_limit: effectif/);
  });

  it("is refused to accounts without a real email, and rate-limited", () => {
    expect(route).toContain("hasRealEmail(user.email)");
    expect(route).toContain("checkStrictUserRateLimit(");
  });

  it("has exactly one caller: the layer's plan cards", () => {
    // Any other form posting here would be a way around the plan + headcount.
    expect(read("components/school-layer/school-setup.tsx")).toContain('"/api/school/create"');
    expect(read("components/teacher-link.tsx")).not.toContain("/api/school/create");
  });
});

describe("after the pilot", () => {
  const billing = read("lib/billing.ts");

  it("a lapsed trial stops granting seats, and the school turns read-only", () => {
    expect(billing).toContain(".or(stillRunning(nowIso))");
    expect(billing).toContain('reason: "pilot_ended"');
  });

  it("a failed read never locks a school", () => {
    expect(billing).toMatch(/if \(subErr\) return \{ limited: false/);
  });

  it("read-only blocks new classes and new students", () => {
    expect(read("app/api/school/classes/route.ts")).toContain("isSchoolReadOnly(school.id)");
    expect(read("app/api/school/join/route.ts")).toContain('gate.reason === "pilot_ended"');
  });
});

describe("asking a school without a code", () => {
  const route = read("app/api/school/request-access/route.ts");

  it("answers the same whether or not a school matched", () => {
    // One response, sent before any lookup — neither the body nor the timing
    // may reveal which addresses belong to a school.
    expect(route.match(/NextResponse\.json\(\{ status:/g)).toHaveLength(1);
    expect(route).toContain("after(() => fileRequests(");
    expect(route.indexOf("after(() => fileRequests(")).toBeLessThan(route.indexOf('status: "sent"'));
  });

  it("matches an address whole, never as a pattern", () => {
    expect(route).toContain("literal(email)");
  });
});

describe("the layer is translated, not just translatable", () => {
  // The catalogue allows a locale to lag behind English (test/i18n.test.ts).
  // This flow does not: it is where a school decides to commit, in whatever
  // language its admin reads, and an English paragraph about pricing in the
  // middle of a French form is exactly where trust is lost.
  const keys = (Object.keys(en) as MessageKey[]).filter(
    (k) => k.startsWith("layer.") || k.startsWith("onb.path.schools.") || k.startsWith("school.billing.readOnly"),
  );

  it("covers the whole flow", () => {
    expect(keys.length).toBeGreaterThan(80);
  });

  for (const locale of ["fr", "de", "es"] as const) {
    it(`in ${locale}`, () => {
      const missing = keys.filter((k) => !MESSAGES[locale][k]);
      expect(missing, `${locale} is missing`).toEqual([]);
    });
  }
});

describe("onboarding's two filters", () => {
  const form = read("components/onboarding-form.tsx");

  it("filter 1: an anonymous account cannot take the Schools path", () => {
    expect(form).toMatch(/if \(t === "schools" && isAnonymous\) \{\s*setSchoolsGate\(true\);\s*return;/);
  });

  it("filter 2: the role decides which form of the layer opens", () => {
    expect(form).toContain('const SCHOOL_STEPS = ["path", "age", "name", "srole"] as const;');
    expect(form).toContain('`/school/enter?as=${schoolRole === "teacher" ? "teacher" : "admin"}`');
  });
});
