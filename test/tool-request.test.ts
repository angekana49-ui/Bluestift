import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { isToolRequestLang, parseToolRequest } from "@/lib/tool-request";
import { parseMarkdown } from "@/lib/markdown";
import { buildRayaMessages } from "@/lib/raya/prompt";

/**
 * A conversation asking the rest of the app for something: Raya writes a
 * ```create block, the chat shows a card, and only the learner's press creates
 * the tool in Tools. Pinned here: the syntax the prompt teaches and the card
 * reads, that nothing is created without the press, and that the result opens
 * in the Tools page's own player.
 */

const read = (rel: string) => readFileSync(join(process.cwd(), rel), "utf8").split("\r\n").join("\n");

describe("reading the block", () => {
  it("reads the tool, the source and the topic", () => {
    expect(parseToolRequest("tool: quiz\nfrom: conversation\ntopic: Les dérivées, niveau 1re")).toEqual({
      tool: "quiz",
      from: "conversation",
      topic: "Les dérivées, niveau 1re",
    });
    expect(parseToolRequest("tool: mind_map\nfrom: topic\ntopic: La Révolution française")).toMatchObject({ tool: "mind_map", from: "topic" });
  });

  it("accepts the tool's name in the learner's language", () => {
    expect(parseToolRequest("tool: résumé\ntopic: x y")?.tool).toBe("summary");
    expect(parseToolRequest("tool: fiches\ntopic: x y")?.tool).toBe("flashcards");
    expect(parseToolRequest("tool: carte mentale\ntopic: x y")?.tool).toBe("mind_map");
    expect(parseToolRequest("tool: Zusammenfassung\ntopic: x y")?.tool).toBe("summary");
  });

  it("builds from the conversation unless told otherwise", () => {
    expect(parseToolRequest("tool: quiz\ntopic: Pythagore")?.from).toBe("conversation");
    expect(parseToolRequest("tool: quiz\nfrom: sujet\ntopic: Pythagore")?.from).toBe("topic");
  });

  it("refuses a block without a known tool or a topic, rather than guessing", () => {
    expect(parseToolRequest("tool: poem\ntopic: x y")).toBeNull();
    expect(parseToolRequest("tool: quiz")).toBeNull();
  });

  it("is a fenced block the reply parser hands over by its language", () => {
    const blocks = parseMarkdown("Voilà :\n```create\ntool: quiz\ntopic: Les fractions\n```");
    const code = blocks.find((b) => b.t === "code") as { lang: string | null } | undefined;
    expect(code && isToolRequestLang(code.lang)).toBe(true);
  });
});

describe("the card", () => {
  const card = read("components/chat/tool-request-card.tsx");

  it("creates nothing until the learner presses the button", () => {
    // The only call to the Tools route is inside create(), bound to the button.
    expect(card.match(/\/api\/tools\/generate/g)).toHaveLength(1);
    expect(card).toContain("<button type=\"button\" onClick={create}");
    expect(card).not.toMatch(/useEffect\([^)]*create\(/);
  });

  it("builds from the learner's own thread when there is one, from the topic otherwise", () => {
    expect(card).toContain('const fromConversation = req.from === "conversation" && conversationId != null;');
    expect(card).toContain("...(fromConversation ? { conversation_id: conversationId } : { topic: req.topic })");
    const surface = read("components/chat/chat-surface.tsx");
    // A room's channel is the room's: never sent as a conversation source.
    expect(surface).toContain("conversationId: config.extraBody?.roomId ? null : (conversationId ?? null)");
  });

  it("opens the result in the Tools page's own player — the exact rendering", () => {
    expect(card).toContain("{player && createPortal(<ToolPlayer player={player} onExit={() => setPlayer(null)} />, document.body)}");
    expect(read("components/tools.tsx")).toContain("{player && <ToolPlayer player={player} onExit={closePlayer} studentName={studentName} />}");
  });

  it("remembers what it created, so a revisit does not spend a second generation", () => {
    expect(card).toContain("window.localStorage.setItem(key, data.id);");
    expect(card).toContain('{ kind: "remembered", id }');
  });

  it("only shows on the Raya surfaces that have a Tools page", () => {
    expect(card).toContain("if (!env?.enabled) return null;");
    expect(read("components/chat.tsx")).toContain("toolRequests: true,");
    expect(read("components/room-view.tsx")).toContain("toolRequests: true,");
    expect(read("components/school/school-raya-chat.tsx")).not.toContain("toolRequests");
  });

  it("lands on the created tool, already open, from the Tools link", () => {
    const tools = read("components/tools.tsx");
    expect(tools).toContain('url.searchParams.get("open")');
    expect(tools).toContain("setPlayer(playerFor(o.tool_type, o.id, o.output_content");
  });
});

describe("what Raya is told", () => {
  it("teaches the block, and to write it only when asked or accepted", () => {
    const system = buildRayaMessages([], null)[0].content as string;
    expect(system).toContain("```create");
    expect(system).toContain("tool: quiz, summary, flashcards or mind_map.");
    expect(system).toContain("never one the learner did not ask for or accept");
  });
});
