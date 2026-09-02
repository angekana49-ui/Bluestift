import { describe, expect, it } from "vitest";
import { buildRayaMessages, safetyLayer } from "@/lib/raya/prompt";
import type { KernelAlertType } from "@/lib/kernel/types";

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

describe("alert coverage", () => {
  it("gives Raya a move for every alert the kernel can emit", () => {
    // The kernel decides which alerts exist; the prompt decides what to do about
    // them. A new kernel alert type arriving with no instruction here would reach
    // students as an unhandled token, so this pins the two lists together.
    const kernelAlertTypes: KernelAlertType[] = [
      "passive_dependency",
      "false_mastery",
      "re_emergence_error",
      "cognitive_overload",
      "fixed_mindset",
      "inconsistency_high",
      "ood_distribution",
    ];
    const system = systemOf([], null);
    for (const alertType of kernelAlertTypes) {
      expect(system).toContain(alertType);
    }
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

  it("NAMES an absent profile instead of omitting the block", () => {
    /*
     * This used to assert the opposite — that no <learner_state> was emitted
     * when nothing was known — and that silence is what produced the worst bug
     * this file exists to prevent.
     *
     * A model handed no state and no instruction about the gap fills it in. It
     * told a student "je n'ai pas la capacité de me souvenir des échanges
     * précédents; chaque session démarre sans historique": a fabricated claim
     * about the product's architecture, and a false one. It was also
     * indistinguishable from the truthful case, so the same sentence came out
     * whether the learner was brand new or the Kernel had been unreachable for
     * seventeen days.
     */
    const system = systemOf([], null);
    expect(system).toContain('<learner_state available="false">');
    expect(system).toContain("</learner_state>");
  });

  it("forbids generalising an empty turn into a claim about having no memory", () => {
    const system = systemOf([], null);
    // The instruction has to be inside the block, where it is scoped to THIS
    // turn — a static rule alone would not tell the model which case it is in.
    const block = /<learner_state available="false">([\s\S]*?)<\/learner_state>/.exec(system)?.[1] ?? "";
    expect(block).toMatch(/no memory/i);
    expect(block).toMatch(/do NOT conclude the learner is new/i);
  });

  it("tells Raya what it truthfully does and does not carry between sessions", () => {
    // Without this section the model has no basis for answering "do you
    // remember me?" and invents one.
    const system = systemOf([], null);
    expect(system).toContain("# What you remember");
    // The true half: no transcripts.
    expect(system).toMatch(/do not keep transcripts/i);
    // The other true half, which is the one it was getting wrong.
    expect(system).toMatch(/carry between sessions is the learner's cognitive profile/i);
  });

  it("marks a populated profile as available, so the two cases are distinguishable", () => {
    const system = systemOf([], null, [], "", "", { birthYear: 2016 });
    expect(system).toContain('<learner_state available="true">');
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
