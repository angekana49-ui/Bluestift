import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  canConnect,
  decideFriendAction,
  type ConnectRefusal,
  type FriendAction,
  type FriendRefusal,
  type FriendshipRow,
} from "@/lib/social/rules";
import { createNotification } from "@/lib/social/notifications";

/**
 * Friendships, server side. PREPARED, NOT WIRED: no route calls this yet, and
 * every entry point answers `disabled` until SOCIAL_ENABLED=1 — so even a
 * stray import cannot switch the feature on by accident.
 *
 * Requires supabase/drafts/social_v1.sql to be APPLIED first (it adds
 * `blocked_by` and the one-row-per-pair index this code relies on, and it
 * removes the browser's write access that would otherwise bypass all of it).
 *
 * The caller passes `actorId` from its own verified session — never from the
 * request body — exactly like lib/ops.ts.
 */

export function socialEnabled(): boolean {
  return process.env.SOCIAL_ENABLED === "1";
}

/**
 * Untyped client on the `learning` schema: `blocked_by` is not in the
 * generated types until the draft migration is applied and `gen:types` re-run.
 * Same pattern as createSchoolsAdminClient.
 */
function learningAdmin() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  return createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    db: { schema: "learning" },
  });
}

const ROW_COLUMNS = "id, user_id, friend_id, status, blocked_by";

type StoredRow = FriendshipRow & { id: string };

async function readPair(a: string, b: string): Promise<StoredRow | null> {
  const { data, error } = await learningAdmin()
    .from("friendships")
    .select(ROW_COLUMNS)
    .or(`and(user_id.eq.${a},friend_id.eq.${b}),and(user_id.eq.${b},friend_id.eq.${a})`)
    .maybeSingle();
  if (error) throw new Error(`friendships read failed: ${error.message}`);
  return (data as StoredRow | null) ?? null;
}

export type FriendResult =
  | { ok: true }
  | { ok: false; reason: FriendRefusal | ConnectRefusal | "disabled" | "error" };

/**
 * Apply one friendship action. The only write path for learning.friendships.
 *
 * `other` is a user id resolved server-side (from a handle, a room member
 * list…) — ids are uuids, so the `.or()` filter above never sees free text.
 */
export async function actOnFriendship(actorId: string, otherId: string, action: FriendAction): Promise<FriendResult> {
  if (!socialEnabled()) return { ok: false, reason: "disabled" };
  try {
    const row = await readPair(actorId, otherId);
    const decision = decideFriendAction(actorId, otherId, action, row);
    if (!decision.ok) return decision;

    // Age and school gate — on the actions that CREATE contact. Checked on
    // accept too: a year declared after the request was sent still counts.
    const createsContact = decision.next?.status === "pending" || decision.next?.status === "accepted";
    if (createsContact) {
      const gate = await connectGate(actorId, otherId);
      if (!gate.ok) return gate;
    }

    const db = learningAdmin();
    const now = new Date().toISOString();
    if (decision.op === "delete") {
      const { error } = await db.from("friendships").delete().eq("id", row!.id);
      if (error) throw new Error(error.message);
    } else if (decision.op === "insert") {
      const { error } = await db.from("friendships").insert({ ...decision.next!, updated_at: now });
      // A unique violation is the other side's request landing first — the
      // pair row now exists, and the caller can simply retry the action.
      if (error) throw new Error(error.message);
    } else {
      const { status, blocked_by } = decision.next!;
      const { error } = await db.from("friendships").update({ status, blocked_by, updated_at: now }).eq("id", row!.id);
      if (error) throw new Error(error.message);
    }

    if (decision.notify) {
      await createNotification({
        userId: decision.notify.userId,
        senderId: actorId,
        type: "friend_request",
        payload: { accepted: decision.notify.accepted },
      });
    }
    return { ok: true };
  } catch {
    return { ok: false, reason: "error" };
  }
}

async function connectGate(a: string, b: string): Promise<{ ok: true } | { ok: false; reason: ConnectRefusal | "error" }> {
  const { data } = await createAdminClient().from("users").select("id, birth_year, school_id").in("id", [a, b]);
  const byId = new Map((data ?? []).map((u) => [u.id, u]));
  const ua = byId.get(a);
  const ub = byId.get(b);
  // Either account unreadable: refuse. This gate protects minors.
  if (!ua || !ub) return { ok: false, reason: "error" };
  return canConnect(
    { birthYear: ua.birth_year, schoolId: ua.school_id },
    { birthYear: ub.birth_year, schoolId: ub.school_id },
  );
}

export type FriendListEntry = {
  userId: string;
  status: "accepted" | "incoming" | "outgoing";
  since: string;
};

/**
 * The caller's friends and pending requests. Blocked pairs are left out on
 * both sides — the blocked person must not be able to infer the block, and
 * the blocker manages blocks from a separate list (`listBlocked`).
 */
export async function listFriends(userId: string): Promise<FriendListEntry[]> {
  if (!socialEnabled()) return [];
  const { data, error } = await learningAdmin()
    .from("friendships")
    .select("user_id, friend_id, status, updated_at")
    .or(`user_id.eq.${userId},friend_id.eq.${userId}`)
    .neq("status", "blocked")
    .order("updated_at", { ascending: false })
    .limit(500);
  if (error || !data) return [];
  return (data as Array<{ user_id: string; friend_id: string; status: string; updated_at: string }>).map((r) => {
    const other = r.user_id === userId ? r.friend_id : r.user_id;
    const status = r.status === "accepted" ? "accepted" : r.user_id === userId ? "outgoing" : "incoming";
    return { userId: other, status, since: r.updated_at };
  });
}

/** The people THIS user blocked (never the people who blocked them). */
export async function listBlocked(userId: string): Promise<string[]> {
  if (!socialEnabled()) return [];
  const { data } = await learningAdmin()
    .from("friendships")
    .select("user_id, friend_id")
    .eq("status", "blocked")
    .eq("blocked_by", userId)
    .limit(500);
  return ((data ?? []) as Array<{ user_id: string; friend_id: string }>).map((r) =>
    r.user_id === userId ? r.friend_id : r.user_id,
  );
}
