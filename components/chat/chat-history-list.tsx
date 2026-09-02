"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Modal } from "@/components/ui/modal";
import {
  IconArchive,
  IconChevron,
  IconDots,
  IconMemorize,
  IconTrash,
  IconUnarchive,
} from "@/components/ui/icons";
import { useTranslate } from "@/components/ui/locale";
import { filterBySearch } from "@/lib/search";
import { LIST_SEARCH_MIN } from "@/components/ui/list-filter";
import type { AppTheme } from "@/components/ui/tokens";
import type { MessageKey } from "@/lib/i18n";
import type { Conversation } from "./types";

/**
 * The conversation history: a "+ New session" button and the list of past
 * conversations. Shared by the Raya sidebar and the Raya-for-Schools in-tab
 * history, so everything past plain delete is OPTIONAL — pass `onArchive` /
 * `onMemorize` and the row menu grows those verbs; omit them (Schools) and it
 * offers delete alone.
 *
 * A row used to carry a bare ✕, which made destroying a thread the single
 * cheapest gesture in the list: one mis-tap, no warning, nothing recoverable.
 * Now every row action goes through a menu and then a dialog that says what the
 * action does BEFORE it runs — including the parts a learner would not guess
 * (archiving withdraws the thread from Raya's context; deleting does NOT unlearn
 * what the Kernel already took from it).
 */

type PendingAction = {
  conv: Conversation;
  kind: "memorize" | "archive" | "unarchive" | "delete";
};

export function ChatHistoryList({
  theme: t,
  conversations,
  activeId,
  busy,
  onNew,
  onSelect,
  onDelete,
  onArchive,
  onMemorize,
}: {
  theme: AppTheme;
  conversations: Conversation[];
  activeId: string | null;
  busy: boolean;
  onNew: () => void;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  /** Archive / restore. Absent → the menu omits both. */
  onArchive?: (id: string, archived: boolean) => Promise<boolean>;
  /** Hand the thread to the Kernel. Resolves null when it could not be reached. */
  onMemorize?: (id: string) => Promise<{ root_gap: string | null; concepts: number | null } | null>;
}) {
  const tr = useTranslate();
  const [menuFor, setMenuFor] = useState<{ conv: Conversation; x: number; y: number } | null>(null);
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [query, setQuery] = useState("");

  /**
   * Search is what makes archiving worth choosing over deleting.
   *
   * "Archive" promises the thread is put away but kept. Behind a collapsed
   * disclosure at the bottom of a two-hundred-row sidebar, kept is only true in
   * the database — nobody is scrolling to it. Filtering by title reaches
   * archived threads as readily as live ones, and the disclosure opens by itself
   * whenever the query finds something inside it, so a match is never hidden
   * behind a click the reader does not know to make.
   *
   * Titles only: transcripts are not held client-side, and a field that quietly
   * searches less than the user assumes is worse than a narrower promise.
   */
  const searchable = conversations.length >= LIST_SEARCH_MIN;

  // A query must not outlive the field that set it — delete enough threads and
  // the input goes away, so the text has to go with it.
  useEffect(() => {
    if (!searchable) setQuery("");
  }, [searchable]);

  const q = searchable ? query.trim() : "";
  const matching = q ? filterBySearch(conversations, q, (c) => [c.title]) : conversations;

  // `archived_at` is optional on the type: a surface that has no such notion
  // (Schools) sends rows without it, and those must all count as live.
  const live = matching.filter((c) => !c.archived_at);
  const archived = matching.filter((c) => c.archived_at);
  const archivedOpen = showArchived || (q.length > 0 && archived.length > 0);

  const row = (c: Conversation) => (
    <ConversationRow
      key={c.id}
      theme={t}
      conv={c}
      active={c.id === activeId}
      onSelect={() => onSelect(c.id)}
      onOpenMenu={(x, y) => setMenuFor({ conv: c, x, y })}
      untitled={tr("hist.untitled")}
      menuLabel={tr("hist.actions")}
      memorizedLabel={tr("hist.memorized")}
    />
  );

  return (
    <>
      {/* A real <button>, not a clickable div: it is the primary action of this
          list and was previously unreachable by keyboard and invisible to
          assistive tech. Same for the Archived disclosure below. */}
      <button
        type="button"
        disabled={busy}
        onClick={(e) => {
          e.stopPropagation();
          onNew();
        }}
        style={{
          cursor: busy ? "default" : "pointer",
          background: t.sidebarActiveBg,
          color: t.sidebarText,
          border: `1px solid ${t.sidebarBorder}`,
          borderRadius: 9,
          padding: "8px 10px",
          width: "100%",
          fontSize: 13,
          fontWeight: 650,
          fontFamily: "inherit",
          textAlign: "center",
          marginBottom: 2,
          opacity: busy ? 0.5 : 1,
        }}
      >
        {tr("hist.new")}
      </button>

      {/* Not the shared <ListToolbar>: the sidebar has its own palette
          (sidebarBg/sidebarText/sidebarMuted, not card/input), and a field
          borrowing the card colours reads as a panel dropped into the rail. The
          part that must not diverge — what counts as a match — is shared, and
          lives in lib/search.ts. */}
      {searchable && (
        <div style={{ position: "relative", margin: "6px 0 4px" }}>
          <input
            type="search"
            className="list-search-input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape" && query) {
                e.stopPropagation();
                setQuery("");
              }
            }}
            placeholder={tr("hist.search")}
            aria-label={tr("hist.search")}
            style={{
              width: "100%",
              boxSizing: "border-box",
              background: t.sidebarActiveBg,
              color: t.sidebarText,
              border: `1px solid ${t.sidebarBorder}`,
              borderRadius: 9,
              padding: "7px 26px 7px 10px",
              fontSize: 13,
              fontFamily: "inherit",
              outline: "none",
            }}
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label={tr("hist.cancel")}
              style={{
                position: "absolute",
                right: 4,
                top: "50%",
                transform: "translateY(-50%)",
                width: 20,
                height: 20,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: 0,
                border: "none",
                borderRadius: 999,
                background: "transparent",
                color: t.sidebarMuted,
                fontSize: 13,
                lineHeight: 1,
                cursor: "pointer",
              }}
            >
              ✕
            </button>
          )}
        </div>
      )}

      {conversations.length === 0 && (
        <div style={{ fontSize: 13, color: t.sidebarMuted, padding: "6px 10px" }}>
          {tr("hist.empty")}
        </div>
      )}

      {/* "Nothing here" and "nothing matched" are different sentences, and only
          the second one has a remedy. Telling a learner with 200 threads that
          they have no conversations because they mistyped a word is the version
          of this that gets reported as data loss. */}
      {conversations.length > 0 && matching.length === 0 && (
        <div style={{ fontSize: 13, color: t.sidebarMuted, padding: "6px 10px", lineHeight: 1.5 }}>
          {tr("hist.noMatch")}
        </div>
      )}

      {live.map(row)}

      {/* Archived threads stay reachable behind one click. Hiding them outright
          would make "archive" a synonym for "delete", which is the distinction
          the whole menu exists to draw. */}
      {archived.length > 0 && (
        <>
          <button
            type="button"
            aria-expanded={archivedOpen}
            onClick={(e) => {
              e.stopPropagation();
              setShowArchived((s) => !s);
            }}
            style={{
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
              width: "100%",
              background: "none",
              border: "none",
              borderRadius: 9,
              padding: "8px 10px",
              marginTop: 4,
              fontSize: 12,
              fontWeight: 700,
              fontFamily: "inherit",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              textAlign: "left",
              color: t.sidebarMuted,
            }}
          >
            <IconChevron
              size={11}
              style={{
                flex: "none",
                transition: "transform 0.15s ease",
                transform: archivedOpen ? "rotate(0deg)" : "rotate(-90deg)",
              }}
            />
            {tr("hist.archivedSection")} ({archived.length})
          </button>
          {archivedOpen && archived.map(row)}
        </>
      )}

      {menuFor && (
        <RowMenu
          theme={t}
          x={menuFor.x}
          y={menuFor.y}
          onClose={() => setMenuFor(null)}
          items={[
            ...(onMemorize && !menuFor.conv.archived_at
              ? [
                  {
                    key: "memorize",
                    label: tr("hist.memorize"),
                    sublabel: tr("hist.memorize.menuSub"),
                    icon: <IconMemorize size={15} />,
                    tone: "accent" as const,
                    onSelect: () => setPending({ conv: menuFor.conv, kind: "memorize" }),
                  },
                ]
              : []),
            ...(onArchive
              ? [
                  menuFor.conv.archived_at
                    ? {
                        key: "unarchive",
                        label: tr("hist.unarchive"),
                        sublabel: tr("hist.unarchive.menuSub"),
                        icon: <IconUnarchive size={15} />,
                        onSelect: () => setPending({ conv: menuFor.conv, kind: "unarchive" }),
                      }
                    : {
                        key: "archive",
                        label: tr("hist.archive"),
                        sublabel: tr("hist.archive.menuSub"),
                        icon: <IconArchive size={15} />,
                        onSelect: () => setPending({ conv: menuFor.conv, kind: "archive" }),
                      },
                ]
              : []),
            {
              key: "delete",
              label: tr("hist.delete"),
              sublabel: tr("hist.delete.menuSub"),
              icon: <IconTrash size={15} />,
              tone: "danger" as const,
              onSelect: () => setPending({ conv: menuFor.conv, kind: "delete" }),
            },
          ]}
        />
      )}

      {pending && (
        <ConfirmAction
          theme={t}
          action={pending}
          onClose={() => setPending(null)}
          onDelete={onDelete}
          onArchive={onArchive}
          onMemorize={onMemorize}
        />
      )}
    </>
  );
}

/** One history row: the title (opens it) plus the overflow trigger. */
function ConversationRow({
  theme: t,
  conv: c,
  active,
  onSelect,
  onOpenMenu,
  untitled,
  menuLabel,
  memorizedLabel,
}: {
  theme: AppTheme;
  conv: Conversation;
  active: boolean;
  onSelect: () => void;
  onOpenMenu: (x: number, y: number) => void;
  untitled: string;
  menuLabel: string;
  memorizedLabel: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 4,
        background: active ? t.rowActiveBg : undefined,
        borderRadius: 9,
        padding: "8px 10px",
        // Archived rows read as filed away rather than merely older.
        opacity: c.archived_at ? 0.62 : 1,
      }}
    >
      <span
        onClick={(e) => {
          e.stopPropagation();
          onSelect();
        }}
        title={c.title ?? untitled}
        style={{
          flex: 1,
          minWidth: 0,
          cursor: "pointer",
          fontSize: 13,
          fontWeight: active ? 700 : 500,
          color: active ? t.sidebarText : t.sidebarMuted,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {c.title ?? untitled}
      </span>

      {/* A memorized thread is marked, because "which conversations is Raya
          actually building on" is otherwise invisible to the learner. */}
      {c.memorized_at && (
        <span
          title={memorizedLabel}
          aria-label={memorizedLabel}
          style={{ flex: "none", display: "flex", color: t.link, opacity: 0.85 }}
        >
          <IconMemorize size={13} />
        </span>
      )}

      <button
        type="button"
        aria-label={menuLabel}
        title={menuLabel}
        onClick={(e) => {
          e.stopPropagation();
          const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
          onOpenMenu(r.right, r.bottom);
        }}
        style={{
          flex: "none",
          display: "flex",
          alignItems: "center",
          background: "none",
          border: "none",
          padding: "2px 1px",
          cursor: "pointer",
          color: t.sidebarMuted,
          fontFamily: "inherit",
        }}
      >
        <IconDots size={15} />
      </button>
    </div>
  );
}

type MenuItem = {
  key: string;
  label: string;
  sublabel?: string;
  icon?: ReactNode;
  tone?: "accent" | "danger";
  onSelect: () => void;
};

/**
 * The row menu, rendered through a portal and positioned from the trigger's
 * viewport rect.
 *
 * NOT an absolutely-positioned sibling, which is the pattern used elsewhere in
 * the app (SidebarProfile). It cannot be one here: the Schools surface mounts
 * this list inside a 232px `overflow: auto` dropdown, which would clip an
 * in-tree popover to a sliver. A portal escapes any ancestor overflow, so the
 * one shared component behaves the same in both hosts.
 */
function RowMenu({
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
  // sits at the right edge of a narrow sidebar, so this is the normal case.
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

/** Copy + handler for one confirmable action, keyed off its kind. */
function ConfirmAction({
  theme: t,
  action,
  onClose,
  onDelete,
  onArchive,
  onMemorize,
}: {
  theme: AppTheme;
  action: PendingAction;
  onClose: () => void;
  onDelete: (id: string) => void;
  onArchive?: (id: string, archived: boolean) => Promise<boolean>;
  onMemorize?: (id: string) => Promise<{ root_gap: string | null; concepts: number | null } | null>;
}) {
  const tr = useTranslate();
  const [running, setRunning] = useState(false);
  // Memorize is the one action whose OUTCOME is worth reading: it reports what
  // the Kernel took from the thread. The others just close.
  const [result, setResult] = useState<{ root_gap: string | null } | null>(null);

  const { conv, kind } = action;
  const k = (suffix: string) => `hist.${kind}.${suffix}` as MessageKey;
  const danger = kind === "delete";

  async function run() {
    if (running) return;
    setRunning(true);
    try {
      if (kind === "delete") {
        onDelete(conv.id);
        onClose();
        return;
      }
      if (kind === "archive" || kind === "unarchive") {
        await onArchive?.(conv.id, kind === "archive");
        onClose();
        return;
      }
      const res = await onMemorize?.(conv.id);
      // On failure the engine has already set the surface's error line; closing
      // sends the learner to it instead of leaving a dialog that says nothing.
      if (!res) {
        onClose();
        return;
      }
      setResult({ root_gap: res.root_gap });
    } finally {
      setRunning(false);
    }
  }

  return (
    <Modal onClose={onClose} label={tr(k("title"))} maxWidth={460}>
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
          {result ? tr("hist.memorize.done") : tr(k("title"))}
        </h2>
        <p style={{ fontSize: 13, color: t.mutedLight, margin: "0 0 12px", fontWeight: 600 }}>
          {conv.title ?? tr("hist.untitled")}
        </p>

        {result ? (
          result.root_gap && (
            <p style={{ fontSize: 14.5, color: t.text, lineHeight: 1.6, margin: 0 }}>
              {tr("hist.memorize.doneGap")} <strong>{result.root_gap}</strong>
            </p>
          )
        ) : (
          <>
            <p style={{ fontSize: 14.5, color: t.muted, lineHeight: 1.65, margin: 0 }}>{tr(k("body"))}</p>
            {/* The honest footnote on delete: the thread goes, the learning
                does not. Said here rather than discovered later. */}
            {kind === "delete" && (
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
                {tr("hist.delete.caveat")}
              </p>
            )}
          </>
        )}

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 20 }}>
          {result ? (
            <button type="button" onClick={onClose} style={btn(t, "primary")}>
              OK
            </button>
          ) : (
            <>
              <button type="button" onClick={onClose} disabled={running} style={btn(t, "ghost")}>
                {tr("hist.cancel")}
              </button>
              <button
                type="button"
                onClick={run}
                disabled={running}
                style={btn(t, danger ? "danger" : "primary")}
              >
                {running ? tr("hist.working") : tr(k("confirm"))}
              </button>
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}

function btn(t: AppTheme, kind: "primary" | "ghost" | "danger"): CSSProperties {
  const base: CSSProperties = {
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
