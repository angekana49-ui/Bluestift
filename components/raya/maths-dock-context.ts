"use client";

import { createContext, useContext } from "react";
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
export type MathsDock = { open: (lang: MathBlockLang, src?: string) => void };

export const MathsDockContext = createContext<MathsDock | null>(null);

export function useMathsDock(): MathsDock | null {
  return useContext(MathsDockContext);
}
