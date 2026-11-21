import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { lookup } from "@/lib/i18n";

/**
 * A prof only ever sees — and submits — the subjects they've been assigned.
 * Pickers filter through getViewerSubjects; every route that takes a
 * subjectId re-checks through assertSubjectAccess, because a picker is not
 * a gate. Admins keep the full school list on both sides.
 */

const read = (rel: string) => readFileSync(join(process.cwd(), rel), "utf8").split("\r\n").join("\n");

describe("the helpers", () => {
  const lib = read("lib/school-admin.ts");

  it("assertSubjectAccess mirrors assertClassAccess: school scope, admin bypass, assignment row", () => {
    expect(lib).toContain("export async function assertSubjectAccess(userId: string, subjectId: string): Promise<boolean>");
    expect(lib).toContain('if (m.role === "admin_master") return true;');
    expect(lib).toContain('.eq("prof_id", m.adminId)');
    expect(lib).toContain('.eq("subject_id", subjectId)');
  });

  it("getViewerSubjects intersects the school list with the prof's assignments", () => {
    expect(lib).toContain("export async function getViewerSubjects(userId: string): Promise<SchoolSubject[]>");
    expect(lib).toContain("all.filter((s) => ids.has(s.id))");
  });
});

describe("the pickers", () => {
  it("the subjects list is role-aware", () => {
    const route = read("app/api/school/subjects/route.ts");
    expect(route).toContain("getViewerSubjects(user.id)");
    expect(route).not.toContain("getSchoolSubjects");
  });

  it("reports embed the role-aware list", () => {
    const route = read("app/api/school/reports/route.ts");
    expect(route).toContain("getViewerSubjects(user.id)");
  });
});

describe("the gates", () => {
  it("prepare refuses a subject the caller doesn't teach", () => {
    const route = read("app/api/school/prepare/route.ts");
    expect(route).toContain("if (subjectId && !(await assertSubjectAccess(user.id, subjectId)))");
    expect(route).toContain('apiT("api.notYourSubject")');
  });

  it("gaps refuses too — a forged chip scope would read another subject's weaknesses", () => {
    const route = read("app/api/school/prepare/gaps/route.ts");
    expect(route).toContain("assertSubjectAccess(user.id, subjectId)");
    expect(route).toContain('apiT("api.notYourSubject")');
  });

  it("the refusal message exists in every locale", () => {
    expect(lookup("en", "api.notYourSubject")).toBe("Not your subject.");
    expect(lookup("fr", "api.notYourSubject")).toBe("Ce n'est pas l'une de vos matières.");
    expect(lookup("es", "api.notYourSubject")).toBe("No es una de tus asignaturas.");
    expect(lookup("de", "api.notYourSubject")).toBe("Das ist nicht dein Fach.");
  });
});
