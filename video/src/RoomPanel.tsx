import type { CSSProperties } from "react";
import { Img } from "remotion";
import { RoomShot } from "@/components/site/ProductShots";
import { RAYA_FONT } from "@/components/ui/brand";
import type { Theme } from "@/components/site/theme";
import { FONTS } from "./brand";
import { MARKS } from "./generated/marks";

/**
 * The Study Room with its right panel open — the column components/room-view.tsx
 * renders beside the thread (`RightPanel`, wide width 348): notifications,
 * shared documents, the roster with presence, and the room's settings.
 *
 * The site's RoomShot is the thread alone, and the landing keeps it that way;
 * the film wanted what a room holds besides its conversation. The panel is
 * drawn next to the shot, not inside it, so the shot keeps its own width — and
 * every point scripts/measure.mjs took on it stays true.
 *
 * Scale: the shot draws the app about 1.8× (a 16px bubble is 29px here). The
 * panel is drawn at 1.25×, a step smaller, as the app's panel type is next to
 * its thread. Even so the whole column is taller than the room, so it is shown
 * scrolled to its first section after Invite — the state of a room that already
 * has five members in it.
 */

const K = 1.25;
const px = (n: number) => Math.round(n * K * 100) / 100;

/** The shot's own size (4:3 at 1300), and the panel beside it. */
export const ROOM_SHOT = { w: 1300, h: 975 };
export const ROOM_PANEL = { w: Math.round(348 * K) };

// The app's light tokens (components/ui/tokens.ts).
const A = {
  rightBg: "#f4f6f9",
  rightBorder: "rgba(15,23,42,0.14)",
  rowActive: "#e3eaf5",
  text: "#0b1220",
  muted: "#44546a",
  mutedLight: "#58687d",
  indigo: "#6366f1",
  green: "#22c55e",
  offline: "#cbd5e1",
};

/** The room clock the shot's pill shows at `ms` (ProductShots ROOM_CLOCK, one reading a second from 140ms). */
const CLOCK = ["24:31", "24:30", "24:29", "24:28", "24:27", "24:26"];
export const roomClockAt = (ms: number) => CLOCK[Math.max(0, Math.min(CLOCK.length - 1, Math.floor((ms - 140) / 1000)))];

// The shot's roster (ProductShots ROOM_MEMBERS), in the order the panel lists it.
const MEMBERS = [
  { initials: "AS", name: "Amira S.", bg: "#4f46e5", online: true },
  { initials: "LD", name: "Léa D.", bg: "#0ea5e9", online: true },
  { initials: "NK", name: "Noah K.", bg: "#10b981", online: true },
  { initials: "YO", name: "You", bg: "#f97316", online: true },
  { initials: "TB", name: "Tomás B.", bg: "#8b5cf6", online: false },
];
const DOCUMENTS = ["Chapter 6 — The unit circle.pdf", "Trig identities — cheat sheet.pdf"];

/** Section offsets inside the panel, from its top edge, for aiming the camera. */
export const ROOM_PANEL_AT = { members: { x: Math.round(348 * K) / 2, y: 672 } };

const sectionTitle: CSSProperties = {
  fontSize: px(14),
  fontWeight: 700,
  letterSpacing: px(0.3),
  textTransform: "uppercase",
  color: A.mutedLight,
  margin: `0 0 ${px(8)}px`,
};

const dot = (on: boolean): CSSProperties => ({ width: px(8), height: px(8), borderRadius: "50%", flex: "none", background: on ? A.green : A.offline });

function Avatar({ initials, bg, raya }: { initials?: string; bg?: string; raya?: boolean }) {
  const size = px(26);
  return raya ? (
    <span style={{ width: size, height: size, borderRadius: "50%", background: "#ffffff", border: `1px solid rgba(15,23,42,0.12)`, display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
      <Img src={MARKS["raya-mark.png"]} style={{ width: size * 0.72, height: size * 0.72 }} />
    </span>
  ) : (
    <span style={{ width: size, height: size, borderRadius: "50%", background: bg, color: "#fff", fontSize: px(10.5), fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
      {initials}
    </span>
  );
}

export function RoomPanel({ ms }: { ms: number }) {
  const clock = roomClockAt(ms);
  const online = MEMBERS.filter((m) => m.online).length;
  const notifications = [
    { title: "Session in progress", detail: `${clock} left.` },
    { title: `${online} members online`, detail: `${MEMBERS.length} in this room.` },
    { title: `${DOCUMENTS.length} documents shared`, detail: "Open the Documents section to review them." },
  ];

  return (
    <div
      style={{
        width: ROOM_PANEL.w,
        height: ROOM_SHOT.h,
        flex: "none",
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        background: A.rightBg,
        borderLeft: `1px solid ${A.rightBorder}`,
        color: A.text,
      }}
    >
      <div style={{ flex: "none", display: "flex", alignItems: "center", gap: px(8), padding: `${px(12)}px ${px(16)}px`, minHeight: px(56), boxSizing: "border-box", borderBottom: `1px solid ${A.rightBorder}` }}>
        <span style={{ flex: 1, minWidth: 0, fontFamily: FONTS.display, fontSize: px(15), fontWeight: 700 }}>Trigonometry</span>
        {/* The collapse button's icon: the panel's edge and an arrow out of it. */}
        <svg width={px(20)} height={px(20)} viewBox="0 0 20 20" fill="none" stroke={A.muted} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
          <rect x="2.5" y="3.5" width="15" height="13" rx="2.5" />
          <path d="M12.5 3.5v13M6.5 8l2 2-2 2" />
        </svg>
      </div>

      <div style={{ flex: 1, minHeight: 0, padding: px(18), display: "flex", flexDirection: "column", gap: px(18) }}>
        <div>
          <div style={sectionTitle}>Notifications</div>
          {notifications.map((n) => (
            <div key={n.title} style={{ background: A.rowActive, borderRadius: px(10), padding: `${px(9)}px ${px(11)}px`, marginBottom: px(6) }}>
              <div style={{ fontSize: px(15), fontWeight: 600, display: "flex", alignItems: "center", gap: px(6) }}>
                <span style={{ width: px(7), height: px(7), borderRadius: "50%", flex: "none", background: A.indigo }} />
                {n.title}
              </div>
              <div style={{ fontSize: px(14), color: A.muted, marginTop: px(2) }}>{n.detail}</div>
            </div>
          ))}
        </div>

        <div>
          <div style={sectionTitle}>Documents</div>
          {DOCUMENTS.map((d) => (
            <div key={d} style={{ display: "flex", alignItems: "center", gap: px(8), padding: `${px(7)}px ${px(8)}px`, borderRadius: px(9) }}>
              <span style={{ fontSize: px(17), flex: "none" }}>📄</span>
              <span style={{ minWidth: 0, flex: 1, fontSize: px(14), fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{d}</span>
            </div>
          ))}
        </div>

        <div>
          <div style={sectionTitle}>Members</div>
          <div style={{ display: "flex", alignItems: "center", gap: px(8), padding: `${px(5)}px ${px(2)}px` }}>
            <Avatar raya />
            <span translate="no" style={{ flex: 1, minWidth: 0, fontFamily: RAYA_FONT, fontSize: px(15), fontWeight: 700 }}>Raya</span>
            <span style={dot(true)} />
          </div>
          {MEMBERS.map((m) => (
            <div key={m.name} style={{ display: "flex", alignItems: "center", gap: px(8), padding: `${px(5)}px ${px(2)}px` }}>
              <Avatar initials={m.initials} bg={m.bg} />
              <span style={{ flex: 1, minWidth: 0, fontSize: px(15), whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.name}</span>
              <span style={dot(m.online)} />
            </div>
          ))}
        </div>

        <div>
          <div style={sectionTitle}>Room settings</div>
          <div style={{ fontSize: px(15), display: "flex", flexDirection: "column", gap: px(6) }}>
            <div><span style={{ color: A.muted }}>Subject · </span>Mathematics</div>
            <div><span style={{ color: A.muted }}>Visibility · </span>Private</div>
            <div><span style={{ color: A.muted }}>Session · </span>{clock} left</div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** The room as the film shows it: the site's thread, and the panel beside it. */
export function RoomWithPanel({ theme, ms }: { theme: Theme; ms: number }) {
  return (
    <div style={{ display: "flex", alignItems: "stretch" }}>
      <div style={{ width: ROOM_SHOT.w, flex: "none" }}>
        <RoomShot theme={theme} />
      </div>
      <RoomPanel ms={ms} />
    </div>
  );
}
