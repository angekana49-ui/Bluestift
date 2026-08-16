import "server-only";
import { createKernelAdminClient } from "@/lib/supabase/admin";

/**
 * One live risk picture per student, for the school dashboards.
 *
 * WHY THIS EXISTS
 *
 * Six call sites used to read `kernel.student_risk_assessments`. Nothing writes
 * that table — not this app, not the kernel — so every one of them silently
 * reported that no child needed attention. The columns it promised all have
 * live sources, and this module reads those instead:
 *
 *   risk_level / status_label  ← kernel_monitoring alerts (the anomaly layer)
 *   avg_mastery                ← student_concept_state.mastery_score_effective
 *   mindset_score              ← student_mindset_state.m_score
 *   last_active_at             ← max(student_concept_state.last_strong_signal_at)
 *   sessions_last_7d           ← kernel_requests in the last 7 days
 *
 * WHY IT READS THE DATABASE AND NOT THE KERNEL'S HTTP API
 *
 * The kernel exposes /load_alerts, and it is the right door for anyone who does
 * not share this database. This app does share it. Going over HTTP here would
 * mean a teacher opening a dashboard wakes a sleeping container — the kernel
 * runs on Railway with app-sleeping enabled, so that is a billed wake-up per
 * page view — and the screen would break whenever the kernel is asleep or
 * degraded. Reading the schema we already own costs nothing and always works.
 *
 * The coupling this creates is the one the kernel handoff §6 already warns
 * about: the alert filter below (`level='alert'`, unresolved) duplicates the
 * kernel's own. Keep it to that one line, and keep it in this file only.
 */

export type StudentRisk = {
  userId: string;
  /** Severity of the student's WORST open signal — never an average. */
  riskLevel: "high" | "medium" | "low" | null;
  statusLabel: string | null;
  alertTypes: string[];
  alertCount: number;
  /** The open alert rows behind this line, so staff can acknowledge them. */
  alertIds: string[];
  avgMastery: number | null;
  mindsetScore: number | null;
  lastActiveAt: string | null;
  sessionsLast7d: number | null;
};

/** Plain-language names for the kernel's alert types (kernel-handoff §4). */
export const ALERT_LABELS: Record<string, string> = {
  cognitive_overload: "Overloaded",
  fixed_mindset: "Giving up early",
  passive_dependency: "Leaning on answers",
  false_mastery: "Mastery may be false",
  re_emergence_error: "Fails in harder contexts",
  inconsistency_high: "Unstable estimate",
  ood_distribution: "Doesn't match the cohort",
};

export const SEVERITY_RANK: Record<string, number> = { high: 0, medium: 1, low: 2 };

type AlertRow = {
  id: string;
  user_id: string | null;
  alert_type: string | null;
  alert_severity: string | null;
};
type StateRow = { user_id: string; mastery_score_effective: number | null; last_strong_signal_at: string | null };
type MindsetRow = { user_id: string; m_score: number | null };
type RequestRow = { user_id: string };

/**
 * Fold raw kernel rows into one risk picture per student.
 *
 * Exported for tests: this is the logic that decides what a teacher sees, and
 * it should be checkable without a database.
 */
export function foldStudentRisk(
  userIds: string[],
  rows: { alerts: AlertRow[]; states: StateRow[]; mindsets: MindsetRow[]; requests: RequestRow[] },
): Map<string, StudentRisk> {
  const out = new Map<string, StudentRisk>();
  const wanted = new Set(userIds);
  for (const userId of wanted) {
    out.set(userId, {
      userId,
      riskLevel: null,
      statusLabel: null,
      alertTypes: [],
      alertCount: 0,
      alertIds: [],
      avgMastery: null,
      mindsetScore: null,
      lastActiveAt: null,
      sessionsLast7d: null,
    });
  }

  for (const a of rows.alerts) {
    const entry = a.user_id ? out.get(a.user_id) : undefined;
    if (!entry || !a.alert_type) continue;
    entry.alertCount += 1;
    entry.alertIds.push(a.id);
    const severity = a.alert_severity ?? "low";
    if ((SEVERITY_RANK[severity] ?? 3) < (SEVERITY_RANK[entry.riskLevel ?? ""] ?? 3)) {
      entry.riskLevel = severity as StudentRisk["riskLevel"];
    }
    const label = ALERT_LABELS[a.alert_type] ?? a.alert_type;
    if (!entry.alertTypes.includes(label)) entry.alertTypes.push(label);
    entry.statusLabel = entry.alertTypes[0] ?? null;
  }

  const mastery = new Map<string, { sum: number; n: number }>();
  for (const s of rows.states) {
    const entry = out.get(s.user_id);
    if (!entry) continue;
    if (s.mastery_score_effective != null) {
      const m = mastery.get(s.user_id) ?? { sum: 0, n: 0 };
      m.sum += s.mastery_score_effective;
      m.n += 1;
      mastery.set(s.user_id, m);
    }
    // Most recent strong signal across every KC = when this child last did
    // something the kernel could learn from.
    if (s.last_strong_signal_at && (!entry.lastActiveAt || s.last_strong_signal_at > entry.lastActiveAt)) {
      entry.lastActiveAt = s.last_strong_signal_at;
    }
  }
  for (const [userId, m] of mastery) {
    const entry = out.get(userId);
    if (entry && m.n > 0) entry.avgMastery = m.sum / m.n;
  }

  for (const m of rows.mindsets) {
    const entry = out.get(m.user_id);
    if (entry) entry.mindsetScore = m.m_score;
  }

  // A kernel request is one analysis, which stands in for one working session.
  // It is a proxy, not a session counter — name it that way wherever it shows.
  for (const r of rows.requests) {
    const entry = out.get(r.user_id);
    if (entry) entry.sessionsLast7d = (entry.sessionsLast7d ?? 0) + 1;
  }

  return out;
}

/**
 * Which student an alert is about, or null if there is no such alert.
 *
 * An alert id is an opaque UUID a caller could guess or copy, so knowing it
 * proves nothing. Before acting on one, resolve its owner here and check that
 * student is on the caller's own roster — otherwise a teacher could close an
 * alert raised about a child in another school.
 */
export async function getAlertOwner(alertId: string): Promise<string | null> {
  const kernel = createKernelAdminClient();
  const { data } = await kernel
    .from("kernel_monitoring")
    .select("user_id")
    .eq("id", alertId)
    .eq("level", "alert")
    .maybeSingle();
  return (data as { user_id: string | null } | null)?.user_id ?? null;
}

/**
 * Live risk rows for a set of students. Throws when the kernel schema is
 * unreachable — callers must distinguish "nobody at risk" from "we don't know",
 * and an empty map cannot carry that difference.
 */
export async function getStudentRisk(userIds: string[]): Promise<Map<string, StudentRisk>> {
  const ids = [...new Set(userIds)];
  if (ids.length === 0) return new Map();

  const kernel = createKernelAdminClient();
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [alerts, states, mindsets, requests] = await Promise.all([
    kernel
      .from("kernel_monitoring")
      .select("id, user_id, alert_type, alert_severity")
      // The one line duplicated from the kernel's own filter. See the note above.
      .eq("level", "alert")
      .eq("resolved", false)
      .in("user_id", ids),
    kernel
      .from("student_concept_state")
      .select("user_id, mastery_score_effective, last_strong_signal_at")
      .in("user_id", ids),
    kernel.from("student_mindset_state").select("user_id, m_score").in("user_id", ids),
    kernel.from("kernel_requests").select("user_id").in("user_id", ids).gte("created_at", weekAgo),
  ]);

  return foldStudentRisk(ids, {
    alerts: (alerts.data as AlertRow[] | null) ?? [],
    states: (states.data as StateRow[] | null) ?? [],
    mindsets: (mindsets.data as MindsetRow[] | null) ?? [],
    requests: (requests.data as RequestRow[] | null) ?? [],
  });
}
