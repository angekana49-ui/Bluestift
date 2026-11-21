import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { isPrepareRequestLang, parsePrepareRequest } from "@/lib/prepare-request";
import { parseMarkdown } from "@/lib/markdown";

/**
 * A staff conversation asking the rest of the app for something: Raya for
 * Schools writes a ```prepare block, the chat shows a card, and only the
 * teacher's press creates the resource in Prepare. The staff-side mirror of
 * test/tool-request.test.ts — pinned here: the syntax the prompt teaches and
 * the card reads, that nothing is created without the press, and that the
 * result opens in the Prepare library's own document view.
 */

const read = (rel: string) => readFileSync(join(process.cwd(), rel), "utf8").split("\r\n").join("\n");

describe("reading the block", () => {
  it("reads the kind, the source, the topic and the count", () => {
    expect(parsePrepareRequest("kind: quiz\nfrom: topic\ntopic: Les fractions, 5e\ncount: 10")).toEqual({
      kind: "quiz",
      from: "topic",
      topic: "Les fractions, 5e",
      count: 10,
    });
  });

  it("accepts the kind's name in the teacher's language", () => {
    expect(parsePrepareRequest("kind: examen\ntopic: x y")?.kind).toBe("exam");
    expect(parsePrepareRequest("kind: devoir\ntopic: x y")?.kind).toBe("exercise");
    expect(parsePrepareRequest("kind: fiche de cours\ntopic: x y")?.kind).toBe("worksheet");
    expect(parsePrepareRequest("kind: qcm\ntopic: x y")?.kind).toBe("quiz");
    expect(parsePrepareRequest("kind: Arbeitsblatt\ntopic: x y")?.kind).toBe("worksheet");
  });

  it("builds from the topic and the class gaps unless told the thread holds the material", () => {
    expect(parsePrepareRequest("kind: quiz\ntopic: Pythagore")?.from).toBe("topic");
    expect(parsePrepareRequest("kind: quiz\nfrom: conversation\ntopic: Pythagore")?.from).toBe("conversation");
  });

  it("defaults the count to the tab's own 8 and clamps it to 1-20", () => {
    expect(parsePrepareRequest("kind: quiz\ntopic: x y")?.count).toBe(8);
    expect(parsePrepareRequest("kind: quiz\ntopic: x y\ncount: 99")?.count).toBe(20);
    expect(parsePrepareRequest("kind: quiz\ntopic: x y\ncount: abc")?.count).toBe(8);
  });

  it("refuses a block without a known kind or a topic, rather than guessing", () => {
    expect(parsePrepareRequest("kind: poem\ntopic: x y")).toBeNull();
    expect(parsePrepareRequest("kind: quiz")).toBeNull();
  });

  it("is a fenced block the reply parser hands over by its language", () => {
    const blocks = parseMarkdown("Voilà :\n```prepare\nkind: quiz\ntopic: Les fractions\n```");
    const code = blocks.find((b) => b.t === "code") as { lang: string | null } | undefined;
    expect(code && isPrepareRequestLang(code.lang)).toBe(true);
  });
});

describe("the card", () => {
  const card = read("components/chat/prepare-request-card.tsx");

  it("creates nothing until the teacher presses the button", () => {
    // The only call to the Prepare route is inside create(), bound to the button.
    expect(card.match(/\/api\/school\/prepare/g)).toHaveLength(1);
    expect(card).toContain('<button type="button" onClick={create}');
    expect(card).not.toMatch(/useEffect\([^)]*create\(/);
  });

  it("builds from the staff thread when told to, from the topic and gaps otherwise", () => {
    expect(card).toContain('const fromConversation = req.from === "conversation" && conversationId != null;');
    expect(card).toContain("...(fromConversation ? { conversationId } : {})");
    const surface = read("components/chat/chat-surface.tsx");
    // A room's channel is the room's: never sent as a conversation source.
    expect(surface).toContain("conversationId: config.extraBody?.roomId ? null : (conversationId ?? null),");
  });

  it("opens the result in the Prepare library's own document view — the exact rendering", () => {
    expect(card).toContain("<DocumentView {...prepareDoc(");
    expect(read("components/school/prof-prepare.tsx")).toContain("<DocumentView");
  });

  it("remembers what it created, so a revisit does not spend a second generation", () => {
    expect(card).toContain("window.localStorage.setItem(key, created.id);");
    expect(card).toContain('{ kind: "remembered", id }');
  });

  it("only shows in the teacher's Raya tab, which owns the Prepare library", () => {
    expect(card).toContain("if (!env?.enabled) return null;");
    expect(read("components/school/school-raya-chat.tsx")).toContain("prepareRequests: opts.prepare,");
    expect(read("components/chat.tsx")).not.toContain("prepareRequests");
    expect(read("components/room-view.tsx")).not.toContain("prepareRequests");
  });

  it("lets the teacher ground on one of the school's reports, by title — never an id", () => {
    expect(card).toContain('"/api/school/reports"');
    expect(card).toContain('tr("chat.prepare.reportLabel")');
    expect(card).toContain("...(reportId ? { reportIds: [reportId] } : {})");
  });

  it("lands on the created resource, already open, from the Prepare link", () => {
    const prepare = read("components/school/prof-prepare.tsx");
    expect(prepare).toContain('url.searchParams.get("resource")');
    expect(card).toContain("`/school?tab=prepare&resource=${encodeURIComponent(id)}`");
  });
});

describe("what Raya for Schools is told", () => {
  const route = read("app/api/school/raya/chat/route.ts");

  it("teaches the block, and to write it only when asked or accepted", () => {
    // Escaped in source (the prompt is a template literal): `\`\`\`prepare.
    expect(route).toContain("\\`\\`\\`prepare");
    expect(route).toContain("kind: exam, exercise, worksheet or quiz.");
    expect(route).toContain("never one the teacher did not ask for or accept");
  });
});

describe("the Prepare route's conversation source", () => {
  const route = read("app/api/school/prepare/route.ts");

  it("accepts the teacher's own thread as extra material, owner-gated like Tools", () => {
    expect(route).toContain("conversationId?: string");
    expect(route).toContain("conv.user_id !== user.id");
    expect(route).toContain("Discussion context (the teacher's own thread)");
  });

  it("brings the thread's attached documents with it, under the same owner gate", () => {
    expect(route).toContain('.from("conversation_files")');
    expect(route).toContain("Attached document");
  });
});

describe("the Prepare route's report source", () => {
  const route = read("app/api/school/prepare/route.ts");

  it("grounds on picked school reports, with the list's own visibility rule", () => {
    expect(route).toContain("reportIds?: string[]");
    expect(route).toContain('.from("reports")');
    // A prof reads only their own reports; an admin reads the school's.
    expect(route).toContain('rq.eq("created_by", membership.adminId)');
    expect(route).toContain("School report");
  });
});
