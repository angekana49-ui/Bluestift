"use client";

import { useEffect, useState } from "react";
import { netFetch } from "@/lib/net/client-fetch";
import { POST_TYPES, mapCategoryToType, slugify, type PostType } from "@/lib/research/publish";

type Pending = {
  id: string;
  title: string | null;
  category: string | null;
  contributor_name: string | null;
  email: string | null;
  description: string | null;
  storage_path: string | null;
  submitted_at: string;
  fileUrl: string | null;
};

const box: React.CSSProperties = {
  border: "1px solid #2a3142",
  borderRadius: 14,
  padding: 18,
  marginBottom: 16,
  background: "#151a24",
};
const label: React.CSSProperties = { fontSize: 14, color: "#9aa4b8", margin: "0 0 6px", display: "block" };
const input: React.CSSProperties = {
  background: "#0e1219",
  color: "#eef1f7",
  border: "1px solid #2a3142",
  borderRadius: 10,
  padding: "10px 12px",
  width: "100%",
  fontSize: 15,
  boxSizing: "border-box",
  marginBottom: 14,
};
const meta: React.CSSProperties = { fontSize: 14, color: "#9aa4b8", margin: "0 0 4px" };
const approveBtn: React.CSSProperties = {
  background: "#16a34a",
  color: "#fff",
  border: "none",
  borderRadius: 10,
  padding: "11px 18px",
  fontSize: 15,
  fontWeight: 600,
  cursor: "pointer",
  flex: 1,
};
const rejectBtn: React.CSSProperties = {
  background: "transparent",
  color: "#f87171",
  border: "1px solid #7f2d2d",
  borderRadius: 10,
  padding: "11px 18px",
  fontSize: 15,
  fontWeight: 600,
  cursor: "pointer",
  flex: 1,
};

function ReviewCard({ item, onDone }: { item: Pending; onDone: (id: string) => void }) {
  const [slug, setSlug] = useState(() => slugify(item.title ?? ""));
  const [type, setType] = useState<PostType>(() => mapCategoryToType(item.category));
  const [title, setTitle] = useState(item.title ?? "");
  const [content, setContent] = useState(item.description ?? "");
  const [authorName, setAuthorName] = useState(item.contributor_name ?? "");
  const [institution, setInstitution] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const post = async (path: string, payload: Record<string, string>) => {
    setBusy(true);
    setError(null);
    try {
      const res = await netFetch(
        path,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) },
        { timeoutMs: 60_000 },
      );
      const data = (await res.json().catch(() => ({}))) as { error?: string; slug?: string };
      if (!res.ok) {
        setError(data.error ?? "request_failed");
        return;
      }
      onDone(item.id);
    } catch {
      setError("network_error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={box}>
      <div style={{ fontSize: 17, fontWeight: 700, color: "#eef1f7", margin: "0 0 6px" }}>{item.title || "(untitled)"}</div>
      <p style={meta}>
        {item.category ?? "other"} · {item.contributor_name || "anonymous"}
        {item.email ? ` · ${item.email}` : ""} · {new Date(item.submitted_at).toLocaleDateString()}
      </p>
      {item.storage_path && (
        <p style={{ ...meta, margin: "0 0 12px" }}>
          {item.fileUrl ? (
            <a href={item.fileUrl} target="_blank" rel="noreferrer" style={{ color: "#7ab3f7" }}>
              Open quarantined file (1h link)
            </a>
          ) : (
            <span>File: {item.storage_path} (preview unavailable)</span>
          )}
        </p>
      )}

      <label style={label}>Post title</label>
      <input style={input} value={title} onChange={(e) => setTitle(e.target.value)} />
      <div style={{ display: "flex", gap: 12 }}>
        <div style={{ flex: 2 }}>
          <label style={label}>Slug</label>
          <input style={input} value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="my-paper-slug" />
        </div>
        <div style={{ flex: 1 }}>
          <label style={label}>Type</label>
          <select
            style={input}
            value={type}
            onChange={(e) => setType(e.target.value as PostType)}
          >
            {POST_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
      </div>
      <label style={label}>Content (plain paragraphs, first = summary)</label>
      <textarea style={{ ...input, minHeight: 120, resize: "vertical" }} value={content} onChange={(e) => setContent(e.target.value)} />
      <div style={{ display: "flex", gap: 12 }}>
        <div style={{ flex: 1 }}>
          <label style={label}>Author name</label>
          <input style={input} value={authorName} onChange={(e) => setAuthorName(e.target.value)} />
        </div>
        <div style={{ flex: 1 }}>
          <label style={label}>Institution (optional)</label>
          <input style={input} value={institution} onChange={(e) => setInstitution(e.target.value)} />
        </div>
      </div>

      {error && <p style={{ fontSize: 14, color: "#f87171", margin: "0 0 12px" }}>Failed: {error}</p>}
      <div style={{ display: "flex", gap: 12 }}>
        <button
          style={{ ...approveBtn, opacity: busy ? 0.6 : 1 }}
          disabled={busy}
          onClick={() => post("/api/ops/research/contributions/approve", { id: item.id, slug, type, title, content, authorName, institution })}
        >
          {busy ? "Working…" : "Approve & publish"}
        </button>
        <button
          style={{ ...rejectBtn, opacity: busy ? 0.6 : 1 }}
          disabled={busy}
          onClick={() => post("/api/ops/research/contributions/reject", { id: item.id, reason })}
        >
          Reject
        </button>
      </div>
      <input
        style={{ ...input, marginTop: 12, marginBottom: 0 }}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Rejection reason (optional, shown to nobody — internal record)"
      />
    </div>
  );
}

export function OpsResearchForm() {
  const [items, setItems] = useState<Pending[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await netFetch("/api/ops/research/contributions", {}, { timeoutMs: 15_000 });
        const data = (await res.json().catch(() => ({}))) as { contributions?: Pending[] };
        if (!cancelled) {
          if (res.ok) setItems(data.contributions ?? []);
          else setFailed(true);
        }
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (failed) return <p style={{ color: "#f87171" }}>Could not load the review queue.</p>;
  if (items === null) return <p style={{ color: "#9aa4b8" }}>Loading…</p>;
  if (items.length === 0) return <p style={{ color: "#9aa4b8" }}>Queue empty — nothing pending review.</p>;
  return (
    <>
      {items.map((item) => (
        <ReviewCard key={item.id} item={item} onDone={(id) => setItems((v) => (v ?? []).filter((c) => c.id !== id))} />
      ))}
    </>
  );
}
