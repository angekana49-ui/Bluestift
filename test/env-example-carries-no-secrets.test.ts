import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * `.env.example` is the one env file whose NAME says "safe to share".
 *
 * In this repository it is also gitignored — `.gitignore` ignores `.env.*`
 * wholesale, "so no keys can slip in" — which means the template nobody can
 * commit is the template people copy, paste into an issue, screenshot during
 * onboarding, or hand to a contributor. Its name and its contents must not
 * disagree.
 *
 * Checked on 2026-09-07: the real values in it have never entered git. Both
 * commits that once tracked the file carried empty fields and placeholders, and
 * a search of every commit for each live value found nothing. Nothing leaked,
 * and nothing needs rotating. What existed was a trap rather than a breach —
 * one `git add -f`, or one person relaxing an ignore rule because "it's only
 * the example file", and three live secrets become public in a repository meant
 * to be read by strangers.
 *
 * So the rule is machine-checked instead of remembered. Any key that names
 * itself a secret must be empty or an obvious placeholder. `NEXT_PUBLIC_*` is
 * exempt by definition: those reach the browser on every page load, and the
 * anon key is protected by RLS rather than by being unknown.
 */
const FILE = ".env.example";
const SECRET_NAME = /SECRET|KEY|TOKEN|PASSWORD/;
const PLACEHOLDER = /^(your[-_]|changeme|xxx|<|\.\.\.|sk_test_x)/i;

describe(".env.example carries no live secrets", () => {
  const path = join(process.cwd(), FILE);

  it("is either absent or free of filled-in secrets", () => {
    // Absent on a fresh clone and in CI — it is gitignored, so there is nothing
    // to check there and nothing to fail.
    if (!existsSync(path)) return;

    const filled: string[] = [];
    for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const eq = t.indexOf("=");
      if (eq < 1) continue;
      const name = t.slice(0, eq).replace(/^export\s+/, "").trim();
      const value = t.slice(eq + 1).trim();
      if (name.startsWith("NEXT_PUBLIC_")) continue;
      if (!SECRET_NAME.test(name)) continue;
      if (!value || PLACEHOLDER.test(value)) continue;
      filled.push(name);
    }

    expect(
      filled,
      `${FILE} holds real values for: ${filled.join(", ")}. Blank them (keep the ` +
        `comments) — this file is named to be shared, and only a .gitignore rule ` +
        `is standing between those secrets and a public repository.`,
    ).toEqual([]);
  });
});
