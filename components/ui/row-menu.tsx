"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import type { AppTheme } from "@/components/ui/tokens";

/**
 * A small overflow (⋮) menu, positioned from the trigger's viewport rect and
 * rendered through a portal so it escapes any ancestor `overflow`/transform.
 *
 * Extracted from the conversation history list (chat-history-list.tsx), which
 * needed exactly this — a portal-based menu that behaves the same whether it's
 * mounted in a wide sidebar or a clipped dropdown — for its own row actions.
 * Any list of generated-content rows (Tools outputs, self-tests, room
 * challenges, Schools Prepare resources) that wants the same "⋮ → confirm"
 * pattern for archive/delete reuses this rather than re-implementing the
 * positioning math.
 */

export type MenuItem = {
  key: string;
  label: string;
  sublabel?: string;
  icon?: ReactNode;
  tone?: "accent" | "danger";
  onSelect: () => void;
};

export function RowMenu({
  theme: t,
  x,
  y,
  items,
  onClose,
}: {
  theme: AppTheme;
  x: number;
  y: number;
  items: MenuItem[];
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    // Fixed coordinates were measured once; anything that moves the trigger
    // leaves the menu behind, so it closes rather than floating detached.
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
  }, [onClose]);

  if (!mounted) return null;

  const W = 226;
  // Flip back inside the viewport rather than opening off-screen — the trigger
  // often sits near the right edge of a narrow column.
  const left = Math.max(8, Math.min(x - W, window.innerWidth - W - 8));
  const top = Math.min(y + 6, Math.max(8, window.innerHeight - 8 - items.length * 46));

  const accentBg = t.dark ? "rgba(99,102,241,0.16)" : "rgba(99,102,241,0.09)";
  const accentBorder = t.dark ? "rgba(99,102,241,0.42)" : "rgba(99,102,241,0.3)";
  const accentInk = t.dark ? "#a5b4fc" : "#6366f1";

  return createPortal(
    <div
      ref={ref}
      role="menu"
      style={{
        position: "fixed",
        left,
        top,
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
      {items.map((item) => {
        const accent = item.tone === "accent";
        const danger = item.tone === "danger";
        return (
          <button
            key={item.key}
            role="menuitem"
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
              item.onSelect();
            }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 9,
              width: "100%",
              textAlign: "left",
              background: accent ? accentBg : "transparent",
              border: `1px solid ${accent ? accentBorder : "transparent"}`,
              borderRadius: 9,
              padding: "7px 9px",
              cursor: "pointer",
              color: danger ? "#ef4444" : t.text,
              fontFamily: "inherit",
            }}
          >
            {item.icon && (
              <span
                style={{
                  flex: "none",
                  display: "flex",
                  color: accent ? accentInk : danger ? "#ef4444" : t.muted,
                }}
              >
                {item.icon}
              </span>
            )}
            <span style={{ minWidth: 0 }}>
              <span style={{ display: "block", fontSize: 13.5, fontWeight: 600 }}>{item.label}</span>
              {item.sublabel && (
                <span style={{ display: "block", fontSize: 12, color: t.mutedLight, marginTop: 1 }}>
                  {item.sublabel}
                </span>
              )}
            </span>
          </button>
        );
      })}
    </div>,
    document.body,
  );
}
