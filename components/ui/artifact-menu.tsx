"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { IconArchive, IconDots, IconTrash, IconUnarchive } from "@/components/ui/icons";
import { RowMenu, type MenuItem } from "@/components/ui/row-menu";
import { useTranslate } from "@/components/ui/locale";
import type { AppTheme } from "@/components/ui/tokens";
import type { MessageKey } from "@/lib/i18n";

/**
 * The "⋮ → confirm" pattern the conversation history list already uses
 * (chat-history-list.tsx), generalised for one row of generated content:
 * a Tools output, a self-test, a room challenge, a Schools Prepare resource.
 *
 * Every one of those lives in its own list with its own row markup, so this
 * does NOT own the list's state — it is a single, self-contained control a
 * row drops in next to its other actions. What it shares with the
 * conversation list is only the parts that must not diverge: the portal menu
 * (components/ui/row-menu.tsx) and the "say what happens before it happens"
 * confirm dialog, including delete's honest caveat.
 */
export function ArtifactMenu({
  theme: t,
  itemLabel,
  archived = false,
  canArchive = true,
  canDelete = true,
  deleteCaveatKey,
  onArchive,
  onDelete,
  menuLabel,
}: {
  theme: AppTheme;
  /** Shown under the confirm dialog's title, e.g. "Quiz — Chapter 3". */
  itemLabel: string;
  archived?: boolean;
  /** Hide the archive/restore item entirely — e.g. this row has no such notion yet. */
  canArchive?: boolean;
  /** Hide the delete item entirely — e.g. only the creator/room owner may delete. */
  canDelete?: boolean;
  /** Which surface-specific "this also…" line to show under delete's body. */
  deleteCaveatKey?: MessageKey;
  onArchive?: (archived: boolean) => Promise<void> | void;
  onDelete: () => Promise<void> | void;
  menuLabel?: string;
}) {
  const tr = useTranslate();
  const [menuAt, setMenuAt] = useState<{ x: number; y: number } | null>(null);
  const [pending, setPending] = useState<"archive" | "unarchive" | "delete" | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!canArchive && !canDelete) return null;

  const items: MenuItem[] = [
    ...(canArchive
      ? [
          archived
            ? {
                key: "unarchive",
                label: tr("hist.unarchive"),
                sublabel: tr("hist.unarchive.menuSub"),
                icon: <IconUnarchive size={15} />,
                onSelect: () => setPending("unarchive"),
              }
            : {
                key: "archive",
                label: tr("hist.archive"),
                sublabel: tr("hist.archive.menuSub"),
                icon: <IconArchive size={15} />,
                onSelect: () => setPending("archive"),
              },
        ]
      : []),
    ...(canDelete
      ? [
          {
            key: "delete",
            label: tr("hist.delete"),
            sublabel: tr("hist.delete.menuSub"),
            icon: <IconTrash size={15} />,
            tone: "danger" as const,
            onSelect: () => setPending("delete"),
          },
        ]
      : []),
  ];

  async function run() {
    if (running || !pending) return;
    setRunning(true);
    setError(null);
    try {
      if (pending === "delete") await onDelete();
      else await onArchive?.(pending === "archive");
      setPending(null);
    } catch (e) {
      // The server can legitimately refuse this (e.g. a class-linked Prepare
      // resource, or a class assignment masquerading as a personal test) —
      // closing the dialog on that would look like it worked. Stay open and
      // say why instead.
      setError(e instanceof Error && e.message ? e.message : tr("artifact.actionFailed"));
    } finally {
      setRunning(false);
    }
  }

  const danger = pending === "delete";
  const k = (suffix: string) => `artifact.${pending}.${suffix}` as MessageKey;

  return (
    <>
      <button
        type="button"
        aria-label={menuLabel ?? tr("hist.actions")}
        title={menuLabel ?? tr("hist.actions")}
        onClick={(e) => {
          e.stopPropagation();
          const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
          setMenuAt({ x: r.right, y: r.bottom });
        }}
        style={{
          flex: "none",
          display: "flex",
          alignItems: "center",
          background: "none",
          border: "none",
          padding: "2px 4px",
          cursor: "pointer",
          color: t.mutedLight,
          fontFamily: "inherit",
        }}
      >
        <IconDots size={15} />
      </button>

      {menuAt && <RowMenu theme={t} x={menuAt.x} y={menuAt.y} items={items} onClose={() => setMenuAt(null)} />}

      {pending && (
        <Modal onClose={() => { setPending(null); setError(null); }} label={tr(k("title"))} maxWidth={460} center>
          <div
            style={{
              background: t.cardBg,
              border: `1px solid ${t.cardBorder}`,
              borderRadius: 20,
              padding: 24,
              boxShadow: "0 24px 60px rgba(15,23,42,0.22)",
            }}
          >
            <h2 style={{ fontSize: "1.12rem", fontWeight: 800, color: t.text, margin: "0 0 4px", letterSpacing: "-0.01em" }}>
              {tr(k("title"))}
            </h2>
            <p style={{ fontSize: 13, color: t.mutedLight, margin: "0 0 12px", fontWeight: 600 }}>{itemLabel}</p>
            <p style={{ fontSize: 14.5, color: t.muted, lineHeight: 1.65, margin: 0 }}>{tr(k("body"))}</p>
            {danger && deleteCaveatKey && (
              <p
                style={{
                  fontSize: 13.5,
                  color: t.mutedLight,
                  lineHeight: 1.6,
                  margin: "12px 0 0",
                  padding: "10px 12px",
                  background: t.cardBg2,
                  border: `1px solid ${t.cardBorder}`,
                  borderRadius: 12,
                }}
              >
                {tr(deleteCaveatKey)}
              </p>
            )}
            {error && (
              <p style={{ fontSize: 13.5, color: "#ef4444", lineHeight: 1.5, margin: "12px 0 0" }}>{error}</p>
            )}
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 20 }}>
              <button
                type="button"
                onClick={() => {
                  setPending(null);
                  setError(null);
                }}
                disabled={running}
                style={btn(t, "ghost")}
              >
                {tr("hist.cancel")}
              </button>
              <button type="button" onClick={run} disabled={running} style={btn(t, danger ? "danger" : "primary")}>
                {running ? tr("hist.working") : tr(k("confirm"))}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}

function btn(t: AppTheme, kind: "primary" | "ghost" | "danger"): React.CSSProperties {
  const base: React.CSSProperties = {
    borderRadius: 999,
    padding: "9px 18px",
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
    fontFamily: "inherit",
    border: "1px solid transparent",
  };
  if (kind === "ghost") {
    return { ...base, background: "transparent", border: `1px solid ${t.cardBorder}`, color: t.muted };
  }
  if (kind === "danger") {
    return { ...base, background: "#dc2626", color: "#fff" };
  }
  return { ...base, background: t.ctaBg, color: t.ctaText };
}
