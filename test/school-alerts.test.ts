import { describe, it, expect } from "vitest";
import { foldStudentRisk } from "@/lib/kernel/risk";
import { aggregateAlertsByStudent, type AlertIdentity } from "@/lib/school-admin";

// This is the logic that decides what a teacher sees when they open the
// dashboard, so it is checkable without a database on purpose.

let alertSeq = 0;
const alert = (user_id: string | null, alert_type: string, alert_severity: string) => ({
  id: `a${++alertSeq}`,
  user_id,
  alert_type,
  alert_severity,
});
const state = (user_id: string, mastery: number | null, at: string | null) => ({
  user_id,
  mastery_score_effective: mastery,
  last_strong_signal_at: at,
});
const empty = { alerts: [], states: [], mindsets: [], requests: [] };

describe("foldStudentRisk", () => {
  it("takes a student's worst signal, never an average", () => {
    // Two low alerts must not bury one high one — averaging would demote a
    // child in real trouble below one who is merely wobbling.
    const out = foldStudentRisk(["u1"], {
      ...empty,
      alerts: [
        alert("u1", "false_mastery", "low"),
        alert("u1", "cognitive_overload", "high"),
        alert("u1", "inconsistency_high", "low"),
      ],
    });
    expect(out.get("u1")!.riskLevel).toBe("high");
    expect(out.get("u1")!.alertCount).toBe(3);
  });

  it("lists each reason once but counts every signal", () => {
    const out = foldStudentRisk(["u1"], {
      ...empty,
      alerts: [
        alert("u1", "cognitive_overload", "medium"),
        alert("u1", "cognitive_overload", "low"),
        alert("u1", "fixed_mindset", "medium"),
      ],
    });
    const r = out.get("u1")!;
    expect(r.alertTypes).toEqual(["Overloaded", "Giving up early"]);
    expect(r.alertCount).toBe(3);
  });

  it("passes an unknown alert type through instead of hiding it", () => {
    // A kernel that grows a new detector must not go silent on this screen
    // just because the app hasn't learned the label yet.
    const out = foldStudentRisk(["u1"], {
      ...empty,
      alerts: [alert("u1", "brand_new_detector", "high")],
    });
    expect(out.get("u1")!.alertTypes).toEqual(["brand_new_detector"]);
    expect(out.get("u1")!.riskLevel).toBe("high");
  });

  it("averages mastery across KCs and keeps the most recent activity", () => {
    const out = foldStudentRisk(["u1"], {
      ...empty,
      states: [
        state("u1", 0.2, "2026-08-01T00:00:00Z"),
        state("u1", 0.8, "2026-08-09T00:00:00Z"),
        // A KC with no score yet must not drag the average toward zero.
        state("u1", null, "2026-08-05T00:00:00Z"),
      ],
    });
    const r = out.get("u1")!;
    expect(r.avgMastery).toBeCloseTo(0.5);
    expect(r.lastActiveAt).toBe("2026-08-09T00:00:00Z");
  });

  it("returns a row for every student asked about, even a silent one", () => {
    // A child with no activity is not missing data — they are a child who has
    // not engaged, which is exactly what a teacher needs to see.
    const out = foldStudentRisk(["u1", "u2"], { ...empty, alerts: [alert("u1", "fixed_mindset", "high")] });
    expect([...out.keys()].sort()).toEqual(["u1", "u2"]);
    const quiet = out.get("u2")!;
    expect(quiet.alertCount).toBe(0);
    expect(quiet.riskLevel).toBeNull();
    expect(quiet.lastActiveAt).toBeNull();
  });

  it("ignores rows about anyone who was not asked for", () => {
    const out = foldStudentRisk(["u1"], {
      ...empty,
      alerts: [alert("u9", "cognitive_overload", "high"), alert(null, "fixed_mindset", "high")],
      states: [state("u9", 0.9, "2026-08-01T00:00:00Z")],
    });
    expect(out.size).toBe(1);
    expect(out.get("u1")!.alertCount).toBe(0);
  });

  it("counts recent kernel requests as working sessions", () => {
    const out = foldStudentRisk(["u1", "u2"], {
      ...empty,
      requests: [{ user_id: "u1" }, { user_id: "u1" }, { user_id: "u1" }],
    });
    expect(out.get("u1")!.sessionsLast7d).toBe(3);
    // Never asked, never active: null, not 0 — we know nothing rather than zero.
    expect(out.get("u2")!.sessionsLast7d).toBeNull();
  });
});

describe("aggregateAlertsByStudent", () => {
  const IDENTITIES: AlertIdentity[] = [
    { user_id: "u1", first_name: "Amina", last_name: "Diallo", class_id: "c1" },
    { user_id: "u2", first_name: "Tom", last_name: "Bernard", class_id: "c2" },
  ];
  const CLASS_NAMES = new Map([
    ["c1", "3e A"],
    ["c2", "3e B"],
  ]);

  it("lists only students who need attention, most urgent first", () => {
    const risk = foldStudentRisk(["u1", "u2"], {
      ...empty,
      alerts: [alert("u1", "false_mastery", "low"), alert("u2", "cognitive_overload", "high")],
    });
    const out = aggregateAlertsByStudent(risk, IDENTITIES, CLASS_NAMES);
    expect(out.map((a) => a.userId)).toEqual(["u2", "u1"]);
    expect(out[0].className).toBe("3e B");
    expect(out[1].name).toBe("Amina D.");
  });

  it("leaves out students with no open signal", () => {
    // The panel answers "who needs you", not "who is enrolled".
    const risk = foldStudentRisk(["u1", "u2"], {
      ...empty,
      alerts: [alert("u1", "fixed_mindset", "medium")],
      states: [state("u2", 0.95, "2026-08-09T00:00:00Z")],
    });
    const out = aggregateAlertsByStudent(risk, IDENTITIES, CLASS_NAMES);
    expect(out.map((a) => a.userId)).toEqual(["u1"]);
  });

  it("carries every open alert id, so acknowledging clears the whole line", () => {
    // The row aggregates N alerts. If it only carried one id, pressing "Seen"
    // would close one and leave the student sitting in the list looking
    // unacknowledged — so staff would stop trusting the button.
    const risk = foldStudentRisk(["u1"], {
      ...empty,
      alerts: [
        alert("u1", "cognitive_overload", "high"),
        alert("u1", "fixed_mindset", "medium"),
      ],
    });
    const out = aggregateAlertsByStudent(risk, IDENTITIES, CLASS_NAMES);
    expect(out[0].alertIds).toHaveLength(2);
    expect(out[0].alertIds).toEqual(risk.get("u1")!.alertIds);
  });

  it("carries mastery through so the teacher sees the number too", () => {
    const risk = foldStudentRisk(["u1"], {
      ...empty,
      alerts: [alert("u1", "cognitive_overload", "high")],
      states: [state("u1", 0.4, null)],
    });
    const out = aggregateAlertsByStudent(risk, IDENTITIES, CLASS_NAMES);
    expect(out[0].avgMastery).toBeCloseTo(0.4);
  });
});
