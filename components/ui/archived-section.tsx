"use client";

import { useState, type ReactNode } from "react";
import { IconChevron } from "@/components/ui/icons";
import { useTranslate } from "@/components/ui/locale";
import type { AppTheme } from "@/components/ui/tokens";

/**
 * The collapsible "Archived (N)" disclosure, generalized from the
 * conversation history list (components/chat/chat-history-list.tsx) so every
 * list of generated artifacts follows the same rule: archiving takes a row
 * OUT of the default list, not just dims it in place. Collapsed by default —
 * closed is "out of the way", which is the whole point of archiving something
 * instead of leaving it in the live list.
 *
 * Caller does the split (`items.filter(i => !i.archived_at)` for the live
 * list, the rest here) and supplies its own row rendering as `children`, same
 * division of labour as row-menu.tsx / artifact-menu.tsx.
 */
export function ArchivedDisclosure({
  theme: t,
  count,
  children,
}: {
  theme: AppTheme;
  count: number;
  children: ReactNode;
}) {
  const tr = useTranslate();
  const [open, setOpen] = useState(false);
  if (count === 0) return null;

  return (
    <div style={{ marginTop: 8 }}>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        style={{
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: 6,
          width: "100%",
          background: "none",
          border: "none",
          borderRadius: 9,
          padding: "8px 2px",
          fontSize: 13,
          fontWeight: 700,
          fontFamily: "inherit",
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          textAlign: "left",
          color: t.mutedLight,
        }}
      >
        <IconChevron
          size={11}
          style={{
            flex: "none",
            transition: "transform 0.15s ease",
            transform: open ? "rotate(0deg)" : "rotate(-90deg)",
          }}
        />
        {tr("hist.archivedSection")} ({count})
      </button>
      {open && children}
    </div>
  );
}
