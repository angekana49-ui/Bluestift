"use client";

import { useState, type ReactNode } from "react";
import { AttachmentCard, AttachmentChip, FilePreview } from "@/components/attachment";
import {
  IconButton,
  RETRACT_HEADER_PAD,
  RETRACT_HEADER_MIN_H,
  THREAD_MAX_W,
} from "@/components/ui/shell";
import { Bird } from "@/components/ui/widgets";
import { IconFile, IconImage, IconPanel, IconMic, IconAttach, IconAiMode } from "@/components/ui/icons";
import { status, hand, type AppTheme } from "@/components/ui/tokens";
import type { ChatConfig } from "./types";
import type { ChatEngine } from "./use-chat-engine";

const ell = (size: number, weight: number, color: string): React.CSSProperties => ({
  fontSize: size,
  fontWeight: weight,
  color,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
});

/**
 * The presentational chat surface shared by both Raya and RAYA-for-Schools:
 * header (session name + state), the pale-blue animated welcome screen, the
 * centred reading column, message bubbles, pending attachments, the composer
 * (voice / attach / send), and the file preview modal.
 *
 * All state + handlers come from `engine` (see useChatEngine); everything that
 * differs between the two surfaces comes from `config` or the slots:
 *  - `greetingName`  first name shown on the welcome screen
 *  - `headerActions` extra header pills (Raya: profile + Analyze; Schools: none)
 *  - `onToggleRight` / `rightOpen` drive the right-panel toggle button
 */
export function ChatSurface({
  theme: t,
  engine,
  config,
  greetingName,
  headerActions,
  onToggleRight,
  rightOpen,
}: {
  theme: AppTheme;
  engine: ChatEngine;
  config: ChatConfig;
  greetingName: string;
  headerActions?: ReactNode;
  onToggleRight?: () => void;
  rightOpen?: boolean;
}) {
  const {
    messages,
    pending,
    filesByMessage,
    preview,
    input,
    busy,
    uploading,
    error,
    voice,
    activeTitle,
    sessionFiles,
    setInput,
    setPreview,
    removePending,
    uploadDoc,
    onSend,
  } = engine;

  const [filesOpen, setFilesOpen] = useState(false);
  const { voice: voiceEnabled, files: filesEnabled } = config.capabilities;

  const composerBlock = (centered: boolean) => (
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
              <AttachmentChip key={a.id} file={a} onRemove={() => removePending(a.id)} busy={busy} />
            ))}
            {uploading && <span style={{ fontSize: 11, color: t.mutedLight }}>Reading the document…</span>}
          </div>
        )}

        {/* error */}
        {(error || voice.error) && (
          <div style={{ padding: "0 24px 8px", fontSize: 12, color: "#f87171" }}>{error || voice.error}</div>
        )}

        {/* composer */}
        <div style={{ padding: "16px 24px", display: "flex", gap: 8, alignItems: "center" }}>
          {voiceEnabled && (
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
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onSend()}
            disabled={busy}
            placeholder={config.placeholder}
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
          {filesEnabled && (
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
                accept=".txt,.md,.markdown,.csv,.pdf,.docx,.xlsx,.mp3,.m4a,.wav,.webm,.ogg,.flac,audio/*,application/pdf,text/plain"
                style={{ display: "none" }}
                onChange={(e) => {
                  uploadDoc(e.target.files?.[0] ?? null);
                  e.target.value = "";
                }}
                disabled={busy || uploading}
              />
            </label>
          )}
          <IconButton theme={t} size={38} radius={999} title="AI mode — Encouraging" color={t.text}>
            <IconAiMode size={16} />
          </IconButton>
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
              cursor: busy || uploading || !input.trim() ? "default" : "pointer",
              opacity: busy || uploading || !input.trim() ? 0.5 : 1,
            }}
          >
            ↑
          </span>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* The pale-blue animated wash backs the whole chat; the header stays solid
          on top of it so the session bar reads as a distinct strip. */}
      <div
        className={t.dark ? "chat-welcome-bg is-dark" : "chat-welcome-bg"}
        style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}
      >
        {/* header */}
        <div
          style={{
            position: "relative",
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: RETRACT_HEADER_PAD,
            // Pinned so the header lines up with the right panel's title bar.
            minHeight: RETRACT_HEADER_MIN_H,
            boxSizing: "border-box",
            background: t.cardBg,
            borderBottom: `1px solid ${t.cardBorder}`,
          }}
        >
          {/* Session name + state only — no product wordmark or AI avatar. */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={ell(13.5, 700, t.text)}>{activeTitle}</div>
            <div style={{ fontSize: 10.5, color: busy ? t.mutedLight : status.positive }}>
              {busy ? "Thinking…" : "● in session"}
            </div>
          </div>
          {headerActions}
          {filesEnabled && (
            <IconButton theme={t} onClick={() => setFilesOpen((o) => !o)} bg={filesOpen ? t.sidebarActiveBg : t.cardBg2}>
              <IconFile size={14} />
            </IconButton>
          )}
          {onToggleRight && (
            <IconButton
              theme={t}
              onClick={onToggleRight}
              title={rightOpen ? "Hide panel" : "Show panel"}
              bg={rightOpen ? t.sidebarActiveBg : undefined}
            >
              <IconPanel size={14} />
            </IconButton>
          )}
          {filesEnabled && filesOpen && (
            <div
              style={{
                position: "absolute",
                top: 56,
                right: 24,
                zIndex: 5,
                width: 240,
                background: t.cardBg2,
                border: `1px solid ${t.cardBorder}`,
                borderRadius: 14,
                boxShadow: t.cardShadow,
                padding: 12,
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 700, color: t.text, marginBottom: 8 }}>Session documents</div>
              {sessionFiles.length === 0 && (
                <div style={{ fontSize: 10.5, color: t.muted }}>No documents yet.</div>
              )}
              {sessionFiles.map((f) => (
                <div
                  key={f.id}
                  onClick={() => setPreview(f)}
                  style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 8px", borderRadius: 9, cursor: "pointer" }}
                >
                  {(f.mime_type ?? "").startsWith("image/") ? (
                    <IconImage size={13} style={{ color: t.muted }} />
                  ) : (
                    <IconFile size={13} style={{ color: t.muted }} />
                  )}
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={ell(10.5, 600, t.text)}>{f.file_name}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* thread */}
        {messages.length === 0 ? (
          <div style={{ flex: 1, position: "relative", overflow: "auto", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: 24 }}>
            <div style={{ position: "relative", display: "inline-block", maxWidth: 520 }}>
              <h1
                style={{
                  fontFamily: hand,
                  fontWeight: 700,
                  fontSize: "clamp(2.2rem,5vw,3.4rem)",
                  lineHeight: 1,
                  margin: 0,
                  color: t.text,
                  animation: "writeReveal 2.2s cubic-bezier(0.65,0,0.35,1) 0.15s 1 both",
                }}
              >
                {config.greeting(greetingName)}
              </h1>
              <Bird variant={1} fill={status.aiIndigo} />
              <Bird variant={2} fill={t.mutedLight} />
            </div>
            <p style={{ maxWidth: 380, margin: "14px 0 26px", fontSize: 13, lineHeight: 1.7, color: t.muted }}>
              {config.emptyHint}
            </p>

            {composerBlock(true)}

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center", maxWidth: 460, marginTop: 26 }}>
              {config.suggestions.map((label, i) => (
                <span
                  key={label}
                  className="shine"
                  onClick={() => onSend(label)}
                  style={{
                    cursor: "pointer",
                    background: t.cardBg2,
                    border: `1px solid ${t.cardBorder}`,
                    borderRadius: 14,
                    padding: "12px 16px",
                    fontSize: 12,
                    fontWeight: 600,
                    color: t.text,
                    animation: `floatSm ${6.5 + i * 0.35}s ease-in-out infinite`,
                    animationDelay: `${i * 0.3}s`,
                  }}
                >
                  {label}
                </span>
              ))}
            </div>
          </div>
        ) : (
          <div style={{ flex: 1, overflow: "auto", padding: "28px 24px" }}>
            {/* Centred reading column — full width until the zone is narrower
                than THREAD_MAX_W, capped beyond it. */}
            <div style={{ maxWidth: THREAD_MAX_W, margin: "0 auto", display: "flex", flexDirection: "column", gap: 16 }}>
              {messages.map((m) => {
                const mine = m.role !== "assistant";
                const files = filesByMessage[m.id] ?? [];
                return (
                  <div
                    key={m.id}
                    style={{
                      maxWidth: "80%",
                      alignSelf: mine ? "flex-end" : "flex-start",
                      background: mine ? t.ctaBg : t.bubbleBg,
                      color: mine ? t.ctaText : t.text,
                      borderRadius: mine ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                      padding: "13px 16px",
                      fontSize: 13.5,
                      lineHeight: 1.65,
                      whiteSpace: "pre-wrap",
                    }}
                  >
                    {files.length > 0 && (
                      <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem", marginBottom: m.content ? "0.4rem" : 0 }}>
                        {files.map((f) => (
                          <AttachmentCard key={f.id} file={f} onOpen={setPreview} />
                        ))}
                      </div>
                    )}
                    {m.content}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Once the conversation has started the composer returns to the bottom
            edge, where it stays put as the thread scrolls. */}
        {messages.length > 0 && composerBlock(false)}
      </div>

      {preview && (
        <FilePreview file={preview} scope="conversation" onClose={() => setPreview(null)} />
      )}
    </>
  );
}
