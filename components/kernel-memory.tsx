"use client";

import { useState } from "react";
import Link from "next/link";
import { useAppTheme } from "@/components/ui/theme";
import { panelCard, cardTitle, ghostButton } from "@/components/ui/forms";
import { IconMemorize } from "@/components/ui/icons";
import { ListNoMatch, ListToolbar, useListSearch } from "@/components/ui/list-filter";
import { text } from "@/components/ui/tokens";
import { RayaText } from "@/components/ui/brand";

export type MemorizedConversation = {
  id: string;
  title: string | null;
  memorized_at: string;
};

/**
 * Memory — the Kernel page's list of the conversations the learner deliberately
 * anchored.
 *
 * The counterpart to "Memorize" in the history menu. Without this, memorizing a
 * thread was a one-way gesture into a black box: the learner was told their
 * profile had been updated and then had no way to see WHICH threads Raya is
 * building on, or to take one back. A list you can point at is the difference
 * between a memory and a rumour.
 *
 * The mastery states themselves live one card down in <CognitiveProfile/>; this
 * one answers the other half of the question — where did that come from.
 */
export function KernelMemory({ initial }: { initial: MemorizedConversation[] }) {
  const { theme: t } = useAppTheme();
  const [items, setItems] = useState(initial);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Untitled threads keep the label the list shows them under, so searching
  // "untitled" finds the ones with no title rather than nothing.
  const search = useListSearch(items, (c) => [c.title ?? "Untitled conversation"], {
    noun: "conversations",
  });

  async function forget(id: string) {
    if (busy) return;
    setBusy(id);
    setError(null);
    try {
      const res = await fetch("/api/raya/conversations", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ conversationId: id, action: "forget" }),
      });
      if (!res.ok) {
        setError("Couldn't update your memory. Try again in a moment.");
        return;
      }
      setItems((list) => list.filter((c) => c.id !== id));
      setConfirming(null);
    } catch {
      setError("Couldn't reach the server.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div style={panelCard(t)}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ display: "flex", color: t.link, flex: "none" }}>
          <IconMemorize size={17} />
        </span>
        <h2 style={{ ...cardTitle(t), margin: 0 }}>Memory</h2>
      </div>
      <p style={{ margin: "6px 0 16px", color: t.muted, fontSize: text.sm, lineHeight: 1.6 }}>
        <RayaText>
          The conversations you asked Raya to remember. Each one was read in full and folded into
          your Kernel, and Raya can draw on it later.
        </RayaText>
      </p>

      {items.length === 0 ? (
        <p style={{ margin: 0, color: t.mutedLight, fontSize: text.sm, lineHeight: 1.6 }}>
          <RayaText>
            Nothing memorized yet. Open the ⋯ menu on any conversation in your history and choose
            Memorize — that is what puts it here.
          </RayaText>
        </p>
      ) : (
        <>
        <ListToolbar search={search} />
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {search.visible.map((c) => {
            const open = confirming === c.id;
            return (
              <div
                key={c.id}
                style={{
                  background: t.cardBg2,
                  border: `1px solid ${t.cardBorder}`,
                  borderRadius: 14,
                  padding: "12px 14px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <Link
                    href={`/chat?c=${encodeURIComponent(c.id)}`}
                    style={{
                      flex: 1,
                      minWidth: 160,
                      color: t.text,
                      fontSize: text.sm,
                      fontWeight: 650,
                      textDecoration: "none",
                    }}
                  >
                    {c.title ?? "Untitled conversation"}
                  </Link>
                  <span style={{ color: t.mutedLight, fontSize: text.xs, flex: "none" }}>
                    {new Date(c.memorized_at).toLocaleDateString()}
                  </span>
                  <button
                    type="button"
                    onClick={() => setConfirming(open ? null : c.id)}
                    style={{ ...ghostButton(t), flex: "none", padding: "6px 13px", fontSize: text.xs }}
                  >
                    {open ? "Cancel" : "Remove"}
                  </button>
                </div>

                {/* The awkward part, said before the button rather than after:
                    un-anchoring is not an unlearn. Same honesty the delete
                    dialog carries — the Kernel keeps what it derived, and the
                    only place to remove that is the data controls. */}
                {open && (
                  <div style={{ marginTop: 12, borderTop: `1px solid ${t.cardBorder}`, paddingTop: 12 }}>
                    <p style={{ margin: "0 0 12px", color: t.muted, fontSize: text.sm, lineHeight: 1.6 }}>
                      <RayaText>
                        This takes the conversation off the list, so it stops counting as one you
                        asked Raya to build on. The conversation itself is kept, and the mastery
                        your Kernel already derived from it stays in your profile — removing it
                        here does not unlearn it.
                      </RayaText>
                    </p>
                    <button
                      type="button"
                      onClick={() => void forget(c.id)}
                      disabled={busy === c.id}
                      style={{
                        ...ghostButton(t),
                        borderColor: "#dc2626",
                        color: "#dc2626",
                        opacity: busy === c.id ? 0.6 : 1,
                      }}
                    >
                      {busy === c.id ? "Removing…" : "Remove from memory"}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <ListNoMatch search={search} />
        </>
      )}

      {error && (
        <p style={{ color: "#f87171", margin: "12px 0 0", fontSize: text.sm }}>{error}</p>
      )}
    </div>
  );
}
