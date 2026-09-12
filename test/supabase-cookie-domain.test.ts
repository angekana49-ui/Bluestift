import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { conflictingSessionCookies, cookieDomainFor } from "@/lib/supabase/cookie-domain";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("cookieDomainFor", () => {
  it("scopes to the parent on the apex and every subdomain", () => {
    vi.stubEnv("NEXT_PUBLIC_COOKIE_DOMAIN", ".thebluestift.com");
    for (const host of [
      "thebluestift.com",
      "www.thebluestift.com",
      "www.raya.thebluestift.com",
      "schools.thebluestift.com",
      "SCHOOLS.thebluestift.com:443",
    ]) {
      expect(cookieDomainFor(host), host).toBe(".thebluestift.com");
    }
  });

  it("stays host-only where the browser would reject the domain silently", () => {
    vi.stubEnv("NEXT_PUBLIC_COOKIE_DOMAIN", ".thebluestift.com");
    for (const host of [
      "localhost:3000",
      "127.0.0.1:3000",
      "bluestift-git-main.vercel.app",
      "evilthebluestift.com",
      null,
      undefined,
      "",
    ]) {
      expect(cookieDomainFor(host), String(host)).toBeUndefined();
    }
  });

  it("is host-only whenever the variable is unset", () => {
    vi.stubEnv("NEXT_PUBLIC_COOKIE_DOMAIN", "");
    expect(cookieDomainFor("www.thebluestift.com")).toBeUndefined();
  });
});

describe("conflictingSessionCookies", () => {
  it("ignores a single clean session, chunked or not", () => {
    expect(conflictingSessionCookies("sb-ref-auth-token=a; theme=dark")).toEqual([]);
    expect(conflictingSessionCookies("sb-ref-auth-token.0=a; sb-ref-auth-token.1=b")).toEqual([]);
    expect(conflictingSessionCookies(null)).toEqual([]);
  });

  it("flags a name the browser sent twice", () => {
    expect(conflictingSessionCookies("sb-ref-auth-token=old; x=1; sb-ref-auth-token=new")).toEqual([
      "sb-ref-auth-token",
    ]);
  });

  it("flags a whole value sent alongside chunks of the same session", () => {
    expect(
      conflictingSessionCookies("sb-ref-auth-token=a; sb-ref-auth-token.0=b; sb-ref-auth-token.1=c").sort(),
    ).toEqual(["sb-ref-auth-token", "sb-ref-auth-token.0", "sb-ref-auth-token.1"]);
  });

  it("leaves other cookies alone even when they repeat", () => {
    expect(conflictingSessionCookies("theme=a; theme=b")).toEqual([]);
  });
});

/**
 * The bug this file exists for was ONE client of three writing a different
 * scope. Asserted over the source because the failure is a shape: a fourth
 * client, or a refactor of one of these, reading the variable directly again.
 */
describe("every Supabase client resolves the cookie scope the same way", () => {
  const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");

  for (const file of ["lib/supabase/client.ts", "lib/supabase/server.ts", "lib/supabase/proxy.ts"]) {
    it(file, () => {
      const src = read(file);
      expect(src).toContain("cookieDomainFor(");
      expect(src).not.toMatch(/domain:\s*process\.env\.NEXT_PUBLIC_COOKIE_DOMAIN/);
    });
  }
});
