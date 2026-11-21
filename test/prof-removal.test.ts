import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { lookup } from "@/lib/i18n";

/**
 * Removing a teacher must never vaporize their data: the membership goes,
 * their teaching assignments go (the admin reassigns those classes), and
 * everything they authored stays under the school. Selecting teachers in
 * the roster table opens a confirm dialog that says exactly that — no more
 * one-click silent wipe, single or bulk.
 */

const read = (rel: string) => readFileSync(join(process.cwd(), rel), "utf8").split("\r\n").join("\n");

describe("the author FKs are dropped", () => {
  const mig = read("supabase/migrations/20261119000000_prof_removal_keeps_data.sql");

  it.each([
    "reports_created_by_fkey",
    "teacher_resources_created_by_fkey",
    "resource_assignments_assigned_by_fkey",
    "student_followups_author_admin_id_fkey",
    "school_admin_logs_admin_id_fkey",
  ])("drops %s", (fk) => {
    expect(mig).toContain(`drop constraint if exists ${fk}`);
  });
});

describe("the removal route only takes membership, assignments and prefs", () => {
  const route = read("app/api/school/profs/route.ts");

  it("deletes assignments and prefs before the membership", () => {
    expect(route).toContain('.from("assignments").delete().eq("prof_id", adminId)');
    expect(route).toContain('.from("staff_preferences").delete().eq("admin_id", adminId)');
    const assignsAt = route.indexOf('.from("assignments").delete()');
    const prefsAt = route.indexOf('.from("staff_preferences").delete()');
    const memberAt = route.indexOf('.eq("role", "prof")\n    .select("id")');
    expect(assignsAt).toBeGreaterThan(-1);
    expect(prefsAt).toBeGreaterThan(assignsAt);
    expect(memberAt).toBeGreaterThan(prefsAt);
  });

  it("never touches authored data", () => {
    expect(route).not.toContain("teacher_resources");
    expect(route).not.toContain('.from("reports")');
    expect(route).not.toContain("student_followups");
  });
});

describe("template delete detaches assignment records first", () => {
  it("nulls resource_id before deleting the template", () => {
    const route = read("app/api/school/prepare/route.ts");
    expect(route).toContain('.update({ resource_id: null }).eq("resource_id", id)');
    expect(route.indexOf("resource_id: null")).toBeLessThan(route.indexOf('.from("teacher_resources").delete()'));
  });
});

describe("the team view feeds the confirm dialog", () => {
  const lib = read("lib/school-admin.ts");

  it("links assignments to profs by id and counts authored data", () => {
    expect(lib).toContain("profId: a.prof_id");
    expect(lib).toContain("authoredByAdmin");
    expect(lib).toContain('.from("student_followups").select("author_admin_id")');
  });
});

describe("the selection opens a confirm dialog, not a wipe", () => {
  const ui = read("components/school-team.tsx");

  it("opens a modal stating dropped assignments and kept data", () => {
    expect(ui).toContain("openRemoveSelected");
    expect(ui).toContain("setConfirmRemove(sel)");
    expect(ui).toContain("school.team.removeTitle");
    expect(ui).toContain("school.team.removeTitleOther");
    expect(ui).toContain("school.team.removeSomeFailed");
    expect(ui).toContain("school.team.removeLineAssignments");
    expect(ui).toContain("school.team.removeLineKept");
    expect(ui).toContain("school.team.removeLineAccount");
    expect(ui).toContain("school.team.removeConfirm");
  });

  it("filters the dropped assignments by prof id, not name", () => {
    expect(ui).toContain("a.profId !== t.adminId");
    expect(ui).not.toContain("a.profName !==");
  });
});

describe("i18n", () => {
  it("the dialog keys exist in every locale", () => {
    const keys = [
      "school.team.removeTitle",
      "school.team.removeLineAssignments",
      "school.team.removeLineNoAssignments",
      "school.team.removeLineKept",
      "school.team.removeLineAccount",
      "school.team.removeConfirm",
      "school.team.removeTitleOther",
      "school.team.removeSomeFailed",
    ] as const;
    for (const locale of ["en", "fr", "es", "de"] as const) {
      for (const key of keys) {
        const s = lookup(locale, key);
        expect(s.length).toBeGreaterThan(0);
        expect(s).not.toBe(key);
      }
    }
  });
});
