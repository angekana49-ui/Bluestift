import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Raya-for-Schools history is PER SCHOOL.
 *
 * A staff member can belong to several schools, and a thread is grounded in one
 * school's data snapshot — so a thread opened about school A must not be
 * readable, resumable or deletable while school B is active.
 *
 * The database will not enforce this. The policies on the two tables the
 * history reads resolve to the conversation's owner and nothing more:
 *
 *   messages_owner        ALL     conversations.user_id = auth.uid()
 *   conv_files_owner_*    SELECT  conversations.user_id = auth.uid()
 *
 * No `school_id`, no `context_type`. RLS stops another PERSON's thread; the
 * school boundary and the staff/student boundary exist only in this route file.
 * These tests hold all four paths to writing them down, because a path that
 * forgets loses the guarantee silently — the read still succeeds, just against
 * the wrong school.
 */

const conversations = readFileSync(
  join(process.cwd(), "app/api/school/raya/conversations/route.ts"),
  "utf8",
);
const chat = readFileSync(join(process.cwd(), "app/api/school/raya/chat/route.ts"), "utf8");

/*
 * The four handlers, sliced apart so a guard in one cannot satisfy another —
 * anchored on exact markers rather than a character window, because a window
 * that drifts into the list branch would let its `school_id` filter stand in
 * for the read branch's missing one, and the test would pass on the bug.
 */
const LIST_END = "return NextResponse.json({ conversations: data ?? [] });";
const listAndRead = conversations.slice(
  conversations.indexOf("export async function GET"),
  conversations.indexOf("export async function DELETE"),
);
const del = conversations.slice(conversations.indexOf("export async function DELETE"));
const list = listAndRead.slice(0, listAndRead.indexOf(LIST_END) + LIST_END.length);
const readById = listAndRead.slice(listAndRead.indexOf(LIST_END) + LIST_END.length);

describe("school Raya history is scoped to the active school", () => {
  it("filters the history list on the active school", () => {
    expect(list).toMatch(/\.eq\("context_type", "school_analytics"\)/);
    expect(list).toMatch(/\.eq\("school_id", membership\.schoolId\)/);
  });

  it("checks the thread belongs to this school before reading its messages", () => {
    expect(readById).toMatch(/\.eq\("school_id", membership\.schoolId\)/);
    expect(readById).toMatch(/\.eq\("context_type", "school_analytics"\)/);
  });

  it("refuses a thread from another school before deleting anything", () => {
    expect(del).toMatch(/\.eq\("school_id", membership\.schoolId\)/);
  });

  it("refuses to resume a thread from another school", () => {
    const guard = chat.slice(chat.indexOf("requestedConvId"), chat.indexOf("if (!allowed)"));
    expect(guard).toMatch(/\.eq\("school_id", m\.schoolId\)/);
    expect(guard).toMatch(/\.eq\("context_type", "school_analytics"\)/);
  });

  it("stamps a new thread with the school it was opened about", () => {
    const create = chat.slice(chat.indexOf("if (!convId) {"), chat.indexOf("// ── Wave 2"));
    expect(create).toMatch(/school_id: membership\.schoolId/);
    expect(create).toMatch(/context_type: "school_analytics"/);
  });
});

describe("the guards run before the work they guard", () => {
  /*
   * Ordering is the whole bug class here. Both of these read or write on the
   * conversation id ALONE; the scoping check has to have happened already,
   * because after the query has run there is nothing left to protect.
   */
  it("reads messages only after the ownership check", () => {
    const check = readById.indexOf('.eq("school_id", membership.schoolId)');
    const read = readById.indexOf('.from("messages")');
    expect(check).toBeGreaterThan(-1);
    expect(check).toBeLessThan(read);
  });

  it("deletes messages only after the ownership check", () => {
    // This one WAS the other way round: the messages delete keyed on the
    // conversation id ran first, with the ownership check sitting on the
    // conversations delete underneath it — one table too late.
    const check = del.indexOf('.eq("school_id", membership.schoolId)');
    const wipe = del.indexOf('.from("messages").delete()');
    expect(check).toBeGreaterThan(-1);
    expect(check).toBeLessThan(wipe);
  });

  it("returns rather than falls through when the thread does not match", () => {
    expect(readById).toMatch(/if \(!owned\) return NextResponse\.json/);
    expect(del).toMatch(/if \(!owned\) return NextResponse\.json/);
  });
});

describe("student transcripts stay with the student", () => {
  it("keeps the staff prompt's promise about transcripts", () => {
    // The school sees progress, mastery and patterns — never the conversations.
    expect(chat).toMatch(/transcripts/i);
    expect(chat).toMatch(/stay with the student/i);
  });

  it("never widens the staff reader past school_analytics", () => {
    // `context_type` is absent from the RLS policies, so this file is the only
    // thing standing between the staff endpoint and a staff member's OWN
    // student-side tutoring threads.
    const reads = conversations.match(/\.eq\("context_type", "[a-z_]+"\)/g) ?? [];
    expect(reads.length).toBeGreaterThanOrEqual(3);
    for (const r of reads) expect(r).toContain("school_analytics");
  });
});
