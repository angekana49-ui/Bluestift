"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { netFetch } from "@/lib/net/client-fetch";
import { FilePreview, type Attachment } from "@/components/attachment";
import { useAppTheme } from "@/components/ui/theme";
import { RayaName, RayaText } from "@/components/ui/brand";
import { neutralButton } from "@/components/ui/forms";
import { FilePicker } from "@/components/ui/file-picker";
import { useTranslate } from "@/components/ui/locale";

type RoomFile = Attachment & {
  file_type: string | null;
  created_at: string;
};

export function RoomFiles({ roomId, readOnly = false }: { roomId: string; readOnly?: boolean }) {
  const { theme: t } = useAppTheme();
  const tr = useTranslate();
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
    setStatus(tr("room.files.uploadingStatus"));
    try {
      const fd = new FormData();
      fd.append("roomId", roomId);
      fd.append("file", file);
      // Audio/PDF go through server-side extraction (maxDuration 60s) — a bare
      // fetch never times out, but netFetch's 10s default would abort a
      // legitimately-running transcription, so it's raised to match.
      const res = await netFetch("/api/rooms/files", { method: "POST", body: fd }, { timeoutMs: 65_000 });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ?? tr("room.files.uploadFailed"));
        return;
      }
      setStatus(data.hasText ? tr("room.files.addedWithContext") : tr("room.files.addedPlain"));
      await load();
    } catch {
      setError(tr("room.files.uploadFailed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={box}>
      <p style={{ color: t.muted, marginTop: 0, fontSize: 15 }}>
        {tr("room.files.contextA")} <RayaName /> {tr("room.files.contextB")}
      </p>
      {readOnly ? (
        <p style={{ color: t.muted, fontSize: 14, margin: 0 }}>
          {tr("room.files.readOnlyBanner")}
        </p>
      ) : (
        <FilePicker
          accept=".txt,.md,.markdown,.csv,.pdf,.docx,.xlsx,.mp3,.m4a,.wav,.webm,.ogg,.flac,audio/*,application/pdf,text/plain"
          onPick={(files) => upload(files?.[0] ?? null)}
          disabled={busy}
          // Uploads on pick and lists the result below, so it needs no filename
          // line — but a failed upload must be retryable with the same file.
          resetAfterPick
          label={busy ? tr("room.files.uploading") : undefined}
          buttonStyle={neutralButton(t)}
        />
      )}
      {status && <p style={{ color: t.muted, marginTop: 8, fontSize: 14 }}><RayaText>{status}</RayaText></p>}
      {error && <p style={{ color: "#f87171", marginTop: 8, fontSize: 15 }}>{error}</p>}

      <div style={{ marginTop: 16 }}>
        {files.length === 0 && <p style={{ color: t.muted, fontSize: 15 }}>{tr("room.files.noFilesYet")}</p>}
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
            <span style={{ flex: 1, color: t.text, fontSize: 15 }}>{f.file_name}</span>
            <span style={{ color: t.mutedLight, fontSize: 13 }}>{f.file_type}</span>
            <button
              onClick={() => setPreview(f)}
              style={{
                background: t.cardBg2,
                color: t.text,
                border: `1px solid ${t.cardBorder}`,
                borderRadius: 99,
                padding: "4px 12px",
                cursor: "pointer",
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              {tr("room.files.openButton")}
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
