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
  /**
   * Extra fields merged into every chat/upload request — e.g. the room's
   * `roomId` for the private-room channel. Absent for the plain solo chat.
   */
  extraBody?: Record<string, string>;
  /**
   * HYBRID new-conversation hooks. Resolved client-side once, only when the
   * thread is empty. When it returns personalized greeting/suggestions (the
   * metadata is present AND reachable), the welcome screen shows them; on
   * null / empty / throw (no data, or offline), the static `greeting`/
   * `suggestions` above are used. That's the hybrid contract: AI/data-driven
   * when it can, static otherwise — it must NEVER block or break the screen.
   */
  personalizedHooks?: () => Promise<{ greeting?: string; suggestions?: string[] } | null>;
};

export function titleFrom(text: string): string {
  return text.length > 60 ? `${text.slice(0, 57)}…` : text;
}

/**
 * Builds a `personalizedHooks` resolver that GETs `url` and returns its
 * `{greeting?, suggestions?}` — or `null` when the request fails (offline / no
 * connection), the response isn't ok, or it carries no hooks. That null is the
 * hybrid signal for the surface to keep its static hooks.
 */
export function fetchHooks(url: string): () => Promise<{ greeting?: string; suggestions?: string[] } | null> {
  return async () => {
    try {
      const r = await fetch(url);
      if (!r.ok) return null;
      const d = (await r.json()) as { greeting?: unknown; suggestions?: unknown };
      const greeting = typeof d?.greeting === "string" ? d.greeting : undefined;
      const suggestions = Array.isArray(d?.suggestions)
        ? d.suggestions.filter((s): s is string => typeof s === "string")
        : undefined;
      if (!greeting && (!suggestions || suggestions.length === 0)) return null;
      return { greeting, suggestions };
    } catch {
      return null;
    }
  };
}
