import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * The export's one hand-typed table.
 *
 * `lib/compliance/export.ts` reaches `learning.kernel_profile_snapshots`
 * through a local cast, because the table is real (migration 20260728004630)
 * but absent from `types/database.types.ts`, which has not been regenerated
 * since it landed.
 *
 * The comment beside that cast used to promise it would "stop compiling" once
 * the types were rebuilt. It would not: `as unknown as` compiles against
 * anything, so the workaround would have quietly outlived its reason with
 * nobody told. This test is the signal instead. It fails the moment
 * `npm run gen:types` brings the table into the generated types — which is
 * exactly when the cast should be deleted — and it says so in the failure.
 */
describe("the export's one untyped table", () => {
  const root = process.cwd();
  const types = readFileSync(join(root, "types/database.types.ts"), "utf8");
  const source = readFileSync(join(root, "lib/compliance/export.ts"), "utf8");

  it("keeps the cast only while the generated types still lack the table", () => {
    if (types.includes("kernel_profile_snapshots")) {
      expect(
        source,
        "types/database.types.ts now knows learning.kernel_profile_snapshots. " +
          "Delete `untypedLearning` in lib/compliance/export.ts and read the " +
          "table through the typed client.",
      ).not.toContain("untypedLearning");
    } else {
      expect(source).toContain("untypedLearning");
    }
  });

  it("exports the table either way, because article 15 does not wait for types", () => {
    expect(source).toContain("kernel_profile_snapshot");
  });
});
