import { describe, it, expect, vi, beforeEach } from "vitest";
import type { LoadProfileResponse } from "@/lib/kernel/types";

/**
 * The two-layer kernel profile cache: on a cold instance (empty L1) the
 * Supabase snapshot must serve the profile within its 250ms budget; refreshes
 * must write BOTH layers; and a hung/absent snapshot degrades to null instead
 * of blocking the chat turn.
 */

// Mutable handles the mock factories close over (hoisting-safe: read at call time).
const state: {
  selectRow: unknown;
  selectDelayMs: number;
  upserts: Record<string, unknown>[];
  loadProfile: ReturnType<typeof vi.fn>;
} = {
  selectRow: null,
  selectDelayMs: 0,
  upserts: [],
  loadProfile: vi.fn(),
};

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    schema: () => ({
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: () =>
              new Promise((resolve) =>
                setTimeout(
                  () => resolve({ data: state.selectRow, error: null }),
                  state.selectDelayMs,
                ),
              ),
          }),
        }),
        upsert: async (row: Record<string, unknown>) => {
          state.upserts.push(row);
          return { error: null };
        },
      }),
    }),
  }),
}));

vi.mock("@/lib/kernel/client", () => ({
  kernel: {
    get loadProfile() {
      return state.loadProfile;
    },
  },
}));

const PROFILE = { user_id: "u1", concepts: [] } as unknown as LoadProfileResponse;

async function freshModule() {
  vi.resetModules();
  return import("@/lib/kernel/profile-cache");
}

beforeEach(() => {
  state.selectRow = null;
  state.selectDelayMs = 0;
  state.upserts = [];
  state.loadProfile = vi.fn(async () => PROFILE);
  vi.useRealTimers();
});

describe("getCognitiveContext", () => {
  it("serves profile + alerts from the L2 snapshot on a cold instance", async () => {
    const mod = await freshModule();
    state.selectRow = {
      profile: PROFILE,
      alerts: [{ type: "dependency" }],
      profile_updated_at: new Date().toISOString(),
      alerts_updated_at: new Date().toISOString(),
    };
    const ctx = await mod.getCognitiveContext("u1");
    expect(ctx.profile).toEqual(PROFILE);
    expect(ctx.alerts).toEqual([{ type: "dependency" }]);
  });

  it("a fresh L2 hit does not trigger a Kernel refresh", async () => {
    const mod = await freshModule();
    state.selectRow = {
      profile: PROFILE,
      alerts: [],
      profile_updated_at: new Date().toISOString(),
      alerts_updated_at: null,
    };
    await mod.getCognitiveContext("u1");
    expect(state.loadProfile).not.toHaveBeenCalled();
  });

  it("a STALE L2 hit still serves instantly but refreshes in the background", async () => {
    const mod = await freshModule();
    state.selectRow = {
      profile: PROFILE,
      alerts: [],
      profile_updated_at: new Date(Date.now() - 10 * 60_000).toISOString(),
      alerts_updated_at: null,
    };
    const ctx = await mod.getCognitiveContext("u1");
    expect(ctx.profile).toEqual(PROFILE); // stale beats nothing
    await vi.waitFor(() => expect(state.loadProfile).toHaveBeenCalled());
  });

  it("degrades to null when the snapshot read exceeds its 250ms budget", async () => {
    const mod = await freshModule();
    state.selectRow = { profile: PROFILE, alerts: [], profile_updated_at: null, alerts_updated_at: null };
    state.selectDelayMs = 5_000;
    vi.useFakeTimers();
    const p = mod.getCognitiveContext("u1");
    await vi.advanceTimersByTimeAsync(250);
    const ctx = await p;
    expect(ctx.profile).toBeNull();
    expect(ctx.alerts).toEqual([]);
  });

  it("empty everywhere → null profile, no throw", async () => {
    const mod = await freshModule();
    const ctx = await mod.getCognitiveContext("u1");
    expect(ctx).toEqual({ profile: null, alerts: [] });
  });
});

describe("refresh path", () => {
  it("invalidateProfile refreshes from the Kernel and writes the L2 snapshot", async () => {
    const mod = await freshModule();
    mod.invalidateProfile("u1");
    await vi.waitFor(() => {
      expect(state.upserts.some((u) => u.profile === PROFILE)).toBe(true);
    });
    // And the L1 now serves it without touching L2.
    state.selectDelayMs = 5_000;
    const ctx = await mod.getCognitiveContext("u1");
    expect(ctx.profile).toEqual(PROFILE);
  });

  it("setLatestAlerts writes L1 and upserts L2", async () => {
    const mod = await freshModule();
    mod.setLatestAlerts("u1", [{ type: "frustration" } as never]);
    const ctx = await mod.getCognitiveContext("u1");
    expect(ctx.alerts).toEqual([{ type: "frustration" }]);
    await vi.waitFor(() => {
      expect(state.upserts.some((u) => Array.isArray(u.alerts))).toBe(true);
    });
  });

  it("a Kernel failure backs off without erasing the previous profile", async () => {
    const mod = await freshModule();
    mod.invalidateProfile("u1"); // loads PROFILE
    await vi.waitFor(() => expect(state.loadProfile).toHaveBeenCalledTimes(1));
    state.loadProfile = vi.fn(async () => {
      throw new Error("kernel down");
    });
    mod.invalidateProfile("u1");
    await vi.waitFor(() => expect(state.loadProfile).toHaveBeenCalledTimes(1));
    const ctx = await mod.getCognitiveContext("u1");
    expect(ctx.profile).toEqual(PROFILE); // previous value survives
  });
});
