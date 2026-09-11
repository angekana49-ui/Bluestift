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
    const tabsAt = room.indexOf("{CHANNELS.map(");
    const branchEnd = room.indexOf("{joined && (", room.indexOf("Collapsed: the name, the clock"));
    expect(tabsAt).toBeGreaterThan(branchEnd);
  });

  it("keeps one header on a phone, with nothing on the folded one lost", () => {
    // The chrome goes at the phone tier (stylesheet, not a JS branch: the
    // viewport is not knowable while rendering on the server)…
    expect(room).toMatch(/className="room-chrome"/);
    expect(css).toMatch(/@media \(max-width: 899px\) \{\s*\.room-chrome \{\s*display: none/);
    // …so the name and the clock move up into the shell's own header…
    expect(room).toMatch(/mobileTitle=\{roomName\}/);
    expect(room).toMatch(/mobileTrailing=\{timerPill\(true\)\}/);
    // …and the channels — the one thing with no other home — into the panel.
    expect(room).toMatch(/className="app-only-phone"/);
    expect(css).toMatch(/\.app-only-phone \{\s*display: none/);
    // Both switchers read one list, so a sixth channel cannot reach only one.
    expect(room.match(/CHANNELS\.map\(/g)?.length ?? 0).toBe(2);
  });

  it("folds a study player's header actions behind one control on a phone", () => {
    const player = readFileSync(join(process.cwd(), "components/study/focus-player.tsx"), "utf8");
    // Reset + TXT + PDF + Link are all `flex: none`: at 375px they took the
    // whole row and the document's own name was rendering under the Reset pill.
    expect(player).toMatch(/className="focus-more"/);
    expect(player).toMatch(/"focus-actions is-open"/);
    // Both display states belong to the stylesheet. An inline `display` on the
    // toggle outranks the class and leaves a ⋯ on every desktop, next to the
    // very actions it exists to replace — which is what happened first.
    expect(player).not.toMatch(/const headerBtn: React\.CSSProperties = \{\s*\r?\n\s*display:/);
    expect(css).toMatch(/\.focus-more \{\s*display: none/);
    expect(css).toMatch(/@media \(max-width: 640px\) \{[\s\S]*?\.focus-more \{\s*display: flex/);
  });

  it("pushes the invite link while the room has one member", () => {
    const invite = readFileSync(join(process.cwd(), "components/rooms/room-invite.tsx"), "utf8");
    // Every room is private by default, so the link is the only door into it.
    // It is shown until somebody walks through, not parked in a settings list.
    expect(room).toMatch(/memberTotal <= 1 && \(/);
    expect(room).toMatch(/<RoomInviteBanner/);
    expect(room).toMatch(/<RoomInvitePanelBlock/);
    // The platform's own share sheet first — that is what opens WhatsApp or
    // Messages with the link already in it — and the clipboard when there is
    // none. Both paths, or a phone gets a "copied" it cannot paste anywhere.
    expect(invite).toMatch(/navigator\.share/);
    expect(invite).toMatch(/navigator\.clipboard\.writeText/);
    // The link field is focused to be copied from, and iOS Safari zooms the
    // page in on any focused field under 16px.
    expect(invite).toMatch(/fontSize: 16/);
  });

  it("lets a generated report use the whole phone screen", () => {
    // The cap used to be an inline `maxHeight: 52vh`, which no stylesheet can
    // take back — a report read through a half-screen letterbox with its own
    // scrollbar, inside a page that already scrolls.
    expect(room).toMatch(/className="room-report-box"/);
    expect(room).not.toMatch(/maxHeight: "52vh"/);
    expect(css).toMatch(/\.room-report-box \{[\s\S]*?max-height: 52vh/);
    expect(css).toMatch(/@media \(max-width: 899px\) \{\s*\.room-report-box \{[\s\S]*?max-height: none/);
  });

  it("pins the room's composer to two tiers at every width", () => {
    // `\r?` because this repo checks out CRLF on Windows.
    expect(group).toMatch(/\r?\n\s*stacked\s*\r?\n/);
    // Everywhere else the flag is off, which now means "two tiers below the
    // desktop tier, one row above it" rather than "one row always".
    expect(composer).toMatch(/stacked = false/);
  });

  it("gives every surface the two-tier composer on a small screen", () => {
    // The shape is the stylesheet's call, not the component's: one markup tree
    // is rendered at all widths and flattened back to a row from 900px up. A JS
    // breakpoint here would paint the desktop row on a phone for a frame.
    expect(composer).not.toMatch(/if \(stacked\) \{/);
    expect(composer).toMatch(/className="chat-composer-actions"/);
    const wide = /@media \(min-width: 900px\) \{([\s\S]*?)\n\}/.exec(
      css.slice(css.indexOf(".chat-composer {")),
    )?.[1] ?? "";
    // The flattened row is what the wide tier opts into, and `is-stacked` opts
    // back out of it — so the default below 900px is the two-tier box.
    expect(wide).toMatch(/\.chat-composer:not\(\.is-stacked\) \.chat-composer-box \{/);
    expect(wide).toMatch(/flex-direction: row/);
  });

  it("gives the stacked box a focus ring, since the field gave up its own", () => {
    expect(composer).toMatch(/className="chat-composer-box"/);
    expect(css).toMatch(/\.chat-composer-box:focus-within\s*\{[^}]*border-color/);
  });
});
