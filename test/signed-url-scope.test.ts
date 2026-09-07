import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * The route that mints signed storage URLs.
 *
 * It used to authorise purely by "RLS returned a row", which was sound — the
 * policies are correct — but made it the one place in this codebase where the
 * database was the whole boundary, three lines above a service-role signature
 * that no policy can refuse. It now states the predicate itself as well, so
 * both nets have to hold.
 *
 * The failure this guards against is subtle: the natural-looking predicate is
 * wrong on both id branches. `uploader_id` on a room file would break the
 * sharing the feature exists for, and on a conversation file it is only a proxy
 * for ownership that refuses a legitimate open wherever the two diverge.
 */
const src = readFileSync(
  join(process.cwd(), "app/api/files/signed-url/route.ts"),
  "utf8",
);

// Slice on the branch bodies, anchored so neither window can borrow the
// other's check or the file's imports.
const roomBranch = src.slice(
  src.indexOf('if (typeof body.roomFileId'),
  src.indexOf('} else if (typeof body.conversationFileId'),
);
const convBranch = src.slice(
  src.indexOf('} else if (typeof body.conversationFileId'),
  src.indexOf('} else if (typeof body.path'),
);

describe("the room-file branch", () => {
  it("requires membership of the file's room", () => {
    expect(roomBranch).toContain('from("room_members")');
    expect(roomBranch).toContain('.eq("room_id", rf.room_id)');
    expect(roomBranch).toContain('.eq("user_id", user.id)');
  });

  it("does NOT check authorship — every member may open a shared document", () => {
    expect(roomBranch).not.toContain("uploader_id");
  });

  it("does not require the room to still be open — an ended room is read-only", () => {
    expect(roomBranch).not.toContain("assertRoomOpen");
  });
});

describe("the conversation-file branch", () => {
  it("checks the PARENT conversation's owner", () => {
    expect(convBranch).toContain('from("conversations")');
    expect(convBranch).toContain('.eq("user_id", user.id)');
  });

  it("does not settle for the file's own uploader_id, which is only a proxy", () => {
    expect(convBranch).not.toContain("uploader_id");
  });
});

describe("the route as a whole", () => {
  it("keeps reading the row through the RLS-scoped client, not the admin one", () => {
    // Two nets. Reading the row with createAdminClient would remove the first
    // and leave the new check load-bearing alone.
    const beforeSigning = src.slice(0, src.indexOf("createAdminClient()"));
    expect(beforeSigning).not.toContain("createAdminClient()");
    expect(src).toContain("const supabase = await createClient()");
  });

  it("still fails closed when nothing authorised a path", () => {
    expect(src).toContain('if (!path) return NextResponse.json({ error: "forbidden" }, { status: 403 })');
    expect(src.indexOf('{ status: 403 }')).toBeLessThan(src.indexOf("createSignedUrl"));
  });

  it("keeps the folder check on the raw-path branch", () => {
    expect(src).toContain("isOwnedStoragePath(body.path, user.id)");
  });

  it("selects branches by type, so a non-string id cannot shadow the path branch", () => {
    expect(src).toContain("typeof body.roomFileId === \"string\"");
    expect(src).toContain("typeof body.conversationFileId === \"string\"");
  });
});
