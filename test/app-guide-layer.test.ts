import { describe, expect, it } from "vitest";
import { appGuideLayer, appGuideLayerForStaff } from "@/lib/raya/app-guide-layer";
import { buildRayaMessages } from "@/lib/raya/prompt";

/**
 * These pin the SUBSTANCE Raya needs to answer "what does this button do" —
 * rewrite the wording freely, but a rewrite that drops a nav item or a plan
 * fact should fail here. See lib/raya/app-guide.md's own note: this file's
 * two exports are a hand-condensed copy of that doc's "For everyday users"
 * section, kept in sync by hand rather than by a shared runtime read.
 */

describe("appGuideLayer (student-facing: solo Raya + rooms)", () => {
  const layer = appGuideLayer();

  it("names every item in Raya's own nav", () => {
    for (const item of ["Chat", "Rooms", "Tools", "Assignments", "My Kernel", "Settings"]) {
      expect(layer).toContain(item);
    }
  });

  it("states the plan model without hardcoding a price that would go stale", () => {
    expect(layer).toMatch(/free/i);
    // \s+ rather than a literal space: source line-wrapping inside the
    // template literal is incidental and must not be what makes this pass.
    expect(layer).toMatch(/per enrolled\s+student/i);
    expect(layer).toContain("/pricing");
    // A price figure here is a bug waiting to happen — it drifts from the
    // actual plan catalogue the moment either changes.
    expect(layer).not.toMatch(/\$\d/);
  });

  it("tells the model to defer to the real product over this text", () => {
    expect(layer.toLowerCase()).toContain("trust the product");
  });
});

describe("appGuideLayerForStaff (Raya for Schools)", () => {
  const layer = appGuideLayerForStaff();

  it("names every tab in the Schools nav", () => {
    for (const tab of [
      "Overview",
      "Classes",
      "Focus",
      "Prepare",
      "Insights",
      "Reports",
      "Team",
      "Billing",
      "Archive",
    ]) {
      expect(layer).toContain(tab);
    }
  });

  it("restates the transcript boundary — a teacher may ask this directly", () => {
    expect(layer.toLowerCase()).toContain("never the content");
  });
});

describe("wired into the actual prompts", () => {
  it("solo Raya's system message carries the student app guide", () => {
    const system = buildRayaMessages([], null)[0].content;
    expect(system).toContain("What you can explain about the app");
    expect(system).toContain("My Kernel");
  });
});
