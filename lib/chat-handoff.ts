/**
 * A first message for a NEW conversation with Raya, handed from another
 * screen of the app and sent as soon as the chat opens.
 *
 * In sessionStorage rather than the address on purpose: `/chat?ask=…` only
 * ever WRITES into the composer, because a link can come from anyone, and a
 * link that sent a message in the learner's name would let anyone do that.
 * This one can only be set by the app's own code in the learner's own tab,
 * after they pressed a button that says it goes to Raya, and it is read once,
 * within a minute.
 */
const KEY = "bs_chat_handoff";
const TTL_MS = 60_000;

export function setChatHandoff(text: string) {
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify({ text: text.slice(0, 1500), at: Date.now() }));
  } catch {
    // no storage: the chat simply opens empty
  }
}

export function takeChatHandoff(): string | null {
  try {
    const raw = window.sessionStorage.getItem(KEY);
    if (!raw) return null;
    window.sessionStorage.removeItem(KEY);
    const { text, at } = JSON.parse(raw) as { text?: unknown; at?: unknown };
    if (typeof text !== "string" || !text.trim() || typeof at !== "number" || Date.now() - at > TTL_MS) return null;
    return text;
  } catch {
    return null;
  }
}
