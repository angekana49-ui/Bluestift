import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * The tab that ASKED for the email link must not be left behind.
 *
 * The bug, in the shape it took: you typed your address on /login, went to your
 * mail app, opened the link — which the mail client opened in a NEW window —
 * and came back to the original one still showing a grey line of text saying
 * "check your inbox". The app was now open twice, in two different states, and
 * the window you were looking at was the stale one.
 *
 * Two halves, both asserted here because both are easy to undo by accident:
 *   1. the message is a dialog, not a footnote under the last button;
 *   2. the dialog WATCHES, by polling the session, and moves the page when the
 *      sign-in lands.
 *
 * Source-reading, like the other invariants of this kind: what is being
 * protected is a shape (a component rendered, a mechanism chosen), and both
 * would otherwise only fail on a real inbox in a second browser window.
 */
const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

/** Every surface that can send a sign-in / confirmation link. */
const SENDERS = [
  "components/login-view.tsx",
  "components/auth-panel.tsx",
  "components/onboarding-form.tsx",
] as const;

describe("the link-sent notice", () => {
  it("is a dialog on every surface that sends a link", () => {
    for (const p of SENDERS) expect(read(p), p).toContain("<LinkSentDialog");
  });

  it("no surface still drops the notice into the shared message line", () => {
    // `msg` is one slot shared by every error on these forms. Routing "we sent
    // you a link" through it is what made it a footnote in the first place —
    // and it rendered below the fold on a phone, at the exact moment the person
    // had already looked away.
    for (const p of SENDERS) {
      expect(read(p), p).not.toMatch(/setMsg\([^)]*auth\.msg\.linkSent/);
    }
  });
});

describe("the watch that brings the original window along", () => {
  const dialog = read("components/ui/link-sent-dialog.tsx");

  it("polls the session rather than listening for an event", () => {
    // The session lives in COOKIES (lib/supabase/client.ts). A cookie write
    // fires no event, so `storage` — the reflex for cross-tab state — would
    // never hear the sign-in that another window just completed.
    expect(dialog).toContain("supabase.auth.getSession()");
    expect(dialog).not.toContain('addEventListener("storage"');
  });

  it("re-checks the moment the tab is looked at again", () => {
    expect(dialog).toContain('document.addEventListener("visibilitychange"');
    expect(dialog).toContain('window.addEventListener("focus"');
  });

  it("compares an identity, not the mere presence of a session", () => {
    // /account is already signed in when it sends its link: an anonymous
    // account linking an email keeps its user id and only gains an address.
    // "is there a session" is true before and after, so it detects nothing.
    expect(dialog).toMatch(/user\.id.*user\.email.*is_anonymous/s);
  });

  it("hands over exactly once", () => {
    // The timer fires it, and so does dismissing the dialog once confirmed.
    expect(dialog).toContain("handedOver.current");
  });
});

describe("/auth/continue", () => {
  const route = read("app/auth/continue/route.ts");

  it("sends the waiting tab to the same place the link's own tab went", () => {
    expect(route).toContain("resolvePostAuth");
  });

  it("takes no caller-supplied destination", () => {
    // The two callbacks need safeNext because `next` is attacker-supplied
    // (test/auth-redirect-safety.test.ts). This route computes its destination
    // from the session alone, so there is nothing to validate — and that must
    // stay true rather than quietly growing a `next` without the guard.
    expect(route).not.toContain('searchParams.get("next")');
  });

  it("falls back to the door when the session turns out to be gone", () => {
    expect(route).toContain("/login");
  });
});

/**
 * Passwords, added alongside: the flows exist and land somewhere real.
 */
describe("password sign-in", () => {
  const login = read("components/login-view.tsx");

  it("offers all four ways in", () => {
    expect(login).toContain("signInWithPassword");
    expect(login).toContain("supabase.auth.signUp");
    expect(login).toContain("signInWithOtp"); // the magic link, still there
    expect(login).toContain("/api/auth/recover"); // the recovery key
    expect(login).toContain("/api/auth/anon"); // anonymous
  });

  it("sends a reset link to /reset, not into the app", () => {
    // Following the sign-in destination here would land the person home with
    // the password half-chosen in whichever window opened the link.
    expect(login).toContain("resetPasswordForEmail");
    expect(login).toContain("next=/reset");
  });

  it("has a page at the far end of that link, and it demands a session", () => {
    const page = read("app/reset/page.tsx");
    expect(page).toContain("getUser()");
    expect(page).toContain('redirect("/login?error=auth")');
  });

  it("carries a captcha on every credential path, like the rest of the form", () => {
    for (const call of ["signInWithPassword", "signUp", "resetPasswordForEmail"]) {
      const at = login.indexOf(call);
      expect(at, call).toBeGreaterThan(-1);
      // The token appears inside the same call's options object.
      expect(login.slice(at, at + 400), call).toContain("captchaToken");
    }
  });
});
