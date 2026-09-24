import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/types/database.types";
import {
  parseNotification,
  type AppNotification,
  type NotificationPayloads,
  type NotificationType,
} from "@/lib/social/notification-types";

/**
 * learning.notifications, server side. PREPARED, NOT WIRED — nothing calls
 * this yet. The Schools and room panels keep their DERIVED feeds
 * (app/api/school/notifications, room-view.tsx); this table is for events
 * that have no other home: a friend request, a room invite, a result that
 * arrived while the student was away.
 *
 * Writes go through the service role only. After supabase/drafts/social_v1.sql
 * the browser can read its own rows and flip `is_read`, nothing else.
 */

const FEED_LIMIT = 50;

export async function createNotification<T extends NotificationType>(input: {
  userId: string;
  senderId: string | null;
  type: T;
  payload: NotificationPayloads[T];
}): Promise<boolean> {
  // Never notify yourself: every sender-driven type would be noise.
  if (input.senderId && input.senderId === input.userId) return false;
  const { error } = await createAdminClient()
    .schema("learning")
    .from("notifications")
    .insert({
      user_id: input.userId,
      sender_id: input.senderId,
      type: input.type,
      payload: input.payload as Json,
    });
  return !error;
}

/** Newest first; malformed rows are dropped, not rendered. */
export async function listNotifications(userId: string): Promise<AppNotification[]> {
  const { data, error } = await createAdminClient()
    .schema("learning")
    .from("notifications")
    .select("id, type, payload, sender_id, is_read, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(FEED_LIMIT);
  if (error || !data) return [];
  return data.map(parseNotification).filter((n): n is AppNotification => n !== null);
}

export async function countUnread(userId: string): Promise<number> {
  const { count } = await createAdminClient()
    .schema("learning")
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("is_read", false);
  return count ?? 0;
}

/** Mark some (or, with no ids, all) of the user's notifications read. */
export async function markRead(userId: string, ids?: string[]): Promise<boolean> {
  let q = createAdminClient()
    .schema("learning")
    .from("notifications")
    .update({ is_read: true })
    .eq("user_id", userId)
    .eq("is_read", false);
  if (ids) {
    if (ids.length === 0) return true;
    q = q.in("id", ids.slice(0, FEED_LIMIT));
  }
  const { error } = await q;
  return !error;
}
