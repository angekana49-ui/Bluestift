"use client";

import type { Theme } from "./theme";
import { RayaName } from "@/components/ui/brand";
import { useTranslate } from "@/components/ui/locale";
import { SectionHeader, bandColumn, bandSection, bandTone, serifEm } from "./layout";

export default function DifferentiatorsSection({ theme: t }: { theme: Theme }) {
  const tr = useTranslate();
  const cross = (label: string, verdict: string) => (
    // The rows carry their own background because the band is tinted. Left
    // transparent they were an outline on near-identical tint, and the ✕ chip
    // (t.crossBg) all but vanished into it.
    <div style={{ display: "flex", alignItems: "center", gap: 14, background: t.cardBg, border: `1px solid ${t.cardBorder}`, borderRadius: 16, padding: "16px 20px" }}>
      <span style={{ width: 24, height: 24, borderRadius: "50%", background: t.crossBg, color: t.crossText, fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>✕</span>
      <span style={{ fontSize: 15, fontWeight: 600, color: t.labelMuted }}>{label}</span>
      <span style={{ fontSize: 14, color: t.crossText }}>— {verdict}</span>
    </div>
  );

  return (
    // Tint, not the card colour: this band follows the inverted Kernel, and
    // coming out of near-black onto pure white is a harder step than the page
    // needs. No SectionBlend either — nothing should fade out of an ink band.
    <section style={bandSection(bandTone(t, "tint").background)}>
      <div style={bandColumn("text")}>
        <SectionHeader
          t={t}
          align="split"
          title={
            <>
              {tr("site.diff.title.a")}{" "}
              <em style={serifEm}>{tr("site.diff.title.em")}</em>
            </>
          }
          /* The old line here was "the difference is the memory". That stopped
             being true: frontier models ship long context and cross-session
             memory as standard. The durable difference is who else can see the
             learning — so the comparison is now drawn on that axis. */
          lead={tr("site.diff.sub")}
        />

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {cross(tr("site.diff.general.label"), tr("site.diff.general.verdict"))}
          {cross(tr("site.diff.teacher.label"), tr("site.diff.teacher.verdict"))}
          {cross(tr("site.diff.fixed.label"), tr("site.diff.fixed.verdict"))}
          <div style={{ display: "flex", alignItems: "center", gap: 14, border: `1px solid ${t.diffRowBorder}`, background: t.diffRowBg, borderRadius: 16, padding: "16px 20px" }}>
            <span style={{ width: 24, height: 24, borderRadius: "50%", background: "#22c55e", color: "white", fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>✓</span>
            <span style={{ fontSize: 15, fontWeight: 600, color: t.diffStrong }}><RayaName /></span>
            <span style={{ fontSize: 14, color: t.diffSoft }}>— {tr("site.diff.raya.verdict")}</span>
          </div>
        </div>
      </div>
    </section>
  );
}
