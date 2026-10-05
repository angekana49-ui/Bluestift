"use client";

import { createContext, useContext } from "react";

/**
 * What a ```create card in a reply needs from the chat it sits in.
 *
 *  - `enabled`: only the Raya surfaces that know the Tools page offer the card
 *    (the solo chat and a room's private channel). Raya for Schools has no
 *    Tools page, so there the context is absent and the card renders nothing.
 *  - `conversationId`: the conversation to build from — the learner's own solo
 *    thread. Null in a room's channel (the Tools route refuses those) and on a
 *    thread not yet saved; the card then builds from the topic instead.
 */
export type ToolRequestEnv = { enabled: boolean; conversationId: string | null };

export const ToolRequestContext = createContext<ToolRequestEnv | null>(null);

export function useToolRequestEnv(): ToolRequestEnv | null {
  return useContext(ToolRequestContext);
}
