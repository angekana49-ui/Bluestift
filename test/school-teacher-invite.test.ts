import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Joining an organisation takes two people.
 *
 * `POST /api/school/profs` used to write a `school_admins` row outright, so a
 * school admin could attach any account to their school without asking. Anyone
 * can create a school in one signup, so that was not a privilege held by a
 * small set of people: a stranger could make you staff somewhere you had never
 * heard of, and list your name and address to themselves while doing it.
 *
 * The membership is now created only by the invited person, redeeming a code at
 * /api/school/join-team — the path that already exists and already requires
 * them to act. These tests hold both halves: that this route stops writing
 * membership, and that the route which does write it still asks for a code.
 */
const profs = readFileSync(join(process.cwd(), "app/api/school/profs/route.ts"), "utf8");
const post = profs.slice(profs.indexOf("export async function POST"), profs.indexOf("export async function DELETE"));
const del = profs.slice(profs.indexOf("export async function DELETE"));

describe("inviting a teacher", () => {
  it("never writes a membership", () => {
    expect(post).not.toMatch(/from\("school_admins"\)[\s\S]{0,120}\.insert\(/);
  });

  it("still reads school_admins — to refuse someone already in the school", () => {
    expect(post).toContain('.from("school_admins")');
    expect(post).toContain("already in your school");
  });

  it("mints a code for this invitation and emails it", () => {
    expect(post).toContain('from("staff_invite_codes")');
    expect(post).toContain("makeStaffCode()");
    expect(post).toContain("sendBrandedEmail");
  });

  it("hands the code back so an unconfigured mailer cannot swallow the invitation", () => {
    // RESEND_API_KEY is optional in this deployment; a silent no-op would leave
    // the admin believing they had invited someone.
    expect(post).toContain("emailed:");
    expect(post).toContain("codeId");
  });

  it("keeps the email-only lookup and its rate limit", () => {
    expect(post).toContain('identifier.includes("@")');
    expect(post).not.toContain('.eq("username", identifier)');
    expect(post).toContain("checkStrictUserRateLimit");
  });

  it("is admin_master only", () => {
    expect(post).toContain('membership.role !== "admin_master"');
  });
});

describe("removing a teacher", () => {
  it("is still a direct action — leaving is not something to negotiate", () => {
    expect(del).toContain('.from("school_admins")');
    expect(del).toContain("admin_master");
  });
});

describe("the path that does create a membership still requires the person to act", () => {
  const joinTeam = readFileSync(
    join(process.cwd(), "app/api/school/join-team/route.ts"),
    "utf8",
  );

  it("resolves an active code the caller supplied", () => {
    expect(joinTeam).toContain('from("staff_invite_codes")');
    expect(joinTeam).toContain('.eq("code", code)');
    expect(joinTeam).toContain('.eq("is_active", true)');
  });

  it("takes the identity from the session, never from the body", () => {
    expect(joinTeam).toContain("auth.getUser()");
    expect(joinTeam).toContain("user_id: user.id");
  });

  it("still demands a verified email and rate-limits redemption", () => {
    expect(joinTeam).toContain("hasRealEmail(user.email)");
    expect(joinTeam).toContain("checkStrictRateLimit");
  });
});
