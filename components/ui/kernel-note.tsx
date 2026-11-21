"use client";

import { IconAlert } from "@/components/ui/icons";
import { useTranslate } from "@/components/ui/locale";
import { status } from "@/components/ui/tokens";

/**
 * Honesty line under every surface that shows Kernel figures: mastery, risk
 * and mindset numbers are estimates, not exact measures. Red with a warning
 * triangle, so it reads as a caution even when skimmed. Graphs get the
 * stronger "indicative" wording.
 */
export function KernelDataNote({ graph = false }: { graph?: boolean }) {
  const tr = useTranslate();
  return (
    <p
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 6,
        margin: "0.65rem 0 0",
        color: status.danger,
        fontSize: "0.8rem",
        lineHeight: 1.55,
      }}
    >
      <span style={{ display: "inline-flex", flex: "none", marginTop: 2 }}>
        <IconAlert size={14} />
      </span>
      <span>{tr(graph ? "kernel.dataNote.graph" : "kernel.dataNote.figures")}</span>
    </p>
  );
}
