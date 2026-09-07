import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * No env file ships with this repository. Not one, template included.
 *
 * An earlier version of this test asked something else: that `.env.example`
 * hold no live secrets, on the reasoning that a file named "example" is one
 * people copy, paste into an issue and screenshot while onboarding. The owner
 * settled it the other way, and more simply — nothing named `.env*` will ever
 * be visible, so what it contains is nobody's business but theirs, and the
 * setup instructions belong in the README where everyone can actually read
 * them.
 *
 * That is the stronger rule, so this is what gets checked. `.gitignore` covers
 * the whole family, and no env file is tracked — the second assertion is the
 * one that matters, because it is the only thing that catches a `git add -f` or
 * a relaxed ignore rule six months from now.
 */
describe("no env file is ever committed", () => {
  it("is the rule .gitignore states", () => {
    const ignore = readFileSync(join(process.cwd(), ".gitignore"), "utf8");
    const lines = ignore.split(/\r?\n/).map((l) => l.trim());
    expect(lines).toContain(".env");
    // The wildcard is what covers `.env.example` and `.env.production` too.
    expect(lines.some((l) => l === ".env.*" || l === ".env*")).toBe(true);
  });

  it("is the rule git is actually enforcing", () => {
    let tracked: string[];
    try {
      tracked = execFileSync("git", ["ls-files"], { encoding: "utf8" })
        .split(/\r?\n/)
        .filter((p) => /(^|\/)\.env($|\.)/.test(p));
    } catch {
      return; // Not a git checkout — a tarball, or CI without history.
    }
    expect(
      tracked,
      `these env files are tracked by git: ${tracked.join(", ")}. An ignore rule ` +
        `does not apply to a file that is already tracked, so removing it needs ` +
        `\`git rm --cached\` and a look at whether the values ever reached a remote.`,
    ).toEqual([]);
  });
});
