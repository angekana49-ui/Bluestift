import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { buildCsp, makeNonce } from "@/lib/security/csp";

/**
 * The nonce policy, and the four ways it can silently stop working.
 *
 * Every failure mode here is invisible in review: the page still builds, the
 * header is still present, and the only symptom is a browser refusing scripts
 * — or, worse, quietly accepting ones it should not.
 */
describe("makeNonce", () => {
  it("is different every time", () => {
    const seen = new Set(Array.from({ length: 200 }, () => makeNonce()));
    expect(seen.size).toBe(200);
  });

  it("carries enough randomness to be worth calling a nonce", () => {
    // 16 bytes → 24 base64 characters. A short nonce is a guessable one.
    expect(makeNonce()).toHaveLength(24);
  });
});

/**
 * Next.js does not accept a nonce as configuration. It parses one out of the
 * `Content-Security-Policy` header on the incoming request and stamps it onto
 * the script tags it emits — so if OUR policy is shaped in a way ITS parser
 * does not recognise, Next emits scripts with no nonce, the browser refuses
 * them, and the page arrives blank.
 *
 * The regex below is read out of Next itself at test time rather than copied,
 * so an upgrade that changes the accepted shape fails here instead of in
 * production.
 */
describe("Next.js can find our nonce", () => {
  const parserSrc = readFileSync(
    join(process.cwd(), "node_modules/next/dist/server/app-render/get-script-nonce-from-header.js"),
    "utf8",
  );
  const declared = parserSrc.match(/CSP_NONCE_SOURCE_REGEX = (\/.+\/);/)?.[1];

  it("still parses the header the way we think it does", () => {
    expect(declared).toBeTruthy();
    // It looks at `script-src` first, falling back to `default-src`.
    expect(parserSrc).toContain("script-src");
    expect(parserSrc).toContain("default-src");
  });

  it("matches the nonce token we emit", () => {
    const re = new RegExp(declared!.slice(1, declared!.lastIndexOf("/")));
    const nonce = makeNonce();
    expect(`'nonce-${nonce}'`).toMatch(re);
  });

  it("finds it in the real policy, by Next's own procedure", () => {
    const nonce = makeNonce();
    const csp = buildCsp(nonce, false);
    const re = new RegExp(declared!.slice(1, declared!.lastIndexOf("/")));

    const directives = csp.split(";").map((d) => d.trim());
    const directive =
      directives.find((d) => d.startsWith("script-src")) ??
      directives.find((d) => d.startsWith("default-src"));
    expect(directive).toBeTruthy();

    let found: string | undefined;
    for (const source of directive!.split(/\s+/).slice(1)) {
      const m = source.trim().match(re);
      if (m) {
        found = m[1];
        break;
      }
    }
    expect(found).toBe(nonce);
  });
});

describe("buildCsp", () => {
  const nonce = "TESTNONCE0123456789abcd";
  const prod = buildCsp(nonce, false);
  const dev = buildCsp(nonce, true);
  const scriptSrc = (csp: string) =>
    csp.split(";").map((d) => d.trim()).find((d) => d.startsWith("script-src"))!;

  it("no longer allows inline scripts — the whole point of the exercise", () => {
    expect(scriptSrc(prod)).not.toContain("'unsafe-inline'");
    expect(scriptSrc(dev)).not.toContain("'unsafe-inline'");
  });

  it("trusts the nonce and what the nonce loads, not an origin list", () => {
    expect(scriptSrc(prod)).toContain(`'nonce-${nonce}'`);
    expect(scriptSrc(prod)).toContain("'strict-dynamic'");
  });

  it("never ships 'unsafe-eval' to production", () => {
    expect(prod).not.toContain("'unsafe-eval'");
    // React needs it in development to rebuild server stacks in the browser.
    expect(dev).toContain("'unsafe-eval'");
  });

  it("keeps 'unsafe-inline' for STYLES, which no nonce can replace", () => {
    // The design system is built on `style={{…}}` attributes, and CSP governs
    // those separately from <style> elements. Dropping this blanks the UI.
    const styleSrc = prod.split(";").map((d) => d.trim()).find((d) => d.startsWith("style-src"))!;
    expect(styleSrc).toContain("'unsafe-inline'");
  });

  it("still refuses framing, plugins and a rewritten <base>", () => {
    expect(prod).toContain("frame-ancestors 'none'");
    expect(prod).toContain("object-src 'none'");
    expect(prod).toContain("base-uri 'self'");
    expect(prod).toContain("form-action 'self'");
  });

  it("keeps the surfaces the app actually needs", () => {
    expect(prod).toContain("worker-src 'self' blob:"); // service worker
    expect(prod).toContain("media-src 'self' blob: data:"); // voice notes
    expect(prod).toContain("https://challenges.cloudflare.com"); // Turnstile iframe
  });

  it("emits one script-src, so Next reads the directive we meant", () => {
    // Next takes the FIRST directive whose name starts with "script-src" — a
    // second one (script-src-elem, say) placed earlier would shadow this.
    const names = prod.split(";").map((d) => d.trim().split(/\s+/)[0]);
    expect(names.filter((n) => n.startsWith("script-src"))).toHaveLength(1);
  });
});

describe("the policy is wired where a nonce can exist", () => {
  const proxy = readFileSync(join(process.cwd(), "proxy.ts"), "utf8");
  const config = readFileSync(join(process.cwd(), "next.config.ts"), "utf8");
  const layout = readFileSync(join(process.cwd(), "app/layout.tsx"), "utf8");

  it("is built per request in the proxy, not once at build time", () => {
    expect(proxy).toContain("makeNonce()");
    expect(proxy).toContain("buildCsp(");
    // The config still NAMES the header, in the comment explaining why it left.
    // What it must not do is set it.
    expect(config).not.toContain('key: "Content-Security-Policy"');
  });

  it("puts the SAME policy on the request and on the response", () => {
    // The request copy decides which nonce Next writes into the page; the
    // response copy decides which nonce the browser accepts. Two different
    // strings is a blank page.
    expect(proxy).toContain('headers.set("content-security-policy", csp)');
    expect(proxy).toContain('response.headers.set("content-security-policy", csp)');
    expect(proxy.match(/buildCsp\(/g)).toHaveLength(1);
  });

  it("keeps every page server-rendered, because a prerendered one has no nonce", () => {
    expect(layout).toContain('export const dynamic = "force-dynamic"');
  });

  it("leaves the constant security headers in the config, where they belong", () => {
    for (const h of [
      "X-Content-Type-Options",
      "X-Frame-Options",
      "Referrer-Policy",
      "Permissions-Policy",
      "Strict-Transport-Security",
    ]) {
      expect(config).toContain(h);
    }
  });
});
