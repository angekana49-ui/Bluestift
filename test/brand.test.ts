import { describe, it, expect } from "vitest";
import { splitOnRaya } from "@/components/ui/brand";

/**
 * <RayaText/> applies the brand serif to every "Raya" inside a plain copy
 * string. Its only logic is this split, and getting it wrong is visible on
 * every surface — hence the coverage.
 */
describe("splitOnRaya", () => {
  it("leaves copy without the brand untouched (single part)", () => {
    expect(splitOnRaya("Study Rooms")).toEqual(["Study Rooms"]);
    expect(splitOnRaya("")).toEqual([""]);
  });

  it("splits around each occurrence, so a wordmark fits between the parts", () => {
    expect(splitOnRaya("Ask Raya to help")).toEqual(["Ask ", " to help"]);
    expect(splitOnRaya("Raya")).toEqual(["", ""]);
    expect(splitOnRaya("Raya for Schools, powered by Raya")).toEqual([
      "",
      " for Schools, powered by ",
      "",
    ]);
  });

  it("keeps possessives and punctuation working", () => {
    expect(splitOnRaya("Raya's suggestions")).toEqual(["", "'s suggestions"]);
    expect(splitOnRaya("works with Raya.")).toEqual(["works with ", "."]);
  });

  it("is word-bounded — it never carves up a longer word", () => {
    expect(splitOnRaya("Rayan joined the room")).toEqual(["Rayan joined the room"]);
    expect(splitOnRaya("rayasoft")).toEqual(["rayasoft"]);
  });

  it("is case-sensitive: only the correctly cased brand is matched", () => {
    // "RAYA" is the retired all-caps form — it must not silently pass as brand.
    expect(splitOnRaya("RAYA for Schools")).toEqual(["RAYA for Schools"]);
  });
});
