"use client";

import { useEffect, useState } from "react";
import { useAppTheme } from "@/components/ui/theme";
import { netFetch, getJsonCached, invalidateCached } from "@/lib/net/client-fetch";
import { panelCard, textInput, ctaButton, ghostButton } from "@/components/ui/forms";
import { RayaName } from "@/components/ui/brand";
import { useTranslate } from "@/components/ui/locale";

type Instruction = {
  id: string;
  content: string;
  isActive: boolean;
  subjectId: string | null;
  subjectName: string | null;
};
type SubjectOpt = { id: string; name: string };

async function postJson(url: string, body: unknown, method = "POST") {
  const res = await netFetch(
    url,
    {
      method,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    },
    { timeoutMs: 15_000 },
  );
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error ?? `Request failed (${res.status}).`);
  return data;
}

/**
 * Teacher instructions that steer Raya for one class. Access is gated server-side
 * by assertClassAccess (admin_master, or a prof assigned to the class). Active
 * instructions reach the class's students as guardrail-subordinate guidance in
 * their solo /chat prompt (via getStudentRecommendations) — never a command that
 * gives answers away. Shared here so both the Classes drill-down and the Overview
 * can surface it without a circular import back into school-admin.tsx.
 */
export function InstructionsPanel({ classId }: { classId: string }) {
  const { theme: t } = useAppTheme();
  const tr = useTranslate();
  const box = panelCard(t);
  const input = textInput(t);
  const btn = ctaButton(t);
  const ghost = ghostButton(t);

  const [items, setItems] = useState<Instruction[]>([]);
  const [subjects, setSubjects] = useState<SubjectOpt[]>([]);
  const [content, setContent] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const apply = (d: { instructions?: Instruction[]; subjects?: SubjectOpt[] }) => {
      if (!alive) return;
      setItems(d.instructions ?? []);
      setSubjects(d.subjects ?? []);
    };
    (async () => {
      // Cached first: reopening the same class's panel renders its known
      // instructions instantly instead of a blank list every time.
      const { data } = await getJsonCached<{ instructions?: Instruction[]; subjects?: SubjectOpt[] }>(
        `/api/school/instructions?classId=${encodeURIComponent(classId)}`,
        { cacheKey: `school:instructions:${classId}`, onUpdate: apply },
      );
      if (data) apply(data);
    })();
    return () => {
      alive = false;
    };
  }, [classId]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const d = (await postJson("/api/school/instructions", {
        classId,
        subjectId: subjectId || null,
        content,
      })) as Instruction;
      const subjectName = subjects.find((s) => s.id === d.subjectId)?.name ?? null;
      setItems((v) => [{ ...d, subjectName }, ...v]);
      setContent("");
      invalidateCached(`school:instructions:${classId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : tr("school.instructionsPanel.addFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function toggle(it: Instruction) {
    setError(null);
    try {
      await postJson("/api/school/instructions", { id: it.id, isActive: !it.isActive }, "PATCH");
      setItems((v) => v.map((x) => (x.id === it.id ? { ...x, isActive: !x.isActive } : x)));
      invalidateCached(`school:instructions:${classId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : tr("school.class.updateFailed"));
    }
  }

  async function remove(id: string) {
    setError(null);
    try {
      const res = await netFetch(
        `/api/school/instructions?id=${encodeURIComponent(id)}`,
        { method: "DELETE" },
        { timeoutMs: 15_000 },
      );
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? tr("school.instructionsPanel.deleteFailed"));
      setItems((v) => v.filter((x) => x.id !== id));
      invalidateCached(`school:instructions:${classId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : tr("school.instructionsPanel.deleteFailed"));
    }
  }

  return (
    <div style={box}>
      <h3 style={{ marginTop: 0 }}>{tr("school.instructionsPanel.titleA")} <RayaName /></h3>
      <p style={{ opacity: 0.6, fontSize: "0.82rem", marginTop: 0 }}>
        {tr("school.instructionsPanel.introA")} <RayaName /> {tr("school.instructionsPanel.introB")}
      </p>
      {error && <p style={{ color: "#f87171", fontSize: "0.85rem" }}>{error}</p>}
      {items.length === 0 && <p style={{ opacity: 0.55, fontSize: "0.85rem" }}>{tr("school.instructionsPanel.noneYet")}</p>}
      {items.map((it) => (
        <div key={it.id} style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.35rem 0" }}>
          <span style={{ flex: 1, opacity: it.isActive ? 1 : 0.45 }}>
            {it.content}
            <span style={{ opacity: 0.5, fontSize: "0.78rem" }}> · {it.subjectName ?? tr("school.instructionsPanel.allSubjectsFallback")}</span>
          </span>
          <button style={ghost} onClick={() => toggle(it)}>
            {it.isActive ? tr("school.instructionsPanel.disable") : tr("school.instructionsPanel.enable")}
          </button>
          <button
            onClick={() => remove(it.id)}
            title={tr("school.instructionsPanel.deleteTitle")}
            style={{ background: "transparent", color: "#6b7794", border: "none", cursor: "pointer" }}
          >
            ✕
          </button>
        </div>
      ))}
      <form onSubmit={add} style={{ display: "flex", gap: "0.5rem", marginTop: "0.75rem", flexWrap: "wrap" }}>
        <input
          style={{ ...input, flex: 1, minWidth: 200 }}
          placeholder={tr("school.instructionsPanel.placeholder")}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          maxLength={500}
        />
        <select style={input} value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
          <option value="">{tr("school.instructionsPanel.allSubjectsOption")}</option>
          {subjects.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <button type="submit" style={btn} disabled={busy || !content.trim()}>
          {tr("school.dashboard.addButton")}
        </button>
      </form>
    </div>
  );
}
