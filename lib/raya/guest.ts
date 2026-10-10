/**
 * Raya before an account: a visitor who is not signed in can talk to Raya for a
 * few turns at /chat, then is asked to create one to keep going.
 *
 * There is no account behind a guest, so nothing is stored server side — no
 * conversation row, no Kernel, no analytics (the age band that gates them is
 * unknown). The thread lives in this browser only, and is handed to the new
 * account once it exists (`/api/raya/conversations/import`), so signing up
 * keeps what was said instead of starting over.
 *
 * Shared by the client and the routes: the server enforces the same limit on
 * the history it is sent, the client uses it to show what is left.
 */

/** Learner turns a guest gets before the sign-up wall. */
export const GUEST_TURN_LIMIT = 5;

/** A guest message as sent to the try route and kept in this browser. */
export type GuestMessage = { role: "user" | "assistant"; content: string };

/** Longest stored message — the same cap the chat route puts on a turn. */
export const GUEST_MESSAGE_MAX = 4000;

const KEY = "bs_raya_guest";
/** Long enough to survive the sign-up email round trip, short enough not to linger on a shared machine. */
const TTL_MS = 24 * 60 * 60 * 1000;

/** Keep only well-formed turns, capped, in order. Used on every read and on the server. */
export function cleanGuestMessages(raw: unknown, max = GUEST_TURN_LIMIT * 2 + 2): GuestMessage[] {
  if (!Array.isArray(raw)) return [];
  const out: GuestMessage[] = [];
  for (const m of raw) {
    if (!m || typeof m !== "object") continue;
    const { role, content } = m as { role?: unknown; content?: unknown };
    if ((role !== "user" && role !== "assistant") || typeof content !== "string") continue;
    const text = content.trim().slice(0, GUEST_MESSAGE_MAX);
    if (text) out.push({ role, content: text });
  }
  return out.slice(-max);
}

export function guestTurns(messages: { role: string }[]): number {
  return messages.filter((m) => m.role === "user").length;
}

export function saveGuestThread(messages: GuestMessage[]) {
  try {
    if (messages.length === 0) window.localStorage.removeItem(KEY);
    else window.localStorage.setItem(KEY, JSON.stringify({ messages, at: Date.now() }));
  } catch {
    // no storage: the thread lasts as long as the tab
  }
}

export function readGuestThread(): GuestMessage[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const { messages, at } = JSON.parse(raw) as { messages?: unknown; at?: unknown };
    if (typeof at !== "number" || Date.now() - at > TTL_MS) {
      window.localStorage.removeItem(KEY);
      return [];
    }
    return cleanGuestMessages(messages);
  } catch {
    return [];
  }
}

/** Forget the thread — once the account holds it, or when it is not worth keeping. */
export function clearGuestThread() {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // nothing to clear
  }
}
