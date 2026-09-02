import { describe, expect, it, vi, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { authorizedCron } from "@/lib/cron-auth";

/**
 * Cron endpoints, and the monitor that would have caught the seventeen-day
 * Kernel outage on day one.
 *
 * The auth half is a security check that now has two callers — one of which
 * erases accounts. It is tested here rather than trusted, because the failure
 * mode of a bearer check is that it keeps working for the legitimate caller
 * while being wrong.
 */

const req = (auth?: string) =>
  new Request("https://example.com/api/cron/x", auth ? { headers: { authorization: auth } } : {});

afterEach(() => vi.unstubAllEnvs());

describe("cron authorization", () => {
  it("an UNSET secret closes the endpoint rather than opening it", () => {
    // The direction that matters. A cron route that answers everyone because
    // nobody configured it is worse than one that answers nobody: the first is
    // a public account-erasure endpoint.
    vi.stubEnv("CRON_SECRET", "");
    expect(authorizedCron(req("Bearer anything"))).toBe(false);
    expect(authorizedCron(req())).toBe(false);
  });

  it("accepts the exact bearer and nothing else", () => {
    vi.stubEnv("CRON_SECRET", "s3cret-value");
    expect(authorizedCron(req("Bearer s3cret-value"))).toBe(true);
    expect(authorizedCron(req("Bearer s3cret-valu"))).toBe(false);
    expect(authorizedCron(req("Bearer  s3cret-value"))).toBe(false); // double space
    expect(authorizedCron(req("bearer s3cret-value"))).toBe(false); // case matters
    expect(authorizedCron(req("s3cret-value"))).toBe(false);
    expect(authorizedCron(req())).toBe(false);
  });

  it("treats a trailing space as the same header, because HTTP does", () => {
    // `Bearer x ` compares equal to `Bearer x`, and that is correct rather than
    // a hole: header values are trimmed at the transport layer, so the space
    // never reaches this function. Written down because it looks like a bug on
    // first read and someone will otherwise "fix" it.
    vi.stubEnv("CRON_SECRET", "s3cret-value");
    expect(new Request("https://e.com", { headers: { authorization: "Bearer s3cret-value " } })
      .headers.get("authorization")).toBe("Bearer s3cret-value");
    expect(authorizedCron(req("Bearer s3cret-value "))).toBe(true);
  });

  it("a prefix match is not enough", () => {
    // The specific thing a timing-safe compare is for.
    vi.stubEnv("CRON_SECRET", "abcdefgh");
    expect(authorizedCron(req("Bearer a"))).toBe(false);
    expect(authorizedCron(req("Bearer abcdefg"))).toBe(false);
    expect(authorizedCron(req("Bearer abcdefgh"))).toBe(true);
  });

  it("is defined once, not copied per route", () => {
    // It started as a private function inside the account-erasure route. A
    // second cron meant a second copy, which is how one of them ends up with a
    // `!==` in it a year later while the other keeps the constant-time compare.
    const anon = readFileSync(join(process.cwd(), "app/api/cron/anon-lifecycle/route.ts"), "utf8");
    const health = readFileSync(join(process.cwd(), "app/api/cron/kernel-health/route.ts"), "utf8");
    for (const [name, src] of [["anon-lifecycle", anon], ["kernel-health", health]] as const) {
      expect(src, name).toMatch(/authorizedCron/);
      expect(src, name).not.toMatch(/timingSafeEqual/);
    }
  });
});

describe("the Kernel monitor", () => {
  const route = readFileSync(join(process.cwd(), "app/api/cron/kernel-health/route.ts"), "utf8");
  const vercel = JSON.parse(readFileSync(join(process.cwd(), "vercel.json"), "utf8")) as {
    crons: { path: string; schedule: string }[];
  };

  it("is actually scheduled — the whole point", () => {
    // /api/kernel/health already existed and returned exactly the boolean
    // needed. Nothing called it. That is why the outage lasted seventeen days.
    expect(vercel.crons.some((c) => c.path === "/api/cron/kernel-health")).toBe(true);
  });

  it("does not collide with the other cron's slot", () => {
    const schedules = vercel.crons.map((c) => c.schedule);
    expect(new Set(schedules).size).toBe(schedules.length);
  });

  it("is authenticated like every other cron", () => {
    expect(route).toMatch(/authorizedCron\(request\)/);
    expect(route).toMatch(/status: 401/);
  });

  it("checks readiness as well as liveness", () => {
    // A Kernel that answers /health but cannot reach its database is the more
    // confusing outage of the two, because it looks alive.
    expect(route).toMatch(/kernel\.health\(/);
    expect(route).toMatch(/kernel\.ready\(/);
    expect(route).toMatch(/degraded/);
  });

  it("reports at error, not warning", () => {
    // The per-turn reporter uses `warning` because one failed call is genuinely
    // expected sometimes. A scheduled probe failing is not noise.
    expect(route).toMatch(/severity: "error"/);
    expect(route).toMatch(/dependency: "kernel"/);
  });

  it("tolerates a cold start rather than reporting one as an outage", () => {
    // The Kernel sleeps when idle and a Python cold start outlasts the client's
    // 6s default. Alerting on that would train the reader to ignore alerts.
    expect(route).toMatch(/PROBE_TIMEOUT_MS/);
    const ms = /const PROBE_TIMEOUT_MS = ([\d_]+)/.exec(route)?.[1]?.replace(/_/g, "");
    expect(Number(ms)).toBeGreaterThanOrEqual(20_000);
  });

  it("keeps the PUBLIC probe quiet about internals", () => {
    // /api/kernel/health is deliberately reachable by an external uptime
    // monitor, so it returns a bare boolean. Only this cron — whose body only
    // the operator reads — may name what failed.
    const pub = readFileSync(join(process.cwd(), "app/api/kernel/health/route.ts"), "utf8");
    expect(pub).toMatch(/NextResponse\.json\(\{ ok \}\)/);
    expect(route).toMatch(/liveness/);
  });
});
