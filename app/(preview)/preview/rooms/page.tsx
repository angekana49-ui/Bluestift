"use client";

import { RoomScreen } from "@/components/rooms/room-screen";
import { roomMock } from "@/components/rooms/mocks";

const noop = () => {};

export default function RoomsPreview() {
  return (
    <main style={{ padding: 24 }}>
      <RoomScreen
        {...roomMock}
        onJoin={noop}
        onSendGroup={noop}
        onSendPrivate={noop}
        onAskRaya={noop}
        onUpload={noop}
        onGenerateReport={noop}
      />
    </main>
  );
}
