import { describe, expect, it } from "vitest";

import { lookup } from "@/lib/i18n";
import type { MessageKey } from "@/lib/i18n";
import { studentRecordToDoc } from "@/lib/school-record-doc";

/**
 * The education record's human-readable rendering — what a parent receives as
 * TXT/PDF. The JSON stays the complete original; this composer must keep the
 * same sections, order its lines usefully (attempts oldest-first, concepts
 * weakest-first), and never print a blank line for a row it cannot read.
 */

const tr = (key: MessageKey, vars?: Record<string, string | number>) => lookup("en", key, vars);

const full = {
  assessment_results: [
    { score: 0.9, completed_at: "2026-10-02T10:00:00Z" },
    { score: 0.5, completed_at: "2026-09-01T10:00:00Z" },
    { score: null, completed_at: "2026-10-20T10:00:00Z" },
  ],
  staff_followups: [{ content: "Revoir les fractions.", created_at: "2026-09-15T10:00:00Z" }],
  cognitive_profile: {
    student_concept_state: [
      { concept_label: "Fractions", k_effective: 0.8 },
      { concept_label: "Distributivité", k_raw: 0.3 },
      { concept_id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890", k_effective: 0.6 },
    ],
    student_mindset_state: [{ m_score: 0.7 }],
    student_risk_assessments: [],
    learning_trajectories: [{}, {}],
  },
  _errors: [],
};

describe("student record document", () => {
  it("carries the student, class and school as a branded school document", () => {
    const doc = studentRecordToDoc(full, { studentName: "Amina Diallo", className: "5e B", schoolName: "Lycée Exemple", tr });
    expect(doc.brand).toBe("bluestift");
    expect(doc.title).toBe("Amina Diallo");
    expect(doc.meta).toContain("5e B");
    expect(doc.audience).toBe("Lycée Exemple");
    for (const h of ["Assessment results", "Inferred understanding", "Staff notes", "About this record"]) {
      expect(doc.body).toContain(`## ${h}`);
    }
  });

  it("lists attempts oldest-first with an average over the marked ones", () => {
    const doc = studentRecordToDoc(full, { studentName: "A", tr });
    const results = doc.body.split("## Inferred understanding")[0];
    expect(results.indexOf("50%")).toBeLessThan(results.indexOf("90%"));
    // (0.9 + 0.5) / 2 — the unmarked attempt neither counts nor breaks it.
    expect(results).toContain("Average 70% across 2 marked attempts");
  });

  it("lists concepts weakest-first, labelling the anonymous rows", () => {
    const doc = studentRecordToDoc(full, { studentName: "A", tr });
    const section = doc.body.split("## Inferred understanding")[1].split("## Staff notes")[0];
    expect(section.indexOf("Distributivité")).toBeLessThan(section.indexOf("Fractions"));
    expect(section).toContain("…567890");
    expect(section).toContain("1 mindset snapshots · 0 risk assessments · 2 trajectory points");
  });

  it("quotes staff notes with their dates", () => {
    const doc = studentRecordToDoc(full, { studentName: "A", tr });
    expect(doc.body).toContain("Revoir les fractions.");
  });

  it("states the scope and the exclusion, in words a parent understands", () => {
    const doc = studentRecordToDoc(full, { studentName: "A", tr });
    expect(doc.body).toContain(lookup("en", "school.record.scope"));
    expect(doc.body).toContain(lookup("en", "school.record.excludes"));
  });

  it("says plainly when a section is empty, rather than printing nothing", () => {
    const doc = studentRecordToDoc(
      { assessment_results: [], staff_followups: [], cognitive_profile: {}, _errors: [] },
      { studentName: "A", tr },
    );
    expect(doc.body.match(/Nothing recorded yet\./g)).toHaveLength(3);
  });

  it("flags a partial record with the sections that failed", () => {
    const doc = studentRecordToDoc({ ...full, _errors: ["kernel:student_mindset_state"] }, { studentName: "A", tr });
    expect(doc.body).toContain("Incomplete sections: kernel:student_mindset_state");
  });

  it("skips unreadable rows instead of printing blank lines", () => {
    const doc = studentRecordToDoc(
      {
        assessment_results: [{}, null, "x"],
        staff_followups: [{ created_at: "2026-01-01T00:00:00Z" }],
        cognitive_profile: { student_concept_state: [{}] },
        _errors: [],
      },
      { studentName: "A", tr },
    );
    expect(doc.body).not.toMatch(/^-\s*$/m);
    expect(doc.body).not.toContain("undefined");
  });
});
