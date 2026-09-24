import { ageBand, isMinor } from "@/lib/compliance/age";

/**
 * The friendship rules, as pure functions. PREPARED, NOT WIRED — nothing in
 * app/ or components/ imports lib/social yet (test/prepared-updates.test.ts
 * holds that line until the switch-on; see docs/prepared-updates.md).
 *
 * One row per PAIR in learning.friendships (the draft migration adds the
 * unordered-pair unique index): `user_id` is whoever asked first, `friend_id`
 * the other side. A declined, cancelled, removed or unblocked relationship is
 * DELETED rather than kept under a status, so "no row" is the one neutral state
 * and a fresh request can always start from it.
 *
 * Everything here decides; nothing here writes. lib/social/friendships.ts turns
 * a decision into a service-role write — the browser never writes this table.
 */

export type FriendshipStatus = "pending" | "accepted" | "blocked";

export type FriendshipRow = {
  user_id: string;
  friend_id: string;
  status: FriendshipStatus;
  blocked_by: string | null;
};

export type FriendAction = "request" | "accept" | "decline" | "cancel" | "remove" | "block" | "unblock";

/**
 * Why an action was refused. `unavailable` is deliberately vague: it is the
 * answer for "they blocked you", and saying so would tell a blocked person that
 * the block exists — which is what the block is there to prevent.
 */
export type FriendRefusal =
  | "self"
  | "unavailable"
  | "already_pending"
  | "already_friends"
  | "not_pending"
  | "not_yours"
  | "not_friends"
  | "not_blocked";

export type FriendDecision =
  | { ok: false; reason: FriendRefusal }
  | {
      ok: true;
      op: "insert" | "update" | "delete";
      /** The row as it should read afterwards (absent for a delete). */
      next?: FriendshipRow;
      /** Tell `userId` about it: a new request, or (`accepted`) theirs was accepted. */
      notify?: { userId: string; accepted: boolean };
    };

/**
 * Decide what `actor` doing `action` towards `other` means, given the pair's
 * current row (null when there is none).
 */
export function decideFriendAction(
  actor: string,
  other: string,
  action: FriendAction,
  row: FriendshipRow | null,
): FriendDecision {
  if (actor === other) return { ok: false, reason: "self" };
  if (row && !isPairRow(row, actor, other)) {
    // A row for some other pair reaching here is a caller bug; refusing is
    // the only answer that cannot act on the wrong relationship.
    return { ok: false, reason: "not_yours" };
  }

  // A block overrides everything except the blocker lifting it or re-blocking.
  if (row?.status === "blocked") {
    if (action === "unblock") {
      return row.blocked_by === actor ? { ok: true, op: "delete" } : { ok: false, reason: "not_blocked" };
    }
    // Blocking an already-blocked pair changes nothing, whoever does it: the
    // first blocker is kept, so a second block cannot be used to take over —
    // and then lift — someone else's block.
    if (action === "block") return { ok: true, op: "update", next: row };
    return { ok: false, reason: "unavailable" };
  }

  switch (action) {
    case "request": {
      if (!row) {
        return {
          ok: true,
          op: "insert",
          next: { user_id: actor, friend_id: other, status: "pending", blocked_by: null },
          notify: { userId: other, accepted: false },
        };
      }
      if (row.status === "accepted") return { ok: false, reason: "already_friends" };
      // Pending: asking someone who already asked you is accepting.
      if (row.user_id === actor) return { ok: false, reason: "already_pending" };
      return {
        ok: true,
        op: "update",
        next: { ...row, status: "accepted" },
        notify: { userId: other, accepted: true },
      };
    }
    case "accept": {
      if (!row || row.status !== "pending") return { ok: false, reason: "not_pending" };
      // Only the side that was asked may accept.
      if (row.friend_id !== actor) return { ok: false, reason: "not_yours" };
      return {
        ok: true,
        op: "update",
        next: { ...row, status: "accepted" },
        notify: { userId: row.user_id, accepted: true },
      };
    }
    case "decline": {
      if (!row || row.status !== "pending") return { ok: false, reason: "not_pending" };
      if (row.friend_id !== actor) return { ok: false, reason: "not_yours" };
      return { ok: true, op: "delete" };
    }
    case "cancel": {
      if (!row || row.status !== "pending") return { ok: false, reason: "not_pending" };
      if (row.user_id !== actor) return { ok: false, reason: "not_yours" };
      return { ok: true, op: "delete" };
    }
    case "remove": {
      if (!row || row.status !== "accepted") return { ok: false, reason: "not_friends" };
      return { ok: true, op: "delete" };
    }
    case "block": {
      const base = row ?? { user_id: actor, friend_id: other, status: "pending" as const, blocked_by: null };
      return {
        ok: true,
        op: row ? "update" : "insert",
        next: { ...base, status: "blocked", blocked_by: actor },
      };
    }
    case "unblock":
      return { ok: false, reason: "not_blocked" };
  }
}

function isPairRow(row: FriendshipRow, a: string, b: string): boolean {
  return (row.user_id === a && row.friend_id === b) || (row.user_id === b && row.friend_id === a);
}

// ── Who may connect with whom ─────────────────────────────────────────────

export type ConnectPerson = {
  birthYear: number | null | undefined;
  schoolId: string | null | undefined;
};

export type ConnectRefusal = "adult_minor" | "minor_outside_school";

/**
 * Whether two people may become friends at all. PROPOSED POLICY — the owner
 * signs it off before the switch-on (docs/prepared-updates.md, "Decisions"):
 *
 *   adult ↔ adult   yes
 *   adult ↔ minor   never
 *   minor ↔ minor   only inside the same school
 *
 * The school condition gives minors a supervised context (a school that has
 * the account on its roll) rather than the open internet. An undeclared birth
 * year counts as a minor, the same fail-closed direction as
 * lib/rooms.ts isMinorBirthYear: this is a gate on contact, so "we don't know"
 * must not open it.
 *
 * `block` is exempt — anyone may block anyone — and the server applies this
 * only to `request`/`accept`.
 */
export function canConnect(
  a: ConnectPerson,
  b: ConnectPerson,
  now: Date = new Date(),
): { ok: true } | { ok: false; reason: ConnectRefusal } {
  const minorA = isMinor(ageBand(a.birthYear, now));
  const minorB = isMinor(ageBand(b.birthYear, now));
  if (!minorA && !minorB) return { ok: true };
  if (minorA !== minorB) return { ok: false, reason: "adult_minor" };
  if (a.schoolId && a.schoolId === b.schoolId) return { ok: true };
  return { ok: false, reason: "minor_outside_school" };
}
