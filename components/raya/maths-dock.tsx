"use client";

import { useCallback, useMemo, useState, type ReactNode } from "react";
import { RightPanel } from "@/components/ui/shell";
import { type AppTheme, status as statusColors } from "@/components/ui/tokens";
import { useTranslate } from "@/components/ui/locale";
import { MathPanel, saveMathTool } from "@/components/math-studio";
import type { MathBlockLang } from "@/lib/math-blocks";
import type { MathsDock } from "./maths-dock-context";

/**
 * The Maths panel: the graph and the calculator, on the right of every Raya
 * screen, so a student can use them WHILE talking to Raya, in a room or during
 * a self-test — not on a page of their own they have to leave the work for.
 *
 * It is a right panel like the others (RightPanel: a column on a wide screen, a
 * drawer over the page below 900px or on a touch screen), opened from a thin
 * rail of two icons along the right edge. From a phone, where there is no rail,
 * it opens from the header. While it is open it takes the place of the page's
 * own panel: two stacked right columns would leave the conversation nothing.
 *
 * Raya's replies open into it too ("Open in the Maths panel" on a graph or a
 * calculation she wrote) — see `MathsDockContext`.
 */

const TOOLS: { id: MathBlockLang; glyph: string; labelKey: "math.graph" | "math.calc" }[] = [
  { id: "graph", glyph: "ƒ", labelKey: "math.graph" },
  { id: "calc", glyph: "=", labelKey: "math.calc" },
];

function Glyph({ children }: { children: string }) {
  return <span style={{ fontFamily: "Georgia, serif", fontStyle: "italic", fontSize: 18, lineHeight: 1 }}>{children}</span>;
}

/** Open/close state for the panel, plus the handle pages and replies use to open it. */
export function useMathsDockState(): { tool: MathBlockLang | null; version: number; setTool: (t: MathBlockLang | null) => void; dock: MathsDock } {
  const [tool, setTool] = useState<MathBlockLang | null>(null);
  // Bumped when content arrives from outside (a reply), so the panel re-reads it.
  const [version, setVersion] = useState(0);
  const open = useCallback((lang: MathBlockLang, src?: string) => {
    if (src != null) saveMathTool(lang, src);
    setTool(lang);
    setVersion((v) => v + 1);
  }, []);
  const dock = useMemo(() => ({ open }), [open]);
  return { tool, version, setTool, dock };
}

/** The thin column of icons along the right edge (hidden on phones — see globals.css). */
export function MathsRail({ active, onPick, theme: t }: { active: MathBlockLang | null; onPick: (t: MathBlockLang | null) => void; theme: AppTheme }) {
  const tr = useTranslate();
  return (
    <nav
      className="app-mathrail"
      aria-label={tr("math.panelTitle")}
      style={{ background: t.rightBg, borderLeft: `1px solid ${t.rightBorder}` }}
    >
      {TOOLS.map((x) => {
        const on = active === x.id;
        return (
          <button
            key={x.id}
            type="button"
            title={tr(x.labelKey)}
            aria-label={tr(x.labelKey)}
            aria-pressed={on}
            onClick={() => onPick(on ? null : x.id)}
            style={{
              width: 34,
              height: 34,
              borderRadius: 10,
              border: `1px solid ${on ? statusColors.aiIndigo : t.controlBorder}`,
              boxShadow: on ? `0 0 0 1px ${statusColors.aiIndigo}` : "none",
              background: on ? t.ctaBg : "transparent",
              color: on ? t.ctaText : t.text,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Glyph>{x.glyph}</Glyph>
          </button>
        );
      })}
    </nav>
  );
}

/** The header button that opens the panel on a phone, where the rail is hidden. */
export function MathsHeaderButton({ open, onToggle, theme: t }: { open: boolean; onToggle: () => void; theme: AppTheme }) {
  const tr = useTranslate();
  return (
    <button
      type="button"
      className="app-mathrail-mobile"
      onClick={onToggle}
      aria-pressed={open}
      aria-label={tr("math.panelTitle")}
      title={tr("math.panelTitle")}
      style={{
        width: 34,
        height: 34,
        borderRadius: 10,
        border: `1px solid ${t.controlBorder}`,
        background: open ? t.ctaBg : "transparent",
        color: open ? t.ctaText : t.text,
        cursor: "pointer",
        alignItems: "center",
        justifyContent: "center",
        flex: "none",
      }}
    >
      <Glyph>ƒ</Glyph>
    </button>
  );
}

/** The panel itself: a tab per tool, then the tool. */
export function MathsDockPanel({
  tool,
  version,
  onPick,
  onClose,
  theme: t,
}: {
  tool: MathBlockLang;
  version: number;
  onPick: (t: MathBlockLang) => void;
  onClose: () => void;
  theme: AppTheme;
}) {
  const tr = useTranslate();
  const tabs: ReactNode = (
    <span role="tablist" style={{ display: "inline-flex", gap: 4 }}>
      {TOOLS.map((x) => {
        const on = tool === x.id;
        return (
          <button
            key={x.id}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onPick(x.id)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "4px 10px",
              borderRadius: 8,
              border: `1px solid ${on ? statusColors.aiIndigo : "transparent"}`,
              background: on ? t.cardBg : "transparent",
              color: t.text,
              fontSize: 14,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            <Glyph>{x.glyph}</Glyph>
            {tr(x.labelKey)}
          </button>
        );
      })}
    </span>
  );
  return (
    <RightPanel theme={t} width={360} wideWidth={400} padding={12} title={tabs} onCollapse={onClose}>
      <MathPanel key={`${tool}:${version}`} lang={tool} />
    </RightPanel>
  );
}
