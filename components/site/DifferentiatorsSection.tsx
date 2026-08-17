"use client";

import type { Theme } from "./theme";
import { RayaName } from "@/components/ui/brand";
import { useTranslate } from "@/components/ui/locale";
import { SectionBlend, bandColumn, bandSection, lead, sectionH2, serifEm } from "./layout";

export default function DifferentiatorsSection({ theme: t }: { theme: Theme }) {
  const tr = useTranslate();
  const cross = (label: string, verdict: string) => (
    <div style={{ display: "flex", alignItems: "center", gap: 14, border: `1px solid ${t.cardBorder}`, borderRadius: 16, padding: "16px 20px" }}>
      <span style={{ width: 24, height: 24, borderRadius: "50%", background: t.crossBg, color: t.crossText, fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>✕</span>
      <span style={{ fontSize: 15, fontWeight: 600, color: t.labelMuted }}>{label}</span>
      <span style={{ fontSize: 14, color: t.crossText }}>— {verdict}</span>
    </div>
  );

  return (
    <section style={bandSection(t.cardBg)}>
      <SectionBlend from={t.sectionAltBg} />
      <div style={bandColumn("text")}>
        <div style={{ textAlign: "center", marginBottom: 44 }}>
          <h2 style={sectionH2(t)}>
            {tr("site.diff.title.a")}{" "}
            <em style={serifEm}>{tr("site.diff.title.em")}</em>
          </h2>
          {/* The old line here was "the difference is the memory". That stopped
              being true: frontier models ship long context and cross-session
              memory as standard. The durable difference is who else can see the
              learning — so the comparison is now drawn on that axis. */}
          <p style={lead(t)}>{tr("site.diff.sub")}</p>
        </div>

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
