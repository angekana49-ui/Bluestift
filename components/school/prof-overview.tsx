"use client";

import { useEffect, useState } from "react";
import { useAppTheme } from "@/components/ui/theme";
import { panelCard, ctaButton, ghostButton, textInput } from "@/components/ui/forms";
import { KpiTile } from "@/components/ui/widgets";
import { InstructionsPanel } from "@/components/school/class-instructions";

type ClassOpt = { id: string; name: string; studentCount?: number };
type Alert = {
  userId: string;
  classId: string;
  className: string;
  name: string;
  riskLevel: string | null;
  statusLabel: string | null;
  avgMastery: number | null;
};
type Overview = {
  classCount: number;
  studentCount: number;
  alertCount: number;
  classes: { id: string; name: string; studentCount: number }[];
  alerts: Alert[];
};

const pctOrDash = (v: number | null) => (v == null ? "—" : `${Math.round(v * 100)}%`);
const riskColor = (level: string | null) =>
  level === "high" ? "#ef4444" : level === "medium" || level === "med" ? "#f59e0b" : "#22c55e";

/**
 * The teacher's home: KPIs across their classes, an at-risk feed that jumps
 * straight into Focus, an Instructions-to-RAYA card (per class), and quick links
 * to Prepare / Reports. Everything degrades gracefully when the Kernel is down.
 */
export function ProfOverviewView({
  classes,
  teacherName,
  onOpenStudent,
  onGoto,
}: {
  classes: ClassOpt[];
  teacherName: string;
  onOpenStudent: (classId: string, userId: string) => void;
  onGoto: (tab: "focus" | "prepare" | "reports") => void;
}) {
  const { theme: t } = useAppTheme();
  const box = panelCard(t);
  const btn = ctaButton(t);
  const ghost = ghostButton(t);
  const input = textInput(t);

  const [ov, setOv] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [instrClassId, setInstrClassId] = useState(classes[0]?.id ?? "");

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const d = await (await fetch("/api/school/prof-overview")).json();
        if (alive && d.overview) setOv(d.overview as Overview);
      } catch {
        // KPIs degrade to the class props below
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const classCount = ov?.classCount ?? classes.length;
  const studentCount = ov?.studentCount ?? classes.reduce((a, c) => a + (c.studentCount ?? 0), 0);
  const alertCount = ov?.alertCount ?? 0;

  const firstName = teacherName.trim().split(/\s+/)[0] || "there";

  return (
    <div>
      <div style={{ ...box, display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ flex: 1 }}>
          <h2 style={{ fontSize: "1.15rem", margin: 0 }}>Welcome back, {firstName}</h2>
          <p style={{ margin: "4px 0 0", opacity: 0.6, fontSize: "0.85rem" }}>
            Your teaching home — students, alerts, and what to work on next.
          </p>
        </div>
        <button style={btn} onClick={() => onGoto("prepare")}>
          Prepare material
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: 12, marginBottom: 18 }}>
        <KpiTile theme={t} label="Classes" value={classCount} shine />
        <KpiTile theme={t} label="Students" value={studentCount} shine />
        <KpiTile theme={t} label="Need attention" value={alertCount} />
      </div>

      <div style={box}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
          <h3 style={{ margin: 0, flex: 1 }}>Students to focus on</h3>
          <button style={ghost} onClick={() => onGoto("focus")}>
            Open Focus →
          </button>
        </div>
        {loading ? (
          <p style={{ opacity: 0.55, fontSize: "0.85rem", margin: 0 }}>Loading…</p>
        ) : !ov || ov.alerts.length === 0 ? (
          <p style={{ opacity: 0.55, fontSize: "0.85rem", margin: 0 }}>
            No students need attention right now.
          </p>
        ) : (
          ov.alerts.slice(0, 6).map((a) => (
            <div key={`${a.classId}:${a.userId}`} style={{ display: "flex", alignItems: "center", gap: "0.6rem", padding: "0.35rem 0" }}>
              <span style={{ width: 8, height: 8, borderRadius: 999, background: riskColor(a.riskLevel), flexShrink: 0 }} />
              <span style={{ flex: 1, minWidth: 0 }}>
                {a.name}
                <span style={{ opacity: 0.5, fontSize: "0.8rem" }}>
                  {" "}
                  · {a.className} · {a.statusLabel ?? "at risk"} · {pctOrDash(a.avgMastery)}
                </span>
              </span>
              <button style={ghost} onClick={() => onOpenStudent(a.classId, a.userId)}>
                Focus →
              </button>
            </div>
          ))
        )}
      </div>

      <div style={box}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.6rem", flexWrap: "wrap" }}>
          <h3 style={{ margin: 0, flex: 1 }}>Steer RAYA for a class</h3>
          <select style={input} value={instrClassId} onChange={(e) => setInstrClassId(e.target.value)}>
            {classes.length === 0 && <option value="">No classes</option>}
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        {instrClassId ? (
          <InstructionsPanel classId={instrClassId} />
        ) : (
          <p style={{ opacity: 0.55, fontSize: "0.85rem", margin: 0 }}>
            You have no assigned classes yet.
          </p>
        )}
      </div>

      <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
        <button style={ghost} onClick={() => onGoto("prepare")}>
          Prepare an exam or exercise
        </button>
        <button style={ghost} onClick={() => onGoto("reports")}>
          Generate a class report
        </button>
      </div>
    </div>
  );
}
