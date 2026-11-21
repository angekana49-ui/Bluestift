"use client";

import { useState } from "react";
import { useAppTheme } from "@/components/ui/theme";
import { ghostButton } from "@/components/ui/forms";
import { useTranslate } from "@/components/ui/locale";
import { netFetch } from "@/lib/net/client-fetch";
import { downloadBrandedPdf, downloadBrandedText } from "@/lib/document";
import { studentRecordToDoc } from "@/lib/school-record-doc";

/**
 * The student record's downloads: TXT and PDF first, JSON kept discreet.
 *
 * The record used to download as a raw JSON file — the complete original, and
 * unreadable to the non-technical staff and parents it is for. TXT/PDF render
 * the same record through the shared branded exporter (logo, title, footer),
 * composed by lib/school-record-doc.ts. The JSON link stays for the
 * machine-readable original, secondary by placement and size.
 *
 * Each download fetches the record once (and the server logs one FERPA
 * disclosure per serve, exactly as when the JSON link was the only option).
 */
export function StudentRecordActions({
  classId,
  userId,
  studentName,
  className,
  schoolName,
}: {
  classId: string;
  userId: string;
  studentName: string;
  className?: string;
  schoolName?: string;
}) {
  const { theme: t } = useAppTheme();
  const tr = useTranslate();
  const ghost = ghostButton(t);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const href = `/api/school/student/record?classId=${encodeURIComponent(classId)}&userId=${encodeURIComponent(userId)}`;

  async function save(kind: "txt" | "pdf") {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await netFetch(href, { method: "GET" }, { timeoutMs: 30_000 });
      const record = (await res.json().catch(() => null)) as Record<string, unknown> | null;
      if (!res.ok || !record || typeof record !== "object") throw new Error("record");
      const doc = studentRecordToDoc(record, { studentName, className, schoolName, tr });
      if (kind === "txt") await downloadBrandedText(doc);
      else await downloadBrandedPdf(doc);
    } catch {
      setError(tr("artifact.actionFailed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8, marginLeft: "auto", flexWrap: "wrap", justifyContent: "flex-end" }}>
      <button type="button" style={{ ...ghost, opacity: busy ? 0.6 : 1 }} onClick={() => void save("txt")} disabled={busy} title={tr("school.student.downloadRecordTitle")}>
        {busy ? "…" : "TXT"}
      </button>
      <button type="button" style={{ ...ghost, opacity: busy ? 0.6 : 1 }} onClick={() => void save("pdf")} disabled={busy} title={tr("school.student.downloadRecordTitle")}>
        {busy ? "…" : "PDF"}
      </button>
      <a href={href} style={{ ...ghost, textDecoration: "none", fontSize: "0.8rem", opacity: 0.75 }} title={tr("school.student.downloadRecordTitle")}>
        JSON
      </a>
      {error && <span style={{ fontSize: "0.8rem", color: "#f87171", flexBasis: "100%", textAlign: "right" }}>{error}</span>}
    </span>
  );
}
