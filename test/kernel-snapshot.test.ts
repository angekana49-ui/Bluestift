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

  it("a minutes-old L2 hit serves instantly and does NOT wake the Kernel", async () => {
    // This used to refresh, and that was the single biggest reason the Kernel
    // was awake: on Vercel the in-process cache is cold on nearly every
    // request, so ordinary chat turns woke a sleeping container to warm it.
    // A profile only changes when the Kernel commits evidence, and those paths
    // call invalidateProfile() themselves.
    const mod = await freshModule();
    state.selectRow = {
      profile: PROFILE,
      alerts: [],
      profile_updated_at: new Date(Date.now() - 30 * 60_000).toISOString(),
      alerts_updated_at: null,
    };
    const ctx = await mod.getCognitiveContext("u1");
    expect(ctx.profile).toEqual(PROFILE);
    await new Promise((r) => setTimeout(r, 20));
    expect(state.loadProfile).not.toHaveBeenCalled();
  });

  it("a profile old enough to have decayed does refresh in the background", async () => {
    // The one thing no event announces: K_effective falls as a student
    // forgets. That drift is measured in days, so the bound is hours, not
    // minutes — but it must still exist, or a quiet student's profile would
    // be frozen at whatever it was the last time they were graded.
    const mod = await freshModule();
    state.selectRow = {
      profile: PROFILE,
      alerts: [],
      profile_updated_at: new Date(Date.now() - 7 * 60 * 60_000).toISOString(),
      alerts_updated_at: null,
    };
    const ctx = await mod.getCognitiveContext("u1");
    expect(ctx.profile).toEqual(PROFILE); // stale beats nothing, served instantly
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
    // Two analysis slots now: the ambient pass and the anchored one a learner
    // asked for. Both empty here.
    expect(ctx).toEqual({ profile: null, alerts: [], analysis: null, anchored: null });
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

  it("setLatestAnalysis writes L1 and upserts L2", async () => {
    const mod = await freshModule();
    mod.setLatestAnalysis("u1", {
      alerts: [{ type: "frustration" }],
      root_gap: "notion_de_variable",
      detection_path: ["derivation", "notion_de_variable"],
      recommended_path: ["notion_de_variable", "derivation"],
      confidence: 0.9,
    } as never);
    const ctx = await mod.getCognitiveContext("u1");
    expect(ctx.alerts).toEqual([{ type: "frustration" }]);
    // The whole point of the rename: the root cause survives the response.
    expect(ctx.analysis?.root_gap).toBe("notion_de_variable");
    expect(ctx.analysis?.recommended_path).toEqual(["notion_de_variable", "derivation"]);
    await vi.waitFor(() => {
      expect(state.upserts.some((u) => u.latest_analysis != null)).toBe(true);
    });
  });

  it("an ANCHORED analysis is written to its own slot as well", async () => {
    // Memorize writes both: the ambient slot (so this session benefits now) and
    // the durable one (so it survives the next ambient pass, three turns away).
    const mod = await freshModule();
    mod.setLatestAnalysis("u1", {
      alerts: [],
      root_gap: "partage_en_parts_egales",
      summary: "The learner got stuck on unequal shares.",
      detection_path: [],
      recommended_path: [],
      confidence: 0.8,
    } as never, { anchored: true });

    const ctx = await mod.getCognitiveContext("u1");
    expect(ctx.anchored?.root_gap).toBe("partage_en_parts_egales");
    // The summary used to be computed on every /analyze and discarded here.
    expect(ctx.anchored?.summary).toBe("The learner got stuck on unequal shares.");
    await vi.waitFor(() => {
      expect(state.upserts.some((u) => u.anchored_analysis != null)).toBe(true);
    });
  });

  it("an AMBIENT analysis never touches the anchored slot", async () => {
    // The bug this closes: one column for both meant the automatic pass
    // overwrote what the learner had explicitly asked to keep.
    const mod = await freshModule();
    mod.setLatestAnalysis("u1", { alerts: [], root_gap: "ambient" } as never);
    const ctx = await mod.getCognitiveContext("u1");
    expect(ctx.analysis?.root_gap).toBe("ambient");
    expect(ctx.anchored).toBeNull();
    expect(state.upserts.every((u) => u.anchored_analysis === undefined)).toBe(true);
  });

  it("an anchored analysis outlives the ambient TTL", async () => {
    // Thirty minutes is right for a pass nobody asked for and wrong for one
    // someone did — the dialog says the thread is "something Raya can draw on
    // later", and half an hour is not later.
    const mod = await freshModule();
    const dayOld = Date.now() - 24 * 60 * 60_000;
    state.selectRow = {
      profile: null,
      alerts: [],
      latest_analysis: { root_gap: "ambient", detection_path: [], recommended_path: [], confidence: 0.5, at: dayOld },
      anchored_analysis: { root_gap: "anchored", summary: "kept", detection_path: [], recommended_path: [], confidence: 0.8, at: dayOld },
      profile_updated_at: null,
      alerts_updated_at: null,
      anchored_updated_at: new Date(dayOld).toISOString(),
    };
    const ctx = await mod.getCognitiveContext("u1");
    expect(ctx.analysis).toBeNull();          // ambient: expired
    expect(ctx.anchored?.root_gap).toBe("anchored"); // anchored: still there
  });

  it("an analysis older than the TTL is not served as current", async () => {
    const mod = await freshModule();
    state.selectRow = {
      profile: null,
      alerts: [],
      latest_analysis: {
        root_gap: "stale_gap",
        detection_path: [],
        recommended_path: [],
        confidence: 0.5,
        at: Date.now() - 31 * 60_000,
      },
      profile_updated_at: null,
      alerts_updated_at: null,
    };
    const ctx = await mod.getCognitiveContext("u1");
    expect(ctx.analysis).toBeNull();
  });

  it("a root cause from the last half hour IS served", async () => {
    const mod = await freshModule();
    state.selectRow = {
      profile: null,
      alerts: [],
      latest_analysis: {
        root_gap: "fresh_gap",
        detection_path: [],
        recommended_path: [],
        confidence: 0.5,
        at: Date.now() - 60_000,
      },
      profile_updated_at: null,
      alerts_updated_at: null,
    };
    const ctx = await mod.getCognitiveContext("u1");
    expect(ctx.analysis?.root_gap).toBe("fresh_gap");
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
