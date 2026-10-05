"use client";

import { useCallback, useMemo, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
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
export function useMathsDockState(): {
  tool: MathBlockLang | null;
  version: number;
  locked: boolean;
  aboveOverlay: boolean;
  setTool: (t: MathBlockLang | null) => void;
  dock: MathsDock;
} {
  const [rawTool, setRawTool] = useState<MathBlockLang | null>(null);
  const [locked, setLockedState] = useState(false);
  const [aboveOverlay, setAboveOverlay] = useState(false);
  // Locking also closes it, so lifting the lock doesn't pop it back open.
  const setLocked = useCallback((on: boolean) => {
    setLockedState(on);
    if (on) setRawTool(null);
  }, []);
  // Locked means closed, and nothing reopens it until the lock lifts.
  const tool = locked ? null : rawTool;
  const setTool = useCallback((t: MathBlockLang | null) => setRawTool(t), []);
  // Bumped when content arrives from outside (a reply), so the panel re-reads it.
  const [version, setVersion] = useState(0);
  const open = useCallback((lang: MathBlockLang, src?: string) => {
    if (src != null) saveMathTool(lang, src);
    setRawTool(lang);
    setVersion((v) => v + 1);
  }, []);
  const dock = useMemo(() => ({ open, setLocked, setAboveOverlay }), [open, setLocked]);
  return { tool, version, locked, aboveOverlay, setTool: (t) => (locked ? undefined : setTool(t)), dock };
}

/** The thin column of icons along the right edge (hidden on phones — see globals.css). */
export function MathsRail({
  active,
  locked = false,
  onPick,
  theme: t,
}: {
  active: MathBlockLang | null;
  locked?: boolean;
  onPick: (t: MathBlockLang | null) => void;
  theme: AppTheme;
}) {
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
            title={locked ? tr("math.locked") : tr(x.labelKey)}
            aria-label={tr(x.labelKey)}
            aria-pressed={on}
            disabled={locked}
            onClick={() => onPick(on ? null : x.id)}
            style={{
              opacity: locked ? 0.4 : 1,
              width: 34,
              height: 34,
              borderRadius: 10,
              border: `1px solid ${on ? statusColors.aiIndigo : t.controlBorder}`,
              boxShadow: on ? `0 0 0 1px ${statusColors.aiIndigo}` : "none",
              background: on ? t.ctaBg : "transparent",
              color: on ? t.ctaText : t.text,
              cursor: locked ? "not-allowed" : "pointer",
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
export function MathsHeaderButton({ open, locked = false, onToggle, theme: t }: { open: boolean; locked?: boolean; onToggle: () => void; theme: AppTheme }) {
  const tr = useTranslate();
  return (
    <button
      type="button"
      className="app-mathrail-mobile"
      onClick={onToggle}
      aria-pressed={open}
      aria-label={tr("math.panelTitle")}
      title={locked ? tr("math.locked") : tr("math.panelTitle")}
      disabled={locked}
      style={{
        opacity: locked ? 0.4 : 1,
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

/**
 * The panel, floated above a full-screen test: a tab on the right edge of the
 * screen opens it as a drawer over the test. Portalled, because the test is
 * itself a fixed layer over the whole app.
 */
export function MathsOverlayDock({
  tool,
  version,
  onPick,
  onClose,
  theme: t,
}: {
  tool: MathBlockLang | null;
  version: number;
  onPick: (t: MathBlockLang | null) => void;
  onClose: () => void;
  theme: AppTheme;
}) {
  const tr = useTranslate();
  return createPortal(
    tool ? (
      <div style={{ position: "fixed", top: 0, right: 0, bottom: 0, zIndex: 65, display: "flex", boxShadow: "-12px 0 32px rgba(8,12,24,0.18)" }}>
        <MathsDockPanel tool={tool} version={version} onPick={onPick} onClose={onClose} theme={t} />
      </div>
    ) : (
      <button
        type="button"
        onClick={() => onPick("calc")}
        aria-label={tr("math.panelTitle")}
        title={tr("math.panelTitle")}
        style={{
          position: "fixed",
          right: 0,
          top: "50%",
          transform: "translateY(-50%)",
          zIndex: 65,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 6,
          padding: "12px 8px",
          borderRadius: "12px 0 0 12px",
          border: `1px solid ${t.controlBorder}`,
          borderRight: "none",
          background: t.ctaBg,
          color: t.ctaText,
          cursor: "pointer",
          fontSize: 13,
          fontWeight: 700,
          writingMode: "vertical-rl",
        }}
      >
        <Glyph>ƒ</Glyph>
        {tr("math.panelTitle")}
      </button>
    ),
    document.body,
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
