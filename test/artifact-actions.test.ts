import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * One overflow menu per row, not a cluster of buttons: row actions (assign,
 * send to school) live inside ArtifactMenu above archive/delete, the trigger
 * is a visible pill, and rows wrap on narrow screens.
 */

const read = (rel: string) => readFileSync(join(process.cwd(), rel), "utf8").split("\r\n").join("\n");

describe("the menu takes custom actions", () => {
  const menu = read("components/ui/artifact-menu.tsx");

  it("exposes an actions prop rendered above archive/delete", () => {
    expect(menu).toContain("export type ArtifactAction");
    expect(menu).toContain("actions = [],");
    expect(menu).toContain("actions?: ArtifactAction[];");
    expect(menu).toContain("...actions,");
  });

  it("the trigger is a visible pill, not bare dots", () => {
    expect(menu).toContain("1px solid ${t.cardBorder}");
    expect(menu).toContain("borderRadius: 999");
    expect(menu).toContain("onMouseEnter");
  });

  it("menu items can render disabled (the Sent state)", () => {
    const row = read("components/ui/row-menu.tsx");
    expect(row).toContain("disabled?: boolean;");
    expect(row).toContain("if (item.disabled) return;");
  });
});

describe("prepare rows consolidate into the menu", () => {
  const tab = read("components/school/prof-prepare.tsx");

  it("assign and send are menu items, not buttons", () => {
    expect(tab).toContain("actions={rowActions}");
    expect(tab).toContain('key: "assign"');
    expect(tab).toContain('key: "send"');
    expect(tab).not.toContain("<button style={ghost} onClick={() => setOpen((v) => !v)}>");
    expect(tab).not.toContain("<button style={ghost} disabled={sent} onClick={onSend}>");
  });

  it("send failures surface under the row", () => {
    expect(tab).toContain("sendError");
    expect(tab).toContain("void handleSend()");
  });
});

describe("report rows consolidate into the menu", () => {
  const ui = read("components/school-reports.tsx");

  it("send is a menu item, not a button", () => {
    expect(ui).toContain("actions={");
    expect(ui).toContain('key: "send"');
    expect(ui).not.toContain("<button style={ghost} disabled={sentIds.has(r.id)}");
  });
});

describe("rows wrap on narrow screens", () => {
  it("library, reports and shelf rows wrap with a flexible title", () => {
    for (const rel of [
      "components/school/prof-prepare.tsx",
      "components/school-reports.tsx",
      "components/school-library.tsx",
    ]) {
      const src = read(rel);
      expect(src).toContain('flexWrap: "wrap"');
      expect(src).toContain('flex: "1 1 170px"');
    }
  });
});
