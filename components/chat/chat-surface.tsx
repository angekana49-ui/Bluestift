"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { AttachmentCard, FilePreview } from "@/components/attachment";
import {
  IconButton,
  RETRACT_HEADER_PAD,
  RETRACT_HEADER_MIN_H,
} from "@/components/ui/shell";
import { Bird } from "@/components/ui/widgets";
import { IconFile, IconImage, IconPanel } from "@/components/ui/icons";
import { status, hand, text, type AppTheme } from "@/components/ui/tokens";
import { RayaText } from "@/components/ui/brand";
import { useTranslate } from "@/components/ui/locale";
import { DegradedBanner } from "@/components/ui/degraded-banner";
import { ChatComposer } from "./chat-composer";
import { ChatAvatar } from "./chat-avatar";
import { RichText } from "./rich-text";
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
 * The presentational chat surface shared by both Raya and Raya-for-Schools:
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
  /** Avatar shown on the current user's bubbles (Raya's own is always its logo). */
  userInitials?: string;
  userAvatarUrl?: string | null;
}) {
  const {
    conversationId,
    messages,
    pending,
    filesByMessage,
    preview,
    input,
    busy,
    uploading,
    error,
    quota,
    voice,
    activeTitle,
    sessionFiles,
    setInput,
    setPreview,
    removePending,
    uploadDoc,
    onSend,
    retrySend,
  } = engine;

  const tr = useTranslate();
  const [filesOpen, setFilesOpen] = useState(false);

  // Auto-scroll: keep the thread pinned to the newest message (including while a
  // reply streams in), but only when the user is already near the bottom — if
  // they scrolled up to re-read, we don't yank them back down. `stick` tracks
  // that intent; the scroll handler refreshes it as the user scrolls.
  const scrollerRef = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  const onThreadScroll = () => {
    const el = scrollerRef.current;
    if (el) stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
  };
  useEffect(() => {
    const el = scrollerRef.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [messages]);
  useEffect(() => {
    // A freshly opened conversation always starts at its latest message.
    stick.current = true;
    const el = scrollerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [conversationId]);
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
    <>
    {/* Honest connectivity, right above the composer — where the student is
        about to type, not buried in a corner. Renders nothing when healthy. */}
    <div className="chat-col">
      <DegradedBanner />
    </div>
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
      quota={quota}
      extraAction={extraComposerAction}
    />
    </>
  );

  return (
    <>
      {/* The pale-blue animated wash is the WELCOME screen's backdrop, and only
          that. It used to back the whole chat, which meant every message bubble
          sat on a drifting gradient — the assistant's pale bubble all but
          dissolved into it, and the thread never held still. Once there is a
          conversation the ground goes flat and the bubbles carry the contrast. */}
      <div
        className={
          messages.length === 0 ? (t.dark ? "chat-welcome-bg is-dark" : "chat-welcome-bg") : undefined
        }
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          minWidth: 0,
          minHeight: 0,
          background: messages.length === 0 ? undefined : t.contentBg,
        }}
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
            <div style={ell(text.base, 700, t.text)}>{activeTitle}</div>
            {/* The status used to be green TEXT (#10b981 on the header white,
                ~2.4:1) — a colour carrying meaning at 13px, under AA twice over.
                The dot carries the colour, the words carry the meaning. */}
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: text.xs, color: t.muted }}>
              <span
                aria-hidden
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  flex: "none",
                  background: busy ? status.warn : status.positive,
                }}
              />
              {busy ? "Thinking…" : "In session"}
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
              <div style={{ fontSize: text.xs, fontWeight: 700, color: t.text, marginBottom: 8 }}>Session documents</div>
              {sessionFiles.length === 0 && (
                <div style={{ fontSize: text.xs, color: t.muted }}>No documents yet.</div>
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
                    <div style={ell(text.xs, 600, t.text)}>{f.file_name}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        )}

        {/* thread */}
        {messages.length === 0 ? (
          <div style={{ flex: 1, minHeight: 0, position: "relative", overflow: "auto", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: 24 }}>
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
            {/* The greeting <h1> above stays plain: it's set in the handwritten
                display face, where the brand serif would clash. Body copy and
                chips below carry the wordmark. */}
            <p style={{ maxWidth: 380, margin: "14px 0 26px", fontSize: text.base, lineHeight: 1.7, color: t.muted }}>
              <RayaText>{config.emptyHint}</RayaText>
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
                    fontSize: text.sm,
                    fontWeight: 600,
                    color: t.text,
                    animation: `floatSm ${6.5 + i * 0.35}s ease-in-out infinite`,
                    animationDelay: `${i * 0.3}s`,
                  }}
                >
                  <RayaText>{label}</RayaText>
                </span>
              ))}
            </div>
          </div>
        ) : (
          <div ref={scrollerRef} onScroll={onThreadScroll} className="chat-thread">
            {/* Centred reading column — the SAME `.chat-col` box the composer
                and the banner use, so all three share one left edge. */}
            <div className="chat-col" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
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
                        // Raya's bubble is the same white as a card, so it needs
                        // the same 1px edge to be a bubble and not just text.
                        border: mine ? "1px solid transparent" : `1px solid ${t.cardBorder}`,
                        borderRadius: mine ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                        padding: "13px 16px",
                        fontSize: text.base,
                        lineHeight: 1.65,
                        // Raya's replies are Markdown and carry their own block
                        // structure; the student's own text is literal.
                        whiteSpace: mine ? "pre-wrap" : "normal",
                      }}
                    >
                      {files.length > 0 && (
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem", marginBottom: m.content ? "0.4rem" : 0 }}>
                          {files.map((f) => (
                            <AttachmentCard key={f.id} file={f} onOpen={setPreview} />
                          ))}
                        </div>
                      )}
                      {mine ? m.content : <RichText content={m.content ?? ""} theme={t} />}
                      {/* Undelivered: the message stays put with its files —
                          nothing the student typed is ever thrown away. */}
                      {m.status === "failed" && (
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                            marginTop: 6,
                            fontSize: 12,
                            opacity: 0.85,
                          }}
                        >
                          <span>{tr("chat.sendFailed")}</span>
                          <button
                            type="button"
                            onClick={() => void retrySend(m.id)}
                            disabled={busy}
                            style={{
                              background: "transparent",
                              border: "none",
                              padding: 0,
                              color: "inherit",
                              font: "inherit",
                              fontWeight: 700,
                              textDecoration: "underline",
                              cursor: "pointer",
                            }}
                          >
                            {tr("chat.retry")}
                          </button>
                        </div>
                      )}
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
