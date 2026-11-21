import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { lookup } from "@/lib/i18n";

/**
 * Delete lives in the teacher's library; the school side archives. Teachers
 * decide what reaches the school shelf (frozen copies of their Prepare
 * resources and generated reports), and the admin files those copies away.
 */

const read = (rel: string) => readFileSync(join(process.cwd(), rel), "utf8").split("\r\n").join("\n");

describe("delete is prof-only", () => {
  it("prepare DELETE refuses non-profs", () => {
    const route = read("app/api/school/prepare/route.ts");
    expect(route).toContain('if (membership.role !== "prof")');
    expect(route).toContain('apiT("api.deleteProfOnly")');
  });

  it("prepare DELETE takes class-linked rows too — the dialog carries the risk", () => {
    const route = read("app/api/school/prepare/route.ts");
    expect(route).not.toContain("if (row.class_id)");
    expect(route).not.toContain("thisResourceIsTiedToA");
    const ui = read("components/school/prof-prepare.tsx");
    expect(ui).toContain("canDelete={true}");
    expect(ui).toContain('r.classId ? "artifact.delete.caveat.teacherResourceLinked"');
  });

  it("reports DELETE exists and is prof-author-only", () => {
    const route = read("app/api/school/reports/route.ts");
    expect(route).toContain("export async function DELETE");
    expect(route).toContain('if (membership.role !== "prof")');
    expect(route).toContain("if (row.created_by !== membership.adminId)");
    expect(route).toContain('.from("reports").delete()');
  });

  it("the prof reports face deletes with the year-record caveat; the admin face archives", () => {
    const ui = read("components/school-reports.tsx");
    expect(ui).toContain('canDelete={viewerRole === "prof"}');
    expect(ui).toContain('deleteCaveatKey="artifact.delete.caveat.report"');
    expect(ui).toContain("deleteReport(r.id as string)");
    expect(read("components/school-admin.tsx")).toContain('viewerRole="prof"');
  });
});

describe("send to school", () => {
  it("the shelf table holds frozen copies, one live row per source, RLS on", () => {
    const mig = read("supabase/migrations/20261118000000_school_library.sql");
    expect(mig).toContain("create table if not exists schools.school_library");
    expect(mig).toContain("content text not null");
    expect(mig).toContain("payload jsonb");
    expect(mig).toContain("enable row level security");
    expect(mig).toContain("school_library_source_live_uidx");
  });

  it("sending is prof-author-only and snapshots the source", () => {
    const route = read("app/api/school/library/route.ts");
    expect(route).toContain('apiT("api.teachersOnly")');
    expect(route).toContain("if (row.created_by !== membership.adminId)");
    expect(route).toContain("source_type");
    expect(route).toContain("payload: { questions: row.questions");
    expect(route).toContain('p.title ?? "Report"');
  });

  it("re-sending refreshes the snapshot instead of stacking duplicates", () => {
    const route = read("app/api/school/library/route.ts");
    expect(route).toContain('.is("archived_at", null)');
    expect(route).toContain(".update({ ...snapshot, sent_at: sentAt })");
  });

  it("the shelf has no DELETE — archiving is admin-only", () => {
    const route = read("app/api/school/library/route.ts");
    expect(route).not.toContain("export async function DELETE");
    expect(route).toContain("no DELETE here");
    expect(route).toContain('apiT("api.adminOnly")');
  });

  it("prof libraries offer the send; the admin gets a shelf tab", () => {
    expect(read("components/school/prof-prepare.tsx")).toContain('tr("school.library.send")');
    expect(read("components/school-reports.tsx")).toContain('tr("school.library.send")');
    expect(read("components/school-admin.tsx")).toContain('tr("nav.library")');
    expect(read("components/school-library.tsx")).toContain("canDelete={false}");
  });
});

describe("i18n", () => {
  it("the new keys exist in every locale", () => {
    const keys = [
      "api.deleteProfOnly",
      "api.teachersOnly",
      "artifact.delete.caveat.report",
      "nav.library",
      "school.library.send",
      "school.library.sent",
      "school.library.sendFailed",
      "school.library.title",
      "school.library.empty",
      "artifact.delete.caveat.teacherResourceLinked",
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
