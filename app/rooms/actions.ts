"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertRoomOpen, isMinorBirthYear, roomHoldsMinor, ROOM_TIMER_MIN, ROOM_TIMER_MAX } from "@/lib/rooms";
import { revalidatePath } from "next/cache";
import {
  resolveRayaEntitlements,
  assertFeature,
  assertQuota,
  startOfMonthIso,
  ENTITLEMENTS_ENFORCE,
  EntitlementError,
} from "@/lib/entitlements";
import { captureServer } from "@/lib/analytics/server";

/**
 * Shape returned by a room action when it is blocked. `feature_locked` and
 * `quota_reached` are plan gates (enforcing mode only); `minor_public_room` is
 * an age rule, which is not a plan gate and is never in monitor mode.
 */
export type RoomGateError = {
  error: string;
  code: "feature_locked" | "quota_reached" | "minor_public_room";
};

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
  /*
   * ...and above the plan sits the age rule, which no tier can buy out of.
   *
   * `roomVisibilityChoice` is a paid feature, so without this line a paying
   * 15-year-old could open a room the whole platform can find — the plan would
   * be selling its way past a child-safety default. The room triggers
   * (20260901140000) refuse the same thing at the database, so this is the
   * courteous half of the rule: the learner gets a private room rather than an
   * error about their age.
   */
  const { data: creatorProfile } = await supabase
    .from("users")
    .select("birth_year")
    .eq("id", user.id)
    .maybeSingle();
  const creatorIsMinor = isMinorBirthYear(creatorProfile?.birth_year);
  const visibility =
    ent.roomVisibilityChoice && !creatorIsMinor ? (input.visibility ?? "private") : "private";
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
 * Open a room to everyone, or close it again.
 *
 * Three things have to agree before a room can go public, and they are checked
 * in order of how absolute they are:
 *
 *  1. the age rule — no room holding a minor is ever public, at any tier, and
 *     the DB triggers refuse it independently of this function;
 *  2. the plan — `roomVisibilityChoice` is what a paid tier buys, and like
 *     every other monetisation gate it only blocks while ENTITLEMENTS_ENFORCE;
 *  3. ownership — a member cannot re-open a room they did not create.
 *
 * Going back to private needs none of that: closing a room is always allowed,
 * because a safety default you can be talked out of is not one.
 */
export async function setRoomVisibility(
  roomId: string,
  visibility: "public" | "private",
): Promise<void | RoomGateError> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in.");

  const admin = createAdminClient();
  const { data: room } = await admin
    .schema("learning")
    .from("rooms")
    .select("id, created_by, visibility")
    .eq("id", roomId)
    .maybeSingle();
  if (!room) throw new Error("Room not found.");
  if (room.created_by !== user.id) throw new Error("Only the room's creator can change this.");
  if (room.visibility === visibility) return;

  if (visibility === "public") {
    if (await roomHoldsMinor(roomId)) {
      return {
        error: "This room stays private: it has a member under 18.",
        code: "minor_public_room",
      };
    }
    const { ent, tier } = await resolveRayaEntitlements(user.id);
    try {
      assertFeature(ent.roomVisibilityChoice, {
        feature: "room_visibility",
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
    .from("rooms")
    .update({ visibility })
    .eq("id", roomId);
  // The triggers are the real guard and they answer in SQL. Anything they
  // refuse comes back as the age rule rather than as a raw database error,
  // because that is the only thing they refuse this for.
  if (error) {
    return {
      error: "This room stays private: it has a member under 18.",
      code: "minor_public_room",
    };
  }
  void captureServer(user.id, "room_visibility_changed", { visibility });
  revalidatePath(`/rooms/${roomId}`);
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
    .select("id, created_by, visibility")
    .eq("id", roomId)
    .maybeSingle();
  if (!room) throw new Error("Room not found.");

  /*
   * A member under 18 only ever belongs to a private room.
   *
   * "Public" here means discoverable by every account on the platform, which is
   * precisely the exposure the private-by-default rule exists to prevent — so
   * letting a minor walk into one through Discover would undo that rule from the
   * other end. Private rooms stay fully open to them: those are reached by
   * invite link, which is someone they know handing them the room.
   *
   * Checked here as well as in the database trigger because THIS insert runs on
   * the service role and so bypasses RLS entirely; the trigger is the guarantee,
   * this is the readable refusal the UI can act on instead of a raw 500.
   */
  if (room.visibility === "public") {
    const { data: joinerProfile } = await admin
      .from("users")
      .select("birth_year")
      .eq("id", user.id)
      .maybeSingle();
    if (isMinorBirthYear(joinerProfile?.birth_year)) {
      return {
        error:
          "This room is public. Rooms that include a member under 18 stay private — ask for an invite link instead.",
        code: "minor_public_room",
      };
    }
  }

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
