"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertRoomOpen, ROOM_TIMER_MIN, ROOM_TIMER_MAX } from "@/lib/rooms";

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
}): Promise<{ roomId: string }> {
  const name = input.name.trim();
  if (!name) throw new Error("Room name is required.");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in.");

  // Optional session timer: null/0/absent → no timer; otherwise clamp to 10–60.
  const raw = input.durationMinutes;
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
      visibility: input.visibility ?? "public",
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

  return { roomId: room.id };
}

/**
 * Join an existing room as a member. Works for public rooms (found via Discover)
 * and private rooms reached through their invite link — in both cases holding the
 * room's id is sufficient. The membership row is written with the service role so
 * a not-yet-member can join a private room without tripping its RLS.
 */
export async function joinRoom(roomId: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in.");

  const admin = createAdminClient();
  const { data: room } = await admin
    .schema("learning")
    .from("rooms")
    .select("id")
    .eq("id", roomId)
    .maybeSingle();
  if (!room) throw new Error("Room not found.");

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
