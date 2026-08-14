import { describe, it, expect, vi, beforeEach } from "vitest";

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
