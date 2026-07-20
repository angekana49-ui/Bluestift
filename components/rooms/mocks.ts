import type { RoomScreenProps } from "@/components/rooms/contracts";

/** Mock data (no callbacks) for building RoomScreen in isolation at /preview/rooms. */
export const roomMock: Omit<
  RoomScreenProps,
  "onJoin" | "onSendGroup" | "onSendPrivate" | "onAskRaya" | "onUpload" | "onGenerateReport"
> = {
  roomId: "r1",
  roomName: "Révisions Brevet — Maths",
  subject: "Mathématiques",
  visibility: "public",
  isMember: true,
  memberCount: 4,
  myUserId: "u1",
  messages: [
    { id: "m1", user_id: "u2", role: "user", content: "Quelqu'un a compris l'exo 3 ?" },
    { id: "m2", user_id: "u1", role: "user", content: "Oui je t'explique" },
  ],
  roomFiles: [],
  privateConvId: "pc1",
  privateMessages: [{ id: "p1", role: "assistant", content: "On reprend où tu bloques ?" }],
  privateFiles: [],
  report: null,
};
