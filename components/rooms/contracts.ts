/**
 * Rooms — prop contract. Seam between the container (`components/room-view.tsx`,
 * keeps Realtime + server actions) and your presentational screen.
 *
 * Shapes mirror what `app/rooms/[id]/page.tsx` fetches. 5 channels:
 * group · raya (private) · challenges · files · report.
 */
import type { RoomFileRow, PrivateFileRow } from "@/components/room-view";

export type RoomMsg = {
  id: string;
  user_id: string | null;
  role: string;
  content: string | null;
  has_media?: boolean;
};
export type PrivMsg = { id: string; role: string; content: string | null };
export type RoomReport = {
  id: string;
  summary: string | null;
  key_learnings: string | null;
  highlights: unknown;
  recommendations: string | null;
  squad_score: number | null;
  created_at: string;
} | null;

export type RoomScreenProps = {
  // ── data in ──────────────────────────────────────────────
  roomId: string;
  roomName: string;
  subject: string | null;
  visibility: string; // 'public' | 'private'
  isMember: boolean;
  memberCount: number;
  myUserId: string;
  messages: RoomMsg[];
  roomFiles: RoomFileRow[];
  privateConvId: string | null;
  privateMessages: PrivMsg[];
  privateFiles: PrivateFileRow[];
  report: RoomReport;
  // ── actions out ──────────────────────────────────────────
  onJoin: () => void;
  onSendGroup: (text: string) => void;
  onSendPrivate: (text: string) => void;
  onAskRaya: (text: string) => void;
  onUpload: (file: File) => void;
  onGenerateReport: () => void;
};
