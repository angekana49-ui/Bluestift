import { describe, it, expect } from "vitest";
import {
  classifyPublishFile,
  isPostType,
  isValidSlug,
  mapCategoryToType,
  publishObjectName,
  slugify,
} from "@/lib/research/publish";

describe("research publish helpers", () => {
  it("slugifies titles into URL-safe slugs", () => {
    expect(slugify("My Cool Paper!")).toBe("my-cool-paper");
    expect(slugify("  Spaced   Out  ")).toBe("spaced-out");
    expect(slugify("L'apprentissage & l'IA")).toBe("l-apprentissage-l-ia");
    expect(slugify("")).toBe("");
  });

  it("validates slugs strictly", () => {
    expect(isValidSlug("bluestift-manifesto")).toBe(true);
    expect(isValidSlug("a")).toBe(true);
    expect(isValidSlug("Bluestift")).toBe(false);
    expect(isValidSlug("has space")).toBe(false);
    expect(isValidSlug("has_underscore")).toBe(false);
    expect(isValidSlug("-leading")).toBe(false);
    expect(isValidSlug("trailing-")).toBe(false);
    expect(isValidSlug("")).toBe(false);
    expect(isValidSlug("x".repeat(121))).toBe(false);
  });

  it("maps contribution categories to post types with an article fallback", () => {
    expect(mapCategoryToType("paper")).toBe("paper");
    expect(mapCategoryToType("experiment")).toBe("experiment");
    expect(mapCategoryToType("article")).toBe("article");
    expect(mapCategoryToType("Paper")).toBe("paper");
    expect(mapCategoryToType("other")).toBe("article");
    expect(mapCategoryToType("dataset")).toBe("article");
    expect(mapCategoryToType("")).toBe("article");
    expect(mapCategoryToType(null)).toBe("article");
  });

  it("accepts only the four research post types", () => {
    for (const t of ["paper", "experiment", "article", "update"]) expect(isPostType(t)).toBe(true);
    expect(isPostType("other")).toBe(false);
    expect(isPostType("Paper")).toBe(false);
    expect(isPostType("")).toBe(false);
  });

  it("classifies media files with their research_media type", () => {
    expect(classifyPublishFile("1234-uuid-paper.pdf")).toEqual({
      kind: "media",
      mediaType: "pdf",
      contentType: "application/pdf",
      ext: "pdf",
    });
    expect(classifyPublishFile("a/b/shot.PNG")).toMatchObject({ kind: "media", mediaType: "image" });
    expect(classifyPublishFile("clip.mp4")).toMatchObject({ kind: "media", mediaType: "video" });
  });

  it("classifies datasets and slides as attachments (download link, no media row)", () => {
    expect(classifyPublishFile("data.zip")).toMatchObject({ kind: "attachment", ext: "zip" });
    expect(classifyPublishFile("scores.CSV")).toMatchObject({ kind: "attachment" });
    expect(classifyPublishFile("deck.pptx")).toMatchObject({ kind: "attachment" });
    expect(classifyPublishFile("table.xlsx")).toMatchObject({ kind: "attachment" });
  });

  it("refuses anything executable or active — it must stay in quarantine", () => {
    for (const name of ["page.html", "page.htm", "pic.svg", "app.js", "run.exe", "doc", "archive.tar.gz", "noext", "evil.pdf.exe"]) {
      expect(classifyPublishFile(name), name).toBeNull();
    }
  });

  it("builds deterministic public object names", () => {
    expect(publishObjectName("my-paper", "pdf")).toBe("my-paper.pdf");
  });
});
