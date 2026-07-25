"use client";

import type { RefObject } from "react";
import { AttachmentCard, type Attachment } from "@/components/attachment";
import { ChatComposer, type ComposerVoice } from "@/components/chat/chat-composer";
import { ChatAvatar } from "@/components/chat/chat-avatar";
import { THREAD_MAX_W } from "@/components/ui/shell";
import { Bird } from "@/components/ui/widgets";
import { status, hand, type AppTheme } from "@/components/ui/tokens";

export type GroupMsg = {
  id: string;
  user_id: string | null;
  role: string;
  content: string | null;
  has_media?: boolean;
};

/**
 * The room's group channel, wearing the same skin as the solo /chat surface:
 * the pale-blue animated wash, the welcome greeting, the centred reading column
 * and the shared composer. The multi-party bits the solo chat doesn't have —
 * per-sender name labels, a third ("other member") bubble tone, shared-document
 * cards and the "Ask Raya" action — stay here; the visuals stay identical.
 *
 * Realtime, roster and send/upload logic all live in RoomView and arrive as
 * props, so this file is purely presentational.
 */
export function RoomGroupChat({
  theme: t,
  myUserId,
  messages,
  nameOf,
  avatarOf,
  myInitials,
  myAvatarUrl,
  roomFiles,
  onPreview,
  greetingName,
  input,
  onInput,
  onSend,
  onUpload,
  uploading,
  voice,
  onAskRaya,
  busy,
  expired,
  error,
  endRef,
  subject,
}: {
  theme: AppTheme;
  myUserId: string;
  messages: GroupMsg[];
  nameOf: (userId: string | null) => string;
  /** Resolves another member's avatar (initials + optional photo) from the roster. */
  avatarOf: (userId: string | null) => { initials: string; avatarUrl: string | null };
  myInitials: string;
  myAvatarUrl?: string | null;
  roomFiles: Record<string, Attachment>;
  onPreview: (file: Attachment) => void;
  greetingName: string;
  input: string;
  onInput: (value: string) => void;
  onSend: (text?: string) => void;
  onUpload: (file: File | null) => void;
  uploading: boolean;
  voice: ComposerVoice;
  onAskRaya: () => void;
  busy: boolean;
  expired: boolean;
  error: string | null;
  endRef: RefObject<HTMLDivElement | null>;
  /** Room subject — when present it personalizes the welcome chips (hybrid). */
  subject?: string | null;
}) {
  const bubble = (kind: "me" | "raya" | "other"): React.CSSProperties => ({
    minWidth: 0,
    background: kind === "me" ? t.ctaBg : kind === "raya" ? t.bubbleBg : t.bubbleAccentBg,
    color: kind === "me" ? t.ctaText : t.text,
    borderRadius: kind === "me" ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
    padding: "13px 16px",
    fontSize: 13.5,
    lineHeight: 1.65,
    whiteSpace: "pre-wrap",
  });

  // The avatar for a message's author: Raya's logo, my photo/initials, or the
  // sending member's photo/initials from the roster.
  const avatarFor = (m: GroupMsg) => {
    if (m.role === "assistant") return <ChatAvatar theme={t} isRaya />;
    if (m.user_id === myUserId) return <ChatAvatar theme={t} initials={myInitials} avatarUrl={myAvatarUrl} />;
    const a = avatarOf(m.user_id);
    return <ChatAvatar theme={t} initials={a.initials} avatarUrl={a.avatarUrl} />;
  };

  const askRayaAction = (
    <button
      onClick={onAskRaya}
      disabled={busy || expired}
      title="Bring Raya into the room"
      style={{
        flex: "none",
        height: 38,
        padding: "0 15px",
        borderRadius: 99,
        border: `1px solid ${t.cardBorder}`,
        background: t.cardBg2,
        color: t.text,
        fontSize: 12,
        fontWeight: 600,
        cursor: busy || expired ? "default" : "pointer",
        opacity: busy || expired ? 0.5 : 1,
        whiteSpace: "nowrap",
      }}
    >
      Ask Raya
    </button>
  );

  const composer = (centered: boolean) => (
    <ChatComposer
      theme={t}
      centered={centered}
      input={input}
      onInput={onInput}
      onSend={() => onSend()}
      busy={false}
      uploading={uploading}
      placeholder={expired ? "Session ended — read-only" : "Message the group…"}
      voice={voice}
      onUpload={onUpload}
      error={error}
      extraAction={askRayaAction}
      disabled={expired}
    />
  );

  return (
    <div
      className={t.dark ? "chat-welcome-bg is-dark" : "chat-welcome-bg"}
      style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, minHeight: 0 }}
    >
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
              {greetingName ? `Hi ${greetingName}, say hello` : "Say hello"}
            </h1>
            <Bird variant={1} fill={status.aiIndigo} />
            <Bird variant={2} fill={t.mutedLight} />
          </div>
          <p style={{ maxWidth: 380, margin: "14px 0 26px", fontSize: 13, lineHeight: 1.7, color: t.muted }}>
            Study together with your squad, share documents, or bring Raya into the room.
          </p>

          {composer(true)}

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center", maxWidth: 460, marginTop: 26 }}>
            {[
              { label: "Say hello", disabled: expired, onClick: () => onSend("Hi everyone") },
              // Hybrid: a subject-aware opener when the room has one, else nothing here.
              ...(subject?.trim()
                ? [{ label: `Start on ${subject.trim()}`, disabled: expired, onClick: () => onSend(`Let's start on ${subject.trim()}`) }]
                : []),
              { label: "Ask Raya to help", disabled: expired || busy, onClick: () => onAskRaya() },
            ].map((chip, i) => (
              <span
                key={chip.label}
                className="shine"
                onClick={() => !chip.disabled && chip.onClick()}
                style={{
                  cursor: chip.disabled ? "default" : "pointer",
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
                {chip.label}
              </span>
            ))}
          </div>
        </div>
      ) : (
        <div style={{ flex: 1, overflow: "auto", padding: "28px 24px" }}>
          <div style={{ maxWidth: THREAD_MAX_W, margin: "0 auto", display: "flex", flexDirection: "column", gap: 16 }}>
            {messages.map((m) => {
              // A shared-document notice (livestreamed when someone uploads).
              if (m.has_media) {
                const who = m.user_id === myUserId ? "You" : nameOf(m.user_id);
                const file = roomFiles[m.id];
                if (!file) {
                  return (
                    <div
                      key={m.id}
                      style={{
                        alignSelf: "center",
                        fontSize: 11,
                        color: t.muted,
                        background: t.cardBg2,
                        border: `1px solid ${t.cardBorder}`,
                        borderRadius: 99,
                        padding: "5px 12px",
                      }}
                    >
                      📄 {who} shared a document: <strong>{m.content}</strong>
                    </div>
                  );
                }
                const mine = m.user_id === myUserId;
                return (
                  <div
                    key={m.id}
                    style={{ display: "flex", gap: 8, alignItems: "flex-end", alignSelf: mine ? "flex-end" : "flex-start", flexDirection: mine ? "row-reverse" : "row", maxWidth: "85%" }}
                  >
                    {avatarFor(m)}
                    <div style={{ display: "flex", flexDirection: "column", alignItems: mine ? "flex-end" : "flex-start", gap: 3, minWidth: 0 }}>
                      <span style={{ fontSize: 10, color: t.mutedLight }}>{who} shared a document</span>
                      <div style={{ ...bubble(mine ? "me" : "other"), minWidth: 220 }}>
                        <AttachmentCard file={file} onOpen={onPreview} />
                      </div>
                    </div>
                  </div>
                );
              }
              const kind = m.role === "assistant" ? "raya" : m.user_id === myUserId ? "me" : "other";
              return (
                <div
                  key={m.id}
                  style={{ display: "flex", gap: 8, alignItems: "flex-end", alignSelf: kind === "me" ? "flex-end" : "flex-start", flexDirection: kind === "me" ? "row-reverse" : "row", maxWidth: "85%" }}
                >
                  {avatarFor(m)}
                  <div style={{ display: "flex", flexDirection: "column", alignItems: kind === "me" ? "flex-end" : "flex-start", gap: 3, minWidth: 0 }}>
                    <span style={{ fontSize: 10, color: t.mutedLight }}>
                      {kind === "raya" ? "Raya" : kind === "me" ? "You" : nameOf(m.user_id)}
                    </span>
                    <div style={bubble(kind)}>{m.content}</div>
                  </div>
                </div>
              );
            })}
            <div ref={endRef} />
          </div>
        </div>
      )}

      {messages.length > 0 && composer(false)}
    </div>
  );
}
