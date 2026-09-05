import "server-only";
import type { createClient } from "@/lib/supabase/server";
import { ageBand, isMinor } from "@/lib/compliance/age";
import { createAdminClient } from "@/lib/supabase/admin";

type ServerClient = Awaited<ReturnType<typeof createClient>>;

/**
 * Is this birth year a minor, for the room rules?
 *
 * A thin name over `isMinor(ageBand(...))` so the room code reads as the rule it
 * is enforcing. The arithmetic stays in lib/compliance/age.ts — `year - birth
 * year - 1` is already written twice (there, and inside the room triggers in
 * 20260901140000), and a third copy would be a third place for the rounding rule
 * to drift.
 *
 * An absent or undeclared year is a minor, matching `isMinor(null)`. Callers use
 * this to decide whether to WITHHOLD a public room, so "we don't know" has to
 * fail closed.
 */
export function isMinorBirthYear(birthYear: number | null | undefined): boolean {
  return isMinor(ageBand(birthYear ?? null));
}

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
  // RLS returns no row to non-members. Treat that exactly like a missing room:
  // callers must never interpret an invisible room as an open one.
  if (!data) return { open: false, timerEndsAt: null };
  const endsAt = (data as { timer_ends_at?: string | null }).timer_ends_at ?? null;
  return { open: !roomExpired(endsAt), timerEndsAt: endsAt };
}

/**
 * Whether this room holds anyone under 18 — including the asker.
 *
 * Read with the service role because the point is other people's ages, which
 * RLS rightly will not show the caller. What comes back out of here is one
 * boolean, never a birth year and never whose it is: the owner is told the room
 * cannot be opened, not who is keeping it shut.
 *
 * `learning.room_has_minor()` says the same thing inside the database, but its
 * execute grant is revoked (it sits in a PostgREST-exposed schema), so the two
 * copies are deliberate — see the note at the top of
 * 20260901140000_room_minor_visibility_lock.sql.
 */
export async function roomHoldsMinor(roomId: string): Promise<boolean> {
  const admin = createAdminClient();
  const { data: members } = await admin
    .schema("learning")
    .from("room_members")
    .select("user_id")
    .eq("room_id", roomId);
  const ids = (members ?? []).map((m) => m.user_id).filter(Boolean);
  // No members read at all is not evidence of no minors — fail closed, the same
  // direction isMinorBirthYear fails on an undeclared year.
  if (ids.length === 0) return true;
  const { data: rows } = await admin.from("users").select("birth_year").in("id", ids);
  if (!rows) return true;
  return rows.some((r) => isMinorBirthYear(r.birth_year));
}
