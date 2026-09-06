import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * The student education record answers TWO questions, and for a while it only
 * asked one.
 *
 * `assertClassAccess` says the caller may open this class. It says nothing
 * about the student id travelling beside the class id in the same request — and
 * every read the record is built from is keyed on that student id ALONE: the
 * account row, the follow-up notes staff wrote, the assessment history, the
 * whole Kernel cognitive profile. So any staff member holding one legitimate
 * class could name any account on the platform and be handed all of it. Schools
 * are self-serve, so "any staff member" was one signup away from being anyone.
 *
 * There is no database policy behind this: every table is read with the service
 * role, which bypasses RLS by definition. The route and the builder ARE the
 * boundary, which is why both are checked here.
 */
const route = readFileSync(
  join(process.cwd(), "app/api/school/student/record/route.ts"),
  "utf8",
);
const builder = readFileSync(join(process.cwd(), "lib/compliance/school-record.ts"), "utf8");

describe("the record route", () => {
  it("checks class access AND enrolment before reading anything", () => {
    expect(route).toContain("assertClassAccess");
    expect(route).toContain("assertStudentInClass");
    const guard = Math.max(route.indexOf("assertStudentInClass"), route.indexOf("assertClassAccess"));
    expect(guard).toBeLessThan(route.indexOf("buildStudentRecord"));
  });

  it("answers the same refusal either way, so an id cannot be probed", () => {
    const refusals = route.match(/Not found or not yours\./g) ?? [];
    expect(refusals.length).toBeGreaterThanOrEqual(2);
  });

  it("handles the builder's own refusal rather than serving an empty record", () => {
    expect(route).toContain("if (!record)");
  });

  it("only logs a FERPA disclosure once the request was actually served", () => {
    expect(route.indexOf("buildStudentRecord")).toBeLessThan(route.indexOf("recordDataRequest"));
  });
});

describe("the record builder", () => {
  it("refuses outright when the student is not in that class", () => {
    expect(builder).toContain("student_identities");
    expect(builder).toContain("if (!enrolment) return null;");
    // Null, not {} — "no such student here" and "a student with nothing yet"
    // must not be the same answer.
    expect(builder).toContain("Promise<StudentRecord | null>");
  });

  it("checks enrolment BEFORE any of the user-id-keyed reads", () => {
    expect(builder.indexOf("if (!enrolment) return null;")).toBeLessThan(
      builder.indexOf("challenge_attempts"),
    );
    expect(builder.indexOf("if (!enrolment) return null;")).toBeLessThan(
      builder.indexOf("KERNEL_TABLES.map"),
    );
  });

  it("scopes staff follow-ups to this class, not to every school the student ever joined", () => {
    const followups = builder.slice(
      builder.indexOf('soft("followups"'),
      builder.indexOf('soft("challenge_attempts"'),
    );
    expect(followups).toContain('.eq("student_user_id", studentUserId)');
    expect(followups).toContain('.eq("class_id", classId)');
  });

  it("still leaves the student's own conversations out of the school's record", () => {
    expect(builder).not.toContain('from("messages")');
    expect(builder).not.toContain('from("conversations")');
  });
});
