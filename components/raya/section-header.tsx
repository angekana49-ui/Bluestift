"use client";

import { useAppTheme } from "@/components/ui/theme";
import { display } from "@/components/ui/tokens";
import { RayaText } from "@/components/ui/brand";

/** Themed page-section header (IBM Plex Sans display title + muted subtitle). */
export function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  const { theme: t } = useAppTheme();
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontSize: 23, fontWeight: 800, fontFamily: display, color: t.text }}>
        <RayaText>{title}</RayaText>
      </div>
      {subtitle && (
        <div style={{ fontSize: 15, color: t.muted, marginTop: 4 }}>
          <RayaText>{subtitle}</RayaText>
        </div>
      )}
    </div>
  );
}
