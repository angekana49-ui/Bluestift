"use client";

import { useEffect, useState } from "react";
import { useAppTheme } from "@/components/ui/theme";
import { getJsonCached } from "@/lib/net/client-fetch";
import { panelCard, ctaButton, ghostButton, textInput } from "@/components/ui/forms";
import { KpiTile } from "@/components/ui/widgets";
import { InstructionsPanel } from "@/components/school/class-instructions";
import { RayaName } from "@/components/ui/brand";
import { useTranslate } from "@/components/ui/locale";

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
 * straight into Focus, an Instructions-to-Raya card (per class), and quick links
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
  const tr = useTranslate();
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
      // Cached first: this is the teacher's landing tab, so it's the page most
      // worth rendering instantly from the last known KPIs while it reconciles.
      const { data } = await getJsonCached<{ overview?: Overview }>("/api/school/prof-overview", {
        cacheKey: "school:profOverview",
        onUpdate: (fresh) => {
          if (alive && fresh.overview) setOv(fresh.overview);
        },
      });
      if (alive) {
        if (data?.overview) setOv(data.overview);
        setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const classCount = ov?.classCount ?? classes.length;
  const studentCount = ov?.studentCount ?? classes.reduce((a, c) => a + (c.studentCount ?? 0), 0);
  const alertCount = ov?.alertCount ?? 0;

  const firstName = teacherName.trim().split(/\s+/)[0] || tr("school.profOverview.thereFallback");

  return (
    <div>
      <div style={{ ...box, display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ flex: 1 }}>
          <h2 style={{ fontSize: "1.15rem", margin: 0 }}>{tr("school.profOverview.welcomeBack")} {firstName}</h2>
          <p style={{ margin: "4px 0 0", opacity: 0.6, fontSize: "0.85rem" }}>
            {tr("school.profOverview.subtitle")}
          </p>
        </div>
        <button style={btn} onClick={() => onGoto("prepare")}>
          {tr("school.profOverview.prepareMaterial")}
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: 12, marginBottom: 18 }}>
        <KpiTile theme={t} label={tr("nav.classes")} value={classCount} shine />
        <KpiTile theme={t} label={tr("school.overview.kpiStudents")} value={studentCount} shine />
        <KpiTile theme={t} label={tr("school.profOverview.kpiNeedAttention")} value={alertCount} />
      </div>

      <div style={box}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
          <h3 style={{ margin: 0, flex: 1 }}>{tr("school.profOverview.studentsToFocusOn")}</h3>
          <button style={ghost} onClick={() => onGoto("focus")}>
            {tr("school.profOverview.openFocusArrow")}
          </button>
        </div>
        {loading ? (
          <p style={{ opacity: 0.55, fontSize: "0.85rem", margin: 0 }}>{tr("school.loading")}</p>
        ) : !ov || ov.alerts.length === 0 ? (
          <p style={{ opacity: 0.55, fontSize: "0.85rem", margin: 0 }}>
            {tr("school.insights.noneNeedAttention")}
          </p>
        ) : (
          ov.alerts.slice(0, 6).map((a) => (
            <div key={`${a.classId}:${a.userId}`} style={{ display: "flex", alignItems: "center", gap: "0.6rem", padding: "0.35rem 0" }}>
              <span style={{ width: 8, height: 8, borderRadius: 999, background: riskColor(a.riskLevel), flexShrink: 0 }} />
              <span style={{ flex: 1, minWidth: 0 }}>
                {a.name}
                <span style={{ opacity: 0.5, fontSize: "0.8rem" }}>
                  {" "}
                  · {a.className} · {a.statusLabel ?? tr("school.insights.atRiskFallback")} · {pctOrDash(a.avgMastery)}
                </span>
              </span>
              <button style={ghost} onClick={() => onOpenStudent(a.classId, a.userId)}>
                {tr("school.profOverview.focusArrow")}
              </button>
            </div>
          ))
        )}
      </div>

      <div style={box}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.6rem", flexWrap: "wrap" }}>
          <h3 style={{ margin: 0, flex: 1 }}>{tr("school.profOverview.steerRayaPrefix")} <RayaName /> {tr("school.profOverview.forAClass")}</h3>
          <select style={input} value={instrClassId} onChange={(e) => setInstrClassId(e.target.value)}>
            {classes.length === 0 && <option value="">{tr("school.team.noClassesOption")}</option>}
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
            {tr("school.profOverview.noAssignedClassesYet")}
          </p>
        )}
      </div>

      <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
        <button style={ghost} onClick={() => onGoto("prepare")}>
          {tr("school.profOverview.prepareExamOrExercise")}
        </button>
        <button style={ghost} onClick={() => onGoto("reports")}>
          {tr("school.profOverview.generateClassReport")}
        </button>
      </div>
    </div>
  );
}
