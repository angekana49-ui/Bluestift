import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { lookup, MESSAGES } from "@/lib/i18n";
import { LOCALES } from "@/lib/locale";

/**
 * The staff chat's hello: a small library, not a single line — one of four
 * variants picked per visit, addressed to the teacher BY NAME ("…, Aïcha?"),
 * with the casual "prof" word when the account holds no name. Admins keep the
 * role word (their surface passes the school name as the staff name).
 */

const KEYS = [
  "school.rayaChat.greet1",
  "school.rayaChat.greet2",
  "school.rayaChat.greet3",
  "school.rayaChat.greet4",
  "school.rayaChat.profWord",
] as const;

const read = (rel: string) => readFileSync(join(process.cwd(), rel), "utf8").split("\r\n").join("\n");

describe("staff greeting library", () => {
  it("ships four hellos plus the prof word, in every locale", () => {
    for (const locale of LOCALES) {
      for (const key of KEYS) {
        const value = locale.code === "en" ? lookup("en", key) : MESSAGES[locale.code]?.[key];
        expect(value, `${locale.code}/${key}`).toBeTruthy();
      }
    }
  });

  it("addresses the teacher by name in every variant, in every locale", () => {
    for (const locale of LOCALES) {
      for (const key of KEYS.slice(0, 4)) {
        expect(lookup(locale.code, key, { name: "Aïcha" }), `${locale.code}/${key}`).toContain("Aïcha");
      }
    }
  });

  it("picks one hello per visit and falls back to the prof word", () => {
    const chat = read("components/school/school-raya-chat.tsx");
    expect(chat).toContain("Math.floor(Math.random() * 4)");
    expect(chat).toContain('`school.rayaChat.greet${opts.pick + 1}`');
    expect(chat).toContain('firstNameOf(profName) || tr("school.rayaChat.profWord")');
    expect(chat).toContain(': tr("school.role.admin")');
  });

  it("still lets the live hooks override the hello", () => {
    expect(read("components/school/school-raya-chat.tsx")).toContain("personalizedHooks: fetchHooks(");
  });
});
