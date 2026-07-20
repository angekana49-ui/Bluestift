import type { ChatScreenProps } from "@/components/raya/contracts";

/** Mock data (no callbacks) for building ChatScreen in isolation at /preview/raya. */
export const rayaMock: Omit<
  ChatScreenProps,
  "onSend" | "onSelectConversation" | "onNewConversation" | "onDeleteConversation" | "onAttach" | "onAnalyze"
> = {
  conversationId: "c1",
  conversations: [
    { id: "c1", title: "Les fractions", updated_at: new Date().toISOString() },
    { id: "c2", title: "Photosynthèse", updated_at: new Date(Date.now() - 8.64e7).toISOString() },
  ],
  messages: [
    { id: "m1", role: "user", content: "Je comprends pas les fractions équivalentes." },
    { id: "m2", role: "assistant", content: "D'accord — que se passe-t-il si tu multiplies le haut ET le bas par 2 ?" },
  ],
  files: [],
  recommendations: [{ content: "Revoir la division posée", source: "Prof. Diallo" }],
  busy: false,
};
