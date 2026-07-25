"use client";

import { useState } from "react";
import { useDarkMode, ThemeToggle } from "@/components/ui/theme";
import {
  AppShell,
  Sidebar,
  SidebarBrand,
  SidebarProfile,
  NavItem,
  MainCard,
  RightPanel,
  IconButton,
} from "@/components/ui/shell";
import { KpiTile, MasteryGauge, ProgressBar } from "@/components/ui/widgets";
import {
  IconOverview,
  IconClasses,
  IconKernel,
  IconSettings,
  IconPanel,
} from "@/components/ui/icons";
import { SettingsCard, Field, ToggleRow } from "@/components/raya/raya-app";
import { status, display, type AppTheme } from "@/components/ui/tokens";

type View = "overview" | "classes" | "kernel" | "raya" | "settings";
type Role = "admin" | "prof";

const TITLES: Record<View, string> = {
  overview: "Overview",
  classes: "Classes",
  kernel: "Kernel",
  raya: "Raya",
  settings: "Réglages",
};

/**
 * Schools — admin/teacher app shell, faithful reproduction of the design handoff
 * (`reference-Schools.html`). The Admin/Prof switch is a client-side simulate
 * toggle for the prototype; in production it must be driven by the authenticated
 * user's real membership (Prof users never see the Admin-only nav or the toggle).
 */
export function SchoolsApp() {
  const { dark, theme: t, toggle } = useDarkMode();
  const [view, setView] = useState<View>("overview");
  const [collapsed, setCollapsed] = useState(false);
  const [rightOpen, setRightOpen] = useState(true);
  const [role, setRole] = useState<Role>("admin");

  const selectAdmin = () => setRole("admin");
  const selectProf = () => {
    setRole("prof");
    if (view === "classes" || view === "kernel") setView("overview");
  };
  const toggleRole = () => (role === "admin" ? selectProf() : selectAdmin());

  const isAdmin = role === "admin";

  return (
    <AppShell theme={t}>
      {/* ── SIDEBAR ─────────────────────────────────────────── */}
      <Sidebar theme={t} collapsed={collapsed} expandedWidth={216} onBackgroundClick={() => setCollapsed((c) => !c)}>
        <SidebarBrand theme={t} collapsed={collapsed} logoSrc="/raya-mark.png" logoSrcDark="/raya-mark-violet.png" logoRadius={0} logoSize={52} name="Schools" />

        <NavItem theme={t} active={view === "overview"} collapsed={collapsed} icon={<IconOverview />} label="Overview" onClick={() => setView("overview")} />
        {isAdmin && (
          <>
            <NavItem theme={t} active={view === "classes"} collapsed={collapsed} icon={<IconClasses />} label="Classes" onClick={() => setView("classes")} />
            <NavItem theme={t} active={view === "kernel"} collapsed={collapsed} icon={<IconKernel />} label="Kernel" onClick={() => setView("kernel")} />
          </>
        )}
        <NavItem
          theme={t}
          active={view === "raya"}
          collapsed={collapsed}
          icon={
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src="/raya-logo.jpeg" alt="" style={{ width: 16, height: 16, borderRadius: 4, objectFit: "cover", flex: "none" }} />
          }
          label="Raya"
          onClick={() => setView("raya")}
        />
        <NavItem theme={t} active={view === "settings"} collapsed={collapsed} icon={<IconSettings />} label="Réglages" onClick={() => setView("settings")} />

        <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: 12 }}>
          {!collapsed && (
            <div style={{ display: "flex", background: t.sidebarActiveBg, borderRadius: 99, padding: 4, gap: 4 }}>
              <RolePill theme={t} label="Admin" active={role === "admin"} onClick={selectAdmin} />
              <RolePill theme={t} label="Prof" active={role === "prof"} onClick={selectProf} />
            </div>
          )}
          {collapsed && (
            <div style={{ display: "flex", justifyContent: "center" }}>
              <span
                role="button"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleRole();
                }}
                style={{ width: 32, height: 32, borderRadius: "50%", background: t.sidebarActiveBg, color: t.sidebarText, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: 10, fontWeight: 700 }}
              >
                {role === "admin" ? "A" : "P"}
              </span>
            </div>
          )}
          <SidebarProfile theme={t} collapsed={collapsed} initials="SA" name="Lycée Voltaire" avatarBg="#2f7fe0" onClick={() => setView("settings")} />
        </div>
      </Sidebar>

      {/* ── MAIN CARD ───────────────────────────────────────── */}
      <MainCard theme={t} column minWidth={340}>
        <div style={{ padding: "18px 26px", display: "flex", alignItems: "center", borderBottom: `1px solid ${t.cardBorder}` }}>
          <span style={{ fontSize: 16, fontWeight: 800, fontFamily: display, color: t.text }}>{TITLES[view]}</span>
          <span style={{ marginLeft: "auto", fontSize: 12, border: `1px solid ${t.inputBorder}`, background: t.inputBg, color: t.mutedLight, borderRadius: 99, padding: "8px 16px" }}>Rechercher élèves, classes...</span>
          <IconButton theme={t} onClick={() => setRightOpen((o) => !o)} size={34} radius={10} style={{ marginLeft: 12 }}>
            <IconPanel size={15} />
          </IconButton>
        </div>
        <div style={{ flex: 1, overflow: "auto" }}>
          {view === "overview" && (isAdmin ? <OverviewAdmin theme={t} /> : <OverviewProf theme={t} />)}
          {view === "classes" && <ClassesView theme={t} />}
          {view === "kernel" && <KernelView theme={t} />}
          {view === "raya" && <RayaView theme={t} />}
          {view === "settings" && <SettingsView theme={t} dark={dark} onToggleDark={toggle} />}
        </div>
      </MainCard>

      {/* ── RIGHT PANEL ─────────────────────────────────────── */}
      {rightOpen && <SchoolsRightPanel theme={t} view={view} role={role} />}
    </AppShell>
  );
}

function RolePill({ theme: t, label, active, onClick }: { theme: AppTheme; label: string; active: boolean; onClick: () => void }) {
  return (
    <span
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      style={{
        flex: 1,
        textAlign: "center",
        padding: "8px 4px",
        borderRadius: 99,
        fontSize: 11.5,
        fontWeight: 700,
        cursor: "pointer",
        whiteSpace: "nowrap",
        background: active ? "#ffffff" : "transparent",
        color: active ? "#0b1220" : t.sidebarMuted,
        boxShadow: active ? "0 1px 4px rgba(15,23,42,0.15)" : "none",
      }}
    >
      {label}
    </span>
  );
}

/* ── OVERVIEW (admin) ────────────────────────────────────── */
function OverviewAdmin({ theme: t }: { theme: AppTheme }) {
  return (
    <div style={{ padding: "24px 26px" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: 12, marginBottom: 18 }}>
        <KpiTile theme={t} label="Sessions aujourd'hui" value="482" delta="+21%" deltaPositive shine />
        <KpiTile theme={t} label="Élèves en difficulté" value="6" delta="-2" />
        <KpiTile theme={t} label="Maîtrise moyenne" value="83%" delta="+12pts" />
        <KpiTile theme={t} label="Élèves actifs" value="1,204" delta="+340" deltaPositive shine />
      </div>
      <BarChart theme={t} />
    </div>
  );
}

const CHART = [
  { label: "Jan", sessions: 41, quiz: 27, mastery: 12 },
  { label: "Fév", sessions: 53, quiz: 34, mastery: 17 },
  { label: "Mar", sessions: 46, quiz: 37, mastery: 22 },
  { label: "Avr", sessions: 67, quiz: 40, mastery: 28 },
  { label: "Mai", sessions: 88, quiz: 50, mastery: 40 },
  { label: "Juin", sessions: 108, quiz: 67, mastery: 55, current: true },
];

function BarChart({ theme: t }: { theme: AppTheme }) {
  const grad = (current: boolean | undefined, kind: "s" | "q" | "m") => {
    if (current) {
      return { s: "linear-gradient(180deg,#8b5cf6,#4f46e5)", q: "linear-gradient(180deg,#fb923c,#f97316)", m: "linear-gradient(180deg,#4ade80,#22c55e)" }[kind];
    }
    return { s: "linear-gradient(180deg,#b7bdf7,#9aa1ef)", q: "linear-gradient(180deg,#fdc48a,#fbab5c)", m: "linear-gradient(180deg,#a7ecc3,#7fe0a3)" }[kind];
  };
  return (
    <div style={{ border: `1px solid ${t.cardBorder}`, borderRadius: 20, padding: 18, background: t.cardBg2 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: t.text }}>Sessions vs. maîtrise</span>
        <div style={{ display: "flex", gap: 10, fontSize: 10, color: t.mutedLight }}>
          <LegendDot color="#4f46e5" label="Sessions" />
          <LegendDot color="#f97316" label="Quiz" />
          <LegendDot color="#22c55e" label="Maîtrise" />
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 8 }}>
        {CHART.map((m) => (
          <div key={m.label} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5, flex: 1 }}>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 2, width: "100%", height: 116 }}>
              <div style={{ flex: 1, height: m.sessions, background: grad(m.current, "s"), borderRadius: "3px 3px 0 0" }} />
              <div style={{ flex: 1, height: m.quiz, background: grad(m.current, "q"), borderRadius: "3px 3px 0 0" }} />
              <div style={{ flex: 1, height: m.mastery, background: grad(m.current, "m"), borderRadius: "3px 3px 0 0" }} />
            </div>
            <span style={{ fontSize: 8, fontWeight: m.current ? 700 : 400, color: m.current ? t.text : t.mutedLight }}>{m.label}</span>
          </div>
        ))}
      </div>
      <div style={{ textAlign: "center", marginTop: 8 }}>
        <span style={{ background: t.ctaBg, color: t.ctaText, borderRadius: 99, padding: "6px 12px", fontSize: 9 }}>Juin 2026 — Maîtrise en hausse</span>
      </div>
    </div>
  );
}
function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span>
      <span style={{ display: "inline-block", width: 8, height: 8, background: color, borderRadius: 2, marginRight: 4 }} />
      {label}
    </span>
  );
}

/* ── OVERVIEW (prof) ─────────────────────────────────────── */
function OverviewProf({ theme: t }: { theme: AppTheme }) {
  return (
    <div style={{ padding: "24px 26px" }}>
      <div style={{ fontSize: 13, color: t.muted, marginBottom: 18 }}>Tes classes et comment tes élèves progressent.</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: 12, marginBottom: 18 }}>
        <KpiTile theme={t} label="Sessions cette semaine" value="96" delta="+8%" deltaPositive shine />
        <KpiTile theme={t} label="Élèves en difficulté" value="3" delta="6e-A" />
        <KpiTile theme={t} label="Maîtrise moyenne" value="78%" delta="tes classes" />
      </div>
      <div style={{ border: `1px solid ${t.cardBorder}`, borderRadius: 20, padding: 18, background: t.cardBg2 }}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 14, color: t.text }}>Mes classes</div>
        <TableHead theme={t} cols="1.6fr 0.8fr 1fr" labels={["Classe", "Élèves", "Maîtrise"]} />
        <ClassRow theme={t} cols="1.6fr 0.8fr 1fr" cells={["6e-A · Maths", "28"]} pct={78} />
        <ClassRow theme={t} cols="1.6fr 0.8fr 1fr" cells={["5e-C · Maths", "24"]} pct={71} />
      </div>
    </div>
  );
}

/* ── CLASSES (admin) ─────────────────────────────────────── */
function ClassesView({ theme: t }: { theme: AppTheme }) {
  return (
    <div style={{ padding: "24px 26px" }}>
      <div style={{ border: `1px solid ${t.cardBorder}`, borderRadius: 20, padding: 18, background: t.cardBg2 }}>
        <TableHead theme={t} cols="1.6fr 1fr 0.8fr 1fr" labels={["Classe", "Professeur", "Élèves", "Maîtrise"]} />
        <ClassRow theme={t} cols="1.6fr 1fr 0.8fr 1fr" cells={["6e-A · Maths", "M. Diallo", "28"]} pct={78} />
        <ClassRow theme={t} cols="1.6fr 1fr 0.8fr 1fr" cells={["5e-B · Français", "Mme Nkolo", "31"]} pct={54} />
        <ClassRow theme={t} cols="1.6fr 1fr 0.8fr 1fr" cells={["4e-C · Histoire", "M. Fotso", "26"]} pct={88} />
        <div style={{ marginTop: 14 }}>
          <span style={{ fontSize: 11.5, background: t.ctaBg, color: t.ctaText, borderRadius: 99, padding: "8px 14px", fontWeight: 600 }}>+ Ajouter une classe</span>
        </div>
      </div>
    </div>
  );
}

function TableHead({ theme: t, cols, labels }: { theme: AppTheme; cols: string; labels: string[] }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: cols, fontSize: 10.5, color: t.mutedLight, padding: "0 4px 10px" }}>
      {labels.map((l) => (
        <span key={l}>{l}</span>
      ))}
    </div>
  );
}
function ClassRow({ theme: t, cols, cells, pct }: { theme: AppTheme; cols: string; cells: string[]; pct: number }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: cols, alignItems: "center", padding: "12px 4px", borderTop: `1px solid ${t.cardBorder}` }}>
      <span style={{ fontSize: 12.5, fontWeight: 600, color: t.text }}>{cells[0]}</span>
      {cells.slice(1).map((c, i) => (
        <span key={i} style={{ fontSize: 12, color: t.muted }}>{c}</span>
      ))}
      <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <ProgressBar theme={t} pct={pct} width={70} />
        <span style={{ fontSize: 11.5, color: t.text }}>{pct}%</span>
      </span>
    </div>
  );
}

/* ── KERNEL (admin) ──────────────────────────────────────── */
function KernelView({ theme: t }: { theme: AppTheme }) {
  return (
    <div style={{ padding: "24px 26px", display: "grid", gridTemplateColumns: "1fr", gap: 18 }}>
      <div style={{ border: `1px solid ${t.cardBorder}`, borderRadius: 20, padding: 18, background: t.cardBg2 }}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 16, color: t.text }}>Ajustements du kernel</div>
        <Slider theme={t} label="Rythme d'introduction des concepts" value="Modéré" fillPct={55} knobPct={53} mb />
        <Slider theme={t} label="Répétitions avant renforcement" value="3×" fillPct={38} knobPct={36} mb />
        <Slider theme={t} label="Sensibilité aux blocages" value="Élevée" fillPct={80} knobPct={78} />
        <div style={{ marginTop: 18, display: "flex", gap: 10, alignItems: "center" }}>
          <span style={{ fontSize: 11.5, background: t.ctaBg, color: t.ctaText, borderRadius: 99, padding: "9px 16px", fontWeight: 600 }}>Lancer une simulation</span>
          <span style={{ fontSize: 11.5, color: t.mutedLight }}>Impact estimé : +6pts / 4 sem.</span>
        </div>
      </div>
    </div>
  );
}
function Slider({ theme: t, label, value, fillPct, knobPct, mb }: { theme: AppTheme; label: string; value: string; fillPct: number; knobPct: number; mb?: boolean }) {
  return (
    <div style={{ marginBottom: mb ? 18 : 0 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, color: t.muted, marginBottom: 8 }}>
        <span>{label}</span>
        <span style={{ color: t.text, fontWeight: 600 }}>{value}</span>
      </div>
      <div style={{ height: 6, borderRadius: 99, background: t.gaugeTrack, position: "relative" }}>
        <span style={{ position: "absolute", left: 0, top: 0, height: "100%", width: `${fillPct}%`, borderRadius: 99, background: "#2f7fe0" }} />
        <span style={{ position: "absolute", left: `${knobPct}%`, top: -4, width: 14, height: 14, borderRadius: "50%", background: "#fff", border: "2px solid #2f7fe0" }} />
      </div>
    </div>
  );
}

/* ── Raya (school-wide) ──────────────────────────────────── */
function RayaView({ theme: t }: { theme: AppTheme }) {
  return (
    <div style={{ padding: "24px 26px", display: "grid", gridTemplateColumns: "1fr", gap: 18 }}>
      <div style={{ border: `1px solid ${t.cardBorder}`, borderRadius: 20, padding: 18, background: t.cardBg2 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/raya-logo.jpeg" alt="" style={{ width: 26, height: 26, borderRadius: 7, objectFit: "cover" }} />
          <span style={{ fontSize: 14, fontWeight: 700, color: t.text }}>Activité Raya — établissement</span>
        </div>
        <TableHead theme={t} cols="1.6fr 1fr 1fr" labels={["Classe", "Sessions / 7j", "Ton configuré"]} />
        <RayaRow theme={t} cls="6e-A · Maths" sessions="142" tone="Encourageant" />
        <RayaRow theme={t} cls="5e-B · Français" sessions="98" tone="Neutre" />
        <RayaRow theme={t} cls="4e-C · Histoire" sessions="76" tone="Encourageant" />
      </div>
    </div>
  );
}
function RayaRow({ theme: t, cls, sessions, tone }: { theme: AppTheme; cls: string; sessions: string; tone: string }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr 1fr", alignItems: "center", padding: "12px 4px", borderTop: `1px solid ${t.cardBorder}`, fontSize: 12 }}>
      <span style={{ fontWeight: 600, color: t.text }}>{cls}</span>
      <span style={{ color: t.muted }}>{sessions}</span>
      <span style={{ color: t.muted }}>{tone}</span>
    </div>
  );
}

/* ── SETTINGS ────────────────────────────────────────────── */
function SettingsView({ theme: t, dark, onToggleDark }: { theme: AppTheme; dark: boolean; onToggleDark: () => void }) {
  return (
    <div style={{ padding: "24px 26px" }}>
      <SettingsCard theme={t}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: t.text }}>Thème</div>
            <div style={{ fontSize: 11, color: t.muted, marginTop: 2 }}>Basculer entre mode clair et sombre</div>
          </div>
          <ThemeToggle dark={dark} theme={t} onToggle={onToggleDark} />
        </div>
      </SettingsCard>

      <SettingsCard theme={t}>
        <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 16, color: t.text }}>École</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <Field theme={t} label="Nom de l'établissement" value="Lycée Voltaire" />
          <Field theme={t} label="Année scolaire active" value="2025 – 2026" />
          <Field theme={t} label="Code d'invitation élèves" value="VOLT-6A29" letterSpacing="0.1em" />
          <ToggleRow theme={t} label="Notifications hebdo aux professeurs" on />
          <span style={{ marginTop: 6, alignSelf: "flex-start", fontSize: 11.5, color: status.danger, cursor: "pointer" }}>Gérer les accès administrateurs</span>
        </div>
      </SettingsCard>

      <SettingsCard theme={t} mt>
        <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 16, color: t.text }}>Facturation</div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: t.rowActiveBg, borderRadius: 12, padding: "14px 16px", marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: t.text }}>Plan Classroom — 29€/mois</div>
            <div style={{ fontSize: 10.5, color: t.muted, marginTop: 2 }}>Prochain prélèvement le 1er août 2026</div>
          </div>
          <span style={{ fontSize: 11, background: t.ctaBg, color: t.ctaText, borderRadius: 99, padding: "8px 14px", fontWeight: 600, whiteSpace: "nowrap" }}>Passer à School</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
          <Field theme={t} label="Sièges utilisés" value="42 / 50 enseignants" />
          <Field theme={t} label="Moyen de paiement" value="Visa •••• 4242" />
        </div>
        <div style={{ fontSize: 11, color: t.muted, marginBottom: 8 }}>Factures</div>
        <InvoiceRow theme={t} label="Juin 2026" amount="29,00 €" />
        <InvoiceRow theme={t} label="Mai 2026" amount="29,00 €" />
      </SettingsCard>
    </div>
  );
}
function InvoiceRow({ theme: t, label, amount }: { theme: AppTheme; label: string; amount: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "9px 4px", borderTop: `1px solid ${t.cardBorder}`, fontSize: 11.5, color: t.text }}>
      <span>{label}</span>
      <span style={{ color: t.muted }}>{amount}</span>
    </div>
  );
}

/* ── RIGHT PANEL ─────────────────────────────────────────── */
function SchoolsRightPanel({ theme: t, view, role }: { theme: AppTheme; view: View; role: Role }) {
  const isOverviewAdmin = view === "overview" && role === "admin";
  return (
    <RightPanel theme={t} width={300}>
      <div>
        <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 10, color: t.text }}>Notifications</div>
        <div style={{ background: t.rowActiveBg, borderRadius: 12, padding: 11, marginBottom: 6 }}>
          <div style={{ fontSize: 11.5, fontWeight: 600, color: t.text }}>6 élèves de 5e-B décrochent</div>
          <div style={{ fontSize: 10, color: t.muted, marginTop: 2 }}>Il y a 2h</div>
        </div>
        <div style={{ background: t.rowActiveBg, borderRadius: 12, padding: 11 }}>
          <div style={{ fontSize: 11.5, fontWeight: 600, color: t.text }}>M. Fotso : 3 classes sans session depuis 5j</div>
          <div style={{ fontSize: 10, color: t.muted, marginTop: 2 }}>Hier</div>
        </div>
      </div>

      {isOverviewAdmin && (
        <>
          <div style={{ border: `1px solid ${t.cardBorder}`, borderRadius: 20, padding: 16, background: t.cardBg2 }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10, color: t.text }}>Kernel — maîtrise globale</div>
            <MasteryGauge theme={t} valueLabel="1,204" caption="élèves suivis" dashoffset={50} />
          </div>
          <div style={{ border: `1px solid ${t.cardBorder}`, borderRadius: 20, padding: 16, background: t.cardBg2 }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10, color: t.text }}>Insights Raya</div>
            <InsightCard theme={t} title="6 élèves de 5e-B décrochent sur les accords" sub="Suggestion : session ciblée" mb />
            <InsightCard theme={t} title="+12pts sur 6e-A ce mois" sub="Tendance stable, 3 semaines" />
          </div>
        </>
      )}

      {view === "kernel" && (
        <div style={{ border: `1px solid ${t.cardBorder}`, borderRadius: 20, padding: 16, background: t.cardBg2 }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10, color: t.text }}>Maîtrise globale</div>
          <MasteryGauge theme={t} valueLabel="83%" caption="1,204 élèves" dashoffset={50} valueSize={20} />
        </div>
      )}

      {view === "raya" && (
        <>
          <div style={{ background: t.ctaBg, color: t.ctaText, borderRadius: 20, padding: 16 }}>
            <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 6 }}>Personnalité de Raya</div>
            <div style={{ fontSize: 11, opacity: 0.7, marginBottom: 12 }}>Ton par défaut pour toutes les classes</div>
            <span style={{ display: "inline-block", background: "rgba(255,255,255,0.15)", borderRadius: 99, padding: "8px 14px", fontSize: 11, fontWeight: 600 }}>Configurer</span>
          </div>
          <div style={{ border: `1px solid ${t.cardBorder}`, borderRadius: 20, padding: 16, background: t.cardBg2 }}>
            <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 10, color: t.text }}>Contenus signalés</div>
            <div style={{ fontSize: 11.5, color: t.muted }}>Aucun contenu en attente de revue.</div>
          </div>
        </>
      )}
    </RightPanel>
  );
}
function InsightCard({ theme: t, title, sub, mb }: { theme: AppTheme; title: string; sub: string; mb?: boolean }) {
  return (
    <div style={{ background: t.rowActiveBg, borderRadius: 12, padding: 12, marginBottom: mb ? 8 : 0 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: t.text }}>{title}</div>
      <div style={{ fontSize: 10.5, color: t.muted, marginTop: 2 }}>{sub}</div>
    </div>
  );
}
