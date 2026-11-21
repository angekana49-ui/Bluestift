"use client";

import { createContext, useContext } from "react";

/**
 * What a ```prepare card in a reply needs from the chat it sits in.
 *
 *  - `enabled`: only the staff chat offers the card (the teacher's Raya tab —
 *    the surface whose dashboard holds the Prepare library). Everywhere else
 *    the context is absent and the card renders nothing.
 *  - `conversationId`: the staff thread, sent when the block says the material
 *    is in it. Null on a thread not yet saved; the card then builds from the
 *    topic and the class gaps instead.
 *  - `classes`: the teacher's classes for the card's picker — the generation
 *    grounds on the picked class's real gaps.
 */
export type PrepareRequestEnv = {
  enabled: boolean;
  conversationId: string | null;
  classes: { id: string; name: string }[];
};

export const PrepareRequestContext = createContext<PrepareRequestEnv | null>(null);

export function usePrepareRequestEnv(): PrepareRequestEnv | null {
  return useContext(PrepareRequestContext);
}
