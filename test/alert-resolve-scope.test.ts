import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Acknowledging an alert asks two questions about every id: does this alert
 * exist, and is it about a child this staff member teaches. An alert id is a
 * guessable UUID, so holding one proves nothing on its own.
 *
 * Both questions are now asked once for the whole batch rather than once per
 * id — up to 350 sequential round trips became two, on a button teachers press
 * daily. The risk of that change is losing a check while making it faster, so
 * these tests hold the properties the speed-up had to preserve: every id is
 * still checked individually, and an unknown id still refuses before a foreign
 * one does.
 */
const route = readFileSync(
  join(process.cwd(), "app/api/school/alerts/resolve/route.ts"),
  "utf8",
);
const risk = readFileSync(join(process.cwd(), "lib/kernel/risk.ts"), "utf8");
const admin = readFileSync(join(process.cwd(), "lib/school-admin.ts"), "utf8");

describe("the batched authorisation", () => {
  it("still checks every id, not just the first", () => {
    // The loop is what stops a caller smuggling someone else's alert in behind
    // one of their own.
    expect(route).toContain("for (const alertId of alertIds)");
    expect(route).toContain("owners.get(alertId)");
  });

  it("keeps 404-before-403 precedence per id", () => {
    const notFound = route.indexOf('"Alert not found."');
    const forbidden = route.indexOf('"Not your student."');
    expect(notFound).toBeGreaterThan(-1);
    expect(forbidden).toBeGreaterThan(notFound);
  });

  it("authorises before it writes anything", () => {
    expect(route.indexOf("reachable.has(owner)")).toBeLessThan(route.indexOf("kernel.resolveAlert"));
  });

  it("asks each question once, not once per id", () => {
    expect(route.match(/await getAlertOwners\(/g)).toHaveLength(1);
    expect(route.match(/await reachableStudents\(/g)).toHaveLength(1);
    // The per-id helpers are gone, so nothing can quietly go back to N+1.
    expect(route).not.toContain("getAlertOwner(");
    expect(route).not.toContain("canReachStudent(");
  });

  it("still bounds the batch", () => {
    expect(route).toContain("alertIds.length > 50");
  });
});

describe("the batched lookups themselves", () => {
  it("resolve owners in one query, and only from alert rows", () => {
    const fn = risk.slice(risk.indexOf("export async function getAlertOwners"));
    expect(fn).toContain('.eq("level", "alert")');
    expect(fn).toContain('.in("id", ids)');
    // An alert with no owner is absent from the map, so the caller still 404s.
    expect(fn).toContain("if (row.user_id)");
  });

  it("resolve reachability against the caller's own classes only", () => {
    const fn = admin.slice(admin.indexOf("export async function reachableStudents"));
    expect(fn).toContain("getProfClasses(userId)");
    expect(fn).toContain('.in("user_id", ids)');
    expect(fn).toContain('.in("class_id"');
    // No classes means nobody is reachable — fail closed, not open.
    expect(fn).toContain("if (classes.length === 0) return new Set()");
  });

  it("both answer emptily for an empty input instead of querying", () => {
    for (const src of [
      risk.slice(risk.indexOf("export async function getAlertOwners")),
      admin.slice(admin.indexOf("export async function reachableStudents")),
    ]) {
      expect(src).toMatch(/if \(ids\.length === 0\) return new (Map|Set)\(\)/);
    }
  });
});
