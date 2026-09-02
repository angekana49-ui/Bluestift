import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { globSync } from "node:fs";
import { join } from "node:path";

/**
 * One page frame, one chat column.
 *
 * The complaint these tests encode: "les sections sont décalées, pas bien
 * centrées et uniformes". They were, and for a mechanical reason — every screen
 * declared its own scroller inline:
 *
 *   /rooms /tools /homework /profile   padding: "32px 40px"
 *   Schools content zone               padding: "24px 26px"
 *   a room                             padding: "28px 32px"
 *   the chat thread                    padding: "28px 24px"
 *
 * so moving between two tabs of the SAME app shifted every heading sideways,
 * and none of them capped their width. The chat was worse than uneven: the
 * thread centred a 760px box inside a zone already inset by 24px while the
 * composer centred a 760px box on the full zone with the 24px INSIDE it, so the
 * bubbles and the text field genuinely sat 24px apart, with the connectivity
 * banner at a third offset again.
 *
 * The fix is two shared boxes — `PageBody`/`.app-page` and `.chat-col` — and
 * these tests keep the next screen from quietly opening a fifth gutter.
 */

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

/** Every screen that renders inside the app shell. */
const APP_SOURCES = [
  ...globSync("app/**/page.tsx", { cwd: process.cwd() }),
  ...globSync("components/**/*.tsx", { cwd: process.cwd() }),
]
  .map((p) => p.replace(/\\/g, "/"))
  .filter(
    (p) =>
      // The marketing site keeps its own layout system (components/site/layout.ts,
      // MEASURE/pageColumn) and its own theme. Not part of this contract.
      !p.startsWith("components/site/") &&
      // FocusOverlay is an immersive player that covers the WHOLE app — it is
      // not a screen inside the shell, so it does not share the shell's frame.
      // Its own centring is the point of it, not a fifth gutter.
      p !== "components/study/focus-player.tsx",
  );

describe("no screen re-invents the page frame", () => {
  it("nothing declares its own full-height scroller with a hardcoded gutter", () => {
    // The exact shape that was copy-pasted into five files. `PageBody` owns it
    // now; the gutter is responsive and lives in `.app-page`, which is the part
    // an inline style cannot express in the first place.
    const offenders: string[] = [];
    for (const p of APP_SOURCES) {
      const src = read(p);
      const m = src.match(/flex:\s*1[^}]*overflow:\s*"auto"[^}]*padding:\s*"\d+px \d+px"/g);
      if (m) offenders.push(`${p}: ${m[0]}`);
    }
    expect(offenders).toEqual([]);
  });

  it("the four Raya routes and the Schools content zone share PageBody", () => {
    for (const p of [
      "app/rooms/page.tsx",
      "app/tools/page.tsx",
      "app/homework/page.tsx",
      "app/profile/page.tsx",
      "components/school/schools-shell.tsx",
      "components/room-view.tsx",
    ]) {
      expect(read(p), p).toMatch(/<PageBody/);
    }
  });

  it("PageBody carries the gutter in CSS, not inline", () => {
    const shell = read("components/ui/shell.tsx");
    expect(shell).toMatch(/className="app-page"/);
    expect(shell).toMatch(/className="app-page-inner"/);
  });

  it("the page frame is responsive and reserves its scrollbar", () => {
    const css = read("app/globals.css");
    // A centred column that loses half a scrollbar's width the moment content
    // overflows is the other way "centred" stops being centred.
    expect(css).toMatch(/\.app-page\s*\{[^}]*scrollbar-gutter:\s*stable/);
    // At least one narrower gutter below the desktop tier.
    expect(css).toMatch(/@media \(max-width: \d+px\) \{\s*\.app-page \{/);
  });
});

describe("the chat's three subtrees share one column", () => {
  const surface = read("components/chat/chat-surface.tsx");
  const composer = read("components/chat/chat-composer.tsx");
  const room = read("components/rooms/room-group-chat.tsx");

  it("thread, banner and composer all use .chat-col", () => {
    // Two occurrences in the surface: the connectivity banner and the thread.
    expect(surface.match(/chat-col/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
    expect(composer).toMatch(/className="chat-col"/);
    expect(room.match(/chat-col/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
  });

  it("none of them still centres a bare THREAD_MAX_W box", () => {
    // The old pattern. Its problem was never the number, it was that the gutter
    // sat OUTSIDE the max-width in one place and inside it in another.
    for (const [name, src] of [
      ["chat-surface", surface],
      ["chat-composer", composer],
      ["room-group-chat", room],
    ] as const) {
      expect(src, name).not.toMatch(/maxWidth: THREAD_MAX_W/);
    }
  });

  it(".chat-col puts the gutter inside its max-width", () => {
    const css = read("app/globals.css");
    const block = /\.chat-col\s*\{([^}]*)\}/.exec(css)?.[1] ?? "";
    expect(block).toMatch(/max-width:\s*calc\(/);
    expect(block).toMatch(/padding-inline/);
    // Without this the padding would be added OUTSIDE the max-width and the
    // whole alignment argument collapses again.
    expect(block).toMatch(/box-sizing:\s*border-box/);
  });

  it("the thread reserves its scrollbar on both edges so it stays centred", () => {
    const css = read("app/globals.css");
    expect(css).toMatch(/\.chat-thread\s*\{[^}]*scrollbar-gutter:\s*stable both-edges/);
  });
});
