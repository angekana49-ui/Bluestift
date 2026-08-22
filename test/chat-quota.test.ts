import { describe, it, expect } from "vitest";
import { quotaFromHeaders } from "@/components/chat/types";

/**
 * The chat composer's day counter comes off the send response's headers. The
 * whole risk lives in the absent case: the server omits these headers whenever
 * the plan is unlimited or enforcement is off, which is most of the time, and
 * `Number(null)` is a perfectly finite 0.
 */
describe("quotaFromHeaders", () => {
  const h = (init: Record<string, string>) => new Headers(init);

  it("reads the counter the server sent", () => {
    expect(
      quotaFromHeaders(h({ "x-raya-messages-used": "7", "x-raya-messages-limit": "30" })),
    ).toEqual({ used: 7, limit: 30 });
  });

  it("returns null when the headers are absent, rather than 0 of 0", () => {
    // The regression this exists for: 0/0 renders as "0 messages left today"
    // and locks the composer of a user who has no limit at all.
    expect(quotaFromHeaders(h({}))).toBeNull();
  });

  it("returns null when only one of the pair arrives", () => {
    expect(quotaFromHeaders(h({ "x-raya-messages-used": "7" }))).toBeNull();
    expect(quotaFromHeaders(h({ "x-raya-messages-limit": "30" }))).toBeNull();
  });

  it("rejects values that are not usable numbers", () => {
    expect(quotaFromHeaders(h({ "x-raya-messages-used": "x", "x-raya-messages-limit": "30" }))).toBeNull();
    expect(quotaFromHeaders(h({ "x-raya-messages-used": "7", "x-raya-messages-limit": "0" }))).toBeNull();
    expect(quotaFromHeaders(h({ "x-raya-messages-used": "-1", "x-raya-messages-limit": "30" }))).toBeNull();
  });

  it("passes through a count at or over the limit — that is the blocked state", () => {
    expect(
      quotaFromHeaders(h({ "x-raya-messages-used": "30", "x-raya-messages-limit": "30" })),
    ).toEqual({ used: 30, limit: 30 });
    expect(
      quotaFromHeaders(h({ "x-raya-messages-used": "34", "x-raya-messages-limit": "30" })),
    ).toEqual({ used: 34, limit: 30 });
  });
});
