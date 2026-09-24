/**
 * The shape of each learning.notifications row, by type. PREPARED, NOT WIRED.
 *
 * The four types are the live CHECK constraint (notifications_type_check);
 * adding one is a migration first, then an entry here.
 *
 * Payloads carry IDS, never names, emails or message text. A notification
 * outlives the thing it points at — a room is renamed, a friend changes their
 * display name, an account is erased — and a copied name would keep saying the
 * old thing, or keep saying it after the person asked to be forgotten. The
 * feed resolves ids to current names when it renders, and an id that no longer
 * resolves renders as nothing.
 */

export type NotificationPayloads = {
  /** Someone asked to be friends — or accepted, when `accepted` is true. */
  friend_request: { accepted: boolean };
  room_invite: { roomId: string };
  /** The Kernel produced something new for the student's profile. */
  insight_ready: Record<string, never>;
  challenge_result: { challengeId: string; attemptId: string };
};

export type NotificationType = keyof NotificationPayloads;

export const NOTIFICATION_TYPES: readonly NotificationType[] = [
  "friend_request",
  "room_invite",
  "insight_ready",
  "challenge_result",
];

export type AppNotification = {
  [T in NotificationType]: {
    id: string;
    type: T;
    payload: NotificationPayloads[T];
    senderId: string | null;
    isRead: boolean;
    createdAt: string;
  };
}[NotificationType];

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Parse a stored row into a typed notification, or null.
 *
 * The column is `jsonb`, and until the draft migration lands its owner can
 * write any JSON into it. So the feed validates on the way OUT, and an
 * unrecognised or malformed row is dropped rather than rendered — a feed that
 * silently skips a bad row is better than one that crashes on it.
 */
export function parseNotification(row: {
  id: string;
  type: string;
  payload: unknown;
  sender_id: string | null;
  is_read: boolean;
  created_at: string;
}): AppNotification | null {
  const payload = parsePayload(row.type, row.payload);
  if (!payload) return null;
  return {
    id: row.id,
    type: row.type,
    payload,
    senderId: row.sender_id,
    isRead: row.is_read,
    createdAt: row.created_at,
  } as AppNotification;
}

function parsePayload(type: string, raw: unknown): NotificationPayloads[NotificationType] | null {
  const p = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : null;
  if (!p) return null;
  switch (type) {
    case "friend_request":
      return typeof p.accepted === "boolean" ? { accepted: p.accepted } : null;
    case "room_invite":
      return isUuid(p.roomId) ? { roomId: p.roomId } : null;
    case "insight_ready":
      return {};
    case "challenge_result":
      return isUuid(p.challengeId) && isUuid(p.attemptId)
        ? { challengeId: p.challengeId, attemptId: p.attemptId }
        : null;
    default:
      return null;
  }
}

function isUuid(v: unknown): v is string {
  return typeof v === "string" && UUID.test(v);
}
