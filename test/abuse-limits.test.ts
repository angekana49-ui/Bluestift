import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { EXPENSIVE_LIMITS } from "@/lib/abuse-limits";

/**
 * Every request that spends money or storage has a ceiling that does not depend
 * on billing.
 *
 * The plan quotas only block once a payment provider is live; until then they
 * count and let everything through. Before this, that meant one scripted
 * anonymous account could generate, transcribe, analyse and upload in a loop at
 * our expense. These tests make a new model-calling route fail CI until it is
 * given a ceiling, or listed below with the reason it does not need one.
 */

const ROOT = process.cwd();
const read = (p: string) => readFileSync(join(ROOT, p), "utf8").replace(/\r\n/g, "\n");

function routeFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(join(ROOT, dir))) {
    const rel = `${dir}/${name}`;
    if (statSync(join(ROOT, rel)).isDirectory()) out.push(...routeFiles(rel));
    else if (name === "route.ts") out.push(relative(ROOT, join(ROOT, rel)).replace(/\\/g, "/"));
  }
  return out;
}

const LIMITER = /\b(limitExpensive|withinExpensiveLimit|checkStrictUserRateLimit|checkUserRateLimit|checkRateLimit|checkStrictRateLimit)\(/;
const SPENDS = /from "@\/lib\/(raya\/llm|kernel\/client)"/;

/** Routes that call a model or the Kernel without a per-caller ceiling, and why that is fine. */
const EXEMPT: Record<string, string> = {
  "app/api/cron/kernel-health/route.ts": "only Vercel Cron can call it (CRON_SECRET)",
  "app/api/kernel/health/route.ts": "public uptime probe; its answer is cached (asserted below)",
  "app/api/school/alerts/resolve/route.ts": "staff-only acknowledgement, one cheap Kernel write per alert, count capped in the route",
};

describe("model and Kernel calls have a ceiling", () => {
  const spenders = routeFiles("app/api").filter((f) => SPENDS.test(read(f)));

  it("finds the routes it is meant to police", () => {
    expect(spenders.length).toBeGreaterThan(15);
  });

  it.each(spenders)("%s is rate-limited or explicitly exempt", (file) => {
    if (EXEMPT[file]) return;
    expect(read(file), `${file}: add limitExpensive() from lib/abuse-limits.ts, or an EXEMPT entry with a reason`).toMatch(LIMITER);
  });

  it("keeps no stale exemption", () => {
    for (const file of Object.keys(EXEMPT)) expect(spenders, file).toContain(file);
  });

  it("caches the public Kernel health probe", () => {
    const src = read("app/api/kernel/health/route.ts");
    expect(src).toMatch(/CACHE_MS = \d/);
    expect(src.indexOf("cached &&")).toBeLessThan(src.indexOf("await probe()"));
  });
});

describe("uploads have a ceiling", () => {
  it.each([
    "app/api/raya/files/route.ts",
    "app/api/rooms/files/route.ts",
    "app/api/school/raya/files/route.ts",
    "app/api/school/logo/route.ts",
    "app/api/tools/extract/route.ts",
  ])("%s", (file) => {
    expect(read(file)).toMatch(/await limitExpensive\("(upload|logo|toolExtract)", user\.id\)/);
  });
});

describe("limitExpensive is used the way it works", () => {
  it("is always awaited, and its answer returned", () => {
    for (const file of routeFiles("app/api")) {
      const src = read(file);
      for (const line of src.match(/[^\n]*\blimitExpensive\(/g) ?? []) {
        if (line.includes("import ")) continue;
        expect(line, file).toMatch(/const limited = await limitExpensive\(/);
        expect(src, file).toMatch(/if \(limited\) return limited;/);
      }
    }
  });

  it("names only kinds that exist", () => {
    for (const file of routeFiles("app/api")) {
      for (const m of read(file).matchAll(/(?:limitExpensive|withinExpensiveLimit)\("(\w+)"/g)) {
        expect(Object.keys(EXPENSIVE_LIMITS), `${file}: ${m[1]}`).toContain(m[1]);
      }
    }
  });

  it("keeps every daily ceiling above its per-minute one", () => {
    for (const [kind, { perMinute, perDay }] of Object.entries(EXPENSIVE_LIMITS)) {
      expect(perDay, kind).toBeGreaterThan(perMinute);
    }
  });
});

describe("public forms are limited per IP, not only by captcha", () => {
  it.each([
    "app/api/content/contact/route.ts",
    "app/api/content/feedback/route.ts",
    "app/api/content/survey/route.ts",
    "app/api/content/survey/contact/route.ts",
    "app/api/content/subscribe/route.ts",
    "app/api/content/contribute/route.ts",
  ])("%s", (file) => {
    const src = read(file);
    // Captcha farms solve Turnstile cheaply; the IP ceiling runs first so a
    // flood costs one database call, not one Cloudflare call each.
    expect(src).toMatch(/checkRateLimit\("form_\w+", clientIp\(\w+\), \d+\)/);
    expect(src.indexOf("checkRateLimit(\"form_")).toBeLessThan(src.indexOf("verifyTurnstile("));
  });
});

describe("room actions are endpoints too", () => {
  const src = read("app/rooms/actions.ts");
  const body = (name: string) => {
    const start = src.indexOf(`export async function ${name}(`);
    const next = src.indexOf("\nexport async function ", start + 1);
    return src.slice(start, next < 0 ? undefined : next);
  };

  it.each(["createRoom", "joinRoom", "postRoomMessage"])("%s has a ceiling", (name) => {
    expect(body(name)).toMatch(/checkStrictUserRateLimit\("room_/);
  });

  it("caps a room message at the chat's length", () => {
    expect(body("postRoomMessage")).toMatch(/content\.trim\(\)\.slice\(0, 4000\)/);
  });
});
