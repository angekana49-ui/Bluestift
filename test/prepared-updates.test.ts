import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";
import { decideFriendAction, canConnect, type FriendshipRow } from "@/lib/social/rules";
import { parseNotification } from "@/lib/social/notification-types";
import {
  mintConfirmToken,
  mintUnsubscribeToken,
  verifyConfirmToken,
  verifyUnsubscribeToken,
  CONFIRM_TTL_MS,
} from "@/lib/newsletter/tokens";
import { renderIssueEmail, renderConfirmEmail, safeHref, chunk } from "@/lib/newsletter/render";
import { slugify, validatePost } from "@/lib/content-authoring";

/**
 * Social v1 and Newsletter v1 are PREPARED, NOT WIRED (docs/prepared-updates.md).
 * This first block is what keeps them that way: delete the matching assertion
 * in the same commit that plugs a module in, so switching one on is a
 * deliberate, reviewable act and never a side effect of an unrelated import.
 */
describe("prepared updates stay unplugged", () => {
  const PREPARED = ["@/lib/social/", "@/lib/newsletter/", "@/lib/content-authoring"];

  function sources(dir: string): string[] {
    return readdirSync(dir).flatMap((name) => {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) return sources(p);
      return /\.(ts|tsx)$/.test(name) ? [p] : [];
    });
  }

  it("nothing in app/, components/ or the proxy imports them", () => {
    const files = [...sources("app"), ...sources("components"), "proxy.ts", "instrumentation.ts"];
    const offenders = files.filter((f) => {
      const src = readFileSync(f, "utf8");
      return PREPARED.some((m) => src.includes(`"${m}`));
    });
    expect(offenders).toEqual([]);
  });

  it("the draft migrations are outside the folder that gets applied", () => {
    expect(existsSync("supabase/drafts/social_v1.sql")).toBe(true);
    expect(existsSync("supabase/drafts/newsletter_v1.sql")).toBe(true);
    const applied = readdirSync("supabase/migrations").join("\n");
    expect(applied).not.toMatch(/social_v1|newsletter_v1/);
  });
});

// ── Social ────────────────────────────────────────────────────────────────

const A = "00000000-0000-4000-8000-00000000000a";
const B = "00000000-0000-4000-8000-00000000000b";
const pending = (from: string, to: string): FriendshipRow => ({ user_id: from, friend_id: to, status: "pending", blocked_by: null });

describe("friendship state machine", () => {
  it("a first request inserts a pending row and notifies the other side", () => {
    const d = decideFriendAction(A, B, "request", null);
    expect(d).toMatchObject({ ok: true, op: "insert", next: pending(A, B), notify: { userId: B, accepted: false } });
  });

  it("asking someone who already asked you accepts", () => {
    const d = decideFriendAction(B, A, "request", pending(A, B));
    expect(d).toMatchObject({ ok: true, op: "update", next: { status: "accepted" }, notify: { userId: A, accepted: true } });
  });

  it("only the asked side may accept or decline; only the asker may cancel", () => {
    expect(decideFriendAction(A, B, "accept", pending(A, B))).toEqual({ ok: false, reason: "not_yours" });
    expect(decideFriendAction(B, A, "accept", pending(A, B))).toMatchObject({ ok: true, next: { status: "accepted" } });
    expect(decideFriendAction(A, B, "decline", pending(A, B))).toEqual({ ok: false, reason: "not_yours" });
    expect(decideFriendAction(B, A, "decline", pending(A, B))).toEqual({ ok: true, op: "delete" });
    expect(decideFriendAction(B, A, "cancel", pending(A, B))).toEqual({ ok: false, reason: "not_yours" });
    expect(decideFriendAction(A, B, "cancel", pending(A, B))).toEqual({ ok: true, op: "delete" });
  });

  it("refuses self, duplicates and actions on the wrong state", () => {
    expect(decideFriendAction(A, A, "request", null)).toEqual({ ok: false, reason: "self" });
    expect(decideFriendAction(A, B, "request", pending(A, B))).toEqual({ ok: false, reason: "already_pending" });
    const friends = { ...pending(A, B), status: "accepted" as const };
    expect(decideFriendAction(B, A, "request", friends)).toEqual({ ok: false, reason: "already_friends" });
    expect(decideFriendAction(A, B, "remove", pending(A, B))).toEqual({ ok: false, reason: "not_friends" });
    expect(decideFriendAction(B, A, "remove", friends)).toEqual({ ok: true, op: "delete" });
  });

  it("a block hides itself and only the blocker can lift it", () => {
    const blocked = decideFriendAction(B, A, "block", pending(A, B));
    expect(blocked).toMatchObject({ ok: true, op: "update", next: { status: "blocked", blocked_by: B } });
    const row: FriendshipRow = { ...pending(A, B), status: "blocked", blocked_by: B };
    // The blocked person learns nothing more specific than "unavailable".
    expect(decideFriendAction(A, B, "request", row)).toEqual({ ok: false, reason: "unavailable" });
    expect(decideFriendAction(A, B, "unblock", row)).toEqual({ ok: false, reason: "not_blocked" });
    // Blocking back cannot take over the block.
    expect(decideFriendAction(A, B, "block", row)).toMatchObject({ ok: true, next: { blocked_by: B } });
    expect(decideFriendAction(B, A, "unblock", row)).toEqual({ ok: true, op: "delete" });
  });

  it("blocking a stranger creates the row", () => {
    expect(decideFriendAction(A, B, "block", null)).toMatchObject({ ok: true, op: "insert", next: { blocked_by: A, status: "blocked" } });
  });

  it("never acts on a row that belongs to another pair", () => {
    const other = pending(A, "00000000-0000-4000-8000-00000000000c");
    expect(decideFriendAction(A, B, "cancel", other)).toEqual({ ok: false, reason: "not_yours" });
  });
});

describe("who may connect (proposed policy)", () => {
  const now = new Date("2026-09-24T12:00:00Z");
  const adult = { birthYear: 1990, schoolId: null };
  const minor = (schoolId: string | null) => ({ birthYear: 2012, schoolId });

  it("adults with adults, never adults with minors", () => {
    expect(canConnect(adult, adult, now)).toEqual({ ok: true });
    expect(canConnect(adult, minor("s1"), now)).toEqual({ ok: false, reason: "adult_minor" });
  });

  it("minors only inside the same school", () => {
    expect(canConnect(minor("s1"), minor("s1"), now)).toEqual({ ok: true });
    expect(canConnect(minor("s1"), minor("s2"), now)).toEqual({ ok: false, reason: "minor_outside_school" });
    expect(canConnect(minor(null), minor(null), now)).toEqual({ ok: false, reason: "minor_outside_school" });
  });

  it("an undeclared birth year counts as a minor", () => {
    expect(canConnect(adult, { birthYear: null, schoolId: null }, now)).toEqual({ ok: false, reason: "adult_minor" });
  });
});

describe("notification payloads", () => {
  const row = (type: string, payload: unknown) => ({ id: "n1", type, payload, sender_id: null, is_read: false, created_at: "2026-09-24" });

  it("parses each known type", () => {
    expect(parseNotification(row("friend_request", { accepted: true }))).toMatchObject({ payload: { accepted: true } });
    expect(parseNotification(row("room_invite", { roomId: A }))).toMatchObject({ payload: { roomId: A } });
    expect(parseNotification(row("insight_ready", {}))).toMatchObject({ type: "insight_ready" });
  });

  it("drops unknown types and malformed payloads, and keeps no extra fields", () => {
    expect(parseNotification(row("gossip", {}))).toBeNull();
    expect(parseNotification(row("room_invite", { roomId: "not-a-uuid" }))).toBeNull();
    expect(parseNotification(row("friend_request", []))).toBeNull();
    const n = parseNotification(row("room_invite", { roomId: A, name: "Leaked name" }));
    expect(n?.payload).toEqual({ roomId: A });
  });
});

// ── Newsletter ────────────────────────────────────────────────────────────

describe("newsletter tokens", () => {
  const saved = process.env.NEWSLETTER_SECRET;
  beforeEach(() => {
    process.env.NEWSLETTER_SECRET = "x".repeat(40);
  });
  afterEach(() => {
    if (saved === undefined) delete process.env.NEWSLETTER_SECRET;
    else process.env.NEWSLETTER_SECRET = saved;
  });

  it("round-trips and rejects tampering", () => {
    expect(verifyUnsubscribeToken(mintUnsubscribeToken(A))).toBe(A);
    const t = mintUnsubscribeToken(A);
    expect(verifyUnsubscribeToken(t.replace(A, B))).toBeNull();
    expect(verifyUnsubscribeToken(`${t}x`)).toBeNull();
    expect(verifyUnsubscribeToken(`${t}.extra`)).toBeNull();
  });

  it("an unsubscribe token is not a confirmation, and vice versa", () => {
    expect(verifyConfirmToken(mintUnsubscribeToken(A))).toBeNull();
    expect(verifyUnsubscribeToken(mintConfirmToken(A))).toBeNull();
  });

  it("a confirmation expires", () => {
    const t = mintConfirmToken(A, 0);
    expect(verifyConfirmToken(t, CONFIRM_TTL_MS - 1000)).toBe(A);
    expect(verifyConfirmToken(t, CONFIRM_TTL_MS + 1000)).toBeNull();
  });

  it("fails closed without a (long enough) secret", () => {
    const t = mintUnsubscribeToken(A);
    process.env.NEWSLETTER_SECRET = "short";
    expect(verifyUnsubscribeToken(t)).toBeNull();
    expect(() => mintUnsubscribeToken(A)).toThrow();
    delete process.env.NEWSLETTER_SECRET;
    expect(verifyUnsubscribeToken(t)).toBeNull();
  });
});

describe("newsletter rendering", () => {
  const unsub = "https://thebluestift.com/api/content/unsubscribe?token=abc";

  it("escapes author text and drops non-http links", () => {
    const { html, text } = renderIssueEmail({
      title: "<b>T</b>",
      issueNumber: "3",
      bodyMd: "Hello <script>x</script>\n\n[bad](javascript:void0) and [good](https://example.com)",
      unsubscribeUrl: unsub,
    });
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<b>T</b>");
    expect(html).not.toContain('href="javascript:');
    expect(html).toContain('href="https://example.com"');
    expect(text).toContain("good (https://example.com)");
  });

  it("always carries the unsubscribe link, in both parts", () => {
    const { html, text } = renderIssueEmail({ title: "T", issueNumber: "1", bodyMd: "Hi", unsubscribeUrl: unsub });
    expect(html).toContain("Unsubscribe");
    expect(html).toContain("token=abc");
    expect(text).toContain(`Unsubscribe: ${unsub}`);
    expect(() => renderIssueEmail({ title: "T", issueNumber: "1", bodyMd: "Hi", unsubscribeUrl: "javascript:x" })).toThrow();
  });

  it("the confirmation mail has one link and says nothing is sent before it", () => {
    const { html, text } = renderConfirmEmail("https://thebluestift.com/research/newsletter/confirm?token=t");
    expect(html.match(/<a /g)?.length).toBe(1);
    expect(text).toContain("Nothing will be sent until you confirm");
  });

  it("safeHref and chunk", () => {
    expect(safeHref("mailto:a@b.c")).toBe("mailto:a@b.c");
    expect(safeHref("data:text/html,x")).toBeNull();
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(chunk([], 100)).toEqual([]);
  });
});

describe("post authoring", () => {
  it("slugify is ASCII, trimmed and bounded", () => {
    expect(slugify("L'Élève & la Machine — v2")).toBe("l-eleve-la-machine-v2");
    expect(slugify("  --  ")).toBe("");
    expect(slugify("a".repeat(200)).length).toBeLessThanOrEqual(80);
  });

  it("validatePost names each invalid field", () => {
    expect(validatePost({ title: "", content: "", type: "blog" })).toEqual({
      ok: false,
      errors: ["title", "slug", "content", "type"],
    });
    expect(validatePost({ title: "Hello", content: "Body", type: "update" })).toEqual({
      ok: true,
      value: { title: "Hello", slug: "hello", content: "Body", type: "update" },
    });
  });
});
