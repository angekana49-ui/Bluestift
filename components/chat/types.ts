import type { Attachment } from "@/components/attachment";

/**
 * A message row as the chat surface renders it. `status` is client-only: an
 * optimistic bubble is "sending" until the server acknowledges it, and stays
 * as "failed" (never disappears) when delivery fails, so the student's text is
 * visibly preserved with a retry affordance. Persisted messages carry none.
 */
export type Msg = {
  id: string;
  role: string;
  content: string | null;
  status?: "sending" | "failed";
};

/**
 * A conversation as the history list shows it. The two stamps are optional
 * because only the Raya solo surface has them — the Schools staff chat reads the
 * same list component with a plain `{id, title, updated_at}` row, and `undefined`
 * there means "this surface has no such notion", not "false".
 */
export type Conversation = {
  id: string;
  title: string | null;
  updated_at: string;
  /** Non-null = filed away: hidden behind the Archived disclosure, messages kept. */
  archived_at?: string | null;
  /** Non-null = the learner had the Kernel absorb this thread on purpose. */
  memorized_at?: string | null;
};

/** A conversation_files row: attached to a message, or still staged (null). */
export type ConversationFile = Attachment & { message_id: string | null };

/**
 * Everything that differs between the two chat surfaces (Raya vs Raya-for-Schools)
 * lives here, so the engine + surface stay identical. The backend endpoints must
 * be shape-compatible with the Raya ones:
 *  - `chat`          POST → streams text; sets x-conversation-id / x-message-id headers
 *  - `conversations` GET ?id → {messages, files}; DELETE ?id
 *  - `files`         POST (multipart) → {file, conversationId}; DELETE ?id
 */
export type ChatConfig = {
  endpoints: {
    chat: string;
    conversations: string;
    files: string;
    /**
     * Optional auto-rename endpoint. `POST {conversationId}` → `{title}`: Raya
     * distils the exchange into a one-sentence title. When set, the engine calls
     * it once, around the 2nd exchange. Omit it and auto-rename is simply off
     * (e.g. room channels, which keep the room's name).
     */
    summarize?: string;
  };
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
   * True when this surface's chat endpoint is metered by the Raya plan, so the
   * composer should show what is left of the day. Off for the Schools staff
   * chat, which is rate-limited but never plan-metered.
   */
  metered?: boolean;
  /**
   * Extra fields merged into every chat/upload request — e.g. the room's
   * `roomId` for the private-room channel. Absent for the plain solo chat.
   */
  extraBody?: Record<string, string>;
  /**
   * Offers Raya's tutoring-persona picker (the star button in the composer) —
   * on for the real Raya b2c surfaces (solo chat, the room's private channel),
   * which is what RayaEntitlements.aiModes gates. Off for Raya-for-Schools:
   * there is no such entitlement on the Schools side, and the persona concept
   * does not exist for that audience.
   */
  aiModeSwitcher?: boolean;
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

/**
 * The day's plan allowance for the chat, as the composer renders it. Only ever
 * set when a limit both exists on the plan AND is being enforced — the server
 * omits the headers below otherwise, precisely so the UI cannot announce a
 * boundary that is not yet real.
 */
export type ChatQuota = { used: number; limit: number };

/**
 * Read the counter off a send response. Returns null when the response carries
 * none, which is the common case and must stay distinguishable from zero:
 * `Number(null)` is 0, so a naive read of two absent headers produces a
 * perfectly plausible "0 of 0 left" and locks the composer of a user who has
 * no limit at all.
 */
export function quotaFromHeaders(headers: Headers): ChatQuota | null {
  const rawUsed = headers.get("x-raya-messages-used");
  const rawLimit = headers.get("x-raya-messages-limit");
  if (rawUsed == null || rawLimit == null) return null;
  const used = Number(rawUsed);
  const limit = Number(rawLimit);
  if (!Number.isFinite(used) || !Number.isFinite(limit) || limit <= 0 || used < 0) return null;
  return { used, limit };
}

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
