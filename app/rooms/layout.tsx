import type { Metadata } from "next";

/**
 * A layout rather than page-level metadata, because `/rooms/[id]` is a separate
 * route: a title on app/rooms/page.tsx would cover the list and leave every
 * actual room falling back to the bare product name — the tab you have open
 * longest being the one that names itself worst.
 *
 * Rooms is a surface of Raya, not a product of its own (app/chat/layout.tsx has
 * the install identity; this has only a name). `absolute` because the root
 * template appends "· Bluestift", which names the landing site rather than the
 * ecosystem this belongs to.
 *
 * A room's own name would be better on `/rooms/[id]`, and it is deliberately
 * not done here: it needs a `generateMetadata` that reads the room, and a room
 * title is user-supplied content on a page reachable by unguessable-URL invite
 * — worth designing rather than slipping in beside a rename.
 */
export const metadata: Metadata = { title: { absolute: "Rooms · Raya" } };

export default function RoomsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
