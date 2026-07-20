import "server-only";
import type { createClient } from "@/lib/supabase/server";

type ServerClient = Awaited<ReturnType<typeof createClient>>;

/** Clamp a requested session length to the allowed 10–60 minute window. */
export const ROOM_TIMER_MIN = 10;
export const ROOM_TIMER_MAX = 60;

/**
 * A room is "timed" when it has a `timer_ends_at`. It becomes read-only once that
 * instant has passed — members can still read the conversation and generate the
 * session report, but no new messages / challenges / uploads are accepted.
 * A room with a null `timer_ends_at` has no timer and is always open.
 */
export function roomExpired(timerEndsAt: string | null | undefined): boolean {
  return !!timerEndsAt && new Date(timerEndsAt).getTime() <= Date.now();
}

/**
 * Fetch a room's timer and decide whether it still accepts writes. Server-side
 * guard shared by every "send" path so the read-only rule can't be bypassed by
 * a stale client. Returns `{ open: true }` for untimed or still-running rooms.
 */
export async function assertRoomOpen(
  supabase: ServerClient,
  roomId: string,
): Promise<{ open: boolean; timerEndsAt: string | null }> {
  const { data } = await supabase
    .schema("learning")
    .from("rooms")
    .select("timer_ends_at")
    .eq("id", roomId)
    .maybeSingle();
  const endsAt = (data as { timer_ends_at?: string | null } | null)?.timer_ends_at ?? null;
  return { open: !roomExpired(endsAt), timerEndsAt: endsAt };
}
