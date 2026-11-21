import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * The Prepare tab's sources: like Tools, a generation can build from a past
 * conversation or from files — plus, on the staff side, a school report, a
 * past generation of the teacher's own library, and one click on a Kernel gap
 * chip to fill the topic. Pinned here: what the tab sends, what the route
 * accepts, and that every id resolves behind its own gate (a teacher reads
 * their threads, their reports per the list's rule, their rows).
 */

const read = (rel: string) => readFileSync(join(process.cwd(), rel), "utf8").split("\r\n").join("\n");

describe("the tab sends its sources", () => {
  const tab = read("components/school/prof-prepare.tsx");

  it("offers the school threads as a conversation source", () => {
    expect(tab).toContain('"/api/school/raya/conversations"');
    expect(tab).toContain('tr("school.prepare.sourceConversation")');
    expect(tab).toContain("conversationId: sourceConversationId || undefined,");
  });

  it("extracts fresh files and sends them as the brief", () => {
    expect(tab).toContain('"/api/tools/extract"');
    expect(tab).toContain("brief: briefFiles.length");
  });

  it("offers one school report and one past generation, by title", () => {
    expect(tab).toContain('"/api/school/reports"');
    expect(tab).toContain("reportIds: sourceReportId ? [sourceReportId] : undefined,");
    expect(tab).toContain('tr("school.prepare.sourceResource")');
    expect(tab).toContain("resourceIds: sourceResourceId ? [sourceResourceId] : undefined,");
  });

  it("fills the topic from a Kernel gap chip", () => {
    expect(tab).toContain("`/api/school/prepare/gaps");
    expect(tab).toContain("onClick={() => setTopic(g.label)}");
  });
});

describe("the route grounds on them, gated", () => {
  const route = read("app/api/school/prepare/route.ts");

  it("appends the brief as teacher-provided material, capped", () => {
    expect(route).toContain("brief?: string");
    expect(route).toContain("Teacher-provided material");
    expect(route).toContain("body.brief.trim().slice(0, 6000)");
  });

  it("resolves past generations behind the ownership gate", () => {
    expect(route).toContain("resourceIds?: string[]");
    expect(route).toContain('.from("teacher_resources")');
    expect(route).toContain('.eq("created_by", user.id)');
    expect(route).toContain("Earlier material");
  });
});

describe("the gaps endpoint", () => {
  const gaps = read("app/api/school/prepare/gaps/route.ts");

  it("answers the weakest concepts first, staff-gated like the tab", () => {
    expect(gaps).toContain("api.staffOnly");
    expect(gaps).toContain("assertClassAccess");
    expect(gaps).toContain(".sort((a, b) => a.mastery - b.mastery)");
  });

  it("fails soft: no data is an empty row of chips, never an error", () => {
    expect(gaps).toContain("{ concepts: []");
    expect(gaps).toContain("return NextResponse.json(empty);");
  });
});
