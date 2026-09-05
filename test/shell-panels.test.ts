import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { RIGHT_PANEL_OVERLAY_QUERY } from "@/components/ui/use-right-panel";

/**
 * The shell's two drawers, and the one number they share with the stylesheet.
 *
 * Both bugs fixed here were the same shape: a control that performs half of its
 * own gesture. The burger opened the sidebar and could not close it (only the
 * scrim could), and the right panel opened itself on load and left the person to
 * find the way out. Neither shows up in a type check — both routes compile,
 * render, and do something.
 */

const css = readFileSync(join(process.cwd(), "app/globals.css"), "utf8");
const shellSrc = readFileSync(join(process.cwd(), "components/ui/shell.tsx"), "utf8");
const raya = readFileSync(join(process.cwd(), "components/raya/raya-shell.tsx"), "utf8");
const schools = readFileSync(join(process.cwd(), "components/school/schools-shell.tsx"), "utf8");

describe("the mobile header's buttons toggle", () => {
  it("does not wire the burger to a one-way open", () => {
    // `setNavOpen(true)` is the bug: tapping the burger again re-set the same
    // value, so the drawer could only be dismissed by the scrim.
    for (const src of [raya, schools]) {
      expect(src).not.toMatch(/onOpenLeft=\{\(\)\s*=>\s*setNavOpen\(true\)\}/);
      expect(src).toMatch(/onOpenLeft=\{\(\)\s*=>\s*setNavOpen\(\(o\)\s*=>\s*!o\)\}/);
    }
  });

  it("tells the button which way it goes", () => {
    expect(shellSrc).toMatch(/tr\(leftOpen \? "shell\.closeMenu" : "shell\.openMenu"\)/);
    expect(shellSrc).toMatch(/tr\(rightOpen \? "shell\.closePanel" : "shell\.openPanel"\)/);
    for (const src of [raya, schools]) expect(src).toMatch(/leftOpen=\{navOpen\}/);
  });

  it("has the close labels it now asks for, in every locale", () => {
    for (const loc of ["en", "fr", "es", "de"]) {
      const cat = readFileSync(join(process.cwd(), `lib/i18n/${loc}.ts`), "utf8");
      expect(cat, loc).toMatch(/"shell\.closePanel":/);
    }
  });
});

describe("the right panel does not open itself over a phone", () => {
  const consumers = [
    "components/chat.tsx",
    "components/room-view.tsx",
    "components/school/school-raya-chat.tsx",
    "components/school/schools-shell.tsx",
  ];

  it("routes every screen through the shared hook", () => {
    for (const path of consumers) {
      const src = readFileSync(join(process.cwd(), path), "utf8");
      expect(src, path).toMatch(/useRightPanel\(\)/);
      // The old default, in any of its spellings.
      expect(src, path).not.toMatch(/const \[(rightOpen|panelOpen), set\w+\] = useState\(true\)/);
    }
  });

  it("keeps the JS overlay query identical to the stylesheet's", () => {
    /*
     * This is the whole reason the constant is exported. The hook decides
     * whether to open the panel by asking matchMedia the query below; the
     * stylesheet decides whether the panel is a column or an overlay with its
     * own copy. If the two drift, the panel opens itself underneath its own
     * scrim on exactly the sizes nobody tests.
     */
    const normalise = (s: string) => s.replace(/\s+/g, " ").trim();
    const atRule = css.match(/@media \(max-width: 899px\), \(max-width: 1366px\) and \(pointer: coarse\)/);
    expect(atRule, "the .app-right overlay media query moved or changed").not.toBeNull();
    expect(normalise(RIGHT_PANEL_OVERLAY_QUERY)).toBe(
      normalise(atRule![0].replace("@media ", "")),
    );
  });

  it("fails closed when the viewport cannot be read", () => {
    // Server render, or a browser without matchMedia: treat it as the overlay
    // case. Opening a panel that turns out to cover the screen is the failure
    // worth avoiding; a desktop panel arriving a frame late is not.
    const hook = readFileSync(join(process.cwd(), "components/ui/use-right-panel.ts"), "utf8");
    expect(hook).toMatch(/typeof window === "undefined"[\s\S]{0,90}return true/);
    expect(hook).toMatch(/useState\(false\)/);
  });
});

describe("the room's chrome and composer", () => {
  const room = readFileSync(join(process.cwd(), "components/room-view.tsx"), "utf8");
  const group = readFileSync(join(process.cwd(), "components/rooms/room-group-chat.tsx"), "utf8");
  const composer = readFileSync(join(process.cwd(), "components/chat/chat-composer.tsx"), "utf8");

  it("keeps the countdown visible when the header is folded", () => {
    // A timed room turns read-only when it runs out; collapsing the header must
    // not take the one self-changing fact on it away.
    expect(room).toMatch(/const timerBadge =/);
    const collapsed = room.slice(room.indexOf("Collapsed: the name, the clock"));
    expect(collapsed.slice(0, 1200)).toMatch(/\{timerBadge\}/);
  });

  it("leaves the channel tabs reachable in both header states", () => {
    // The tabs sit outside the chromeOpen branch — folding the header must not
    // cost the ability to move between channels.
    const tabsAt = room.indexOf('className="room-tabs"');
    const branchEnd = room.indexOf("{joined && (", room.indexOf("Collapsed: the name, the clock"));
    expect(tabsAt).toBeGreaterThan(branchEnd);
  });

  it("stacks only the room's composer, not every surface", () => {
    // `\r?` because this repo checks out CRLF on Windows.
    expect(group).toMatch(/\r?\n\s*stacked\s*\r?\n/);
    // The shared default stays one row for the solo and Schools chats.
    expect(composer).toMatch(/stacked = false/);
  });

  it("gives the stacked box a focus ring, since the field gave up its own", () => {
    expect(composer).toMatch(/className="chat-composer-box"/);
    expect(css).toMatch(/\.chat-composer-box:focus-within\s*\{[^}]*border-color/);
  });
});
