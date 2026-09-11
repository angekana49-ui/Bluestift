"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AppTheme } from "@/components/ui/tokens";
import { useTranslate } from "@/components/ui/locale";

/**
 * The room's invite link, and the two ways to hand it over.
 *
 * The link is not a convenience here, it is the ONLY door into a private room
 * — and every room is private by default (see createRoom), so a room nobody has
 * been sent the link to is a room of one. That is why this is pushed rather
 * than parked in a settings list: `RoomInviteBanner` sits at the top of a room
 * for as long as its creator is alone in it, and disappears by itself the
 * moment somebody joins.
 *
 * `share()` prefers the platform's own share sheet — on a phone that is the
 * whole point, since it opens WhatsApp, Messages, AirDrop and the rest with the
 * link already in them, which is how a group of students actually passes
 * something around. Where there is no share sheet (most desktops) it falls back
 * to the clipboard, which is what the button did before and everywhere.
 */
function useRoomInvite(roomId: string, roomName: string) {
  /*
   * Both of these resolve AFTER mount, never during render: `window` does not
   * exist on the server and `navigator.share` does not exist on most desktops,
   * so reading either one while rendering gives the server and the client two
   * different answers for the same markup.
   */
  const [url, setUrl] = useState("");
  useEffect(() => {
    setUrl(`${window.location.origin}/rooms/${roomId}`);
  }, [roomId]);

  const tr = useTranslate();
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const flash = useCallback(() => {
    setCopied(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 2400);
  }, []);

  const copy = useCallback(async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      flash();
    } catch {
      // Clipboard refused (an insecure origin, a permission prompt declined).
      // The link is on screen in a field of its own, so there is always a way
      // to get it by hand — say nothing rather than raise an error for it.
    }
  }, [url, flash]);

  const share = useCallback(async () => {
    if (!url) return;
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: roomName, text: tr("room.invite.shareText"), url });
        return;
      } catch {
        // Cancelling the share sheet lands here too, which is not a failure and
        // must not become a copy the person did not ask for — unless the sheet
        // never opened, and we cannot tell the two apart. Falling through to
        // the clipboard is the harmless side of that ambiguity.
      }
    }
    await copy();
  }, [url, roomName, tr, copy]);

  return { url, copied, copy, share };
}

/** Primary action + the link itself, shared by both presentations below. */
function InviteControls({
  theme: t,
  roomId,
  roomName,
  compact = false,
}: {
  theme: AppTheme;
  roomId: string;
  roomName: string;
  /** The right panel's 300px column — one column, smaller type. */
  compact?: boolean;
}) {
  const tr = useTranslate();
  const { url, copied, copy, share } = useRoomInvite(roomId, roomName);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input
          readOnly
          value={url}
          aria-label={tr("room.invite.linkLabel")}
          // Selecting on focus makes the manual path one gesture: tap, then
          // the OS copy item is already over a full selection.
          onFocus={(e) => e.currentTarget.select()}
          style={{
            flex: 1,
            minWidth: 0,
            background: t.inputBg,
            border: `1px solid ${t.inputBorder}`,
            borderRadius: 10,
            padding: "8px 10px",
            // 16px on purpose: iOS Safari zooms the whole page in on a focused
            // field under 16px, and this one is focused to be copied from.
            fontSize: 16,
            color: t.muted,
            fontFamily: "inherit",
            textOverflow: "ellipsis",
          }}
        />
        <button
          type="button"
          onClick={() => void copy()}
          title={tr("room.copyInviteLink")}
          style={{
            flex: "none",
            background: t.cardBg2,
            color: t.text,
            border: `1px solid ${t.cardBorder}`,
            borderRadius: 10,
            padding: "9px 12px",
            fontSize: 14,
            fontWeight: 600,
            fontFamily: "inherit",
            cursor: "pointer",
          }}
        >
          {copied ? tr("room.invite.copied") : tr("room.invite.copy")}
        </button>
      </div>
      <button
        type="button"
        onClick={() => void share()}
        style={{
          background: t.ctaBg,
          color: t.ctaText,
          border: "none",
          borderRadius: 99,
          padding: compact ? "9px 14px" : "11px 18px",
          fontSize: compact ? 14 : 15,
          fontWeight: 700,
          fontFamily: "inherit",
          cursor: "pointer",
        }}
      >
        {tr("room.invite.share")}
      </button>
      {/* The one thing someone hesitates over before sending a link. */}
      <div style={{ fontSize: 13, color: t.mutedLight }}>{tr("room.invite.privateNote")}</div>
    </div>
  );
}

/**
 * The push: a room with one member in it is a room that has not been shared.
 * Shown until somebody joins, or until it is dismissed for this visit.
 */
export function RoomInviteBanner({
  theme: t,
  roomId,
  roomName,
  onDismiss,
}: {
  theme: AppTheme;
  roomId: string;
  roomName: string;
  onDismiss: () => void;
}) {
  const tr = useTranslate();
  return (
    <div style={{ flex: "none", padding: "12px 24px 0" }}>
      <div
        style={{
          background: t.cardBg2,
          border: `1px solid ${t.cardBorder}`,
          borderRadius: 16,
          padding: 14,
          display: "flex",
          flexDirection: "column",
          gap: 10,
          maxWidth: 620,
          marginInline: "auto",
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: t.text }}>{tr("room.invite.aloneTitle")}</div>
            <div style={{ fontSize: 14, color: t.muted, marginTop: 2, lineHeight: 1.5 }}>
              {tr("room.invite.aloneBody")}
            </div>
          </div>
          <button
            type="button"
            onClick={onDismiss}
            title={tr("room.invite.dismiss")}
            aria-label={tr("room.invite.dismiss")}
            style={{
              flex: "none",
              width: 30,
              height: 30,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 8,
              border: "none",
              background: "transparent",
              color: t.mutedLight,
              fontSize: 15,
              cursor: "pointer",
            }}
          >
            ✕
          </button>
        </div>
        <InviteControls theme={t} roomId={roomId} roomName={roomName} />
      </div>
    </div>
  );
}

/** The same thing, parked in the right panel for when the banner is gone. */
export function RoomInvitePanelBlock({
  theme: t,
  roomId,
  roomName,
}: {
  theme: AppTheme;
  roomId: string;
  roomName: string;
}) {
  return <InviteControls theme={t} roomId={roomId} roomName={roomName} compact />;
}
