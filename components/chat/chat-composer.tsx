"use client";

import type { ReactNode } from "react";
import { AttachmentChip, type Attachment } from "@/components/attachment";
import { IconButton, THREAD_MAX_W } from "@/components/ui/shell";
import { IconMic, IconAttach, IconAiMode } from "@/components/ui/icons";
import type { AppTheme } from "@/components/ui/tokens";

/** The minimal voice-recorder shape the composer needs (see useVoiceRecorder). */
export type ComposerVoice = {
  recording: boolean;
  busy: boolean;
  error: string | null;
  toggle: () => void;
};

/** Documents the composer accepts — kept in one place so every surface matches. */
export const COMPOSER_ACCEPT =
  ".txt,.md,.markdown,.csv,.pdf,.docx,.xlsx,.mp3,.m4a,.wav,.webm,.ogg,.flac,audio/*,application/pdf,text/plain";

/**
 * The one chat composer, shared by every chat surface (Raya solo, Raya-for-Schools,
 * and both room channels) so they stay pixel-identical: optional voice + attach,
 * the AI-mode pill, the round send button, the staged-attachment chips and the
 * inline error line. `centered` places it under the welcome greeting; otherwise it
 * pins to the bottom edge with a top border. `extraAction` slots a surface-specific
 * control (e.g. the room's "Ask Raya") just before the send button.
 */
export function ChatComposer({
  theme: t,
  centered,
  input,
  onInput,
  onSend,
  busy,
  uploading = false,
  placeholder,
  voice,
  onUpload,
  pending = [],
  onRemovePending,
  error,
  extraAction,
  disabled = false,
}: {
  theme: AppTheme;
  centered: boolean;
  input: string;
  onInput: (value: string) => void;
  onSend: () => void;
  busy: boolean;
  uploading?: boolean;
  placeholder: string;
  voice?: ComposerVoice | null;
  onUpload?: (file: File | null) => void;
  pending?: Attachment[];
  onRemovePending?: (id: string) => void;
  error?: string | null;
  extraAction?: ReactNode;
  disabled?: boolean;
}) {
  const sendIdle = busy || uploading || disabled || !input.trim();
  return (
    <div
      style={
        centered
          ? { width: "100%", maxWidth: THREAD_MAX_W, margin: "0 auto" }
          : { borderTop: `1px solid ${t.cardBorder}` }
      }
      data-centered={centered || undefined}
    >
      <div style={{ maxWidth: THREAD_MAX_W, margin: "0 auto", paddingTop: centered ? 0 : 12 }}>
        {/* pending attachments */}
        {(pending.length > 0 || uploading) && (
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "0.4rem", padding: "0 24px 8px" }}>
            {pending.map((a) => (
              <AttachmentChip key={a.id} file={a} onRemove={() => onRemovePending?.(a.id)} busy={busy} />
            ))}
            {uploading && <span style={{ fontSize: 11, color: t.mutedLight }}>Reading the document…</span>}
          </div>
        )}

        {/* error */}
        {(error || voice?.error) && (
          <div style={{ padding: "0 24px 8px", fontSize: 12, color: "#f87171" }}>{error || voice?.error}</div>
        )}

        {/* composer */}
        <div style={{ padding: "16px 24px", display: "flex", gap: 8, alignItems: "center" }}>
          {voice && (
            <IconButton
              theme={t}
              size={38}
              radius={999}
              onClick={voice.toggle}
              title="Voice message"
              bg={voice.recording ? "#e0245e" : t.cardBg2}
              color={voice.recording ? "#fff" : t.mutedLight}
            >
              {voice.recording ? <span style={{ fontSize: 12 }}>■</span> : <IconMic size={16} />}
            </IconButton>
          )}
          <input
            value={input}
            onChange={(e) => onInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onSend()}
            disabled={busy || disabled}
            placeholder={placeholder}
            style={{
              flex: 1,
              minWidth: 100,
              background: t.inputBg,
              border: `1px solid ${t.inputBorder}`,
              borderRadius: 99,
              padding: "12px 18px",
              fontSize: 12.5,
              color: t.text,
              outline: "none",
            }}
          />
          {onUpload && (
            <label
              title="Attach a file"
              style={{
                width: 38,
                height: 38,
                borderRadius: "50%",
                background: t.cardBg2,
                color: t.mutedLight,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: busy || uploading ? "default" : "pointer",
                flex: "none",
              }}
            >
              <IconAttach size={16} />
              <input
                type="file"
                accept={COMPOSER_ACCEPT}
                style={{ display: "none" }}
                onChange={(e) => {
                  onUpload(e.target.files?.[0] ?? null);
                  e.target.value = "";
                }}
                disabled={busy || uploading}
              />
            </label>
          )}
          <IconButton theme={t} size={38} radius={999} title="AI mode — Encouraging" color={t.text}>
            <IconAiMode size={16} />
          </IconButton>
          {extraAction}
          <span
            role="button"
            onClick={() => onSend()}
            style={{
              width: 38,
              height: 38,
              borderRadius: "50%",
              background: t.ctaBg,
              color: t.ctaText,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 14,
              flex: "none",
              cursor: sendIdle ? "default" : "pointer",
              opacity: sendIdle ? 0.5 : 1,
            }}
          >
            ↑
          </span>
        </div>
      </div>
    </div>
  );
}
