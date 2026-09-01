import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { isMinorBirthYear } from "@/lib/rooms";

/**
 * A room holding a member under 18 can never be public.
 *
 * The rule is written three times — in this helper, in app/rooms/actions.ts, and
 * in the SQL triggers of 20260901140000_room_minor_visibility_lock.sql — because
 * the service role bypasses RLS and an app-only check would be one forgotten
 * call away from nothing. These tests hold the copies to the same behaviour.
 *
 * The bias under test is one-directional, as everywhere else in the age rules:
 * treating a member as younger than they are is safe, treating one as older is
 * the failure that matters.
 */

describe("isMinorBirthYear", () => {
  it("fails closed on an undeclared year", () => {
    // The whole point: 'we do not know' must withhold the public room, not grant
    // it. A legacy account with no birth year is the common case here.
    expect(isMinorBirthYear(null)).toBe(true);
    expect(isMinorBirthYear(undefined)).toBe(true);
  });

  it("fails closed on an implausible year", () => {
    // ageBand() returns null for these, and null is a minor.
    expect(isMinorBirthYear(1850)).toBe(true);
    expect(isMinorBirthYear(9999)).toBe(true);
  });

  it("treats a birthday that may not have happened yet as still under 18", () => {
    const year = new Date().getUTCFullYear();
    // Turns 18 at some point this year — so today they may still be 17.
    expect(isMinorBirthYear(year - 18)).toBe(true);
    // Turned 18 last year at the latest.
    expect(isMinorBirthYear(year - 19)).toBe(false);
  });

  it("treats a clear adult as an adult", () => {
    expect(isMinorBirthYear(1990)).toBe(false);
  });
});

describe("room visibility lock migration", () => {
  const sql = readFileSync(
    join(process.cwd(), "supabase/migrations/20260901140000_room_minor_visibility_lock.sql"),
    "utf8",
  );

  it("uses the minimum-age formula, not a plain year subtraction", () => {
    // `year - birth_year` would age a 17-year-old into an 18-year-old for the
    // eleven months before their birthday — the exact rounding the TS side
    // refuses to do. Both SQL copies must carry the -1.
    const matches = sql.match(/extract\(year from now\(\)\)::int - (?:u\.|v_)birth_year - 1/g) ?? [];
    expect(matches.length).toBeGreaterThanOrEqual(2);
  });

  it("counts a null birth year as a minor in both directions", () => {
    expect(sql).toMatch(/u\.birth_year is null/);
    expect(sql).toMatch(/v_birth_year is null/);
  });

  it("guards both the room and the membership side of the invariant", () => {
    expect(sql).toMatch(/create trigger rooms_visibility_minor_lock/);
    expect(sql).toMatch(/create trigger room_members_no_minor_in_public/);
  });

  it("fires on membership UPDATE too, since joinRoom upserts", () => {
    // An INSERT-only guard would be walked straight past by the ON CONFLICT
    // path of joinRoom's upsert.
    expect(sql).toMatch(/before insert or update of user_id, room_id on learning\.room_members/);
  });

  it("does not expose the minor check as a callable RPC", () => {
    // `learning` is a PostgREST-exposed schema, so a SECURITY DEFINER function
    // in it is reachable by any signed-in client unless execute is revoked.
    expect(sql).toMatch(/revoke execute on function learning\.room_has_minor\(uuid\)/);
  });
});
