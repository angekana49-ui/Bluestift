"use client";

import { useEffect, useState } from "react";
import type { ClassInsight, SchoolSubject, Simulation } from "@/lib/school-admin";
import { useAppTheme } from "@/components/ui/theme";
import { panelCard, textInput, ctaButton, ghostButton } from "@/components/ui/forms";
import { downloadBrandedPdf, type BrandedDoc } from "@/lib/document";

const pct = (v: number | null) => (v == null ? "—" : `${Math.round(v * 100)}%`);

type SchoolClass = { id: string; name: string };

/** Compose the certified insights + simulations into a branded Markdown document. */
function insightsToDoc(insights: ClassInsight[], sims: Simulation[], schoolName?: string): BrandedDoc {
  const lines: string[] = ["# Kernel insights"];
  if (insights.length === 0) lines.push("No certified insights yet.");
  for (const i of insights) {
    lines.push(`## ${i.className} · ${i.subjectName}`);
    lines.push(`- Average mastery: ${pct(i.avgMastery)}`);
    if (i.masteryTrend != null) lines.push(`- Trend: ${i.masteryTrend >= 0 ? "+" : ""}${Math.round(i.masteryTrend * 100)}%`);
    if (i.topGaps.length > 0) lines.push(`- Top gaps: ${i.topGaps.slice(0, 6).join(", ")}`);
    if (i.topRecommendation) lines.push(`- Recommendation: ${i.topRecommendation}`);
  }
  if (sims.length > 0) {
    lines.push("# What-if simulations");
    for (const s of sims) {
      const p = (s.parameters ?? {}) as { subjectName?: string; className?: string | null; addHours?: number; focus?: string | null };
      const r = (s.result ?? {}) as { projected_mastery_pct?: number | null; summary?: string };
      const head = `+${p.addHours ?? 0}h/week · ${p.subjectName ?? "subject"}${p.className ? ` · ${p.className}` : ""}${p.focus ? ` · ${p.focus}` : ""}`;
      lines.push(`## ${head}`);
      if (r.projected_mastery_pct != null) lines.push(`- Projected mastery: ${r.projected_mastery_pct}%`);
      if (r.summary) lines.push(`- ${r.summary}`);
    }
  }
  return {
    brand: "bluestift",
    title: "Kernel insights",
    meta: new Date().toLocaleDateString(),
    audience: schoolName,
    body: lines.join("\n"),
  };
}

export function SchoolInsights({ schoolName }: { schoolName?: string }) {
  const { theme: t } = useAppTheme();
  const box = panelCard(t);
  const input = textInput(t);
  const btn = ctaButton(t);
  const ghost = ghostButton(t);
  const [insights, setInsights] = useState<ClassInsight[]>([]);
  const [subjects, setSubjects] = useState<SchoolSubject[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [sims, setSims] = useState<Simulation[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [subjectId, setSubjectId] = useState("");
  const [classId, setClassId] = useState(""); // "" = all classes
  const [addHours, setAddHours] = useState(2);
  const [focus, setFocus] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [ins, sim] = await Promise.all([
          (await fetch("/api/school/insights")).json(),
          (await fetch("/api/school/simulations")).json(),
        ]);
        setInsights(ins.insights ?? []);
        setSubjects(ins.subjects ?? []);
        setClasses(ins.classes ?? []);
        setSubjectId((ins.subjects?.[0] as SchoolSubject | undefined)?.id ?? "");
        setSims(sim.simulations ?? []);
      } catch {
        setError("Could not load insights.");
      }
    })();
  }, []);

  async function runSimulation(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !subjectId) {
      if (!subjectId) setError("Pick a subject first.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/school/simulations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ subjectId, classId: classId || null, addHours, focus }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ?? `Request failed (${res.status}).`);
        return;
      }
      setSims((s) => [data as Simulation, ...s]);
    } catch {
      setError("Could not run the simulation.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      {error && <p style={{ color: "#f87171" }}>{error}</p>}

      {/* Kernel insights */}
      <div style={box}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <h3 style={{ margin: 0, flex: 1 }}>Kernel insights</h3>
          {(insights.length > 0 || sims.length > 0) && (
            <button style={ghost} onClick={() => downloadBrandedPdf(insightsToDoc(insights, sims, schoolName))}>
              Download PDF
            </button>
          )}
        </div>
        <p style={{ opacity: 0.55, fontSize: "0.8rem", margin: "0.5rem 0 0.75rem" }}>
          Certified by the Cognitive Kernel · read-only.
        </p>
        {insights.length === 0 ? (
          <p style={{ margin: 0, opacity: 0.65 }}>
            No insights yet — they appear once the Kernel has processed enough activity in your classes.
          </p>
        ) : (
          insights.map((i) => (
            <div key={i.id} style={{ borderTop: `1px solid ${t.cardBorder}`, padding: "0.6rem 0" }}>
              <div style={{ display: "flex", gap: "0.5rem", alignItems: "baseline" }}>
                <strong style={{ flex: 1 }}>
                  {i.className} · {i.subjectName}
                </strong>
                <span style={{ opacity: 0.7, fontSize: "0.85rem" }}>avg mastery {pct(i.avgMastery)}</span>
                {i.masteryTrend != null && (
                  <span style={{ fontSize: "0.8rem", color: i.masteryTrend >= 0 ? "#22c55e" : "#f87171" }}>
                    {i.masteryTrend >= 0 ? "▲" : "▼"} {Math.abs(Math.round(i.masteryTrend * 100))}%
                  </span>
                )}
              </div>
              {i.topGaps.length > 0 && (
                <div style={{ fontSize: "0.85rem", opacity: 0.8, marginTop: "0.25rem" }}>
                  Top gaps: {i.topGaps.slice(0, 4).join(", ")}
                </div>
              )}
              {i.topRecommendation && (
                <div style={{ fontSize: "0.85rem", opacity: 0.7, marginTop: "0.2rem" }}>💡 {i.topRecommendation}</div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Simulation */}
      <div style={box}>
        <h3 style={{ marginTop: 0 }}>What-if simulation</h3>
        <p style={{ opacity: 0.55, fontSize: "0.8rem", margin: "0 0 0.75rem" }}>
          Projects a plausible outcome from the certified baseline. An estimate, not a Kernel guarantee.
        </p>
        <form onSubmit={runSimulation} style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
          <select style={input} value={subjectId} onChange={(e) => setSubjectId(e.target.value)} disabled={busy}>
            {subjects.length === 0 && <option value="">No subjects</option>}
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <select style={input} value={classId} onChange={(e) => setClassId(e.target.value)} disabled={busy}>
            <option value="">All classes</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <label style={{ fontSize: "0.85rem", opacity: 0.7 }}>
            +
            <input
              type="number"
              min={0}
              max={20}
              value={addHours}
              onChange={(e) => setAddHours(Number(e.target.value))}
              style={{ ...input, width: 60, margin: "0 0.35rem" }}
              disabled={busy}
            />
            h/week
          </label>
          <input
            style={{ ...input, flex: 1, minWidth: 160 }}
            placeholder="Focus (optional, e.g. the discriminant)"
            value={focus}
            onChange={(e) => setFocus(e.target.value)}
            disabled={busy}
          />
          <button type="submit" style={{ ...btn, opacity: busy ? 0.7 : 1 }} disabled={busy}>
            {busy ? "Running…" : "Run"}
          </button>
        </form>

        {sims.map((s) => (
          <SimulationCard key={s.id ?? s.createdAt} sim={s} />
        ))}
      </div>
    </div>
  );
}

function SimulationCard({ sim }: { sim: Simulation }) {
  const { theme: t } = useAppTheme();
  const p = sim.parameters as {
    subjectName?: string;
    className?: string | null;
    addHours?: number;
    focus?: string | null;
  };
  const r = (sim.result ?? {}) as {
    projected_mastery_pct?: number | null;
    confidence?: string;
    summary?: string;
    assumptions?: string[];
    risks?: string[];
  };
  return (
    <div style={{ border: `1px solid ${t.cardBorder}`, borderRadius: 12, padding: "0.75rem", marginTop: "0.75rem", background: t.cardBg }}>
      <div style={{ display: "flex", gap: "0.5rem", alignItems: "baseline" }}>
        <strong style={{ flex: 1 }}>
          +{p.addHours ?? 0}h/week · {p.subjectName ?? "subject"}
          {p.className ? ` · ${p.className}` : ""}
          {p.focus ? ` · ${p.focus}` : ""}
        </strong>
        {r.projected_mastery_pct != null && (
          <span style={{ fontWeight: 700 }}>→ {r.projected_mastery_pct}%</span>
        )}
        {r.confidence && (
          <span style={{ fontSize: "0.75rem", opacity: 0.6 }}>conf. {r.confidence}</span>
        )}
      </div>
      {r.summary && <p style={{ margin: "0.4rem 0 0", fontSize: "0.9rem", lineHeight: 1.5 }}>{r.summary}</p>}
      {r.risks && r.risks.length > 0 && (
        <p style={{ margin: "0.35rem 0 0", fontSize: "0.82rem", opacity: 0.7 }}>Risks: {r.risks.join("; ")}</p>
      )}
    </div>
  );
}
