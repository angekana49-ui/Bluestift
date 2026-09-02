import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * The three verbs, and the promise each one makes.
 *
 *   DELETE     "perdu c'est perdu" — the row is destroyed, there is no trash,
 *              and it never comes back in the history.
 *   ARCHIVE    reversible — it leaves the default list and stays retrievable.
 *   MEMORIZE   anchored — it is folded into the Kernel and LISTED, so the
 *              learner can see which threads Raya is actually building on.
 *
 * Each of those is a promise made in a dialog the learner reads before
 * confirming, which makes them contracts rather than behaviour. What these
 * tests guard is the gap between the copy and the code: a soft-delete added
 * "for safety" would silently make the delete dialog a lie, and an archived or
 * memorized thread that no screen can reach would do the same to the other two.
 */

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

const route = read("app/api/raya/conversations/route.ts");
const chatPage = read("app/chat/page.tsx");
const profilePage = read("app/profile/page.tsx");
const historyList = read("components/chat/chat-history-list.tsx");
const engine = read("components/chat/use-chat-engine.ts");
const memory = read("components/kernel-memory.tsx");

describe("delete is permanent", () => {
  it("the route really deletes the row — no soft-delete flag", () => {
    const del = route.slice(route.indexOf("export async function DELETE"));
    expect(del).toMatch(/from\("conversations"\)\s*\.delete\(\)/);
    // A `deleted_at`-style stamp here would keep the row alive while the dialog
    // promised it was erased.
    expect(del).not.toMatch(/deleted_at|is_deleted|soft_delete/);
  });

  it("the delete is scoped to the owner", () => {
    const del = route.slice(route.indexOf("export async function DELETE"));
    expect(del).toMatch(/\.eq\("user_id", user\.id\)/);
  });

  it("the client drops the row from the list rather than re-fetching it", () => {
    expect(engine).toMatch(/setConversations\(\(list\) => list\.filter\(\(c\) => c\.id !== id\)\)/);
  });

  it("the copy says there is no trash and no undo, in every locale", () => {
    for (const loc of ["en", "fr", "es", "de"]) {
      const body = read(`lib/i18n/${loc}.ts`);
      const line = /"hist\.delete\.body":\s*\n?\s*"([^"]+)"/.exec(body)?.[1] ?? "";
      expect(line.length, loc).toBeGreaterThan(40);
      // Not asserting words — four languages. Asserting that the string was
      // extended past the bare "cannot be undone" it used to be, and that the
      // permanence claim is present in some form.
      expect(line, loc).toMatch(
        /permanent|définitiv|endgültig|dauerhaft|Papierkorb|corbeille|papelera|trash/i,
      );
    }
  });
});

describe("archive is reversible and reachable", () => {
  it("the route flips a stamp and never touches messages", () => {
    const patch = route.slice(route.indexOf("export async function PATCH"));
    const archiveBlock = patch.slice(
      patch.indexOf('if (action === "archive"'),
      patch.indexOf("// ── forget"),
    );
    expect(archiveBlock).toMatch(/update\(\{ archived_at \}\)/);
    expect(archiveBlock).not.toMatch(/from\("messages"\)/);
  });

  it("the chat page fetches archived threads instead of filtering them away", () => {
    expect(chatPage).toMatch(/archived_at/);
    // The bug this guards: adding `.is("archived_at", null)` here would make
    // archiving indistinguishable from deleting, since the list is the only
    // place an archived thread can be found.
    const convQuery = chatPage.slice(
      chatPage.indexOf('.from("conversations")'),
      chatPage.indexOf('.order("updated_at"'),
    );
    expect(convQuery).not.toMatch(/is\("archived_at"/);
  });

  it("the history list separates archived from live and can restore them", () => {
    // Matched on the PREDICATE, not on the name of the array it splits: the
    // list is now filtered by the sidebar search first, so the source of rows
    // changes while the archived/live distinction — the thing under test — must
    // not. `archived_at` is still the only thing that decides which side a
    // thread lands on.
    expect(historyList).toMatch(/const live = \w+\.filter\(\(c\) => !c\.archived_at\)/);
    expect(historyList).toMatch(/const archived = \w+\.filter\(\(c\) => c\.archived_at\)/);
    expect(historyList).toMatch(/hist\.archivedSection/);
    expect(historyList).toMatch(/hist\.unarchive/);
  });

  it("searching reaches archived threads instead of burying them", () => {
    // The distinction archiving exists to draw only holds if an archived thread
    // can still be FOUND. Behind a collapsed disclosure at the bottom of a
    // two-hundred-row sidebar it cannot be, so a query filters both sides and
    // opens the section whenever it has a hit.
    expect(historyList).toMatch(/filterBySearch\(conversations/);
    expect(historyList).toMatch(/archivedOpen/);
  });
});

describe("memorize is anchored and visible", () => {
  it("nothing is stamped when the Kernel could not be reached", () => {
    // A thread marked memorized whose analysis never landed is the worst
    // outcome: the learner stops asking and the profile never got the thread.
    const patch = route.slice(route.indexOf("// ── memorize"));
    const kernelFail = patch.slice(patch.indexOf("} catch {"), patch.indexOf("setLatestAnalysis"));
    expect(kernelFail).toMatch(/kernel_unreachable/);
    expect(kernelFail).not.toMatch(/memorized_at/);
  });

  it("the Kernel page lists the memorized threads", () => {
    expect(profilePage).toMatch(/KernelMemory/);
    expect(profilePage).toMatch(/\.not\("memorized_at", "is", null\)/);
  });

  it("the Memory list does NOT hide archived threads", () => {
    // Filing a thread away is not taking back the decision to have Raya build
    // on it, so the two states are independent.
    const q = profilePage.slice(
      profilePage.indexOf('.select("id, title, memorized_at")'),
      profilePage.indexOf('.order("memorized_at"'),
    );
    expect(q).not.toMatch(/archived_at/);
  });

  it("each memorized thread links to the conversation it names", () => {
    // A list of titles that all lead to the same blank page is not a list.
    expect(memory).toMatch(/\/chat\?c=\$\{encodeURIComponent\(c\.id\)\}/);
    expect(chatPage).toMatch(/openConversationId/);
  });

  it("forget clears the anchor only, and says so", () => {
    const forget = route.slice(route.indexOf("// ── forget"), route.indexOf("// ── memorize"));
    // The update payload is exactly one field. `kernel_triggered` is left
    // alone on purpose — it records that an analysis DID run on this thread,
    // which stays true after the anchor is dropped.
    const payload = /\.update\(\{([^}]*)\}\)/.exec(forget)?.[1] ?? "";
    expect(payload.trim()).toBe("memorized_at: null");
    // And the UI must not claim it unlearns anything.
    expect(memory).toMatch(/does not unlearn it/);
  });
});

describe("the app opens blank", () => {
  it("no thread is auto-resumed", () => {
    expect(chatPage).toMatch(/conversationId=\{null\}/);
    expect(chatPage).toMatch(/initialMessages=\{\[\]\}/);
  });

  it("an explicitly requested thread is opened client-side, not server-fetched", () => {
    // The deep link must not reintroduce the blocking messages/attachments
    // queries on the app's most-opened page.
    expect(chatPage).not.toMatch(/from\("messages"\)/);
  });
});
