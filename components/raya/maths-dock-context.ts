"use client";

import { createContext, useContext, useEffect } from "react";
import type { MathBlockLang } from "@/lib/math-blocks";

/**
 * The Maths panel on the right of every Raya screen (components/raya/maths-dock.tsx),
 * as seen from inside the page: open it on a tool, optionally with content.
 *
 * Its own module so the chat's maths blocks (components/chat/math-tools.tsx)
 * can reach the panel without importing it — the panel imports the blocks.
 * `null` outside a Raya screen (Raya for Schools, the public site), where there
 * is no panel and a block simply doesn't offer to open in one.
 */
export type MathsDock = {
  open: (lang: MathBlockLang, src?: string) => void;
  /** Switch the panel off (and close it) while something must be done without it. */
  setLocked: (locked: boolean) => void;
  /** Float the panel above a full-screen view (a test being taken) instead of beside the page. */
  setAboveOverlay: (on: boolean) => void;
};

export const MathsDockContext = createContext<MathsDock | null>(null);

export function useMathsDock(): MathsDock | null {
  return useContext(MathsDockContext);
}

/**
 * Lock the Maths panel while `on` — a "calcul rapide" challenge is mental
 * arithmetic, and a calculator that solves equations beside it would make it
 * pointless. Every other challenge leaves the panel open (owner's decision,
 * 2026-10-05) and is written to need more than the tool can give.
 */
/**
 * Keep the Maths panel reachable while `on` even though a full-screen view
 * covers the page — a test is taken in one (FocusOverlay), which would
 * otherwise hide the panel and its rail entirely.
 */
export function useMathsAboveOverlay(on: boolean): void {
  const dock = useMathsDock();
  useEffect(() => {
    if (!dock || !on) return;
    dock.setAboveOverlay(true);
    return () => dock.setAboveOverlay(false);
  }, [dock, on]);
}

export function useMathsLock(on: boolean): void {
  const dock = useMathsDock();
  useEffect(() => {
    if (!dock || !on) return;
    dock.setLocked(true);
    return () => dock.setLocked(false);
  }, [dock, on]);
}
