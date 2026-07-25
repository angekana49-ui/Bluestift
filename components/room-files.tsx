"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { FilePreview, type Attachment } from "@/components/attachment";
import { useDarkMode } from "@/components/ui/theme";

type RoomFile = Attachment & {
  file_type: string | null;
  created_at: string;
};

export function RoomFiles({ roomId, readOnly = false }: { roomId: string; readOnly?: boolean }) {
  const { theme: t } = useDarkMode();
  const box: React.CSSProperties = {
    background: t.cardBg2,
    border: `1px solid ${t.cardBorder}`,
    borderRadius: 16,
    padding: 16,
    marginTop: 16,
  };
  const [supabase] = useState(() => createClient());
  const [files, setFiles] = useState<RoomFile[]>([]);
  const [preview, setPreview] = useState<Attachment | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const { data } = await supabase
      .schema("learning")
      .from("room_files")
      .select("id, file_name, file_type, mime_type, file_size, created_at")
      .eq("room_id", roomId)
      .order("created_at", { ascending: false });
    setFiles(data ?? []);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  async function upload(file: File | null) {
    if (!file) return;
    setBusy(true);
    setError(null);
    setStatus("Envoi et lecture… (audio/PDF peuvent prendre un instant)");
    try {
      const fd = new FormData();
      fd.append("roomId", roomId);
      fd.append("file", file);
      const res = await fetch("/api/rooms/files", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ?? "Upload failed.");
        return;
      }
      setStatus(data.hasText ? "Added — Raya can use it as context ✓" : "Added ✓");
      await load();
    } catch {
      setError("Upload failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={box}>
      <p style={{ color: t.muted, marginTop: 0, fontSize: 12.5 }}>
        Shared documents give the room its context — Raya reads them.
      </p>
      {readOnly ? (
        <p style={{ color: t.muted, fontSize: 12, margin: 0 }}>
          🔒 This session has ended — no new documents can be shared.
        </p>
      ) : (
        <input
          type="file"
          accept=".txt,.md,.markdown,.csv,.pdf,.docx,.xlsx,.mp3,.m4a,.wav,.webm,.ogg,.flac,audio/*,application/pdf,text/plain"
          onChange={(e) => upload(e.target.files?.[0] ?? null)}
          disabled={busy}
          style={{ fontSize: 12, color: t.muted }}
        />
      )}
      {status && <p style={{ color: t.muted, marginTop: 8, fontSize: 12 }}>{status}</p>}
      {error && <p style={{ color: "#f87171", marginTop: 8, fontSize: 12.5 }}>{error}</p>}

      <div style={{ marginTop: 16 }}>
        {files.length === 0 && <p style={{ color: t.muted, fontSize: 12.5 }}>No files yet.</p>}
        {files.map((f) => (
          <div
            key={f.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 12px",
              background: t.cardBg,
              border: `1px solid ${t.cardBorder}`,
              borderRadius: 12,
              marginTop: 6,
            }}
          >
            <span>📄</span>
            <span style={{ flex: 1, color: t.text, fontSize: 12.5 }}>{f.file_name}</span>
            <span style={{ color: t.mutedLight, fontSize: 11 }}>{f.file_type}</span>
            <button
              onClick={() => setPreview(f)}
              style={{
                background: t.cardBg2,
                color: t.text,
                border: `1px solid ${t.cardBorder}`,
                borderRadius: 99,
                padding: "4px 12px",
                cursor: "pointer",
                fontSize: 11,
                fontWeight: 600,
              }}
            >
              Open
            </button>
          </div>
        ))}
      </div>

      {preview && (
        <FilePreview file={preview} scope="room" onClose={() => setPreview(null)} />
      )}
    </div>
  );
}
