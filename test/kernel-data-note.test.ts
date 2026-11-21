import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { lookup } from "@/lib/i18n";

/**
 * Kernel figures are estimates, not exact measures — every surface that shows
 * them says so through the shared <KernelDataNote/>, and graphs carry the
 * stronger "indicative" wording. Exported documents (TXT/PDF) carry the same
 * line: they outlive the screen they were exported from.
 */

const read = (rel: string) => readFileSync(join(process.cwd(), rel), "utf8").split("\r\n").join("\n");

describe("the shared note", () => {
  const note = read("components/ui/kernel-note.tsx");

  it("renders the figures key by default and the graph key for graphs", () => {
    expect(note).toContain("kernel.dataNote.figures");
    expect(note).toContain("kernel.dataNote.graph");
    expect(note).toContain("graph ?");
  });

  it("reads as a caution: danger red with a warning triangle", () => {
    expect(note).toContain("status.danger");
    expect(note).toContain("<IconAlert");
    expect(read("components/ui/icons.tsx")).toContain("export const IconAlert");
  });
});

describe("solo surfaces", () => {
  it("the cognitive profile notes its figures once they render", () => {
    const ui = read("components/cognitive-profile.tsx");
    expect(ui).toContain("{concepts.length > 0 && <KernelDataNote />}");
  });

  it("the chat analysis panel notes it, and so does its export", () => {
    const ui = read("components/chat.tsx");
    expect(ui).toContain("<KernelDataNote />");
    expect(ui).toContain('tr("kernel.dataNote.figures"),');
  });
});

describe("schools surfaces", () => {
  const dash = read("components/school-admin.tsx");

  it("the learning graph carries the indicative wording", () => {
    expect(dash).toContain("<KernelDataNote graph />");
  });

  it("student detail, overview, panel, roster and prof insights carry the note", () => {
    expect(dash).toContain("{hasKernel && <KernelDataNote />}");
    expect(dash.match(/<KernelDataNote/g)).toHaveLength(6);
  });

  it("the prof insights export carries the line", () => {
    expect(dash).toContain('lines.push("", t("kernel.dataNote.figures"));');
  });

  it("admin insights note the list on screen and in the export", () => {
    const ui = read("components/school-insights.tsx");
    expect(ui).toContain("{insights.length > 0 && <KernelDataNote />}");
    expect(ui).toContain('lines.push("", tr("kernel.dataNote.figures"));');
  });

  it("the prof at-risk feed notes it when alerts render", () => {
    const ui = read("components/school/prof-overview.tsx");
    expect(ui).toContain("{!loading && ov && ov.alerts.length > 0 && <KernelDataNote />}");
  });

  it("generated reports carry it as a footnote, on screen and downloaded", () => {
    const ui = read("components/school-reports.tsx");
    expect(ui).toContain('_${tr("kernel.dataNote.figures")}_`');
  });

  it("shelf copies of reports carry it, prepare resources do not", () => {
    const ui = read("components/school-library.tsx");
    expect(ui).toContain('r.sourceType === "report" ? `${r.content}\\n\\n_${tr("kernel.dataNote.figures")}_` : r.content');
  });

  it("the education-record export notes its inferred-understanding section", () => {
    const lib = read("lib/school-record-doc.ts");
    expect(lib).toContain('body.push("", tr("kernel.dataNote.figures"));');
  });
});

describe("notes sit at the bottom, under the figures they cover", () => {
  it("prof overview: after the quick links", () => {
    const ui = read("components/school/prof-overview.tsx");
    expect(ui.lastIndexOf("<KernelDataNote")).toBeGreaterThan(ui.indexOf("generateClassReport"));
  });

  it("admin insights: after the list, before the simulation box", () => {
    const ui = read("components/school-insights.tsx");
    const at = ui.indexOf("{insights.length > 0 && <KernelDataNote />}");
    expect(at).toBeGreaterThan(ui.indexOf("insights.length === 0"));
    expect(at).toBeLessThan(ui.indexOf("{/* Simulation */}"));
  });

  it("overview: after the class list", () => {
    const dash = read("components/school-admin.tsx");
    const at = dash.indexOf("<KernelDataNote />", dash.indexOf("onClass(c.id)"));
    expect(at).toBeGreaterThan(-1);
    expect(at).toBeLessThan(dash.indexOf("function OverviewClassRow"));
  });

  it("roster: at the end of the view", () => {
    const dash = read("components/school-admin.tsx");
    const at = dash.indexOf("<KernelDataNote />", dash.indexOf("roster.classId} />"));
    expect(at).toBeGreaterThan(-1);
    expect(at).toBeLessThan(dash.indexOf("function LearningGraphView"));
  });

  it("student detail: after the follow-ups panel", () => {
    const dash = read("components/school-admin.tsx");
    const at = dash.indexOf("<KernelDataNote />", dash.indexOf("FollowupsPanel classId={classId}"));
    expect(at).toBeGreaterThan(-1);
    expect(at).toBeLessThan(dash.indexOf("function StudentSummary"));
  });
});

describe("app-owned figures stay unnoted", () => {
  it("the progress curve is challenge scores, not Kernel data", () => {
    const ui = read("components/progress-curve.tsx");
    expect(ui).not.toContain("KernelDataNote");
    expect(ui).not.toContain("kernel.dataNote");
  });
});

describe("i18n", () => {
  it("both keys exist in every locale", () => {
    const keys = ["kernel.dataNote.figures", "kernel.dataNote.graph"] as const;
    for (const locale of ["en", "fr", "es", "de"] as const) {
      for (const key of keys) {
        const s = lookup(locale, key);
        expect(s.length).toBeGreaterThan(0);
        expect(s).not.toBe(key);
      }
    }
  });

  it("graphs say indicative, plainly, in every locale", () => {
    expect(lookup("en", "kernel.dataNote.graph")).toContain("Indicative");
    expect(lookup("fr", "kernel.dataNote.graph")).toContain("à titre indicatif");
    expect(lookup("es", "kernel.dataNote.graph")).toContain("título indicativo");
    expect(lookup("de", "kernel.dataNote.graph")).toContain("Unverbindliche");
  });

  it("no insight string claims certification anymore", () => {
    const keys = [
      "school.insights.noCertifiedYet",
      "school.insights.noCertifiedYetLong",
      "school.insights.certifiedReadOnly",
      "school.insights.simDescription",
    ] as const;
    for (const locale of ["en", "fr", "es", "de"] as const) {
      for (const key of keys) {
        expect(lookup(locale, key)).not.toMatch(/certif/i);
        expect(lookup(locale, key)).not.toMatch(/bestätig/i);
        expect(lookup(locale, key)).not.toMatch(/zertifizier/i);
      }
    }
  });
});
