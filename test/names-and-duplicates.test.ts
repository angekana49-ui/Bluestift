import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { MIN_NAME_LENGTH, isNameTooShort, nameLength, normalizeName } from "@/lib/names";

/**
 * Duplicates and names (owner decisions, 2026-09-13).
 *
 * Schools: many share a name and a country (every state has its Lincoln High),
 * so the city is required, each school keeps its own id, and the admin's email
 * is the last word. The same admin can't create the same school twice.
 *
 * People: a username (shown as @handle) and a display name, each at least 3
 * characters of any kind; usernames unique regardless of case.
 */
const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");

describe("the names rule", () => {
  it("is a length of 3, and nothing about character types", () => {
    expect(MIN_NAME_LENGTH).toBe(3);
    for (const ok of ["Ada", "李明友", "O'N", "@lx", "n°3", "123", "É c"]) {
      expect(isNameTooShort(ok), ok).toBe(false);
    }
    for (const short of ["", "  ", "Al", " a ", "李明"]) {
      expect(isNameTooShort(short), JSON.stringify(short)).toBe(true);
    }
  });

  it("counts characters as a reader sees them, not UTF-16 units", () => {
    expect(nameLength("😀😀")).toBe(2);
    expect(nameLength("  Zoé  ")).toBe(3);
  });

  it("compares names without accents, case or extra spaces — but keeps punctuation", () => {
    expect(normalizeName("Lycée  Victor Hugo ")).toBe(normalizeName("lycee victor hugo"));
    expect(normalizeName("Saint-Louis")).not.toBe(normalizeName("Saint Louis"));
  });
});

describe("schools that share a name", () => {
  const create = read("app/api/school/create/route.ts");

  it("require a city, on creation and in settings", () => {
    expect(create).toContain('if (!city) return NextResponse.json({ error: "Enter the school\'s city.", code: "city" }');
    expect(read("app/api/school/settings/route.ts")).toContain("The school's city can't be empty.");
  });

  it("apply the names floor to the school name", () => {
    expect(create).toContain("isNameTooShort(name)");
    expect(read("app/api/school/settings/route.ts")).toContain("isNameTooShort(name)");
  });

  it("refuse the same admin creating the same school twice — and only that", () => {
    expect(create).toContain('code: "duplicate_school"');
    // Scoped to the caller's own schools: two admins may run same-named schools.
    expect(create).toMatch(/\.from\("school_admins"\)\s*\.select\("school_id"\)\s*\.eq\("user_id", user\.id\)\s*\.eq\("role", "admin_master"\)/);
    expect(create).toMatch(/normalizeName\(s\.name\) === normalizeName\(name\) && normalizeName\(s\.city\) === normalizeName\(city\)/);
  });

  it("are told apart by id, city and admin email in the operator search", () => {
    const search = read("app/api/ops/schools/route.ts");
    expect(search).toContain("isPlatformOwner(user.id)");
    expect(search).toContain("adminEmails");
    expect(search).toContain('literal(q)');
  });

  it("show their id to their admin", () => {
    expect(read("components/school-admin.tsx")).toContain("navigator.clipboard.writeText(school.id)");
  });
});

describe("people's names", () => {
  const onboarding = read("components/onboarding-form.tsx");
  const migration = read("supabase/migrations/20260913130000_user_names_rules.sql");

  it("mark the username as the @handle, and never store the @", () => {
    expect(onboarding).toContain('onChange={(e) => setUsername(e.target.value.replace(/^@+/, ""))}');
    expect(onboarding).toMatch(/color: "rgba\(11,18,32,0\.35\)",[\s\S]{0,200}>\s*@\s*<\/span>/);
  });

  it("hold the 3-character floor in the form and in the database", () => {
    expect(onboarding).toContain("!isNameTooShort(username) && !isNameTooShort(displayName)");
    expect(migration).toContain("check (username is null or char_length(btrim(username)) >= 3)");
    expect(migration).toContain("check (display_name is null or char_length(btrim(display_name)) >= 3)");
  });

  it("make usernames unique regardless of case", () => {
    expect(migration).toContain("on public.users (lower(username))");
  });

  it("never let a school-created account trip the database floor", () => {
    expect(read("app/api/school/profs/route.ts")).toContain(
      "user_metadata: isNameTooShort(firstname) ? {} : { display_name: firstname }",
    );
  });
});

describe("the sign-in form's alerts", () => {
  const login = read("components/login-view.tsx");

  it("render errors in red, announced, under the action that caused them", () => {
    expect(login).toContain('role={isError ? "alert" : "status"}');
    expect(login).toContain('background: isError ? "#fef2f2"');
    for (const at of ["credentials", "recovery", "anonymous"]) {
      expect(login).toContain(`{noticeAt("${at}")}`);
    }
  });

  it("offer the way out when the email already has an account", () => {
    expect(login).toContain('fail("credentials", tr("login.err.emailTaken"), "signIn")');
  });

  it("put the forgot-password errors in the same place", () => {
    expect(login).toContain('if (!email) return fail("credentials", tr("login.err.emailFirst"));');
  });
});

describe("the public site on small screens", () => {
  it("asks for the language in a centred dialog", () => {
    const prompt = read("components/site/LanguagePrompt.tsx");
    expect(prompt).toContain('role="dialog"');
    expect(prompt).toMatch(/inset: 0,[\s\S]{0,80}alignItems: "center",\s*justifyContent: "center"/);
    expect(read("app/globals.css")).toContain(".pub-lang-grid {");
  });

  it("stacks /pricing's comparison on a phone instead of pinning half the screen", () => {
    expect(read("components/site/pages/PricingView.tsx")).toContain('className="pub-compare-stack"');
    expect(read("app/globals.css")).toMatch(/@media \(max-width: 640px\) \{\s*\.pub-compare-table \{\s*display: none;/);
  });
});
