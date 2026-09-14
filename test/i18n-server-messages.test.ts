import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fill, lookup, MESSAGES, planLabelText, type MessageKey } from "@/lib/i18n";
import { en } from "@/lib/i18n/en";
import { LOCALES } from "@/lib/locale";

/**
 * What the server says, in the reader's language.
 *
 * Every client renders a route's `{ error }` as-is, so a message written in
 * English inside a route was English on a French screen, whatever the Settings
 * card said. Routes now send `await apiT("api.…")` (lib/i18n/server.ts), which
 * reads the same locale cookie the interface writes.
 */

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");

function routeFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(join(process.cwd(), dir))) {
    const rel = `${dir}/${name}`;
    if (statSync(join(process.cwd(), rel)).isDirectory()) out.push(...routeFiles(rel));
    else if (name === "route.ts") out.push(rel);
  }
  return out;
}

describe("placeholders", () => {
  it("fills {name} holes and leaves unknown ones visible", () => {
    expect(fill("Enter at least {floor} students.", { floor: 100 })).toBe("Enter at least 100 students.");
    expect(fill("Hi {name}", {})).toBe("Hi {name}");
    expect(lookup("fr", "api.enterAtLeastStudents", { floor: 120 })).toBe("Indiquez au moins 120 élèves.");
  });

  it("keeps every placeholder of the English message in each translation", () => {
    const holes = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(",");
    for (const key of Object.keys(en) as MessageKey[]) {
      const expected = holes(en[key]);
      if (!expected) continue;
      for (const { code } of LOCALES) {
        const value = MESSAGES[code][key];
        if (value === undefined) continue;
        expect(holes(value), `${code}/${key}`).toBe(expected);
      }
    }
  });

  it("covers every server message in every language", () => {
    const serverKeys = (Object.keys(en) as MessageKey[]).filter((k) => /^(api|email)\./.test(k));
    expect(serverKeys.length).toBeGreaterThan(250);
    for (const { code } of LOCALES) {
      for (const key of serverKeys) expect(MESSAGES[code][key], `${code}/${key}`).toBeTruthy();
    }
  });
});

describe("routes", () => {
  it("send no English sentence as an error", () => {
    // A capitalised literal as the value of `error:` is a message a person reads.
    // Lowercase ones ("invalid json", "classId is required.") are the contract
    // with our own client, which never lets a person trigger them.
    for (const file of [...routeFiles("app/api"), "app/rooms/actions.ts", "app/school/actions.ts", "lib/billing.ts"]) {
      const src = read(file);
      const hits = src.match(/\berror:\s*["`][A-Z][^"`]*["`]/g) ?? [];
      expect(hits, file).toEqual([]);
    }
  });

  it("await every gate, now that the gates translate", () => {
    // An un-awaited gate is a Promise, and a Promise is truthy: `if (denied)
    // return denied` would block every request, on every plan.
    for (const file of routeFiles("app/api")) {
      const src = read(file);
      const calls = src.match(/[^\n]*\b(gateFeature|gateQuota|contentLengthExceeds|tooLarge)\(/g) ?? [];
      for (const line of calls) expect(line, file).toMatch(/await (gateFeature|gateQuota|contentLengthExceeds|tooLarge)\(/);
    }
    for (const line of read("app/rooms/actions.ts").match(/[^\n]*\b(assertFeature|assertQuota)\(/g) ?? []) {
      expect(line).toMatch(/await (assertFeature|assertQuota)\(/);
    }
  });
});

describe("plan chip", () => {
  const tr = (key: MessageKey) => lookup("fr", key);

  it("translates the words, never a plan's name", () => {
    // "Solo", not "Utilisateur": the chip names the kind of plan, and /pricing
    // already calls an individual's plans "forfaits solo".
    expect(planLabelText("User — Free", tr)).toBe("Solo — Gratuit");
    expect(planLabelText("User — Plus", tr)).toBe("Solo — Plus");
    expect(planLabelText("Pilot", tr)).toBe("Pilote");
    expect(planLabelText("Schools Plus", tr)).toBe("Schools Plus");
  });
});
