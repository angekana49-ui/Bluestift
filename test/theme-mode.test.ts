import { describe, expect, it, vi, afterEach, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  THEME_KEY,
  parseThemeMode,
  readThemeMode,
  resolveDark,
  writeThemeMode,
} from "@/lib/theme-mode";

/**
 * Light / Dark / System over a key that used to hold a boolean.
 *
 * The risk here is not the new state — it is the old ones. `bluestift-dark` is
 * written by the connected app AND the marketing site, is mirrored into a cookie
 * scoped to the parent domain, and is already sitting in real browsers holding
 * "1" or "0". A third state that fails to read those turns every existing
 * preference into a silent reset; a third state that WRITES something the old
 * readers cannot parse breaks whichever surface deploys second.
 *
 * So the vocabulary is additive: "1" and "0" keep their meanings, "system" is a
 * new word, and an ABSENT key means system rather than light.
 */

/**
 * A browser-ish env, stubbed rather than emulated — the suite runs on the
 * `node` environment (vitest.config), and the repo's other preference tests
 * (analytics-consent, training-consent) do the same. `readPref` reads the
 * cookie first and falls through to localStorage, so both have to exist.
 */
let store: Record<string, string> = {};

function setStored(value: string | null) {
  store = value == null ? {} : { [THEME_KEY]: value };
  vi.stubGlobal("document", { cookie: "" });
  vi.stubGlobal("window", {
    localStorage: {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => {
        store[k] = v;
      },
    },
    location: { protocol: "https:" },
  });
}

const stored = () => store[THEME_KEY] ?? null;

beforeEach(() => setStored(null));
afterEach(() => vi.unstubAllGlobals());

describe("preferences written before this module keep working", () => {
  it('reads the old "1" as dark', () => {
    setStored("1");
    expect(readThemeMode()).toBe("dark");
  });

  it('reads the old "0" as light', () => {
    setStored("0");
    expect(readThemeMode()).toBe("light");
  });

  it('writes the old vocabulary for the two explicit answers', () => {
    // The marketing site and the app deploy independently, and the value is
    // shared across origins by cookie. Writing anything but "1"/"0" for an
    // explicit choice would break whichever surface is running older code.
    writeThemeMode("dark");
    expect(stored()).toBe("1");
    writeThemeMode("light");
    expect(stored()).toBe("0");
  });

  it("round-trips the new third answer", () => {
    writeThemeMode("system");
    expect(stored()).toBe("system");
    expect(readThemeMode()).toBe("system");
  });
});

describe("an unanswered preference follows the device", () => {
  it("no stored value means system, not light", () => {
    // The change of default. "Nobody has said" is not "light" — a person who
    // never opened Settings and runs a dark phone was being handed a white
    // screen on the grounds that they had not asked for anything.
    expect(readThemeMode()).toBe("system");
  });

  it("an unrecognised value falls back to system rather than throwing", () => {
    setStored("wat");
    expect(readThemeMode()).toBe("system");
    expect(parseThemeMode("wat")).toBe("system");
    expect(parseThemeMode(null)).toBe("system");
  });
});

describe("resolution", () => {
  it("an explicit answer ignores the device", () => {
    expect(resolveDark("dark", false)).toBe(true);
    expect(resolveDark("dark", true)).toBe(true);
    expect(resolveDark("light", true)).toBe(false);
    expect(resolveDark("light", false)).toBe(false);
  });

  it("system defers to the device, in both directions", () => {
    expect(resolveDark("system", true)).toBe(true);
    expect(resolveDark("system", false)).toBe(false);
  });
});

describe("both dark hooks read through this module", () => {
  // The bug this prevents: each hook used to inline `readPref(KEY) === "1"`.
  // Leaving one of them on that check means the moment the other writes
  // "system", the first reads !== "1" and renders light — wrong exactly when
  // the device is dark.
  const app = readFileSync(join(process.cwd(), "components/ui/theme.tsx"), "utf8");
  const site = readFileSync(join(process.cwd(), "components/site/useThemeMode.ts"), "utf8");

  for (const [name, src] of [["app", app], ["site", site]] as const) {
    it(`${name}: does not compare the raw stored value itself`, () => {
      expect(src).not.toMatch(/readPref\([^)]*\)\s*===\s*"1"/);
    });

    it(`${name}: resolves through resolveDark`, () => {
      expect(src).toMatch(/resolveDark\(/);
    });

    it(`${name}: subscribes to the device preference`, () => {
      // On "system" the OS is the source of truth and it changes while the tab
      // is open — the automatic sunset switch being the ordinary case.
      expect(src).toMatch(/watchSystemTheme\(/);
    });
  }

  it("the app exposes the mode itself, not only the resolved boolean", () => {
    // A settings UI has to show "System" as its own choice, not as whichever of
    // light/dark it currently resolves to.
    expect(app).toMatch(/mode: ThemeMode/);
    expect(app).toMatch(/setMode/);
  });

  it("picking a side leaves system behind", () => {
    // The two-state switches still exist. Using one is an explicit choice, so
    // it must stop following the device rather than silently staying subscribed.
    expect(app).toMatch(/setDark\s*=\s*useCallback\(\(v: boolean\) => setMode\(v \? "dark" : "light"\)/);
  });
});
