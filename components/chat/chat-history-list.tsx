"use client";

import type { AppTheme } from "@/components/ui/tokens";
import type { Conversation } from "./types";

/**
 * The conversation history: a "+ New session" button and the list of past
 * conversations (switch / delete). Extracted from the Raya chat so both the
 * Raya sidebar and the RAYA-for-Schools in-tab history render the same list.
 */
export function ChatHistoryList({
  theme: t,
  conversations,
  activeId,
  busy,
  onNew,
  onSelect,
  onDelete,
}: {
  theme: AppTheme;
  conversations: Conversation[];
  activeId: string | null;
  busy: boolean;
  onNew: () => void;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <>
      <div
        onClick={(e) => {
          e.stopPropagation();
          onNew();
        }}
        style={{
          cursor: "pointer",
          background: t.sidebarActiveBg,
          color: t.sidebarText,
          borderRadius: 9,
          padding: "8px 10px",
          fontSize: 11,
          fontWeight: 600,
          textAlign: "center",
          marginBottom: 2,
          opacity: busy ? 0.5 : 1,
        }}
      >
        + New session
      </div>
      {conversations.length === 0 && (
        <div style={{ fontSize: 10.5, color: t.sidebarMuted, padding: "6px 10px" }}>
          No conversations yet.
        </div>
      )}
      {conversations.map((c) => {
        const active = c.id === activeId;
        return (
          <div
            key={c.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              background: active ? t.rowActiveBg : undefined,
              borderRadius: 9,
              padding: "8px 10px",
            }}
          >
            <span
              onClick={(e) => {
                e.stopPropagation();
                onSelect(c.id);
              }}
              title={c.title ?? "New conversation"}
              style={{
                flex: 1,
                minWidth: 0,
                cursor: "pointer",
                fontSize: 11,
                fontWeight: active ? 700 : 500,
                color: active ? t.sidebarText : t.sidebarMuted,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {c.title ?? "New conversation"}
            </span>
            <span
              onClick={(e) => {
                e.stopPropagation();
                onDelete(c.id);
              }}
              title="Delete"
              style={{ cursor: "pointer", color: t.mutedLight, fontSize: 11, flex: "none" }}
            >
              ✕
            </span>
          </div>
        );
      })}
    </>
  );
}
