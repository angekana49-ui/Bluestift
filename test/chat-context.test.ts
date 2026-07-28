import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import { persistAndGather } from "@/lib/raya/chat-context";

/**
 * The chat hot path's persist-and-gather wave: all queries must launch in ONE
 * parallel batch (this is the latency win), and the history window must be the
 * LATEST messages ending with the just-stored user message — the old serial
 * code took the oldest 20, silently dropping recent context past 20 messages.
 */

type Row = Record<string, unknown>;

function makeSupabase(cfg: {
  insertResult?: { data: Row | null; error: { message: string } | null };
  histRows?: Row[];
  ownFiles?: Row[];
  roomFiles?: Row[];
}) {
  const events: string[] = [];
  function resolveFor(table: string, op: string): { data: unknown; error: unknown } {
    if (table === "messages" && op === "insert")
      return cfg.insertResult ?? { data: { id: "new-msg" }, error: null };
    if (table === "messages") return { data: cfg.histRows ?? [], error: null };
    if (table === "conversation_files") return { data: cfg.ownFiles ?? [], error: null };
    if (table === "room_files") return { data: cfg.roomFiles ?? [], error: null };
    return { data: null, error: null };
  }
  function makeChain(table: string) {
    let op = "select";
    const chain: Record<string, unknown> = {};
    for (const m of ["select", "eq", "not", "order", "limit", "single", "insert"]) {
      chain[m] = (..._args: unknown[]) => {
        if (m === "insert") op = "insert";
        return chain;
      };
    }
    // Thenable, resolved on a macrotask so a SERIAL implementation would show
    // interleaved start/done events while a parallel one starts all first.
    chain.then = (onF: (v: unknown) => unknown, onR?: (e: unknown) => unknown) => {
      events.push(`start ${table}:${op}`);
      return new Promise((resolve) =>
        setTimeout(() => {
          events.push(`done ${table}:${op}`);
          resolve(resolveFor(table, op));
        }, 0),
      ).then(onF, onR);
    };
    return chain;
  }
  const supabase = {
    schema: () => ({ from: (table: string) => makeChain(table) }),
  } as unknown as SupabaseClient<Database>;
  return { supabase, events };
}

const baseInput = {
  conversationId: "conv-1",
  userId: "u1",
  content: "What is inertia?",
  fileIds: [] as string[],
};

describe("persistAndGather", () => {
  it("launches every query before any of them resolves (one parallel wave)", async () => {
    const { supabase, events } = makeSupabase({});
    await persistAndGather(supabase, { ...baseInput, roomId: "room-1" });
    const firstDone = events.findIndex((e) => e.startsWith("done"));
    const starts = events.filter((e) => e.startsWith("start"));
    expect(starts.length).toBe(4); // insert + history + conv files + room files
    expect(events.slice(0, firstDone)).toEqual(starts);
  });

  it("returns the LATEST history chronologically, ending with the new message", async () => {
    // 25 prior messages, newest first (as the desc query returns them).
    const histRows = Array.from({ length: 21 }, (_, i) => ({
      id: `m${24 - i}`,
      role: (24 - i) % 2 === 0 ? "user" : "assistant",
      content: `msg ${24 - i}`,
    }));
    const { supabase } = makeSupabase({ histRows });
    const turn = await persistAndGather(supabase, baseInput);
    if (turn.error !== undefined) throw new Error(turn.error);
    expect(turn.hist).toHaveLength(20);
    // Chronological: oldest of the window first...
    expect(turn.hist[0].content).toBe("msg 6");
    expect(turn.hist[18].content).toBe("msg 24");
    // ...and the just-stored message is ALWAYS last.
    expect(turn.hist[19]).toEqual({ role: "user", content: "What is inertia?" });
  });

  it("filters the just-inserted message out of the history read (no doubling)", async () => {
    const histRows = [
      { id: "new-msg", role: "user", content: "What is inertia?" },
      { id: "m1", role: "assistant", content: "earlier reply" },
    ];
    const { supabase } = makeSupabase({ histRows });
    const turn = await persistAndGather(supabase, baseInput);
    if (turn.error !== undefined) throw new Error(turn.error);
    expect(turn.hist).toEqual([
      { role: "assistant", content: "earlier reply" },
      { role: "user", content: "What is inertia?" },
    ]);
  });

  it("skips the room-files query outside a room", async () => {
    const { supabase, events } = makeSupabase({});
    await persistAndGather(supabase, baseInput);
    expect(events.some((e) => e.includes("room_files"))).toBe(false);
  });

  it("puts room documents before the student's own, bounded to 8000 chars", async () => {
    const { supabase } = makeSupabase({
      ownFiles: [{ file_name: "mine.pdf", content: "own text" }],
      roomFiles: [{ file_name: "shared.pdf", content: "x".repeat(9000) }],
    });
    const turn = await persistAndGather(supabase, { ...baseInput, roomId: "room-1" });
    if (turn.error !== undefined) throw new Error(turn.error);
    expect(turn.docs.startsWith("# shared.pdf")).toBe(true);
    expect(turn.docs).toHaveLength(8000);
  });

  it("surfaces a message-insert failure as an error", async () => {
    const { supabase } = makeSupabase({
      insertResult: { data: null, error: { message: "insert failed" } },
    });
    const turn = await persistAndGather(supabase, baseInput);
    expect(turn.error).toBe("insert failed");
  });
});
