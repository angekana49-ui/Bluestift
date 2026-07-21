import type { Attachment } from "@/components/attachment";

/** A message row as the chat surface renders it. */
export type Msg = { id: string; role: string; content: string | null };

/** A conversation as the history list shows it. */
export type Conversation = { id: string; title: string | null; updated_at: string };

/** A conversation_files row: attached to a message, or still staged (null). */
export type ConversationFile = Attachment & { message_id: string | null };

/**
 * Everything that differs between the two chat surfaces (Raya vs RAYA-for-Schools)
 * lives here, so the engine + surface stay identical. The backend endpoints must
 * be shape-compatible with the Raya ones:
 *  - `chat`          POST → streams text; sets x-conversation-id / x-message-id headers
 *  - `conversations` GET ?id → {messages, files}; DELETE ?id
 *  - `files`         POST (multipart) → {file, conversationId}; DELETE ?id
 */
export type ChatConfig = {
  endpoints: { chat: string; conversations: string; files: string };
  capabilities: { voice: boolean; files: boolean };
  /** Greeting on the empty (new-conversation) screen, given the user's first name. */
  greeting: (firstName: string) => string;
  /** Sub-line under the greeting. */
  emptyHint: string;
  /** Quick-start chips on the empty screen. */
  suggestions: string[];
  /** Composer input placeholder. */
  placeholder: string;
};

export function titleFrom(text: string): string {
  return text.length > 60 ? `${text.slice(0, 57)}…` : text;
}
