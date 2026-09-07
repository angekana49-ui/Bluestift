import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const src = readFileSync(join(process.cwd(), "lib/compliance/export.ts"), "utf8");
const types = readFileSync(join(process.cwd(), "types/database.types.ts"), "utf8");

/**
 * A debt that is paid, and stays paid.
 *
 * `lib/compliance/export.ts` used to reach `learning.kernel_profile_snapshots`
 * through a hand-written cast, because the table was real (migration
 * 20260728004630) and absent from the generated types. The comment beside that
 * cast promised it would "stop compiling" once the types were rebuilt. It would
 * not — `as unknown as` compiles against anything — so this test was written to
 * be the signal instead. It fired on 2026-09-07 when `gen:types` finally ran,
 * and the cast came out.
 *
 * What it guards now is the other direction: the table the Kernel's read of the
 * learner lives in is exported, through the typed client, with no cast standing
 * between the two.
 */
describe("the Kernel snapshot table is exported, and no longer cast", () => {
  it("is known to the generated types", () => {
    expect(types).toContain("kernel_profile_snapshots");
  });

  it("is read through the typed client", () => {
    expect(src).toContain('.from("kernel_profile_snapshots")');
    expect(src).not.toContain("untypedLearning");
    expect(src).not.toContain("as unknown as");
  });

  it("reaches the bundle, because article 15 is what this table is for", () => {
    expect(src).toContain("kernel_profile_snapshot");
  });
});
