import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

/**
 * The error reporter is the thing that speaks when everything else has gone
 * quiet, so these tests care about two properties above all: it always says
 * something, and it never makes the failure worse by throwing.
 *
 * The module keeps its throttle state in module scope, so every test loads a
 * fresh copy.
 */
async function loadReport() {
  vi.resetModules();
  return import("@/lib/observability/report");
}

function loggedRecords(spy: { mock: { calls: unknown[][] } }, prefix: string) {
  return spy.mock.calls
    .filter((c) => c[0] === prefix)
    .map((c) => JSON.parse(String(c[1])) as Record<string, unknown>);
}

let errorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("reportIssue", () => {
  it("always logs one line, even with nothing configured", async () => {
    const { reportIssue, LOG_PREFIX } = await loadReport();
    await reportIssue({ scope: "test", message: "it broke" });

    const records = loggedRecords(errorSpy, LOG_PREFIX);
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({ scope: "test", message: "it broke", severity: "error" });
    expect(String(records[0].ts)).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("logs the record as a single line, so one failure is one log entry", async () => {
    const { reportIssue, LOG_PREFIX } = await loadReport();
    await reportIssue({ scope: "test", message: "line one\nline two", stack: "a\nb\nc" });

    const payload = errorSpy.mock.calls.find((c) => c[0] === LOG_PREFIX)?.[1];
    expect(String(payload)).not.toContain("\n");
  });

  it("does not call out when no webhook is configured", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { reportIssue } = await loadReport();
    await reportIssue({ scope: "test", message: "it broke" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("POSTs the record when a webhook is configured", async () => {
    const fetchMock = vi.fn(async () => new Response("ok"));
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("ERROR_WEBHOOK_URL", "https://hooks.example/report");

    const { reportIssue } = await loadReport();
    await reportIssue({ scope: "billing.webhook", message: "it broke" });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://hooks.example/report");
    expect(init.method).toBe("POST");
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(JSON.parse(String(init.body))).toMatchObject({ scope: "billing.webhook" });
  });

  it("survives a webhook that is itself down", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("ECONNREFUSED"); }));
    vi.stubEnv("ERROR_WEBHOOK_URL", "https://hooks.example/report");

    const { reportIssue, LOG_PREFIX } = await loadReport();
    await expect(reportIssue({ scope: "test", message: "it broke" })).resolves.toBeUndefined();
    // …and the log line still happened: it is the durable half.
    expect(loggedRecords(errorSpy, LOG_PREFIX)).toHaveLength(1);
  });
});

describe("redaction", () => {
  it("scrubs secrets and addresses out of the message", async () => {
    const { redact } = await loadReport();
    expect(redact("mail to ada@example.com failed")).toBe("mail to <email> failed");
    expect(redact("token=sk_live_abcdef123456")).toBe("token=<redacted>");
    expect(redact("Authorization: Bearer abc.def")).toContain("<redacted>");
    expect(redact("jwt eyJhbGciOi.eyJzdWIiOi.SflKxwRJ")).toBe("jwt <jwt>");
    expect(redact("key AKIAIOSFODNN7EXAMPLEabcdefgh1234")).toBe("key <redacted>");
  });

  it("keeps UUIDs, because a payment id is what makes a record actionable", async () => {
    const { redact } = await loadReport();
    const id = "0f8fad5b-d9cb-469f-a165-70867728950e";
    expect(redact(`activation failed for ${id}`)).toBe(`activation failed for ${id}`);
  });

  it("applies to the emitted record, not just in principle", async () => {
    const { reportIssue, LOG_PREFIX } = await loadReport();
    await reportIssue({ scope: "test", message: "could not mail ada@example.com", tags: { who: "ada@example.com" } });

    const [record] = loggedRecords(errorSpy, LOG_PREFIX);
    expect(record.message).toBe("could not mail <email>");
    expect((record.tags as Record<string, string>).who).toBe("<email>");
  });
});

describe("fingerprint", () => {
  it("groups the same failure across different ids and counts", async () => {
    const { fingerprint } = await loadReport();
    const a = fingerprint("billing", "Error", "activation failed for 0f8fad5b-d9cb-469f-a165-70867728950e after 3 tries");
    const b = fingerprint("billing", "Error", "activation failed for 7c9e6679-7425-40de-944b-e07fc1f90ae7 after 11 tries");
    expect(a).toBe(b);
  });

  it("separates different scopes and different failures", async () => {
    const { fingerprint } = await loadReport();
    expect(fingerprint("billing", "Error", "boom")).not.toBe(fingerprint("school", "Error", "boom"));
    expect(fingerprint("billing", "Error", "boom")).not.toBe(fingerprint("billing", "Error", "different"));
  });
});

describe("describeError", () => {
  it("narrows a thrown Error, including React's digest", async () => {
    const { describeError } = await loadReport();
    const err = Object.assign(new TypeError("nope"), { digest: "12345" });
    expect(describeError(err)).toMatchObject({ name: "TypeError", message: "nope", digest: "12345" });
  });

  it("narrows the values that are not Errors at all", async () => {
    const { describeError } = await loadReport();
    expect(describeError("just a string")).toMatchObject({ name: "NonError", message: "just a string" });
    expect(describeError({ code: 7 })).toMatchObject({ name: "NonError", message: '{"code":7}' });
  });

  it("reports a thrown value through reportError with its stack", async () => {
    const { reportError, LOG_PREFIX } = await loadReport();
    await reportError("billing.activation", new Error("write failed"), { tags: { paymentId: "p1" } });

    const [record] = loggedRecords(errorSpy, LOG_PREFIX);
    expect(record).toMatchObject({ scope: "billing.activation", name: "Error", message: "write failed" });
    expect(String(record.stack)).toContain("write failed");
    expect(record.tags).toEqual({ paymentId: "p1" });
  });
});

describe("flood control", () => {
  it("bounds the webhook but never the log, and reports what it held back", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    const fetchMock = vi.fn(async () => new Response("ok"));
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("ERROR_WEBHOOK_URL", "https://hooks.example/report");

    const { reportIssue, LOG_PREFIX } = await loadReport();
    for (let i = 0; i < 7; i++) await reportIssue({ scope: "hot", message: "same failure" });

    expect(loggedRecords(errorSpy, LOG_PREFIX)).toHaveLength(7);
    expect(fetchMock).toHaveBeenCalledTimes(5);

    // Next window: the first delivery carries the count it stands for.
    vi.setSystemTime(new Date("2026-01-01T00:01:01Z"));
    await reportIssue({ scope: "hot", message: "same failure" });
    expect(fetchMock).toHaveBeenCalledTimes(6);
    const last = JSON.parse(String((fetchMock.mock.calls.at(-1) as unknown as [string, RequestInit])[1].body));
    expect(last.suppressed).toBe(2);
  });

  it("throttles per failure shape, not globally", async () => {
    const fetchMock = vi.fn(async () => new Response("ok"));
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("ERROR_WEBHOOK_URL", "https://hooks.example/report");

    const { reportIssue } = await loadReport();
    for (let i = 0; i < 6; i++) await reportIssue({ scope: "hot", message: "same failure" });
    await reportIssue({ scope: "hot", message: "a different failure" });

    // 5 for the hot one, plus the unrelated one — which is not collateral damage.
    expect(fetchMock).toHaveBeenCalledTimes(6);
  });
});

describe("tags", () => {
  it("drops empty values instead of emitting nulls", async () => {
    const { reportIssue, LOG_PREFIX } = await loadReport();
    await reportIssue({ scope: "test", message: "x", tags: { a: null, b: undefined, c: 0, d: false } });

    const [record] = loggedRecords(errorSpy, LOG_PREFIX);
    expect(record.tags).toEqual({ c: 0, d: false });
  });
});

describe("the Next.js error hook", () => {
  async function loadHook() {
    vi.resetModules();
    const report = await import("@/lib/observability/report");
    const hook = await import("@/instrumentation");
    return { onRequestError: hook.onRequestError, LOG_PREFIX: report.LOG_PREFIX };
  }

  const context = {
    routerKind: "App Router" as const,
    routePath: "/s/[token]",
    routeType: "render" as const,
    renderSource: "server-rendering" as const,
    revalidateReason: undefined,
    renderType: "dynamic" as const,
  };

  it("reports the route pattern and leaks neither the token nor the query", async () => {
    const { onRequestError, LOG_PREFIX } = await loadHook();
    await onRequestError(new Error("render blew up"), { path: "/s/9tKqR2xLmN0p?code=abc", method: "GET", headers: {} }, context);

    const line = String(errorSpy.mock.calls.find((c) => c[0] === LOG_PREFIX)?.[1]);
    expect(JSON.parse(line)).toMatchObject({
      scope: "request",
      message: "render blew up",
      request: { method: "GET", route: "/s/[token]", type: "render" },
    });
    expect(line).not.toContain("9tKqR2xLmN0p");
    expect(line).not.toContain("code=abc");
  });

  it("falls back to the path, minus its query, when Next has no route pattern", async () => {
    const { onRequestError, LOG_PREFIX } = await loadHook();
    await onRequestError(new Error("proxy blew up"), { path: "/login?next=/chat", method: "GET", headers: {} }, {
      ...context,
      routePath: "",
      routeType: "proxy",
    });

    const line = String(errorSpy.mock.calls.find((c) => c[0] === LOG_PREFIX)?.[1]);
    expect(JSON.parse(line).request).toMatchObject({ route: "/login", type: "proxy" });
  });
});
