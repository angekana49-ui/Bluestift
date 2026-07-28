"use client";

import { useEffect, useState } from "react";
import { useAppTheme } from "@/components/ui/theme";
import { panelCard, textInput, ctaButton, ghostButton } from "@/components/ui/forms";
import { RayaName } from "@/components/ui/brand";

type Instruction = {
  id: string;
  content: string;
  isActive: boolean;
  subjectId: string | null;
  subjectName: string | null;
};
type SubjectOpt = { id: string; name: string };

async function postJson(url: string, body: unknown, method = "POST") {
  const res = await fetch(url, {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
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
    (async () => {
      try {
        const r = await fetch(`/api/school/instructions?classId=${encodeURIComponent(classId)}`);
        const d = await r.json();
        if (alive && r.ok) {
          setItems(d.instructions ?? []);
          setSubjects(d.subjects ?? []);
        }
      } catch {
        // leave empty
      }
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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add the instruction.");
    } finally {
      setBusy(false);
    }
  }

  async function toggle(it: Instruction) {
    setError(null);
    try {
      await postJson("/api/school/instructions", { id: it.id, isActive: !it.isActive }, "PATCH");
      setItems((v) => v.map((x) => (x.id === it.id ? { ...x, isActive: !x.isActive } : x)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update.");
    }
  }

  async function remove(id: string) {
    setError(null);
    try {
      const res = await fetch(`/api/school/instructions?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? "Could not delete.");
      setItems((v) => v.filter((x) => x.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete.");
    }
  }

  return (
    <div style={box}>
      <h3 style={{ marginTop: 0 }}>Instructions to <RayaName /></h3>
      <p style={{ opacity: 0.6, fontSize: "0.82rem", marginTop: 0 }}>
        Focus areas <RayaName /> applies for this class&apos;s students — guidance only, it never gives
        answers away.
      </p>
      {error && <p style={{ color: "#f87171", fontSize: "0.85rem" }}>{error}</p>}
      {items.length === 0 && <p style={{ opacity: 0.55, fontSize: "0.85rem" }}>No instructions yet.</p>}
      {items.map((it) => (
        <div key={it.id} style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.35rem 0" }}>
          <span style={{ flex: 1, opacity: it.isActive ? 1 : 0.45 }}>
            {it.content}
            <span style={{ opacity: 0.5, fontSize: "0.78rem" }}> · {it.subjectName ?? "all subjects"}</span>
          </span>
          <button style={ghost} onClick={() => toggle(it)}>
            {it.isActive ? "Disable" : "Enable"}
          </button>
          <button
            onClick={() => remove(it.id)}
            title="Delete"
            style={{ background: "transparent", color: "#6b7794", border: "none", cursor: "pointer" }}
          >
            ✕
          </button>
        </div>
      ))}
      <form onSubmit={add} style={{ display: "flex", gap: "0.5rem", marginTop: "0.75rem", flexWrap: "wrap" }}>
        <input
          style={{ ...input, flex: 1, minWidth: 200 }}
          placeholder="e.g. Focus on fractions this week"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          maxLength={500}
        />
        <select style={input} value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
          <option value="">All subjects</option>
          {subjects.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <button type="submit" style={btn} disabled={busy || !content.trim()}>
          Add
        </button>
      </form>
    </div>
  );
}
