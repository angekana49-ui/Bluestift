import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { splitOnRaya, RayaText, RayaName, SchoolsName, BluestiftName } from "@/components/ui/brand";

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

/**
 * Our own i18n keeps Bluestift/Raya/Schools/Rooms/Tools/Kernel literal in every
 * locale, but that's invisible to the browser's own translate tool — it rewrites
 * whatever text it finds on the rendered page regardless of what put it there.
 * `translate="no"` + the `notranslate` class is the DOM-level signal both Chrome's
 * built-in translate and the Google Translate widget honour to leave a node alone,
 * so every component that carries a brand word must render it wrapped like this —
 * checked here instead of trusting it holds by inspection, since it's a property
 * of markup a future edit could easily lose.
 */
describe("machine-translation shielding", () => {
  function isShielded(html: string, word: string) {
    // A rough but sufficient check: `word` appears inside some element carrying
    // both translate="no" and the notranslate class, with nothing else that
    // would let a translator skip past the attribute to the word.
    const re = new RegExp(
      `translate="no"[^>]*class="notranslate"[^>]*>${word}<|class="notranslate"[^>]*translate="no"[^>]*>${word}<`,
    );
    expect(html, html).toMatch(re);
  }

  it("shields Raya, Bluestift and Schools at their dedicated wordmarks", () => {
    isShielded(renderToStaticMarkup(RayaName({})), "Raya");
    isShielded(renderToStaticMarkup(BluestiftName({})), "Bluestift");
    isShielded(renderToStaticMarkup(SchoolsName({})), "Schools");
  });

  it("shields Schools, Rooms, Tools and Kernel wherever <RayaText/> renders them", () => {
    isShielded(renderToStaticMarkup(RayaText({ children: "Rooms" })), "Rooms");
    isShielded(renderToStaticMarkup(RayaText({ children: "Tools Studio" })), "Tools");
    isShielded(renderToStaticMarkup(RayaText({ children: "My Kernel" })), "Kernel");
    isShielded(renderToStaticMarkup(RayaText({ children: "Ask Raya about Schools" })), "Schools");
  });

  it("does not wrap ordinary prose that happens to share no brand word", () => {
    const html = renderToStaticMarkup(RayaText({ children: "Ask your teacher a question" }));
    expect(html).not.toContain("notranslate");
  });
});
