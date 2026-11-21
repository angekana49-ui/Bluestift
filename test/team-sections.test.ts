import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { lookup } from "@/lib/i18n";

/**
 * The Team tab shows one section at a time — subjects, teachers, access
 * (invites, codes AND join requests), assignments — picked from a shell
 * right panel shaped exactly like the Overview tab's (RightPanel + cards).
 * The section state lives in the dashboard; the tab reports its counts up.
 */

const read = (rel: string) => readFileSync(join(process.cwd(), rel), "utf8").split("\r\n").join("\n");
const ui = read("components/school-team.tsx");
const dash = read("components/school-admin.tsx");

describe("four sections, one visible", () => {
  it("defines exactly the four sections with labels", () => {
    expect(ui).toContain('{ key: "subjects", labelKey: "school.team.navSubjects" }');
    expect(ui).toContain('{ key: "teachers", labelKey: "school.team.navTeachers" }');
    expect(ui).toContain('{ key: "access", labelKey: "school.team.navAccess" }');
    expect(ui).toContain('{ key: "assignments", labelKey: "school.team.navAssignments" }');
  });

  it("renders only the selected section", () => {
    for (const key of ["subjects", "teachers", "access", "assignments"]) {
      expect(ui).toContain(`{section === "${key}" && (`);
    }
  });

  it("join requests live inside the access section", () => {
    const accessAt = ui.indexOf('{section === "access"');
    const reqAt = ui.indexOf("Pending join requests");
    const asgAt = ui.indexOf('{section === "assignments"');
    expect(accessAt).toBeGreaterThan(-1);
    expect(reqAt).toBeGreaterThan(accessAt);
    expect(asgAt).toBeGreaterThan(reqAt);
  });
});

describe("the nav is an overview-shaped shell panel", () => {
  it("TeamSectionsPanel mirrors OverviewRightPanel's shell", () => {
    expect(ui).toContain("export function TeamSectionsPanel");
    expect(ui).toContain("<RightPanel theme={t} width={300} title={tr(\"school.team.sectionsLabel\")}>");
    expect(ui).toContain("background: t.cardBg2");
  });

  it("the tab is controlled and reports its counts up", () => {
    expect(ui).toContain("section: TeamSection;");
    expect(ui).toContain("onSectionCounts(counts);");
    expect(ui).toContain("access: invites.length + requests.length,");
  });

  it("the dashboard owns the section and mounts the panel for the team tab", () => {
    expect(dash).toContain('useState<TeamSection>("teachers")');
    expect(dash).toContain("<TeamSectionsPanel section={teamSection} counts={teamCounts} onSection={setTeamSection} />");
    expect(dash).toContain('tab === "team" ? (');
  });
});

describe("instructions first, tables below", () => {
  it("subjects: the add form sits above the name/code table", () => {
    expect(ui.indexOf("subjectNamePlaceholder")).toBeLessThan(ui.indexOf("school.team.colName"));
  });

  it("teachers: the invite box sits above the roster table", () => {
    expect(ui.indexOf("teacherEmailPlaceholder")).toBeLessThan(ui.indexOf('school.team.colClasses"'));
  });

  it("access: the generate row sits above the codes table", () => {
    expect(ui.indexOf("generateCodeButton")).toBeLessThan(ui.indexOf("school.team.colMode"));
  });

  it("assignments: the assign form sits above the teacher/class/subject table", () => {
    expect(ui.lastIndexOf("assignButton")).toBeLessThan(ui.indexOf('school.team.colSubject"'));
  });
});

describe("the roster is a multi-select table", () => {
  it("selects via checkboxes into an action bar", () => {
    expect(ui).toContain('type="checkbox"');
    expect(ui).toContain("toggleSelect(p.adminId)");
    expect(ui).toContain("toggleSelectVisible(e.target.checked)");
    expect(ui).toContain("openRemoveSelected");
    expect(ui).toContain("school.team.selectAll");
    expect(ui).toContain("school.team.selectedCount");
    expect(ui).toContain("school.team.clearSelection");
  });

  it("shows each teacher's subjects and class count from their assignments", () => {
    expect(ui).toContain("assignmentsOf(p)");
    expect(ui).toContain("new Set(mine.map((a) => a.className)).size");
    expect(ui).toContain("school.team.colTeacher");
    expect(ui).toContain("school.team.colEmail");
    expect(ui).toContain("school.team.colClasses");
  });

  it("no per-row remove button survives", () => {
    expect(ui).not.toContain("setConfirmRemove({ adminId: p.adminId, name: p.name })");
  });
});

describe("search is always on", () => {
  it("every list search shows from the first item", () => {
    expect(ui.match(/minItems: 1/g)).toHaveLength(4);
  });
});

describe("zones are visibly separated", () => {
  it("a divider splits form zones from table zones", () => {
    expect(ui).toContain("background: t.cardBg2");
    expect(ui.match(/\{\s*\.\.\.zoneBand/g)).toHaveLength(4);
    expect(ui).toContain("color: t.link");
    expect(ui).not.toContain("borderTop:");
  });
});

describe("the roster search is scoped by column", () => {
  it("chips restrict the query to one column", () => {
    expect(ui).toContain("profScope");
    expect(ui).toContain("setProfScope(scope)");
    expect(ui).toContain('profScope === "subjects"');
    expect(ui).toContain("school.team.filterAll");
    expect(ui).toContain("school.team.colTeacher");
    expect(ui).toContain("school.team.colEmail");
  });
});

describe("the selection assigns to a class and subject", () => {
  it("bulk-assigns every selected prof, reporting failures by name", () => {
    expect(ui).toContain("bulkAssign");
    expect(ui).toContain("bulkClass");
    expect(ui).toContain("bulkSubject");
    expect(ui).toContain("profAdminId: p.adminId");
    expect(ui).toContain("school.team.pickClassSubject");
    expect(ui).toContain("school.team.assignSomeFailed");
  });
});

describe("i18n", () => {
  it("the nav keys exist in every locale", () => {
    const keys = [
      "school.team.navSubjects",
      "school.team.navTeachers",
      "school.team.navAccess",
      "school.team.navAssignments",
      "school.team.sectionsLabel",
      "school.team.colTeacher",
      "school.team.colEmail",
      "school.team.colClasses",
      "school.team.colName",
      "school.team.colCode",
      "school.team.colMode",
      "school.team.colClass",
      "school.team.colSubject",
      "school.team.selectedCount",
      "school.team.clearSelection",
      "school.team.selectAll",
      "school.team.filterAll",
      "school.team.pickClassSubject",
      "school.team.assignSomeFailed",
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
