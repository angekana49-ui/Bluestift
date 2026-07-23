"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { AttachmentCard, FilePreview } from "@/components/attachment";
import {
  IconButton,
  RETRACT_HEADER_PAD,
  RETRACT_HEADER_MIN_H,
  THREAD_MAX_W,
} from "@/components/ui/shell";
import { Bird } from "@/components/ui/widgets";
import { IconFile, IconImage, IconPanel } from "@/components/ui/icons";
import { status, hand, type AppTheme } from "@/components/ui/tokens";
import { ChatComposer } from "./chat-composer";
import { ChatAvatar } from "./chat-avatar";
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
  hideHeader = false,
  extraComposerAction,
  userInitials = "ME",
  userAvatarUrl,
}: {
  theme: AppTheme;
  engine: ChatEngine;
  config: ChatConfig;
  greetingName: string;
  headerActions?: ReactNode;
  onToggleRight?: () => void;
  rightOpen?: boolean;
  /** Embedded surfaces (e.g. the private-room channel) hide the session header
   *  because their host already provides one. */
  hideHeader?: boolean;
  /** Surface-specific composer control slotted before the send button. */
  extraComposerAction?: ReactNode;
  /** Avatar shown on the current user's bubbles (RAYA's own is always its logo). */
  userInitials?: string;
  userAvatarUrl?: string | null;
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

  // Hybrid new-conversation hooks: try the config's personalized resolver once
  // (only while the thread is empty). If it yields data we swap it in; on
  // null/empty/throw we stay on the static greeting + suggestions below.
  const [dynamicHooks, setDynamicHooks] = useState<{ greeting?: string; suggestions?: string[] } | null>(null);
  const hooksTried = useRef(false);
  useEffect(() => {
    if (hooksTried.current || !config.personalizedHooks || messages.length > 0) return;
    hooksTried.current = true;
    let active = true;
    config.personalizedHooks()
      .then((h) => {
        if (active && h && (h.greeting || (h.suggestions?.length ?? 0) > 0)) setDynamicHooks(h);
      })
      .catch(() => {
        /* offline / no data → keep static */
      });
    return () => {
      active = false;
    };
  }, [config, messages.length]);

  const greetingText = dynamicHooks?.greeting ?? config.greeting(greetingName);
  const suggestions =
    dynamicHooks?.suggestions && dynamicHooks.suggestions.length > 0
      ? dynamicHooks.suggestions
      : config.suggestions;

  const composerBlock = (centered: boolean) => (
    <ChatComposer
      theme={t}
      centered={centered}
      input={input}
      onInput={setInput}
      onSend={onSend}
      busy={busy}
      uploading={uploading}
      placeholder={config.placeholder}
      voice={voiceEnabled ? voice : null}
      onUpload={filesEnabled ? uploadDoc : undefined}
      pending={pending}
      onRemovePending={removePending}
      error={error}
      extraAction={extraComposerAction}
    />
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
        {!hideHeader && (
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
        )}

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
                {greetingText}
              </h1>
              <Bird variant={1} fill={status.aiIndigo} />
              <Bird variant={2} fill={t.mutedLight} />
            </div>
            <p style={{ maxWidth: 380, margin: "14px 0 26px", fontSize: 13, lineHeight: 1.7, color: t.muted }}>
              {config.emptyHint}
            </p>

            {composerBlock(true)}

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center", maxWidth: 460, marginTop: 26 }}>
              {suggestions.map((label, i) => (
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
                      display: "flex",
                      gap: 8,
                      alignItems: "flex-end",
                      alignSelf: mine ? "flex-end" : "flex-start",
                      flexDirection: mine ? "row-reverse" : "row",
                      maxWidth: "85%",
                    }}
                  >
                    <ChatAvatar theme={t} isRaya={!mine} initials={userInitials} avatarUrl={mine ? userAvatarUrl : undefined} />
                    <div
                      style={{
                        minWidth: 0,
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
