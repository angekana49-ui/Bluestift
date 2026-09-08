"use client";

import { useEffect, useState } from "react";
import type {
  ConceptStateOut,
  KCStatus,
  LoadProfileResponse,
} from "@/lib/kernel/types";
import { useAppTheme } from "@/components/ui/theme";
import { getJsonCached } from "@/lib/net/client-fetch";
import { MasteryGauge } from "@/components/ui/widgets";
import { panelCard } from "@/components/ui/forms";
import type { AppTheme } from "@/components/ui/tokens";
import { RayaName } from "@/components/ui/brand";
import { useTranslate } from "@/components/ui/locale";
import type { MessageKey } from "@/lib/i18n";

const STATUS: Record<KCStatus, { labelKey: MessageKey; color: string }> = {
  mastered: { labelKey: "kernel.status.mastered", color: "#22c55e" },
  partial: { labelKey: "kernel.status.partial", color: "#f59e0b" },
  gap: { labelKey: "kernel.status.gap", color: "#ef4444" },
  unknown: { labelKey: "kernel.status.unknown", color: "#94a3b8" },
};

function pct(v: number): string {
  return `${Math.round(Math.max(0, Math.min(1, v)) * 100)}%`;
}

function Bar({ theme: t, label, value, color }: { theme: AppTheme; label: string; value: number; color: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
      <span style={{ width: 118, color: t.muted }}>{label}</span>
      <div style={{ flex: 1, height: 8, background: t.gaugeTrack, borderRadius: 99, overflow: "hidden" }}>
        <div style={{ width: pct(value), height: "100%", background: color }} />
      </div>
      <span style={{ width: 40, textAlign: "right", color: t.muted }}>{pct(value)}</span>
    </div>
  );
}

function ConceptCard({ theme: t, c }: { theme: AppTheme; c: ConceptStateOut }) {
  const tr = useTranslate();
  const st = STATUS[c.status] ?? STATUS.unknown;
  return (
    <div style={{ ...panelCard(t) }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <strong style={{ flex: 1, color: t.text, fontSize: 15 }}>{c.label || c.concept_id}</strong>
        <span style={{ background: st.color, color: "#0b1020", borderRadius: 999, padding: "2px 10px", fontSize: 13, fontWeight: 600 }}>
          {tr(st.labelKey)}
        </span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
        <Bar theme={t} label={tr("kernel.bar.knowledge")} value={c.k_effective} color="#2f7fe0" />
        <Bar theme={t} label={tr("kernel.bar.retention")} value={c.v_score} color="#8b5cf6" />
        <Bar theme={t} label={tr("kernel.bar.application")} value={c.p_score} color="#06b6d4" />
      </div>
      {c.last_interaction_at && (
        <p style={{ color: t.mutedLight, fontSize: 13, margin: "12px 0 0" }}>
          {tr("kernel.lastPracticed")} {new Date(c.last_interaction_at).toLocaleDateString()}
        </p>
      )}
    </div>
  );
}

export function CognitiveProfile() {
  const { theme: t } = useAppTheme();
  const tr = useTranslate();
  const [profile, setProfile] = useState<LoadProfileResponse | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Cached first: reopening My Kernel renders the last known profile
      // instantly instead of the loading line on every visit.
      const { data } = await getJsonCached<LoadProfileResponse>("/api/kernel/profile", {
        cacheKey: "kernel:profile",
        onUpdate: (fresh) => {
          if (!cancelled) {
            setProfile(fresh);
            setState("ready");
          }
        },
      });
      if (cancelled) return;
      if (!data) {
        setState("error");
        return;
      }
      setProfile(data);
      setState("ready");
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (state === "loading") {
    return <p style={{ color: t.muted, fontSize: 15 }}>{tr("kernel.loading")}</p>;
  }

  if (state === "error") {
    return (
      <div style={panelCard(t)}>
        <p style={{ margin: 0, color: t.text, fontSize: 15 }}>
          {tr("kernel.profileErrorA")} <RayaName />
          {tr("kernel.profileErrorB")}
        </p>
      </div>
    );
  }

  const concepts = profile?.concept_states ?? [];
  const mindset = profile?.mindset ?? null;
  const globalMastery =
    concepts.length > 0
      ? concepts.reduce((s, c) => s + Math.max(0, Math.min(1, c.k_effective)), 0) / concepts.length
      : null;

  return (
    <div>
      {globalMastery != null && (
        /* auto-fit/minmax, not a fixed "260px 1fr" — a hard 260px track can't
           shrink below itself, so on any small phone (< ~500px available,
           i.e. anything from an iPhone SE up) this row would overflow the
           page frame instead of stacking. Same pattern already used for
           the same reason in tools.tsx, prof-overview.tsx, school-admin.tsx
           and school-billing.tsx. */
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16, marginBottom: 16 }}>
          <div style={panelCard(t)}>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 10, color: t.text }}>{tr("kernel.overallMastery")}</div>
            <MasteryGauge theme={t} valueLabel={pct(globalMastery)} caption={tr("kernel.allConcepts")} dashoffset={188 * (1 - globalMastery)} />
          </div>
          {mindset && (
            <div style={panelCard(t)}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <strong style={{ flex: 1, color: t.text, fontSize: 15 }}>{tr("kernel.mindsetLabel")}</strong>
                <span style={{ color: t.muted, textTransform: "capitalize", fontSize: 14 }}>{mindset.detected_mindset || "—"}</span>
              </div>
              <Bar theme={t} label={tr("kernel.growthLabel")} value={mindset.m_score} color="#22c55e" />
            </div>
          )}
        </div>
      )}

      {concepts.length === 0 ? (
        <div style={panelCard(t)}>
          <p style={{ margin: 0, color: t.text, fontSize: 15 }}>
            {tr("kernel.noConceptsA")} <RayaName /> {tr("kernel.noConceptsB")}
          </p>
        </div>
      ) : (
        concepts.map((c) => <ConceptCard key={c.concept_id} theme={t} c={c} />)
      )}

      {profile?.last_kernel_update && (
        <p style={{ color: t.mutedLight, fontSize: 13 }}>
          {tr("kernel.updatedOn")} {new Date(profile.last_kernel_update).toLocaleString()}
        </p>
      )}
    </div>
  );
}
