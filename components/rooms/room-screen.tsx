"use client";

import type { RoomScreenProps } from "@/components/rooms/contracts";

/**
 * Rooms — presentational screen. STUB: design it here. Props only, no fetch.
 *
 * Suggested breakdown: member bandeau (presence/avatars) · channel tabs
 * (group · raya · challenges · files · report) · the active channel pane.
 * Not-a-member state shows the join screen.
 */
export function RoomScreen(props: RoomScreenProps) {
  return (
    <div style={{ border: "1px dashed #556", borderRadius: 4, padding: 24, opacity: 0.7 }}>
      <strong>RoomScreen</strong> — stub to design
      <div style={{ fontSize: 12, opacity: 0.6, marginTop: 4 }}>
        {props.roomName} · {props.memberCount} membres · {props.isMember ? "membre" : "non-membre"}
      </div>
    </div>
  );
}
