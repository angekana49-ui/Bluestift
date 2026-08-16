import { describe, it, expect } from "vitest";
import { aggregateAlertsByStudent, type AlertIdentity } from "@/lib/school-admin";

// The kernel returns one row per signal; a teacher needs one row per child.
// This fold is what stands between "3 alerts scrolling past each other" and
// "Amina needs you, for these three reasons".

const IDENTITIES: AlertIdentity[] = [
  { user_id: "u1", first_name: "Amina", last_name: "Diallo", class_id: "c1" },
  { user_id: "u2", first_name: "Tom", last_name: "Bernard", class_id: "c2" },
];
const CLASS_NAMES = new Map([
  ["c1", "3e A"],
  ["c2", "3e B"],
]);

const row = (user_id: string | null, alert_type: string, alert_severity: string) => ({
  user_id,
  alert_type,
  alert_severity,
});

describe("aggregateAlertsByStudent", () => {
  it("gives one line per student, not per signal", () => {
    const out = aggregateAlertsByStudent(
      [
        row("u1", "cognitive_overload", "medium"),
        row("u1", "fixed_mindset", "medium"),
        row("u1", "cognitive_overload", "low"),
      ],
      IDENTITIES,
      CLASS_NAMES,
    );

    expect(out).toHaveLength(1);
    expect(out[0].alertCount).toBe(3);
    // The same signal firing twice is one reason, listed once.
    expect(out[0].alertTypes).toEqual(["Overloaded", "Giving up early"]);
    expect(out[0].name).toBe("Amina D.");
    expect(out[0].className).toBe("3e A");
  });

  it("takes a student's worst signal, never an average", () => {
    // Two low alerts must not bury one high one — averaging would demote a
    // child in real trouble below one who is merely wobbling.
    const out = aggregateAlertsByStudent(
      [
        row("u1", "false_mastery", "low"),
        row("u1", "cognitive_overload", "high"),
        row("u1", "inconsistency_high", "low"),
      ],
      IDENTITIES,
      CLASS_NAMES,
    );
    expect(out[0].riskLevel).toBe("high");
  });

  it("sorts the most urgent student first", () => {
    const out = aggregateAlertsByStudent(
      [row("u1", "false_mastery", "low"), row("u2", "cognitive_overload", "high")],
      IDENTITIES,
      CLASS_NAMES,
    );
    expect(out.map((a) => a.userId)).toEqual(["u2", "u1"]);
  });

  it("drops alerts about children this teacher does not teach", () => {
    // The kernel answers for the roster it was given; if anything else ever
    // comes back, a teacher must not see it.
    const out = aggregateAlertsByStudent(
      [row("u9", "cognitive_overload", "high"), row(null, "fixed_mindset", "high")],
      IDENTITIES,
      CLASS_NAMES,
    );
    expect(out).toEqual([]);
  });

  it("passes an unknown alert type through instead of hiding it", () => {
    // A kernel that grows a new detector must not go silent on this screen
    // just because the app hasn't learned the label yet.
    const out = aggregateAlertsByStudent(
      [row("u1", "brand_new_detector", "high")],
      IDENTITIES,
      CLASS_NAMES,
    );
    expect(out[0].alertTypes).toEqual(["brand_new_detector"]);
    expect(out[0].riskLevel).toBe("high");
  });
});
