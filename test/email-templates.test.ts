import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { firstNameOf, sendAccountCreatedEmail, sendPilotStartedEmail, sendSchoolLinkedEmail } from "@/lib/email";

/**
 * The three published Resend templates (pilot-started, account-created,
 * school-linked) and the triggers that send them.
 *
 * The request body is captured rather than sent. What matters is its shape,
 * because each rule here was learned against the live API on 2026-09-13:
 * Resend substitutes {{variables}} into the HTML without escaping them, and a
 * template's own subject would take the same raw values.
 */
const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");

type Sent = {
  from: string;
  to: string[];
  reply_to: string;
  subject: string;
  html?: string;
  template: { id: string; variables: Record<string, string | number> };
};

let sent: Sent[] = [];

beforeEach(() => {
  sent = [];
  vi.stubEnv("RESEND_API_KEY", "re_test");
  vi.stubEnv("EMAIL_FROM", "The Bluestift Team <noreply@thebluestift.com>");
  vi.stubEnv("NEXT_PUBLIC_SCHOOLS_URL", "https://schools.thebluestift.com");
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, init: { body: string }) => {
      sent.push(JSON.parse(init.body) as Sent);
      return new Response("{}", { status: 200 });
    }),
  );
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("sending a published template", () => {
  it("escapes every string variable — Resend pastes them in raw", async () => {
    await sendSchoolLinkedEmail({ to: "ada@school.org", firstname: "Ada", schoolName: `<b>X</b> & "Co"`, role: "teacher" });
    expect(sent[0].template.variables.school_name).toBe("&lt;b&gt;X&lt;/b&gt; &amp; &quot;Co&quot;");
  });

  it("sends the subject itself, in plain text, so the inbox never shows entities", async () => {
    await sendSchoolLinkedEmail({ to: "ada@school.org", firstname: "Ada", schoolName: "Victor & Hugo", role: "teacher" });
    expect(sent[0].subject).toBe("You are now a member of Victor & Hugo");
  });

  it("keeps the project's From, and routes replies to a person", async () => {
    await sendAccountCreatedEmail({ to: "jo@school.org", firstname: "Jo", schoolName: "S", role: "teacher" });
    expect(sent[0].from).toBe("Bluestift Schools <noreply@thebluestift.com>");
    expect(sent[0].reply_to).toBe("hello@thebluestift.com");
    // A template payload may not carry html: the API rejects the pair.
    expect(sent[0].html).toBeUndefined();
  });

  it("fills each template with exactly the variables it uses", async () => {
    await sendPilotStartedEmail({ to: "a@s.org", adminFirstname: "Ann", schoolName: "S", pilotDays: 45, pilotUntil: "2026-10-27" });
    await sendAccountCreatedEmail({ to: "b@s.org", firstname: "Bo", schoolName: "S", role: "teacher" });
    await sendSchoolLinkedEmail({ to: "c@s.org", firstname: "Cy", schoolName: "S", role: "teacher" });

    expect(sent[0].template.id).toBe("da4aa2f6-1674-4d81-8dab-765fd7bf9605");
    expect(Object.keys(sent[0].template.variables).sort()).toEqual(
      ["admin_firstname", "dashboard_url", "pilot_duration_days", "pilot_end_date", "school_name"],
    );
    expect(sent[0].template.variables.pilot_duration_days).toBe(45);
    expect(sent[0].template.variables.pilot_end_date).toBe("27 October 2026");

    expect(sent[1].template.id).toBe("ba08106c-4966-43a4-8eb1-22bdd7206950");
    expect(Object.keys(sent[1].template.variables).sort()).toEqual(["email", "firstname", "login_url", "role", "school_name"]);
    expect(sent[1].template.variables.login_url).toBe("https://schools.thebluestift.com/login");

    expect(sent[2].template.id).toBe("c8f32e8d-f55d-468e-a6c1-dd03164aca5e");
    expect(Object.keys(sent[2].template.variables).sort()).toEqual(["dashboard_url", "firstname", "role", "school_name"]);
  });

  it("never mails the synthetic address of an email-less account", async () => {
    const r = await sendSchoolLinkedEmail({ to: "anon-1@anon.bluestift.local", firstname: "x", schoolName: "S", role: "teacher" });
    expect(r.skipped).toBe(true);
    expect(sent).toHaveLength(0);
  });
});

describe("firstNameOf", () => {
  it("takes the first word of a name, or makes one from the address", () => {
    expect(firstNameOf("Ada Lovelace")).toBe("Ada");
    expect(firstNameOf(null, "jean.dupont@school.org")).toBe("Jean");
    expect(firstNameOf("  ", "")).toBe("there");
  });
});

describe("the triggers", () => {
  it("1 — creating a school sends pilot-started", () => {
    expect(read("app/api/school/create/route.ts")).toContain("sendPilotStartedEmail(");
  });

  it("2 — a school creating a teacher's account sends account-created", () => {
    expect(read("app/api/school/profs/route.ts")).toContain("sendAccountCreatedEmail(");
  });

  it("3 — an existing account joining a team sends school-linked, and a renewal does not", () => {
    const joinTeam = read("app/api/school/join-team/route.ts");
    // Once: the new-membership branch, not the year renewal.
    expect(joinTeam.match(/notifyTeacherLinked\(/g)).toHaveLength(1);
    expect(joinTeam.indexOf("notifyTeacherLinked(")).toBeGreaterThan(joinTeam.indexOf('status: "renewed"'));
    const requests = read("app/api/school/requests/route.ts");
    expect(requests).toContain("if (linkedNow) await notifyTeacherLinked(");
  });
});

describe("the pilot reminder the pilot-started email promises", () => {
  const cron = read("app/api/cron/pilot-reminder/route.ts");

  it("is scheduled daily and guarded like the other crons", () => {
    expect(read("vercel.json")).toContain('"/api/cron/pilot-reminder"');
    expect(cron).toContain("authorizedCron(request)");
  });

  it("claims a school before emailing, so it is sent once", () => {
    expect(cron.indexOf(".update({ pilot_reminder_sent_at: nowIso })")).toBeLessThan(cron.indexOf("sendBrandedEmail("));
    expect(cron).toContain('.is("pilot_reminder_sent_at", null)');
  });

  it("looks at a window of days, not one exact date", () => {
    expect(cron).toMatch(/\.gte\("pilot_until", today\)\s*\.lte\("pilot_until"/);
  });
});
