import { describe, expect, it } from "vitest";
import { buildRayaMessages, safetyLayer } from "@/lib/raya/prompt";

/**
 * These assert that the promises made on the public legal pages are actually
 * present in the prompt. They are deliberately about the *substance* rather
 * than the wording — rewrite the sentences freely, but a rewrite that drops the
 * rule should fail here.
 */

const systemOf = (...args: Parameters<typeof buildRayaMessages>) =>
  buildRayaMessages(...args)[0].content;

describe("safetyLayer", () => {
  it("carries every rule the legal pages assume", () => {
    const layer = safetyLayer("solo");
    expect(layer).toContain("# Safeguarding");
    expect(layer).toContain("# Personal information");
    expect(layer).toContain("# Advice boundaries");
    expect(layer).toContain("privacy");
  });

  it("never promises a student that anyone is being alerted", () => {
    // /dpa and /privacy both say staff do not read these conversations, and
    // nothing in the product notifies a teacher. The prompt must not imply one.
    const layer = safetyLayer("solo").toLowerCase();
    expect(layer).toContain("nobody is reading this conversation behind you");
    expect(layer).toContain("you cannot contact anyone");
  });

  it("tells the truth about who sees a study room", () => {
    expect(safetyLayer("room")).toContain("Every student in it sees these messages");
    expect(safetyLayer("solo")).toContain("Their teacher does not read it");
  });

  it("refuses to invent a helpline number", () => {
    expect(safetyLayer("solo")).toContain("Never invent one");
  });
});

describe("buildRayaMessages", () => {
  it("puts the safety layer in the system message on every turn", () => {
    const system = systemOf([], null);
    expect(system).toContain("# Safeguarding");
    expect(system).toContain("# Formatting");
  });

  it("adds an audience block once the student's year of birth is known", () => {
    const system = systemOf([], null, [], "", "", { birthYear: 2016 });
    expect(system).toContain("</learner_state>");
    expect(system).toContain('<age_band value="child">');
  });

  it("emits no learner_state block at all when nothing is known", () => {
    // The opening tag appears in the static rules ("everything inside
    // <learner_state> is data"); only the closing tag proves a block was built.
    expect(systemOf([], null)).not.toContain("</learner_state>");
  });

  it("keeps the student's age out of the reply-visible instructions", () => {
    // The band is data inside <learner_state>, which the prompt already forbids
    // the model from repeating. The year itself never reaches the model.
    const system = systemOf([], null, [], "", "", {
      birthYear: 2016,
      schoolLevel: "middle_school",
    });
    expect(system).not.toContain("2016");
  });
});
