import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  UPGRADE_TOKEN_PATTERN,
  UPGRADE_TTL_HOURS,
  isPlausibleEmail,
  normalizeEmail,
} from "@/lib/account-upgrade-shared";
import { hashUpgradeToken } from "@/lib/account-upgrade";
import { en } from "@/lib/i18n/en";
import { fr } from "@/lib/i18n/fr";
import { de } from "@/lib/i18n/de";
import { es } from "@/lib/i18n/es";

/**
 * Anonymous → verified, without losing anything (owner decision, 2026-09-13).
 *
 * Teenagers start anonymous and come back with a recovery key; paying needs an
 * email, so the SAME account gains an address and a password. The obvious call,
 * supabase.auth.updateUser({ email }), can never finish on these accounts: they
 * carry a confirmed synthetic address, and Secure email change asks that
 * address — which receives nothing — to confirm too (probed on the live
 * project). These tests pin the flow that replaced it, and the recovery key's
 * survival through it.
 */
const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");
/** Comments stripped, so an explanation naming a call is not counted as the call. */
const code = (p: string) =>
  read(p)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "")
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "");

describe("the shapes both sides share", () => {
  it("normalises and sanity-checks an address before spending an email on it", () => {
    expect(normalizeEmail("  Ada@School.ORG ")).toBe("ada@school.org");
    for (const ok of ["ada@school.org", "a.b+c@mail.co.uk"]) expect(isPlausibleEmail(ok), ok).toBe(true);
    for (const bad of ["", "ada", "ada@school", "ada @school.org", "@school.org", "ada@.org"]) {
      expect(isPlausibleEmail(bad), bad).toBe(false);
    }
  });

  it("keeps only a SHA-256 of a 256-bit link token", () => {
    expect(UPGRADE_TOKEN_PATTERN.test("A".repeat(43))).toBe(true);
    expect(UPGRADE_TOKEN_PATTERN.test("A".repeat(42))).toBe(false);
    expect(hashUpgradeToken("A".repeat(43))).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("the request", () => {
  const lib = code("lib/account-upgrade.ts");

  it("refuses an account that already has a real email", () => {
    expect(lib).toContain('if (hasRealEmail(user.email)) return { ok: false, status: 409, code: "already_verified" };');
  });

  it("checks the address is nobody else's before anything is changed", () => {
    expect(lib.indexOf('"auth_email_taken"')).toBeLessThan(lib.indexOf("updateUserById(user.id, { password"));
  });

  it("sets the password admin-side and puts back the session that revokes", () => {
    const at = lib.indexOf("updateUserById(user.id, { password: opts.password })");
    expect(at).toBeGreaterThan(-1);
    expect(lib.indexOf("mintSessionFor(supabase, synthetic)")).toBeGreaterThan(at);
  });

  it("stores the token's hash, never the token, and deletes a link nobody received", () => {
    expect(lib).toContain("token_hash: hashUpgradeToken(token)");
    expect(lib).toContain("`${origin}/upgrade/confirm?token=${token}`");
    expect(lib).toMatch(/if \(!sent\.ok\) \{\s*await admin\.from\("account_upgrades"\)\.delete\(\)/);
  });

  it("is rate-limited per account, failing closed", () => {
    expect(lib).toContain('checkStrictUserRateLimit("account_upgrade", user.id, 5, "24 hours")');
  });
});

describe("the confirmation", () => {
  const lib = code("lib/account-upgrade.ts");

  it("swaps the address admin-side, confirmed, after re-checking it is free", () => {
    const swap = lib.indexOf("email: row.email,\n    email_confirm: true,");
    expect(swap).toBeGreaterThan(-1);
    expect(lib.lastIndexOf('"auth_email_taken"')).toBeLessThan(swap);
  });

  it("signs in the device that opened the link", () => {
    expect(lib).toContain("mintSessionFor(opts.supabase, row.email)");
  });

  it("is a POST behind a button — opening the link changes nothing", () => {
    const page = code("app/upgrade/confirm/page.tsx");
    expect(page).toContain("peekAccountUpgrade(token)");
    expect(page).not.toContain("confirmAccountUpgrade");
    const route = code("app/api/account/upgrade/confirm/route.ts");
    expect(route).toContain("export async function POST");
    expect(route).not.toContain("export async function GET");
  });
});

describe("the recovery key survives every stage", () => {
  it("is never touched by the upgrade", () => {
    const lib = code("lib/account-upgrade.ts");
    expect(lib).not.toMatch(/recovery_code|issueRecoveryKey|rotateSyntheticPassword/);
  });

  it("signs in directly, whatever address the account has", () => {
    const recover = code("app/api/auth/recover/route.ts");
    expect(recover).not.toContain("signInWithOtp");
    expect(recover).not.toContain("hasRealEmail");
    expect(recover).toContain('return NextResponse.json({ status: "recovered" });');
  });
});

describe("the surfaces that offer it", () => {
  it("no longer try supabase.auth.updateUser with an email", () => {
    for (const p of ["components/onboarding-form.tsx", "components/auth-panel.tsx"]) {
      const src = code(p);
      expect(src, p).not.toMatch(/updateUser\(\s*\{\s*email/);
      expect(src, p).not.toMatch(/updateUser\([^)]*\{ email/);
      expect(src, p).toContain("useAccountUpgrade()");
      expect(src, p).toContain("checkConfirmed=");
    }
  });

  it("wait on the server, because the swap may happen on another device", () => {
    const dialog = read("components/ui/link-sent-dialog.tsx");
    expect(dialog).toContain("checkConfirmed?: () => Promise<boolean>");
    expect(dialog).toContain('if (document.visibilityState === "hidden")');
    expect(read("components/account-upgrade/use-account-upgrade.ts")).toContain('netFetch("/api/account/upgrade", { cache: "no-store" }');
  });

  it("show refusals as red alerts", () => {
    expect(read("components/onboarding-form.tsx")).toContain("{notice && <FormAlert text={notice.text} hint={notice.hint} />}");
    expect(read("components/auth-panel.tsx")).toContain("{upgrade.notice && <FormAlert");
  });
});

describe("the database side", () => {
  const sql = read("supabase/migrations/20260913150000_account_upgrades.sql");

  it("keeps pending upgrades out of every client's reach", () => {
    expect(sql).toContain("alter table public.account_upgrades enable row level security;");
    expect(sql).toContain("revoke all on table public.account_upgrades from anon, authenticated;");
    expect(sql).toContain("token_hash text not null unique");
    expect(sql).toContain("references auth.users (id) on delete cascade");
  });

  it("answers 'is this address taken' to the server only", () => {
    expect(sql).toContain("revoke all on function public.auth_email_taken(text, uuid) from public, anon, authenticated;");
    expect(sql).toContain("grant execute on function public.auth_email_taken(text, uuid) to service_role;");
  });
});

describe("the words", () => {
  const keys = (Object.keys(en) as string[]).filter((k) => k.startsWith("upgrade.") || k.startsWith("email.upgrade."));

  it("exist in all four languages", () => {
    expect(keys.length).toBeGreaterThan(30);
    for (const [name, cat] of Object.entries({ fr, de, es })) {
      for (const k of keys) expect((cat as Record<string, string>)[k], `${name} ${k}`).toBeTruthy();
    }
  });

  it("promise the link lifetime the code enforces", () => {
    for (const cat of [en, fr, de, es]) {
      expect((cat as Record<string, string>)["email.upgrade.line2"]).toContain(String(UPGRADE_TTL_HOURS));
    }
  });
});
