"use client";

import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import { AttachmentChip, type Attachment } from "@/components/attachment";
import { IconButton } from "@/components/ui/shell";
import { IconMic, IconAttach, IconAiMode, IconCheck, IconLock } from "@/components/ui/icons";
import { text, type AppTheme } from "@/components/ui/tokens";
import { FilePicker } from "@/components/ui/file-picker";
import { useTranslate } from "@/components/ui/locale";
import type { MessageKey } from "@/lib/i18n";
import { useAiMode } from "./use-ai-mode";
import type { AiMode } from "@/lib/raya/modes";

/** UI-display keys for the three AI modes — the underlying `AI_MODES` data
 *  (lib/raya/modes.ts) stays English since nothing there reaches the LLM
 *  prompt, but is shared client/server, so translation happens at render time. */
const MODE_LABEL_KEY: Record<AiMode, MessageKey> = {
  encouraging: "chat.mode.encouraging.label",
  direct: "chat.mode.direct.label",
  challenging: "chat.mode.challenging.label",
};
const MODE_BLURB_KEY: Record<AiMode, MessageKey> = {
  encouraging: "chat.mode.encouraging.blurb",
  direct: "chat.mode.direct.blurb",
  challenging: "chat.mode.challenging.blurb",
};

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
 *
 * Its SHAPE is the stylesheet's call, not this file's: below 900px every surface
 * gets two tiers — the growing text box on a full-width row, every control on a
 * second row under it — and from 900px up it flattens back to the single row.
 * See `.chat-composer` in globals.css, and `stacked` below for the room's
 * exception.
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
  stacked = false,
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
  /**
   * Pin the two tiers at EVERY width — the text box on a full-width row of its
   * own with every control beneath it.
   *
   * The two-tier shape is no longer opt-in: below 900px every surface wears it
   * (see `.chat-composer` in globals.css), because a phone cannot give a usable
   * text box AND four round buttons one row. What this flag buys is the same
   * shape on a WIDE screen, and only the room's group chat wants that: it is the
   * one composer carrying a labelled button — "Ask Raya" — next to the round
   * ones, which left the field a narrow slot in the middle of its own composer
   * even on a desktop.
   */
  stacked?: boolean;
}) {
  const tr = useTranslate();
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

  /*
   * Pinned to the bottom, but reading as an object that floats over the thread
   * rather than a bar bolted to its edge.
   *
   * The default composer is a full-bleed strip: a top border and a solid fill
   * across the whole width. That is right when the field is one line. Stacked it
   * is two, and the same strip treatment turned the bottom of a room into a
   * heavy block of chrome. So the strip goes: no border, no fill of its own, and
   * the rounded box inside carries a shadow so it lifts off the conversation.
   *
   * It stays a flex sibling of the thread rather than an absolute overlay — the
   * thread must never scroll its last message underneath a floating panel it
   * cannot push past.
   */
  const floating = stacked && !centered;

  return (
    <div
      style={
        centered
          ? { width: "100%" }
          : floating
            ? { background: "transparent" }
            : { borderTop: `1px solid ${t.cardBorder}`, background: t.cardBg }
      }
      data-centered={centered || undefined}
    >
      {/* `.chat-col` — the one box the thread and the banner also use. The
          gutter is INSIDE its max-width, which is the whole point: the field
          and the message bubbles above it now resolve to the same left edge
          instead of sitting 24px apart. */}
      <div className="chat-col" style={{ paddingTop: centered ? 0 : floating ? 4 : 12 }}>
        {/* pending attachments */}
        {(pending.length > 0 || uploading) && (
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "0.4rem", padding: "0 0 8px" }}>
            {pending.map((a) => (
              <AttachmentChip key={a.id} file={a} onRemove={() => onRemovePending?.(a.id)} busy={busy} />
            ))}
            {uploading && <span style={{ fontSize: text.xs, color: t.mutedLight }}>{tr("chat.readingDocument")}</span>}
          </div>
        )}

        {/* the day's plan allowance — deliberately not styled as an error:
            reaching it is the plan working, not something going wrong */}
        {left != null && (spent || left <= LOW_WATER) && (
          <div style={{ padding: "0 0 8px", fontSize: text.sm, color: spent ? t.text : t.mutedLight }}>
            {spent ? (
              <>
                {tr("chat.quota.spentPrefix")} {quota?.limit} {tr("chat.quota.spentSuffix")}{" "}
                <a href="/pricing" style={{ color: "inherit", textDecoration: "underline" }}>
                  {tr("chat.quota.upgradeLink")}
                </a>
                .
              </>
            ) : (
              `${left} ${tr(left === 1 ? "chat.quota.leftOne" : "chat.quota.leftOther")}`
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
                  {tr("chat.retry")}
                </button>
                {voice.discard && (
                  <>
                    {" · "}
                    <button
                      type="button"
                      onClick={voice.discard}
                      style={{ ...linkButton, color: t.mutedLight }}
                    >
                      {tr("chat.discard")}
                    </button>
                  </>
                )}
              </>
            )}
          </div>
        )}

        {/* composer */}
        {(() => {
          const voiceBtn = voice && (
            <IconButton
              theme={t}
              size={38}
              radius={999}
              onClick={voice.toggle}
              title={tr("chat.voiceMessage")}
              bg={voice.recording ? "#e0245e" : t.cardBg2}
              color={voice.recording ? "#fff" : t.muted}
            >
              {voice.recording ? <span style={{ fontSize: 14 }}>■</span> : <IconMic size={16} />}
            </IconButton>
          );
          const textBox = (
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
            // WebKit) so a long message has no chrome — the caret and drag
            // still scroll it. The field's BOX — fill, border, radius, padding,
            // and whether it is a tier of its own or a cell in a row — is
            // `.chat-composer-field` in globals.css, because that is the half
            // of it that changes with the viewport. What is width-independent
            // stays here.
            className="no-scrollbar-arrows chat-composer-field"
            style={{
              minWidth: 100,
              resize: "none",
              maxHeight: 140,
              overflowY: "auto",
              fontSize: text.base,
              lineHeight: 1.5,
              fontFamily: "inherit",
              color: t.text,
              outline: "none",
            }}
          />
          );
          const uploadBtn = onUpload && (
            <FilePicker
              accept={COMPOSER_ACCEPT}
              onPick={(files) => onUpload(files?.[0] ?? null)}
              disabled={busy || uploading}
              // Same file twice in a row is normal here (a failed upload, or a
              // doc sent to two different threads).
              resetAfterPick
              label=""
              ariaLabel={tr("chat.attachFile")}
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
          );
          const sendBtn = (
            <span
              role="button"
              className="chat-composer-send"
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
          );
          const modeBtn = showAiMode ? <AiModePicker theme={t} state={aiMode} /> : null;

          /*
           * ONE tree, both shapes.
           *
           * The composer used to render two different subtrees — a flex row, or
           * a bounded two-tier box — chosen in JS. That was fine while the choice
           * was per-surface and fixed. It is not fine now that the choice is the
           * VIEWPORT's: deciding it here would mean measuring the window during
           * render, which the server cannot do, so every phone would paint the
           * desktop row for a frame and then jump.
           *
           * So the markup below is always the two-tier shape and the stylesheet
           * flattens it back into a single row at 900px and up (unless `stacked`
           * pins it). `.chat-composer-lead` / `-tail` are `display: contents`
           * wrappers: they exist to carry the flex `order` that the flattened row
           * needs — voice ahead of the field, everything else behind it — without
           * putting a box of their own between the buttons and their flex line.
           */
          return (
            <div
              className={
                "chat-composer" + (stacked ? " is-stacked" : "") + (floating ? " is-floating" : "")
              }
              style={{
                // Theme first, layout second: the stylesheet owns which of these
                // apply at a given width, but only the theme knows the colours.
                ["--composer-box-bg" as string]: floating ? t.cardBg : t.inputBg,
                ["--composer-field-bg" as string]: t.inputBg,
                ["--composer-border" as string]: t.inputBorder,
                ["--composer-shadow" as string]: t.dark
                  ? "0 6px 22px rgba(0,0,0,0.42)"
                  : "0 6px 22px rgba(15,23,42,0.13)",
              }}
            >
              {/* Two tiers, ONE surface — not a field with buttons loose under
                  it. The border, fill and radius live on this box, and
                  `.chat-composer-box:focus-within` lights the border, which is
                  the affordance the textarea gives up when it goes transparent. */}
              <div className="chat-composer-box">
                {textBox}
                {/* Send stays hard right — the same corner it occupies in the
                    single row, so the muscle memory survives the new shape. */}
                <div className="chat-composer-actions">
                  <span className="chat-composer-lead">{voiceBtn}</span>
                  <span className="chat-composer-tail">
                    {uploadBtn}
                    {modeBtn}
                    {extraAction}
                  </span>
                  <span className="chat-composer-spacer" />
                  {sendBtn}
                </div>
              </div>
            </div>
          );
        })()}
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
  const tr = useTranslate();
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
        title={`${tr("chat.aiModeTitlePrefix")} ${tr(MODE_LABEL_KEY[current.id])}`}
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
  const tr = useTranslate();
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
        {tr("chat.aiModeHeading")}
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
              <span style={{ display: "block", fontSize: 13.5, fontWeight: 600 }}>{tr(MODE_LABEL_KEY[m.id])}</span>
              <span style={{ display: "block", fontSize: 12, color: t.mutedLight, marginTop: 1 }}>
                {locked ? tr("chat.aiModeUpgradeHint") : tr(MODE_BLURB_KEY[m.id])}
              </span>
            </span>
          </button>
        );
      })}
    </div>,
    document.body,
  );
}
