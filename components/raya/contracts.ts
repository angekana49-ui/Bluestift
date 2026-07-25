/**
 * Raya chat — prop contract. This is the seam between the container
 * (`components/chat.tsx`, keeps state + /api calls) and your presentational
 * screen. Build `ChatScreen` against these types and wiring is a one-liner.
 *
 * Shapes mirror what `app/chat/page.tsx` already fetches. Data comes IN as
 * props, actions go OUT as callbacks — no fetch/Supabase in the screen.
 */
import type { ConversationFile } from "@/components/chat";

export type ChatMessage = { id: string; role: string; content: string | null };
export type ChatConversation = { id: string; title: string | null; updated_at: string };
export type ChatRecommendation = { content: string; source: string };

export type ChatScreenProps = {
  // ── data in ──────────────────────────────────────────────
  conversationId: string | null;
  conversations: ChatConversation[];
  messages: ChatMessage[];
  files: ConversationFile[];
  recommendations: ChatRecommendation[];
  busy: boolean; // a turn / upload is in flight
  // ── actions out ──────────────────────────────────────────
  onSend: (text: string) => void;
  onSelectConversation: (id: string) => void;
  onNewConversation: () => void;
  onDeleteConversation: (id: string) => void;
  onAttach: (file: File) => void;
  onAnalyze: () => void;
};
