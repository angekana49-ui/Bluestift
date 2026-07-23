"use client";

import { useEffect, useState } from "react";
import { useAppTheme } from "@/components/ui/theme";
import { panelCard, textInput, ctaButton, ghostButton } from "@/components/ui/forms";

type Followup = {
  id: string;
  content: string;
  authorName: string;
  createdAt: string;
  updatedAt: string;
};

async function req(url: string, method: string, body?: unknown) {
  const res = await fetch(url, {
    method,
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error ?? `Request failed (${res.status}).`);
  return data;
}

const fmt = (d: string) => new Date(d).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });

/**
 * Personalized follow-up notes on one student — the teacher's running log
 * (observations, plans, what was tried). Shared across the class team (assigned
 * prof + admin); the server gates every call by assertClassAccess.
 */
export function FollowupsPanel({ classId, studentUserId }: { classId: string; studentUserId: string }) {
  const { theme: t } = useAppTheme();
  const box = panelCard(t);
  const input = textInput(t);
  const btn = ctaButton(t);
  const ghost = ghostButton(t);

  const [items, setItems] = useState<Followup[]>([]);
  const [draft, setDraft] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    (async () => {
      try {
        const d = await req(
          `/api/school/followups?classId=${encodeURIComponent(classId)}&studentId=${encodeURIComponent(studentUserId)}`,
          "GET",
        );
        if (alive) setItems((d.followups ?? []) as Followup[]);
      } catch {
        // leave empty — the panel still renders its composer
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [classId, studentUserId]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const d = (await req("/api/school/followups", "POST", {
        classId,
        studentUserId,
        content: draft.trim(),
      })) as { id: string; content: string; createdAt: string; updatedAt: string };
      setItems((v) => [{ ...d, authorName: "You" }, ...v]);
      setDraft("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the note.");
    } finally {
      setBusy(false);
    }
  }

  async function saveEdit(id: string) {
    if (!editDraft.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      await req("/api/school/followups", "PATCH", { id, content: editDraft.trim() });
      setItems((v) => v.map((x) => (x.id === id ? { ...x, content: editDraft.trim() } : x)));
      setEditingId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    setError(null);
    try {
      await req(`/api/school/followups?id=${encodeURIComponent(id)}`, "DELETE");
      setItems((v) => v.filter((x) => x.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete.");
    }
  }

  return (
    <div style={box}>
      <h3 style={{ marginTop: 0 }}>Follow-up notes</h3>
      <p style={{ opacity: 0.6, fontSize: "0.82rem", marginTop: 0 }}>
        Your running log on this student — shared with the class team (you and the school admin).
      </p>
      {error && <p style={{ color: "#f87171", fontSize: "0.85rem" }}>{error}</p>}

      <form onSubmit={add} style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.85rem" }}>
        <input
          style={{ ...input, flex: 1, minWidth: 220 }}
          placeholder="Add an observation or a plan…"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={2000}
        />
        <button type="submit" style={btn} disabled={busy || !draft.trim()}>
          Add note
        </button>
      </form>

      {loading ? (
        <p style={{ opacity: 0.55, fontSize: "0.85rem", margin: 0 }}>Loading…</p>
      ) : items.length === 0 ? (
        <p style={{ opacity: 0.55, fontSize: "0.85rem", margin: 0 }}>No notes yet.</p>
      ) : (
        items.map((it) => (
          <div key={it.id} style={{ padding: "0.5rem 0", borderTop: `1px solid ${t.cardBorder}` }}>
            {editingId === it.id ? (
              <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                <input
                  style={{ ...input, flex: 1, minWidth: 220 }}
                  value={editDraft}
                  onChange={(e) => setEditDraft(e.target.value)}
                  maxLength={2000}
                  autoFocus
                />
                <button style={ghost} onClick={() => saveEdit(it.id)} disabled={busy}>
                  Save
                </button>
                <button style={{ ...ghost, background: "transparent" }} onClick={() => setEditingId(null)}>
                  Cancel
                </button>
              </div>
            ) : (
              <>
                <div style={{ fontSize: "0.92rem", lineHeight: 1.5 }}>{it.content}</div>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "0.3rem" }}>
                  <span style={{ opacity: 0.5, fontSize: "0.75rem", flex: 1 }}>
                    {it.authorName} · {fmt(it.createdAt)}
                  </span>
                  <button
                    style={{ background: "transparent", border: "none", color: t.muted, cursor: "pointer", fontSize: "0.8rem" }}
                    onClick={() => {
                      setEditingId(it.id);
                      setEditDraft(it.content);
                    }}
                  >
                    Edit
                  </button>
                  <button
                    style={{ background: "transparent", border: "none", color: "#6b7794", cursor: "pointer" }}
                    onClick={() => remove(it.id)}
                    title="Delete"
                  >
                    ✕
                  </button>
                </div>
              </>
            )}
          </div>
        ))
      )}
    </div>
  );
}
