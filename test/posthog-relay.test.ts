import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  POSTHOG_INGEST_PATH,
  posthogAssetsHost,
  posthogHost,
  posthogUiHost,
  posthogUpstream,
} from "@/lib/analytics/posthog-host";
import { trailingSlashTarget } from "@/lib/trailing-slash";
import { buildCsp } from "@/lib/security/csp";
import { GET, POST } from "@/app/ingest/[...path]/route";

/**
 * PostHog, connected the way it has to be.
 *
 * Every failure here is silent in production. A key sent to the wrong cluster
 * gets a 401 nobody sees — that is how PostHog received nothing from launch to
 * September 2026. A relay that forwards cookies hands the Supabase session to a
 * third party and still "works". A slash redirect that goes missing changes
 * nothing visible either.
 */

const read = (rel: string) => readFileSync(join(process.cwd(), rel), "utf8").split("\r\n").join("\n");

describe("the PostHog host", () => {
  it("defaults to the US cloud, where the project's key was issued", () => {
    expect(posthogHost("")).toBe("https://us.i.posthog.com");
    expect(posthogHost("not a url")).toBe("https://us.i.posthog.com");
  });

  it("reduces a configured value to its origin", () => {
    expect(posthogHost(" https://us.i.posthog.com/ ")).toBe("https://us.i.posthog.com");
  });

  it("derives the assets and dashboard hosts per cluster", () => {
    expect(posthogAssetsHost("https://us.i.posthog.com")).toBe("https://us-assets.i.posthog.com");
    expect(posthogAssetsHost("https://eu.i.posthog.com")).toBe("https://eu-assets.i.posthog.com");
    expect(posthogUiHost("https://us.i.posthog.com")).toBe("https://us.posthog.com");
  });

  it("leaves a self-hosted instance as one origin", () => {
    expect(posthogAssetsHost("https://ph.example.org")).toBe("https://ph.example.org");
    expect(posthogUiHost("https://ph.example.org")).toBe("https://ph.example.org");
  });

  it("is the same cluster the sub-processors page declares", () => {
    const view = read("components/site/pages/SubprocessorsView.tsx");
    const row = view.slice(view.indexOf('"PostHog"'), view.indexOf("],", view.indexOf('"PostHog"')));
    expect(row).toContain('tr("subprocessors.loc.us")');
  });
});

describe("posthogUpstream", () => {
  const US = "https://us.i.posthog.com";

  it("keeps the trailing slash and the query PostHog expects", () => {
    const url = posthogUpstream(["e"], { trailingSlash: true, search: "?ip=0&compression=gzip-js" }, US);
    expect(url?.toString()).toBe("https://us.i.posthog.com/e/?ip=0&compression=gzip-js");
  });

  it("sends scripts and remote config to the assets host", () => {
    expect(posthogUpstream(["static", "surveys.js"], { trailingSlash: false, search: "" }, US)?.origin).toBe(
      "https://us-assets.i.posthog.com",
    );
    expect(posthogUpstream(["array", "phc_x", "config.js"], { trailingSlash: false, search: "" }, US)?.origin).toBe(
      "https://us-assets.i.posthog.com",
    );
  });

  it("cannot be steered off PostHog", () => {
    for (const segments of [["..", "x"], ["."], [], [""]]) {
      expect(posthogUpstream(segments, { trailingSlash: false, search: "" }, US)).toBeNull();
    }
    const sneaky = posthogUpstream(["", "evil.example", "e"], { trailingSlash: false, search: "" }, US);
    expect(sneaky).toBeNull();
    const encoded = posthogUpstream(["%2F%2Fevil.example", "e"], { trailingSlash: false, search: "" }, US);
    expect(encoded?.origin).toBe(US);
    const slashInSegment = posthogUpstream(["/evil.example"], { trailingSlash: false, search: "" }, US);
    expect(slashInSegment?.origin).toBe(US);
  });
});

describe("the /ingest relay", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function stubUpstream(response: Response) {
    const calls: { url: string; init: RequestInit }[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: URL | string, init: RequestInit) => {
        calls.push({ url: String(url), init });
        return response;
      }),
    );
    return calls;
  }

  const ctx = (path: string[]) => ({ params: Promise.resolve({ path }) });

  it("never forwards the browser's cookies — that is the Supabase session", async () => {
    const calls = stubUpstream(new Response("{}", { status: 200, headers: { "content-type": "application/json" } }));
    const req = new Request(`https://www.thebluestift.com${POSTHOG_INGEST_PATH}/e/?compression=gzip-js`, {
      method: "POST",
      headers: {
        cookie: "sb-mbvovxnfdptxvnhmdxew-auth-token=secret",
        authorization: "Bearer secret",
        "content-type": "text/plain",
        "user-agent": "TestBrowser/1.0",
        "x-forwarded-for": "203.0.113.7, 10.0.0.1",
      },
      body: "batch",
    });

    const res = await POST(req, ctx(["e"]));
    expect(res.status).toBe(200);
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toMatch(/^https:\/\/[a-z.-]*posthog\.com\/e\/\?compression=gzip-js$/);

    const sent = new Headers(calls[0].init.headers);
    expect(sent.get("cookie")).toBeNull();
    expect(sent.get("authorization")).toBeNull();
    expect(sent.get("content-type")).toBe("text/plain");
    expect(sent.get("user-agent")).toBe("TestBrowser/1.0");
    // The client, not the last hop — PostHog's country on the event.
    expect(sent.get("x-forwarded-for")).toBe("203.0.113.7");
  });

  it("puts nothing PostHog sets on our origin", async () => {
    stubUpstream(
      new Response("ok", {
        status: 200,
        headers: { "content-type": "text/javascript", "set-cookie": "ph=1", "content-encoding": "gzip" },
      }),
    );
    const res = await GET(new Request(`https://www.thebluestift.com${POSTHOG_INGEST_PATH}/static/surveys.js`), ctx(["static", "surveys.js"]));
    expect(res.headers.get("set-cookie")).toBeNull();
    expect(res.headers.get("content-encoding")).toBeNull();
    expect(res.headers.get("content-type")).toBe("text/javascript");
  });

  it("answers 502 rather than throwing when PostHog is unreachable", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new Error("offline"))));
    const res = await POST(
      new Request(`https://www.thebluestift.com${POSTHOG_INGEST_PATH}/e/`, { method: "POST", body: "x" }),
      ctx(["e"]),
    );
    expect(res.status).toBe(502);
  });
});

describe("the wiring around the relay", () => {
  it("the browser SDK sends to our origin, not to PostHog", () => {
    const lazy = read("lib/analytics/posthog-lazy.ts");
    expect(lazy).toContain("api_host: POSTHOG_INGEST_PATH");
    expect(lazy).not.toMatch(/api_host:\s*["']https?:/);
  });

  it("is not an external rewrite, which would forward cookies", () => {
    const config = read("next.config.ts");
    expect(config).not.toMatch(/destination:\s*[`"']https:\/\/[^`"']*posthog/);
    expect(config).toContain("skipTrailingSlashRedirect: true");
  });

  it("names PostHog in no CSP directive", () => {
    expect(buildCsp("TESTNONCE0123456789abcd", false)).not.toContain("posthog");
  });

  it("is left out of the proxy, which puts the slash redirect back for everything else", () => {
    const proxy = read("proxy.ts");
    expect(proxy).toContain("ingest/|");
    expect(proxy).toContain("trailingSlashTarget(request.nextUrl.pathname)");
    expect(proxy).toContain("NextResponse.redirect(target, 308)");
  });

  it("is left alone by the service worker", () => {
    expect(read("public/sw.js")).toMatch(/url\.pathname\.startsWith\("\/ingest\/"\)\s*\)\s*return/);
  });
});

describe("trailingSlashTarget", () => {
  it("strips one slash, as Next did", () => {
    expect(trailingSlashTarget("/about/")).toBe("/about");
    expect(trailingSlashTarget("/rooms/abc/")).toBe("/rooms/abc");
  });

  it("leaves the root, clean paths and .well-known alone", () => {
    expect(trailingSlashTarget("/")).toBeNull();
    expect(trailingSlashTarget("/about")).toBeNull();
    expect(trailingSlashTarget("/.well-known/")).toBeNull();
    expect(trailingSlashTarget("/.well-known/acme-challenge/")).toBeNull();
  });
});
