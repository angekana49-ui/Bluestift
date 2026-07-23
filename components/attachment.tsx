"use client";

import { useEffect, useState } from "react";

/** A file row from learning.conversation_files or learning.room_files. */
export type Attachment = {
  id: string;
  file_name: string | null;
  file_type?: string | null;
  mime_type?: string | null;
  file_size?: number | null;
};

/** Which table the id points at — decides how the signed URL is authorized. */
export type AttachmentScope = "conversation" | "room";

const TEXTUAL_EXT = [".txt", ".md", ".markdown", ".csv"];

function isPdf(f: Attachment) {
  return f.mime_type === "application/pdf" || !!f.file_name?.toLowerCase().endsWith(".pdf");
}
function isAudio(f: Attachment) {
  return !!f.mime_type?.startsWith("audio/") || f.file_type === "audio";
}
function isTextual(f: Attachment) {
  if (f.mime_type?.startsWith("text/")) return true;
  const name = f.file_name?.toLowerCase() ?? "";
  return TEXTUAL_EXT.some((ext) => name.endsWith(ext));
}

function iconFor(f: Attachment): string {
  if (isPdf(f)) return "📕";
  if (isAudio(f)) return "🎧";
  if (isTextual(f)) return "📝";
  const name = f.file_name?.toLowerCase() ?? "";
  if (name.endsWith(".docx")) return "📘";
  if (name.endsWith(".xlsx")) return "📊";
  return "📄";
}

/**
 * Split a file list into what hangs under a message and what is still staged.
 * A null `message_id` means the student uploaded it but never sent it — it goes
 * back to the composer where they left it.
 */
export function splitByMessage<T extends Attachment & { message_id: string | null }>(
  files: T[],
): { byMessage: Record<string, Attachment[]>; staged: Attachment[] } {
  const byMessage: Record<string, Attachment[]> = {};
  const staged: Attachment[] = [];
  for (const f of files) {
    if (f.message_id) (byMessage[f.message_id] ??= []).push(f);
    else staged.push(f);
  }
  return { byMessage, staged };
}

export function formatBytes(bytes: number | null | undefined): string | null {
  if (bytes == null || bytes < 0) return null;
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.round(kb)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

const chipBase: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  fontSize: "0.8rem",
  background: "#161a26",
  border: "1px solid #223",
  borderRadius: 4,
  padding: "4px 10px",
  maxWidth: 260,
};
const nameStyle: React.CSSProperties = {
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

/**
 * Composer pill: a file staged for the next message. `onRemove` shows the ✕ —
 * only the composer passes it, a sent attachment can't be unsent.
 */
export function AttachmentChip({
  file,
  onRemove,
  busy,
}: {
  file: Attachment;
  onRemove?: () => void;
  busy?: boolean;
}) {
  const size = formatBytes(file.file_size);
  return (
    <span style={{ ...chipBase, opacity: busy ? 0.6 : 1 }}>
      <span>{iconFor(file)}</span>
      <span style={nameStyle}>{file.file_name ?? "Document"}</span>
      {size && <span style={{ opacity: 0.5 }}>{size}</span>}
      {onRemove && (
        <button
          onClick={onRemove}
          title="Remove"
          disabled={busy}
          style={{
            background: "transparent",
            color: "#8b95ad",
            border: "none",
            cursor: busy ? "default" : "pointer",
            padding: 0,
            fontSize: "0.85rem",
            lineHeight: 1,
          }}
        >
          ✕
        </button>
      )}
    </span>
  );
}

/** A sent attachment, rendered inside a message bubble. Click to preview. */
export function AttachmentCard({
  file,
  onOpen,
}: {
  file: Attachment;
  onOpen: (file: Attachment) => void;
}) {
  const size = formatBytes(file.file_size);
  return (
    <button
      onClick={() => onOpen(file)}
      title="Preview"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        width: "100%",
        textAlign: "left",
        background: "rgba(0,0,0,0.22)",
        color: "inherit",
        border: "1px solid rgba(255,255,255,0.14)",
        borderRadius: 4,
        padding: "0.45rem 0.6rem",
        cursor: "pointer",
        fontSize: "0.85rem",
      }}
    >
      <span style={{ fontSize: "1.1rem" }}>{iconFor(file)}</span>
      <span style={{ ...nameStyle, flex: 1 }}>{file.file_name ?? "Document"}</span>
      {size && <span style={{ opacity: 0.6, fontSize: "0.75rem" }}>{size}</span>}
    </button>
  );
}

/**
 * Inline preview modal. Resolves a short-lived signed URL for the private
 * `user-media` bucket, then renders by type: PDF in an iframe, audio in a
 * player, text inline, anything else as a download.
 */
export function FilePreview({
  file,
  scope,
  onClose,
}: {
  file: Attachment;
  scope: AttachmentScope;
  onClose: () => void;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [text, setText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/files/signed-url", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(
            scope === "room" ? { roomFileId: file.id } : { conversationFileId: file.id },
          ),
        });
        const data = await res.json().catch(() => null);
        if (cancelled) return;
        if (!res.ok || !data?.url) {
          setError(data?.error ?? "Could not open the file.");
          return;
        }
        setUrl(data.url);
        // Text is small and already plain — render it rather than download it.
        if (isTextual(file)) {
          const raw = await fetch(data.url).then((r) => r.text());
          if (!cancelled) setText(raw.slice(0, 200_000));
        }
      } catch {
        if (!cancelled) setError("Could not open the file.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [file, scope]);

  const size = formatBytes(file.file_size);

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(4,7,15,0.75)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "2rem",
        zIndex: 50,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#0f1626",
          border: "1px solid #223",
          borderRadius: 4,
          width: "min(900px, 100%)",
          maxHeight: "100%",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <header
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.6rem",
            padding: "0.8rem 1rem",
            borderBottom: "1px solid #223",
          }}
        >
          <span>{iconFor(file)}</span>
          <strong style={{ ...nameStyle, flex: 1, maxWidth: "none" }}>
            {file.file_name ?? "Document"}
          </strong>
          {size && <span style={{ opacity: 0.5, fontSize: "0.8rem" }}>{size}</span>}
          {url && (
            <a
              href={url}
              download={file.file_name ?? undefined}
              style={{
                background: "#3a3f52",
                color: "white",
                borderRadius: 3,
                padding: "0.35rem 0.7rem",
                fontSize: "0.8rem",
                textDecoration: "none",
              }}
            >
              Download
            </a>
          )}
          <button
            onClick={onClose}
            title="Close"
            style={{
              background: "transparent",
              color: "#8b95ad",
              border: "none",
              cursor: "pointer",
              fontSize: "1rem",
            }}
          >
            ✕
          </button>
        </header>

        <div style={{ flex: 1, minHeight: 320, overflow: "auto", padding: "1rem" }}>
          {error && <p style={{ color: "#f87171" }}>{error}</p>}
          {!error && !url && <p style={{ opacity: 0.5 }}>Opening…</p>}
          {url && isPdf(file) && (
            <iframe
              src={url}
              title={file.file_name ?? "Document"}
              // Sandboxed: the file is user-uploaded content served from the Storage
              // origin via a signed URL. `allow-downloads` keeps the viewer's save
              // button working while blocking scripts, forms, popups and same-origin
              // access, so a malicious PDF/HTML can't run in our context.
              sandbox="allow-downloads"
              style={{ width: "100%", height: "70vh", border: "none", borderRadius: 3 }}
            />
          )}
          {url && isAudio(file) && <audio controls src={url} style={{ width: "100%" }} />}
          {url && isTextual(file) && (
            <pre
              style={{
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                margin: 0,
                fontSize: "0.85rem",
                opacity: 0.9,
              }}
            >
              {text ?? "Loading…"}
            </pre>
          )}
          {url && !isPdf(file) && !isAudio(file) && !isTextual(file) && (
            <p style={{ opacity: 0.7 }}>
              No inline preview for this format — use Download to open it.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
