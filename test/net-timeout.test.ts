import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { withTimeout } from "@/lib/net/timeout";

/**
 * `withTimeout` is the app-wide "bounded, total" contract: whatever happens to
 * the wrapped promise, the caller gets an answer, on time. Middleware auth,
 * plan labels and kernel-snapshot reads all lean on exactly these properties.
 */
describe("withTimeout", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("passes through a value that arrives before the deadline", async () => {
    const p = withTimeout(Promise.resolve("fast"), 1000, "fallback");
    await expect(p).resolves.toBe("fast");
  });

  it("resolves the fallback when the deadline fires first", async () => {
    const never = new Promise<string>(() => {});
    const p = withTimeout(never, 500, "fallback");
    await vi.advanceTimersByTimeAsync(500);
    await expect(p).resolves.toBe("fallback");
  });

  it("resolves the fallback on rejection — it never rejects", async () => {
    const p = withTimeout(Promise.reject(new Error("boom")), 1000, "fallback");
    await expect(p).resolves.toBe("fallback");
  });

  it("keeps the first settlement when the value lands late", async () => {
    let resolveLate!: (v: string) => void;
    const late = new Promise<string>((r) => (resolveLate = r));
    const p = withTimeout(late, 200, "fallback");
    await vi.advanceTimersByTimeAsync(200);
    resolveLate("too late");
    await expect(p).resolves.toBe("fallback");
  });
});
