"use client";

import type { ChatScreenProps } from "@/components/raya/contracts";

/**
 * Raya chat — presentational screen. STUB: design the whole thing here.
 * Consumes ChatScreenProps only. No data fetching, no /api calls.
 *
 * Suggested breakdown (your call): conversation sidebar · message thread ·
 * composer (text + attach + voice) · analysis panel · recommendations banner.
 */
export function ChatScreen(props: ChatScreenProps) {
  return (
    <ScreenStub name="ChatScreen" propsInfo={`${props.messages.length} messages · ${props.conversations.length} conversations`} />
  );
}

// Temporary scaffolding placeholder — delete once you build the real UI.
function ScreenStub({ name, propsInfo }: { name: string; propsInfo: string }) {
  return (
    <div style={{ border: "1px dashed #556", borderRadius: 4, padding: 24, opacity: 0.7 }}>
      <strong>{name}</strong> — stub to design
      <div style={{ fontSize: 14, opacity: 0.6, marginTop: 4 }}>{propsInfo}</div>
    </div>
  );
}
