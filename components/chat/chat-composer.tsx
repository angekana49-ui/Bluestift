"use client";

import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import { AttachmentChip, type Attachment } from "@/components/attachment";
import { IconButton } from "@/components/ui/shell";
import { IconMic, IconAttach, IconAiMode, IconCheck, IconLock } from "@/components/ui/icons";
import { text, type AppTheme } from "@/components/ui/tokens";
import { FilePicker } from "@/components/ui/file-picker";
import { useAiMode } from "./use-ai-mode";
import type { AiMode } from "@/lib/raya/modes";

/** The minimal voice-recorder shape the composer needs (see useVoiceRecorder). */
export type ComposerVoice = {
  recording: boolean;
  busy: boolean;
  error: string | null;
  toggle: () => void;
  /** An un-transcribed recording is being held — offer retry/discard. */
  hasPending?: boolean;
  retry?: () => void | Promise<void>;
  discard?: () => void;
};

/** An inline action that reads as text, not a button (retry/discard links). */
const linkButton: React.CSSProperties = {
  background: "transparent",
  border: "none",
  padding: 0,
  font: "inherit",
  fontWeight: 700,
  textDecoration: "underline",
  cursor: "pointer",
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
/**
 * How many messages left before the composer starts saying so. Flat rather
 * than a fraction of the plan: the number that matters to a student is "am I
 * about to run out", which is the same whether the plan is 30 or 300.
 */
const LOW_WATER = 10;

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
  quota,
  extraAction,
  disabled = false,
  showAiMode = false,
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
  quota?: { used: number; limit: number } | null;
  extraAction?: ReactNode;
  disabled?: boolean;
  /** `config.aiModeSwitcher` from the surface — off for Raya-for-Schools. */
  showAiMode?: boolean;
}) {
  // The day's plan allowance. `quota` is only ever set when a limit exists AND
  // is enforced, so everything below is dead code until that is switched on.
  const left = quota ? Math.max(0, quota.limit - quota.used) : null;
  const spent = left === 0;
  const sendIdle = busy || uploading || disabled || spent || !input.trim();

  // A no-op when `showAiMode` is false (Raya-for-Schools) — see use-ai-mode.ts.
  const aiMode = useAiMode(showAiMode);

  // The input is a textarea so long messages wrap and the field grows with the
  // text (up to a cap, then it scrolls internally) instead of running off in one
  // endless line. Re-measured whenever `input` changes — including the reset to
  // "" after a send, which snaps it back to a single row.
  const taRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
  }, [input]);

  return (
    <div
      style={
        centered
          ? { width: "100%" }
          : { borderTop: `1px solid ${t.cardBorder}`, background: t.cardBg }
      }
      data-centered={centered || undefined}
    >
      {/* `.chat-col` — the one box the thread and the banner also use. The
          gutter is INSIDE its max-width, which is the whole point: the field
          and the message bubbles above it now resolve to the same left edge
          instead of sitting 24px apart. */}
      <div className="chat-col" style={{ paddingTop: centered ? 0 : 12 }}>
        {/* pending attachments */}
        {(pending.length > 0 || uploading) && (
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "0.4rem", padding: "0 0 8px" }}>
            {pending.map((a) => (
              <AttachmentChip key={a.id} file={a} onRemove={() => onRemovePending?.(a.id)} busy={busy} />
            ))}
            {uploading && <span style={{ fontSize: text.xs, color: t.mutedLight }}>Reading the document…</span>}
          </div>
        )}

        {/* the day's plan allowance — deliberately not styled as an error:
            reaching it is the plan working, not something going wrong */}
        {left != null && (spent || left <= LOW_WATER) && (
          <div style={{ padding: "0 0 8px", fontSize: text.sm, color: spent ? t.text : t.mutedLight }}>
            {spent ? (
              <>
                That&apos;s your {quota?.limit} messages for today. They come back tomorrow —{" "}
                <a href="/pricing" style={{ color: "inherit", textDecoration: "underline" }}>
                  or take a bigger plan
                </a>
                .
              </>
            ) : (
              `${left} message${left === 1 ? "" : "s"} left today`
            )}
          </div>
        )}

        {/* error */}
        {(error || voice?.error) && (
          <div style={{ padding: "0 0 8px", fontSize: text.sm, color: "#f87171" }}>
            {error || voice?.error}
            {/* A recording that failed to transcribe is held, not lost — a
                spoken answer can't be scrolled back to and retyped. */}
            {voice?.hasPending && voice.retry && (
              <>
                {" "}
                <button
                  type="button"
                  onClick={() => void voice.retry?.()}
                  disabled={voice.busy}
                  style={{ ...linkButton, color: "inherit" }}
                >
                  Retry
                </button>
                {voice.discard && (
                  <>
                    {" · "}
                    <button
                      type="button"
                      onClick={voice.discard}
                      style={{ ...linkButton, color: t.mutedLight }}
                    >
                      Discard
                    </button>
                  </>
                )}
              </>
            )}
          </div>
        )}

        {/* composer */}
        <div style={{ padding: "16px 0", display: "flex", gap: 8, alignItems: "flex-end" }}>
          {voice && (
            <IconButton
              theme={t}
              size={38}
              radius={999}
              onClick={voice.toggle}
              title="Voice message"
              bg={voice.recording ? "#e0245e" : t.cardBg2}
              color={voice.recording ? "#fff" : t.muted}
            >
              {voice.recording ? <span style={{ fontSize: 14 }}>■</span> : <IconMic size={16} />}
            </IconButton>
          )}
          <textarea
            ref={taRef}
            value={input}
            onChange={(e) => onInput(e.target.value)}
            onKeyDown={(e) => {
              // Enter sends; Shift+Enter (or Alt+Enter) drops to a new line.
              if (e.key === "Enter" && !e.shiftKey && !e.altKey) {
                e.preventDefault();
                onSend();
              }
            }}
            disabled={busy || disabled}
            placeholder={placeholder}
            rows={1}
            // `no-scrollbar-arrows` hides the native scrollbar (Firefox +
            // WebKit) so a long message has no chrome — the caret and drag still
            // scroll it. See globals.css.
            className="no-scrollbar-arrows"
            style={{
              flex: 1,
              minWidth: 100,
              resize: "none",
              maxHeight: 140,
              overflowY: "auto",
              background: t.inputBg,
              border: `1px solid ${t.inputBorder}`,
              borderRadius: 20,
              padding: "10px 18px",
              fontSize: text.base,
              lineHeight: 1.5,
              fontFamily: "inherit",
              color: t.text,
              outline: "none",
            }}
          />
          {onUpload && (
            <FilePicker
              accept={COMPOSER_ACCEPT}
              onPick={(files) => onUpload(files?.[0] ?? null)}
              disabled={busy || uploading}
              // Same file twice in a row is normal here (a failed upload, or a
              // doc sent to two different threads).
              resetAfterPick
              label=""
              ariaLabel="Attach a file"
              icon={<IconAttach size={16} />}
              wrapperStyle={{ flex: "none" }}
              buttonStyle={{
                width: 38,
                height: 38,
                borderRadius: "50%",
                background: t.cardBg2,
                color: t.muted,
                border: `1px solid ${t.cardBorder}`,
                justifyContent: "center",
                gap: 0,
                padding: 0,
              }}
            />
          )}
          {showAiMode && <AiModePicker theme={t} state={aiMode} />}
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
              fontSize: 16,
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

/**
 * The star button + its menu. A locked mode (plan lacks `aiModes`) is still
 * listed, greyed out with a lock glyph, rather than omitted — the whole point
 * of "visible but locked" is that a Free learner sees what upgrading buys
 * instead of never learning the picker exists. Clicking a locked row goes to
 * /pricing instead of selecting it; the real gate is server-side regardless
 * (app/api/raya/chat/route.ts clamps back to the default), this is only UX.
 */
function AiModePicker({ theme: t, state }: { theme: AppTheme; state: ReturnType<typeof useAiMode> }) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLSpanElement>(null);
  const current = state.modes.find((m) => m.id === state.mode) ?? state.modes[0];

  return (
    <span ref={triggerRef}>
      <IconButton
        theme={t}
        size={38}
        radius={999}
        onClick={() => setOpen((o) => !o)}
        title={`AI mode — ${current.label}`}
        bg={open ? t.rowActiveBg : undefined}
        color={t.text}
      >
        <IconAiMode size={16} />
      </IconButton>
      {open && (
        <AiModeMenu
          theme={t}
          triggerRef={triggerRef}
          state={state}
          onClose={() => setOpen(false)}
        />
      )}
    </span>
  );
}

/**
 * Portal-rendered so it escapes the composer's own stacking context, exactly
 * like ChatHistoryList's RowMenu (components/chat/chat-history-list.tsx) —
 * this is the second place that pattern was needed, which is the point where
 * it stopped being that file's private concern.
 */
function AiModeMenu({
  theme: t,
  triggerRef,
  state,
  onClose,
}: {
  theme: AppTheme;
  triggerRef: RefObject<HTMLSpanElement | null>;
  state: ReturnType<typeof useAiMode>;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [rect, setRect] = useState<{ left: number; bottom: number } | null>(null);

  useEffect(() => {
    const r = triggerRef.current?.getBoundingClientRect();
    if (r) setRect({ left: r.left, bottom: r.bottom });
  }, [triggerRef]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (
        ref.current &&
        !ref.current.contains(e.target as Node) &&
        !triggerRef.current?.contains(e.target as Node)
      ) {
        onClose();
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const onMove = () => onClose();
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", onMove);
    window.addEventListener("scroll", onMove, true);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onMove);
      window.removeEventListener("scroll", onMove, true);
    };
  }, [onClose, triggerRef]);

  if (!rect) return null;

  const W = 240;
  // Anchored above the composer, right-aligned to the trigger — the composer
  // sits at the bottom of the surface, so opening downward would run the menu
  // off the viewport more often than not.
  const left = Math.max(8, Math.min(rect.left, window.innerWidth - W - 8));

  return createPortal(
    <div
      ref={ref}
      role="menu"
      style={{
        position: "fixed",
        left,
        bottom: window.innerHeight - rect.bottom + 46,
        width: W,
        zIndex: 5100,
        background: t.cardBg,
        border: `1px solid ${t.cardBorder}`,
        borderRadius: 13,
        boxShadow: "0 18px 44px rgba(15,23,42,0.18)",
        padding: 5,
        display: "flex",
        flexDirection: "column",
        gap: 2,
      }}
    >
      <div style={{ padding: "5px 9px 3px", fontSize: 12, fontWeight: 700, color: t.mutedLight, textTransform: "uppercase", letterSpacing: "0.03em" }}>
        AI mode
      </div>
      {state.modes.map((m: { id: AiMode; label: string; blurb: string }) => {
        const active = m.id === state.mode;
        const locked = !state.unlocked && m.id !== "encouraging";
        return (
          <button
            key={m.id}
            role="menuitem"
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (locked) {
                window.location.href = "/pricing";
                return;
              }
              state.setMode(m.id);
              onClose();
            }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 9,
              width: "100%",
              textAlign: "left",
              background: active ? t.rowActiveBg : "transparent",
              border: "1px solid transparent",
              borderRadius: 9,
              padding: "7px 9px",
              cursor: "pointer",
              color: locked ? t.mutedLight : t.text,
              fontFamily: "inherit",
              opacity: locked ? 0.75 : 1,
            }}
          >
            <span style={{ flex: "none", width: 16, display: "flex", color: t.muted }}>
              {active && <IconCheck size={14} />}
              {locked && <IconLock size={13} />}
            </span>
            <span style={{ minWidth: 0 }}>
              <span style={{ display: "block", fontSize: 13.5, fontWeight: 600 }}>{m.label}</span>
              <span style={{ display: "block", fontSize: 12, color: t.mutedLight, marginTop: 1 }}>
                {locked ? "Upgrade to Plus to unlock" : m.blurb}
              </span>
            </span>
          </button>
        );
      })}
    </div>,
    document.body,
  );
}
