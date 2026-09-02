import { describe, expect, it } from "vitest";
import { readFileSync, globSync } from "node:fs";
import { join } from "node:path";

/**
 * Whoever mounts an app shell must mount the theme context above it.
 *
 * The crash this encodes, in the shape it actually took:
 *
 *   useAppTheme must be used within an AppThemeProvider
 *     at SettingsSheet (components/ui/settings-sheet.tsx)
 *     at RayaShell (components/raya/raya-shell.tsx)
 *     at Chat (components/chat.tsx)
 *
 * Every screen in the app threads `theme` down as a PROP, so for a long time
 * nothing inside a shell read the context and two of the three shell mount
 * points got away with never providing it. Then Settings arrived. It cannot
 * take a palette prop like everything else, because it does not just READ the
 * theme — it sets it, and `setMode` only exists on the context value.
 *
 * So the requirement moved: `<RayaShell>` now implies a provider above it. The
 * two routes that had been rendering the shell bare — /chat and /rooms/[id],
 * between them the most-used screens in the product — threw the moment anyone
 * opened Settings. Neither is covered by a type: the shell takes `theme` as a
 * prop and got one, and the missing piece was three levels down at runtime.
 *
 * Hence a test rather than a type. It is a grep, and a grep is a blunt tool,
 * but the invariant it guards is exactly as blunt: the provider is either in
 * the file or it is not.
 */

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

/** Files that render a shell, i.e. that put <SettingsSheet/> on the screen. */
const SHELLS = /<(RayaShell|SchoolsShell|SchoolChrome)\b/;

const SOURCES = globSync("components/**/*.tsx", { cwd: process.cwd() })
  .map((p) => p.replace(/\\/g, "/"))
  // The shells' own definitions render SettingsSheet but do not mount
  // themselves; the requirement lands on their callers.
  .filter((p) => !/(raya-shell|schools-shell)\.tsx$/.test(p));

describe("the shells' theme context", () => {
  it("every file that renders a shell also mounts AppThemeProvider", () => {
    const offenders: string[] = [];
    for (const p of SOURCES) {
      const src = read(p);
      if (SHELLS.test(src) && !/AppThemeProvider/.test(src)) offenders.push(p);
    }
    expect(offenders).toEqual([]);
  });

  it("all three mount points are actually found — the test is not vacuous", () => {
    // A regex that matches nothing passes the test above forever. Pin the
    // known call sites so a rename of the shell is a failure here rather than
    // a silent loss of coverage.
    const found = SOURCES.filter((p) => SHELLS.test(read(p))).sort();
    expect(found).toEqual([
      "components/chat.tsx",
      "components/raya/raya-scaffold.tsx",
      "components/room-view.tsx",
      "components/school-admin.tsx",
    ]);
  });

  it("the provider sits ABOVE the shell, not beside it", () => {
    // Wrapping in place is not possible here: the component that renders the
    // shell is outside its own provider. Both routes therefore split a body
    // component out, which is the only arrangement that works — and the one
    // that also makes a theme change in Settings re-render what is behind it.
    for (const [p, body] of [
      ["components/chat.tsx", "ChatBody"],
      ["components/room-view.tsx", "RoomViewBody"],
    ] as const) {
      const src = read(p);
      expect(src, p).toMatch(new RegExp(`<AppThemeProvider[\\s\\S]{0,200}<${body}`));
      // And the body reads the context back rather than opening a second,
      // private useDarkMode instance that would drift from the sheet's.
      expect(src, p).toMatch(/const \{ theme: t \} = useAppTheme\(\)/);
    }
  });

  it("nothing inside a shell opens its OWN useDarkMode instance", () => {
    /**
     * A second instance is not a crash, which is what makes it worse than one:
     * the toggle works, half the surface updates, and it reads as flaky CSS.
     *
     * Found by writing this test — `RoomChallenges` and `RoomFiles` each held a
     * private instance, so switching the theme in Settings while inside a room
     * left the challenges and files panels on the old palette until a reload,
     * with the conversation beside them already switched.
     */
    const callers = SOURCES.filter((p) => /useDarkMode\(\)/.test(read(p))).sort();
    expect(callers).toEqual([
      "components/chat.tsx",
      // The design-handoff preview at /preview, which is standalone by design
      // and mounts no shell.
      "components/raya/raya-app.tsx",
      "components/raya/raya-scaffold.tsx",
      "components/room-view.tsx",
      "components/school-admin.tsx",
      // Where it is defined, and where useResolvedTheme falls back to it for
      // the surfaces that legitimately render outside any shell (login,
      // onboarding, the public site).
      "components/ui/theme.tsx",
    ]);
  });
});
