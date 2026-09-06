import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Where a sign-in is allowed to land.
 *
 * Both auth callbacks build their redirect by concatenating `next` onto the
 * origin, and `next` comes from the query string. String concatenation is what
 * makes that dangerous: a value that does not start with `/` is not a path at
 * all once it is glued to a URL, and two of the shapes below take the browser
 * to a different site entirely while the link still reads as ours.
 *
 * The oracle is `new URL`, not a regex of our own — the question is what a
 * browser resolves, and WHATWG parsing is what a browser does.
 */
const ORIGIN = "https://app.test";

/** The guard, mirrored from the two route files (kept honest by the last test). */
function safeNext(raw: string | null): string {
  if (!raw || !raw.startsWith("/")) return "/";
  if (raw.startsWith("//") || raw.startsWith("/\\")) return "/";
  return raw;
}

const hostAfter = (next: string | null) => new URL(ORIGIN + safeNext(next)).host;

describe("safeNext", () => {
  it("keeps an ordinary in-app destination", () => {
    expect(safeNext("/account")).toBe("/account");
    expect(safeNext("/school?tab=lms")).toBe("/school?tab=lms");
    expect(safeNext(null)).toBe("/");
  });

  it("refuses the userinfo trick — everything before an @ is not the host", () => {
    // Unguarded, `https://app.test` + `@evil.com` resolves to host evil.com.
    expect(new URL(`${ORIGIN}@evil.com`).host).toBe("evil.com");
    expect(hostAfter("@evil.com")).toBe("app.test");
    expect(hostAfter("%09@evil.com")).toBe("app.test");
    expect(hostAfter(":80@evil.com")).toBe("app.test");
  });

  it("refuses a value that just extends our hostname", () => {
    expect(new URL(`${ORIGIN}.evil.com`).host).toBe("app.test.evil.com");
    expect(hostAfter(".evil.com")).toBe("app.test");
    expect(hostAfter("-x.evil.com")).toBe("app.test");
  });

  it("refuses a protocol-relative destination, including the backslash form", () => {
    expect(hostAfter("//evil.com")).toBe("app.test");
    expect(hostAfter("/\\evil.com")).toBe("app.test");
    expect(hostAfter("/\\/evil.com")).toBe("app.test");
  });

  it("never lets any input reach another host", () => {
    const attempts = [
      "@evil.com",
      ".evil.com",
      "//evil.com",
      "/\\evil.com",
      "https://evil.com",
      "\\/evil.com",
      "\t//evil.com",
      "  //evil.com",
    ];
    for (const a of attempts) expect(hostAfter(a)).toBe("app.test");
  });
});

describe("both callbacks actually use it", () => {
  for (const file of ["app/auth/callback/route.ts", "app/auth/confirm/route.ts"]) {
    it(`${file} routes \`next\` through safeNext`, () => {
      const src = readFileSync(join(process.cwd(), file), "utf8");
      expect(src).toContain('const next = safeNext(searchParams.get("next"));');
      expect(src).not.toContain('searchParams.get("next") ?? "/"');
      // And the guard it uses is the one these tests describe.
      expect(src).toContain('if (!raw || !raw.startsWith("/")) return "/";');
      expect(src).toContain('if (raw.startsWith("//") || raw.startsWith("/\\\\")) return "/";');
    });
  }
});
