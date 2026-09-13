import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { accountStatusOf, SYNTHETIC_EMAIL_DOMAIN } from "@/lib/auth";
import { en } from "@/lib/i18n/en";
import { fr } from "@/lib/i18n/fr";
import { de } from "@/lib/i18n/de";
import { es } from "@/lib/i18n/es";

/**
 * What an account is — anonymous, email not confirmed, verified — follows
 * auth.users, and says so in the reader's language (2026-09-13).
 *
 * public.users.account_type used to be written once, at signup, and never
 * again: a password signup read 'verified' before confirming anything, and an
 * account that confirmed an address later kept 'anonymous'. Settings printed
 * that raw column, in English, in a code font.
 */
const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");
const MIGRATION = "supabase/migrations/20260913140000_account_status_sync.sql";

describe("accountStatusOf", () => {
  const now = "2026-09-13T12:00:00Z";

  it("never counts the synthetic recovery address, confirmed or not", () => {
    expect(accountStatusOf({ email: `anon-1@${SYNTHETIC_EMAIL_DOMAIN}`, email_confirmed_at: now })).toBe("anonymous");
    expect(accountStatusOf({ email: null, email_confirmed_at: null })).toBe("anonymous");
  });

  it("calls a real address verified only once it is confirmed", () => {
    expect(accountStatusOf({ email: "ada@school.org", email_confirmed_at: null })).toBe("unverified");
    expect(accountStatusOf({ email: "ada@school.org", email_confirmed_at: now })).toBe("verified");
  });
});

describe("the database keeps the status in line with auth.users", () => {
  const sql = read(MIGRATION);

  it("syncs on every change of address or confirmation, after the profile row exists", () => {
    expect(sql).toContain("after insert or update of email, email_confirmed_at on auth.users");
    // Triggers fire in name order: the sync must come after on_auth_user_created.
    expect("on_auth_user_status_sync" > "on_auth_user_created").toBe(true);
    expect(sql).toContain("create trigger on_auth_user_status_sync");
  });

  it("uses the same synthetic domain as the app", () => {
    expect(sql).toContain(`not like '%@${SYNTHETIC_EMAIL_DOMAIN}'`);
  });

  it("can never break a sign-up or a sign-in", () => {
    expect(sql).toMatch(/perform public\.sync_account_status\(new\.id\);\s*exception when others then\s*raise warning/);
  });

  it("does not let a browser declare itself verified", () => {
    expect(sql).toContain("before update of account_state on public.users");
    expect(sql).toContain("coalesce(auth.role(), '') in ('anon', 'authenticated')");
    expect(sql).toContain("old.account_state = 'onboarding_pending'");
  });

  it("keeps the sync out of clients' reach, and the username check in it", () => {
    expect(sql).toContain("revoke all on function public.sync_account_status(uuid) from public, anon, authenticated;");
    expect(sql).toContain("grant execute on function public.username_available(text) to authenticated;");
    expect(sql).toContain("select public.sync_account_status(id) from auth.users;");
  });

  it("is also run by the email callbacks, which fall back to the same rule", () => {
    for (const route of ["app/auth/callback/route.ts", "app/auth/confirm/route.ts"]) {
      const src = read(route);
      expect(src, route).toContain("await syncAccountStatus(user)");
      expect(src, route).not.toContain("markEmailVerified");
    }
    expect(read("lib/auth.ts")).toContain('admin.rpc("sync_account_status", { p_user_id: user.id })');
  });
});

describe("Settings shows the status in words", () => {
  const panel = read("components/auth-panel.tsx");

  it("no longer prints the raw account_type column", () => {
    expect(panel).not.toContain("profile?.account_type");
    expect(panel).toContain('<AccountStatusBadge status={user.status} />');
  });

  it("gets the status from auth.users on both settings screens", () => {
    expect(read("app/account/page.tsx")).toContain("status: accountStatusOf(user)");
    expect(read("app/school/page.tsx")).toContain("status: accountStatusOf(user)");
  });

  it("has every status string in all four languages", () => {
    const keys = [
      "auth.account.statusLabel",
      "auth.account.status.anonymous",
      "auth.account.status.anonymousHint",
      "auth.account.status.unverified",
      "auth.account.status.unverifiedHint",
      "auth.account.status.verified",
      "auth.account.status.verifiedHint",
      "onb.err.usernameShort",
      "onb.err.displayShort",
      "onb.err.usernameTakenHint",
    ] as const;
    for (const [name, cat] of Object.entries({ en, fr, de, es })) {
      for (const k of keys) expect((cat as Record<string, string>)[k], `${name} ${k}`).toBeTruthy();
    }
    expect((en as Record<string, string>)["auth.account.typeLabel"]).toBeUndefined();
  });
});

describe("a taken username is hard to miss", () => {
  const form = read("components/onboarding-form.tsx");

  it("is checked when the name step is left, not three screens later", () => {
    expect(form).toContain('supabase.rpc("username_available", { p_username: username.trim() })');
    expect(form).toMatch(/if \(stepKey === "name"\) \{[\s\S]*?await usernameFree\(\)/);
  });

  it("opens a red alert under the field it concerns, and focuses that field", () => {
    expect(form).toContain('{nameNotice?.field === "username" && <NameAlert notice={nameNotice} />}');
    expect(form).toContain('<FormAlert id="onb-name-alert" text={notice.text} hint={notice.hint} />');
    const alert = read("components/ui/form-alert.tsx");
    expect(alert).toContain('role="alert"');
    expect(alert).toContain('border: "1.5px solid #f87171"');
    expect(form).toContain('nameNotice.field === "username" ? "onb-username" : "onb-display"');
  });

  it("still lands there if the name is taken at the save", () => {
    expect(form).toContain('if (updErr.code === "23505") return flagName(takenNotice());');
  });
});
