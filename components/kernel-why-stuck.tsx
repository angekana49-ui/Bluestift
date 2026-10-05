"use client";

import { useState } from "react";
import Link from "next/link";
import type { PrerequisiteGapsResponse } from "@/lib/kernel/types";
import { useAppTheme } from "@/components/ui/theme";
import { netFetch } from "@/lib/net/client-fetch";
import { useConceptName } from "@/components/ui/concept-name";
import { useTranslate } from "@/components/ui/locale";
import { RayaText } from "@/components/ui/brand";

/**
 * "Why am I stuck?" on a concept of My Kernel — the Kernel's /prerequisite_gaps,
 * read for the learner.
 *
 * Three rules from the Kernel handoff (§2) shape what is shown:
 *  - `gaps` is already in TEACHING order, deepest foundation first: rendered as
 *    numbered steps, top to bottom, never re-sorted;
 *  - `frontier` is shown ("already in place"): it is why a short list is short;
 *  - `truncated` is said out loud: a cut list is never "nothing else missing".
 * A failure is an error state, never an empty list — an empty list here would
 * read as "nothing is missing".
 */

type State =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ready"; data: PrerequisiteGapsResponse }
  | { kind: "notFound" }
  | { kind: "error" };

export function WhyStuck({ label }: { label: string }) {
  const { theme: t } = useAppTheme();
  const tr = useTranslate();
  const name = useConceptName();
  const [state, setState] = useState<State>({ kind: "idle" });
  const [open, setOpen] = useState(false);

  async function load() {
    setState({ kind: "loading" });
    try {
      const res = await netFetch(`/api/kernel/prerequisites?concept=${encodeURIComponent(label)}`, {}, { timeoutMs: 25_000 });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data) return setState({ kind: "error" });
      if (data.notFound) return setState({ kind: "notFound" });
      setState({ kind: "ready", data: data as PrerequisiteGapsResponse });
    } catch {
      setState({ kind: "error" });
    }
  }

  const toggle = () => {
    const next = !open;
    setOpen(next);
    // Fetched on first open, and again after an error; a loaded answer is kept.
    if (next && (state.kind === "idle" || state.kind === "error")) void load();
  };

  const askRaya = (concept: string) =>
    `/chat?ask=${encodeURIComponent(tr("kernel.why.askText", { concept: name(concept), target: name(label) }))}`;

  const linkStyle: React.CSSProperties = { color: t.link, fontSize: 14, fontWeight: 600, textDecoration: "none" };

  return (
    <div style={{ marginTop: 12 }}>
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        style={{
          border: `1px solid ${t.controlBorder}`,
          background: "transparent",
          color: t.text,
          borderRadius: 8,
          padding: "5px 12px",
          fontSize: 14,
          fontWeight: 600,
          cursor: "pointer",
        }}
      >
        {open ? tr("kernel.why.hide") : tr("kernel.why.button")}
      </button>

      {open && (
        <div style={{ marginTop: 10, fontSize: 15, color: t.text, lineHeight: 1.5 }}>
          {state.kind === "loading" && <p style={{ margin: 0, color: t.muted }}>{tr("kernel.why.loading")}</p>}

          {state.kind === "error" && (
            <p role="alert" style={{ margin: 0, color: t.muted }}>
              {tr("kernel.why.error")}{" "}
              <button type="button" onClick={() => void load()} style={{ ...linkStyle, background: "none", border: "none", padding: 0, cursor: "pointer" }}>
                {tr("chat.retry")}
              </button>
            </p>
          )}

          {state.kind === "notFound" && <p style={{ margin: 0, color: t.muted }}>{tr("kernel.why.notFound")}</p>}

          {state.kind === "ready" &&
            (() => {
              const { gaps, frontier, truncated, max_hops } = state.data;
              return (
                <>
                  {gaps.length > 0 ? (
                    <>
                      <p style={{ margin: "0 0 8px", color: t.muted }}>{tr("kernel.why.intro")}</p>
                      <ol style={{ margin: 0, paddingLeft: "1.3em", display: "grid", gap: 8 }}>
                        {gaps.map((g) => (
                          <li key={g.concept_id || g.label}>
                            <strong>{name(g.label)}</strong>
                            <span style={{ color: t.muted }}> · {Math.round(Math.max(0, Math.min(1, g.k_effective)) * 100)}%</span>
                            <div>
                              <Link href={askRaya(g.label)} style={linkStyle}>
                                <RayaText>{tr("kernel.why.workOn")}</RayaText> →
                              </Link>
                            </div>
                          </li>
                        ))}
                      </ol>
                    </>
                  ) : (
                    !truncated && (
                      <p style={{ margin: 0 }}>
                        {tr("kernel.why.none")}{" "}
                        <Link href={askRaya(label)} style={linkStyle}>
                          <RayaText>{tr("kernel.why.workOn")}</RayaText> →
                        </Link>
                      </p>
                    )
                  )}

                  {frontier.length > 0 && (
                    <p style={{ margin: "10px 0 0", color: t.muted, fontSize: 14 }}>
                      {tr("kernel.why.alreadyHeld")} {frontier.map((f) => name(f.label)).join(", ")}
                    </p>
                  )}
                  {truncated && (
                    <p style={{ margin: "10px 0 0", color: t.muted, fontSize: 14 }}>{tr("kernel.why.partial", { hops: max_hops })}</p>
                  )}
                </>
              );
            })()}
        </div>
      )}
    </div>
  );
}
