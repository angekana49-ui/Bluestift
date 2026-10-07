import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { lookup, type MessageKey } from "@/lib/i18n";
import { clearExplanations, deeperMessage, fetchExplanation } from "@/components/chat/math-explain";

/**
 * Owner, 2026-10-07: "Raya relance le LLM pour les explications à chaque
 * fois … on a un espace pour demander à Raya mais rien ne part et ça ne mène
 * même pas vers un nouveau chat — si quelqu'un veut approfondir il est
 * redirigé".
 */

const calls: string[] = [];
vi.mock("@/lib/net/client-fetch", () => ({
  netFetch: async (_url: string, init: { body: string }) => {
    calls.push(init.body);
    await new Promise((r) => setTimeout(r, 5));
    return new Response(JSON.stringify({ text: "Règle de la puissance." }), { status: 200 });
  },
}));

const read = (rel: string) => readFileSync(join(process.cwd(), rel), "utf8").replace(/\r/g, "");

beforeEach(() => {
  calls.length = 0;
  clearExplanations();
});

describe("an explanation is asked for once", () => {
  it("shares a request on its way, and does not send it again once answered", async () => {
    const req = { lang: "calc" as const, src: "dérivée de x³", focus: 0 };
    const key = JSON.stringify(req);
    const [a, b] = await Promise.all([fetchExplanation(key, req, "x"), fetchExplanation(key, req, "x")]);
    expect(a).toEqual({ kind: "done", text: "Règle de la puissance." });
    expect(b).toBe(a);
    expect(calls).toHaveLength(1);
  });

  it("the box reads what it was already told before asking", () => {
    const box = read("components/chat/math-explain.tsx");
    expect(box).toContain("const known = readStored(key);");
    expect(box).toContain('window.sessionStorage.setItem(STORE,');
  });
});

describe("going deeper is a new conversation with Raya", () => {
  const tr = (key: MessageKey, vars?: Record<string, string | number>) => lookup("fr", key, vars);

  it("carries the lines, the explained one and the question", async () => {
    const msg = deeperMessage({ lang: "calc", src: "a = 3\n\ndérivée de x³", focus: 1 }, "pourquoi 3 ?", tr);
    expect(msg).toBe(
      "Je travaille sur ces calculs dans Tools :\n• a = 3\n• dérivée de x³\nTu m’as expliqué la ligne « dérivée de x³ ».\nMa question : pourquoi 3 ?",
    );
    const graph = deeperMessage({ lang: "graph", src: "f(x) = a·x²", sliders: { a: 2 } }, "", tr);
    expect(graph).toContain("(a = 2)");
    expect(graph).toContain("aller plus loin");
  });

  it("opens the chat with it already sent, instead of a second explanation", () => {
    const box = read("components/chat/math-explain.tsx");
    expect(box).toContain("setChatHandoff(deeperMessage(request, question, tr));");
    expect(box).toContain('router.push("/chat");');
    // The follow-up no longer calls the explanation route with a question.
    expect(box).not.toContain("question: q");
    const chat = read("components/chat/chat-surface.tsx");
    expect(chat).toContain("const handoff = takeChatHandoff();");
  });

  it("is handed over inside the tab, once, never by a link", async () => {
    const store = new Map<string, string>();
    vi.stubGlobal("window", {
      sessionStorage: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => void store.set(k, v),
        removeItem: (k: string) => void store.delete(k),
      },
    });
    const { setChatHandoff, takeChatHandoff } = await import("@/lib/chat-handoff");
    setChatHandoff("Ma question : pourquoi ?");
    expect(takeChatHandoff()).toBe("Ma question : pourquoi ?");
    expect(takeChatHandoff()).toBeNull();
    store.set("bs_chat_handoff", JSON.stringify({ text: "vieux", at: Date.now() - 120_000 }));
    expect(takeChatHandoff()).toBeNull();
    vi.unstubAllGlobals();
  });
});
