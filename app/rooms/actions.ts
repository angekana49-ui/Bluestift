"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertRoomOpen, ROOM_TIMER_MIN, ROOM_TIMER_MAX } from "@/lib/rooms";
import {
  resolveRayaEntitlements,
  assertQuota,
  startOfMonthIso,
  ENTITLEMENTS_ENFORCE,
  EntitlementError,
} from "@/lib/entitlements";
import { captureServer } from "@/lib/analytics/server";

/** Shape returned by a room action when a plan gate blocks it (enforcing only). */
export type RoomGateError = { error: string; code: "feature_locked" | "quota_reached" };

/**
 * Create a room and add the creator as its first member. An optional
 * `durationMinutes` (clamped to 10–60) starts a countdown: once it elapses the
 * room turns read-only. Omit / pass null for an untimed room.
 */
export async function createRoom(input: {
  name: string;
  subject?: string;
  visibility?: "public" | "private";
  durationMinutes?: number | null;
}): Promise<{ roomId: string } | RoomGateError> {
  const name = input.name.trim();
  if (!name) throw new Error("Room name is required.");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in.");

  // --- Entitlements: rooms/month quota, visibility, mandatory timer ---------
  const { ent, tier } = await resolveRayaEntitlements(user.id);

  // Rooms created this month (derived from learning.rooms, no counter table).
  const { count: roomsUsed } = await supabase
    .schema("learning")
    .from("rooms")
    .select("id", { count: "exact", head: true })
    .eq("created_by", user.id)
    .gte("created_at", startOfMonthIso());
  /*
   * Rooms are private by default, and on Free that default is the only option.
   *
   * This used to be the other way round: the default was "public" and PRIVATE
   * was the paid feature, so the account most likely to belong to a minor got
   * the room anyone could walk into. Under COPPA and FERPA — and the GDPR's
   * data-protection-by-default — that is the wrong way round, whatever it does
   * for conversion.
   *
   * The coercion below is deliberately NOT an entitlement gate and deliberately
   * does NOT consult ENTITLEMENTS_ENFORCE. Every other check in this file is a
   * monetisation rule, which is why they all run in monitor mode until the
   * switch is thrown; this one is a safety default, and a safety default that
   * waits for a launch flag is not a default. A free account asking for a public
   * room gets a private one rather than an error: the client never offers the
   * choice, so an arriving "public" is a stale form or a crafted request, and in
   * both cases the safe answer beats the honest one.
   */
  const visibility = ent.roomVisibilityChoice ? (input.visibility ?? "private") : "private";
  // Gates throw EntitlementError when enforcing; surface it as a structured result
  // (a thrown error would be masked in prod, so the client couldn't show the modal).
  try {
    assertQuota(roomsUsed ?? 0, ent.roomsPerMonth, {
      metric: "rooms",
      period: "month",
      upgradeTo: "Plus",
      scope: "rooms",
      userId: user.id,
      tier,
    });
  } catch (e) {
    if (e instanceof EntitlementError) return { error: e.message, code: e.code };
    throw e;
  }

  // Free: the session timer is mandatory (the room auto-closes) — if none was
  // requested, force the 60-min max. Only shapes behaviour once enforcing.
  let requestedDuration = input.durationMinutes;
  if (!ent.roomTimerOptional && ENTITLEMENTS_ENFORCE && (requestedDuration == null || requestedDuration <= 0)) {
    requestedDuration = ROOM_TIMER_MAX;
  }

  // Optional session timer: null/0/absent → no timer; otherwise clamp to 10–60.
  const raw = requestedDuration;
  let timer: { timer_status: string; timer_started_at: string; timer_ends_at: string } | null = null;
  if (raw != null && raw > 0) {
    const minutes = Math.min(ROOM_TIMER_MAX, Math.max(ROOM_TIMER_MIN, Math.round(raw)));
    const now = new Date();
    timer = {
      timer_status: "running",
      timer_started_at: now.toISOString(),
      timer_ends_at: new Date(now.getTime() + minutes * 60_000).toISOString(),
    };
  }

  const { data: room, error } = await supabase
    .schema("learning")
    .from("rooms")
    .insert({
      name,
      created_by: user.id,
      subject: input.subject?.trim() || null,
      visibility,
      ai_mode: "active",
      ...(timer ?? {}),
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  const { error: memErr } = await supabase
    .schema("learning")
    .from("room_members")
    .insert({ room_id: room.id, user_id: user.id, role: "creator", is_online: true });
  if (memErr) throw new Error(memErr.message);

  void captureServer(user.id, "room_created", { visibility, timed: timer != null, tier });
  return { roomId: room.id };
}

/**
 * Join an existing room as a member. Works for public rooms (found via Discover)
 * and private rooms reached through their invite link — in both cases holding the
 * room's id is sufficient. The membership row is written with the service role so
 * a not-yet-member can join a private room without tripping its RLS.
 */
export async function joinRoom(roomId: string): Promise<void | RoomGateError> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in.");

  const admin = createAdminClient();
  const { data: room } = await admin
    .schema("learning")
    .from("rooms")
    .select("id, created_by")
    .eq("id", roomId)
    .maybeSingle();
  if (!room) throw new Error("Room not found.");

  // Participant cap is set by the ROOM's plan (its creator's), not the joiner's.
  // A member re-joining (already counted) is fine; the cap bites new members.
  const { data: already } = await admin
    .schema("learning")
    .from("room_members")
    .select("user_id")
    .eq("room_id", roomId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!already && room.created_by) {
    const { ent, tier } = await resolveRayaEntitlements(room.created_by);
    const { count: members } = await admin
      .schema("learning")
      .from("room_members")
      .select("user_id", { count: "exact", head: true })
      .eq("room_id", roomId);
    try {
      assertQuota(members ?? 0, ent.roomMaxParticipants, {
        metric: "room participants",
        upgradeTo: "Plus",
        scope: "rooms",
        userId: user.id,
        tier,
      });
    } catch (e) {
      if (e instanceof EntitlementError) return { error: e.message, code: e.code };
      throw e;
    }
  }

  const { error } = await admin
    .schema("learning")
    .from("room_members")
    .upsert(
      { room_id: roomId, user_id: user.id, role: "member", is_online: true },
      { onConflict: "room_id,user_id" },
    );
  if (error) throw new Error(error.message);
}

/** Post a message to the room's group channel. */
export async function postRoomMessage(
  roomId: string,
  content: string,
): Promise<void> {
  const text = content.trim();
  if (!text) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in.");

  // Timed rooms turn read-only once the countdown ends.
  const { open } = await assertRoomOpen(supabase, roomId);
  if (!open) throw new Error("This room has ended — it's now read-only.");

  const { error } = await supabase
    .schema("learning")
    .from("room_messages")
    .insert({ room_id: roomId, user_id: user.id, role: "user", content: text });
  if (error) throw new Error(error.message);
}
