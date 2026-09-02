import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Model training is on by default for adults and off for every minor. Two
 * things are asserted here because both were once wrong:
 *
 *  - the band gate runs BEFORE the column, so a stored `true` on a minor's row
 *    (a bad backfill, a manual edit, a future bug) still yields false;
 *  - the switch is actually READ. `training_consent` was written by settings and
 *    consulted by nothing, so the control enforced nothing at all.
 */

const state: { row: Record<string, unknown> | null; throws: boolean } = {
  row: null,
  throws: false,
};

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => {
            if (state.throws) throw new Error("db down");
            return { data: state.row, error: null };
          },
        }),
      }),
    }),
  }),
}));

async function freshModule() {
  vi.resetModules();
  return import("@/lib/compliance/optional-processing");
}

const THIS_YEAR = new Date().getUTCFullYear();
const ADULT = THIS_YEAR - 30;
const TEEN = THIS_YEAR - 15;
const CHILD = THIS_YEAR - 9;

beforeEach(() => {
  state.row = null;
  state.throws = false;
});

describe("trainingAllowed", () => {
  it("allows an adult who has not switched it off", async () => {
    const mod = await freshModule();
    state.row = { birth_year: ADULT, training_consent: true };
    expect(await mod.trainingAllowed("u1")).toBe(true);
  });

  it("honours an adult who switched it off — the point of the control", async () => {
    const mod = await freshModule();
    state.row = { birth_year: ADULT, training_consent: false };
    expect(await mod.trainingAllowed("u1")).toBe(false);
  });

  it("refuses a teen even when the column says true", async () => {
    const mod = await freshModule();
    state.row = { birth_year: TEEN, training_consent: true };
    expect(await mod.trainingAllowed("u1")).toBe(false);
  });

  it("refuses a child even when the column says true", async () => {
    const mod = await freshModule();
    state.row = { birth_year: CHILD, training_consent: true };
    expect(await mod.trainingAllowed("u1")).toBe(false);
  });

  it("refuses an account with no declared age", async () => {
    const mod = await freshModule();
    state.row = { birth_year: null, training_consent: true };
    expect(await mod.trainingAllowed("u1")).toBe(false);
  });

  it("refuses when the row is missing or the read fails", async () => {
    const mod = await freshModule();
    state.row = null;
    expect(await mod.trainingAllowed("u1")).toBe(false);
    state.throws = true;
    expect(await mod.trainingAllowed("u2")).toBe(false);
  });

  it("does not leak the analytics decision into the training decision", async () => {
    const mod = await freshModule();
    // Adult with training off: analytics is still permitted for them.
    state.row = { birth_year: ADULT, training_consent: false };
    expect(await mod.trainingAllowed("u1")).toBe(false);
    expect(await mod.optionalProcessingAllowed("u1")).toBe(true);
  });

  it("forgetOptionalProcessing clears both memos, so a toggle takes effect", async () => {
    const mod = await freshModule();
    state.row = { birth_year: ADULT, training_consent: true };
    expect(await mod.trainingAllowed("u1")).toBe(true);

    state.row = { birth_year: ADULT, training_consent: false };
    expect(await mod.trainingAllowed("u1")).toBe(true); // still memoised

    mod.forgetOptionalProcessing("u1");
    expect(await mod.trainingAllowed("u1")).toBe(false);
  });
});

/**
 * The STORED value, which is a separate question from the effective one.
 *
 * `trainingAllowed()` checks the band before the column, so a wrong `true` on a
 * minor's row never trained anything — and that is exactly why it survived: a
 * value that is wrong-but-compensated looks, from the table, like a value that
 * is right. It was not harmless. The data export handed a 16-year-old a JSON
 * file saying `training_consent: true` while the settings screen told them it
 * was off, and the compensating check lived in one function two files away.
 *
 * The cause was structural rather than a bad backfill: the column default fires
 * at INSERT, the row is created at sign-up, and the birth year only arrives
 * later from the age step — so at the moment the default applied, nobody's age
 * was knowable. A default cannot express this rule; a trigger can.
 */
describe("the storage-level floor", () => {
  const sql = readFileSync(
    join(process.cwd(), "supabase/migrations/20260903100000_training_consent_minor_floor.sql"),
    "utf8",
  );

  it("fires on UPDATE as well as INSERT", () => {
    // INSERT alone would miss the only path that matters: the row is written
    // before the age is known, and the age step is an UPDATE.
    expect(sql).toMatch(/before insert or update on public\.users/);
  });

  it("treats an undeclared age as a minor, like the app does", () => {
    // isMinor(null) === true. The safe reading of "we don't know" is the one
    // that withholds, and the column has to agree with it.
    expect(sql).toMatch(/new\.birth_year is null\s*\n?\s*or /);
  });

  it("uses the MINIMUM age a birth year allows", () => {
    // `year - birth_year - 1`, the same arithmetic as lib/compliance/age.ts.
    // Dropping the -1 would enrol a 17-year-old for the months before their
    // birthday, which is the whole reason that helper exists.
    expect(sql).toMatch(/- new\.birth_year - 1\) < 18/);
  });

  it("never stamps training_consent_at", () => {
    // That column means "the user expressed a choice". A machine-set false
    // wearing a user's timestamp would read as a withdrawal they made, and
    // would then be spared by any future backfill that respects choices.
    const fn = sql.slice(sql.indexOf("create or replace function"), sql.indexOf("$$;"));
    expect(fn).not.toMatch(/training_consent_at\s*:?=/);
  });

  it("backfills in the restrictive direction only", () => {
    // Unlike the 2026-08-13 backfill, this one does not need to spare accounts
    // that "already chose": a minor cannot validly have chosen this.
    const backfill = sql.slice(sql.indexOf("update public.users"));
    expect(backfill).toMatch(/set training_consent = false/);
    expect(backfill).not.toMatch(/= true/);
  });

  it("the adult default is granted where the age becomes known", () => {
    // It cannot be a column default any more, so it moves to the one moment an
    // adult is identified as one — and only for an account that never chose.
    const route = readFileSync(join(process.cwd(), "app/api/account/age/route.ts"), "utf8");
    expect(route).toMatch(/allowsOptionalProcessing\(ageBand\(birthYear\)\)/);
    expect(route).toMatch(/!existing\?\.training_consent_at/);
    // The band just changed and the read path memoises it for five minutes.
    expect(route).toMatch(/forgetOptionalProcessing\(user\.id\)/);
  });
});
