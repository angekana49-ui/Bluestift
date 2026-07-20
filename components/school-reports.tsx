"use client";

import { useEffect, useState } from "react";
import { downloadText, downloadPdf } from "@/lib/export";
import { useAppTheme } from "@/components/ui/theme";
import { panelCard, textInput, ctaButton, ghostButton } from "@/components/ui/forms";

type ReportItem = { id: string | null; title: string; scope: string | null; content: string; createdAt: string };
type ClassOpt = { id: string; name: string };
type SubjectOpt = { id: string; name: string; code: string | null };
type Scope = "subject" | "class" | "school";

export function SchoolReports({ classes }: { classes: ClassOpt[] }) {
  const { theme: t } = useAppTheme();
  const box = panelCard(t);
  const btn = ctaButton(t);
  const ghost = ghostButton(t);
  const select = textInput(t);
  const [scope, setScope] = useState<Scope>("school");
  const [classId, setClassId] = useState(classes[0]?.id ?? "");
  const [subjects, setSubjects] = useState<SubjectOpt[]>([]);
  const [subjectId, setSubjectId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [current, setCurrent] = useState<ReportItem | null>(null);
  const [reports, setReports] = useState<ReportItem[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const data = await (await fetch("/api/school/reports")).json();
        if (Array.isArray(data.reports)) setReports(data.reports as ReportItem[]);
        if (Array.isArray(data.subjects)) {
          setSubjects(data.subjects as SubjectOpt[]);
          setSubjectId((data.subjects[0] as SubjectOpt | undefined)?.id ?? "");
        }
      } catch {
        // best-effort list
      }
    })();
  }, []);

  async function generate() {
    if (busy) return;
    if (scope === "class" && !classId) {
      setError("Pick a class first.");
      return;
    }
    if (scope === "subject" && !subjectId) {
      setError("Pick a subject first.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const data = await (
        await fetch("/api/school/reports", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            scope,
            classId: scope === "class" ? classId : undefined,
            subjectId: scope === "subject" ? subjectId : undefined,
          }),
        })
      ).json();
      if (data.error) {
        setError(data.error);
        return;
      }
      const item = data as ReportItem;
      setCurrent(item);
      setReports((r) => [item, ...r]);
    } catch {
      setError("Could not generate the report.");
    } finally {
      setBusy(false);
    }
  }

  const baseName = (current?.title ?? "report").replace(/[^\w]+/g, "-").slice(0, 40);

  return (
    <div>
      <div style={box}>
        <h2 style={{ fontSize: "1.1rem", margin: "0 0 0.75rem" }}>Generate a report</h2>
        <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap", alignItems: "center" }}>
          <select style={select} value={scope} onChange={(e) => setScope(e.target.value as Scope)} disabled={busy}>
            <option value="subject">By subject</option>
            <option value="class">By class</option>
            <option value="school">Whole school</option>
          </select>
          {scope === "class" && (
            <select style={select} value={classId} onChange={(e) => setClassId(e.target.value)} disabled={busy}>
              {classes.length === 0 && <option value="">No classes</option>}
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          )}
          {scope === "subject" && (
            <select style={select} value={subjectId} onChange={(e) => setSubjectId(e.target.value)} disabled={busy}>
              {subjects.length === 0 && <option value="">No subjects yet</option>}
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          )}
          <button style={{ ...btn, opacity: busy ? 0.7 : 1 }} onClick={generate} disabled={busy}>
            {busy ? "Generating…" : "Generate"}
          </button>
        </div>
        {error && <p style={{ color: "#f87171", margin: "0.75rem 0 0" }}>{error}</p>}
      </div>

      {current && (
        <div style={box}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <h3 style={{ margin: 0, flex: 1 }}>{current.title}</h3>
            <button style={ghost} onClick={() => downloadText(baseName, current.content)}>
              TXT
            </button>
            <button style={ghost} onClick={() => downloadPdf(baseName, current.title, current.content)}>
              PDF
            </button>
            <button style={ghost} title="Close" onClick={() => setCurrent(null)}>
              ✕
            </button>
          </div>
          <p style={{ whiteSpace: "pre-wrap", lineHeight: 1.55, marginBottom: 0 }}>{current.content}</p>
        </div>
      )}

      {reports.length > 0 && (
        <div style={box}>
          <h3 style={{ marginTop: 0 }}>Past reports</h3>
          {reports.map((r, i) => (
            <div key={r.id ?? i} style={{ display: "flex", gap: "0.5rem", alignItems: "center", padding: "0.35rem 0" }}>
              <span style={{ flex: 1 }}>{r.title}</span>
              <span style={{ opacity: 0.5, fontSize: "0.8rem" }}>{new Date(r.createdAt).toLocaleDateString()}</span>
              <button style={ghost} onClick={() => setCurrent(r)}>
                View
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
