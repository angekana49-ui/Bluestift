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
import {
  MasteryGauge,
  SegTabs,
  Avatar,
  Bird,
} from "@/components/ui/widgets";
import {
  IconChat,
  IconRooms,
  IconTools,
  IconKernel,
  IconSettings,
  IconChevron,
  IconFile,
  IconImage,
  IconPanel,
  IconMic,
  IconAttach,
  IconAiMode,
  IconLock,
  IconQuiz,
  IconSummary,
  IconFlashcards,
} from "@/components/ui/icons";
import { status } from "@/components/ui/tokens";
import type { AppTheme } from "@/components/ui/tokens";
import { hand, display } from "@/components/ui/tokens";

type View = "chat" | "rooms" | "tools" | "kernel" | "settings";
type RoomTab = "group" | "private";

/**
 * Raya — student app shell, faithful reproduction of the design handoff
 * (`reference-Raya.html`). A self-contained client SPA that switches views in
 * local state, exactly like the mockup; wiring each view to the real routes
 * (/chat, /rooms, /tools, /profile, /account) is the follow-up step. French copy
 * is kept verbatim; identifiers are English.
 */
export function RayaApp() {
  const { dark, theme: t, toggle } = useDarkMode();
  const [view, setView] = useState<View>("chat");
  const [roomTab, setRoomTab] = useState<RoomTab>("group");
  const [collapsed, setCollapsed] = useState(false);
  const [chatRightOpen, setChatRightOpen] = useState(true);
  const [roomsRightOpen, setRoomsRightOpen] = useState(true);
  const [chatHistOpen, setChatHistOpen] = useState(true);
  const [roomsHistOpen, setRoomsHistOpen] = useState(true);
  const [chatFilesOpen, setChatFilesOpen] = useState(false);
  const [newSession, setNewSession] = useState(false);

  const showChatList = view === "chat" && !collapsed && chatHistOpen;
  const showRoomsList = view === "rooms" && !collapsed && roomsHistOpen;

  const chevron = (open: boolean, onClick: () => void) =>
    collapsed ? null : (
      <span
        role="button"
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
        style={{
          display: "flex",
          flex: "none",
          alignItems: "center",
          justifyContent: "center",
          padding: 2,
        }}
      >
        <IconChevron
          size={11}
          style={{ transform: open ? "rotate(0deg)" : "rotate(-90deg)" }}
        />
      </span>
    );

  return (
    <AppShell theme={t}>
      {/* ── SIDEBAR ─────────────────────────────────────────── */}
      <Sidebar
        theme={t}
        collapsed={collapsed}
        expandedWidth={212}
        onBackgroundClick={() => setCollapsed((c) => !c)}
      >
        <SidebarBrand theme={t} collapsed={collapsed} logoSrc="/raya-mark.png" logoSrcDark="/raya-mark-dark.png" logoRadius={0} logoSize={52} name="Raya" />

        <NavItem
          theme={t}
          active={view === "chat"}
          collapsed={collapsed}
          icon={<IconChat />}
          label="Chat"
          onClick={() => setView("chat")}
          trailing={chevron(chatHistOpen, () => setChatHistOpen((o) => !o))}
        />
        {showChatList && (
          <HistoryList>
            <NewRow theme={t} label="+ Nouvelle session" onClick={() => setView("chat")} onActivate={() => setNewSession(true)} />
            <ActiveHistRow theme={t} label="Fractions — Ch.4" />
            <MutedHistRow theme={t} label="Grammaire — accords" />
            <MutedHistRow theme={t} label="Révisions — Histoire" />
          </HistoryList>
        )}

        <NavItem
          theme={t}
          active={view === "rooms"}
          collapsed={collapsed}
          icon={<IconRooms />}
          label="Rooms"
          onClick={() => setView("rooms")}
          trailing={chevron(roomsHistOpen, () => setRoomsHistOpen((o) => !o))}
        />
        {showRoomsList && (
          <HistoryList>
            <NewRow theme={t} label="+ Créer une room" onClick={() => setView("rooms")} />
            <div style={{ background: t.rowActiveBg, borderRadius: 9, padding: "8px 10px" }}>
              <div style={ellipsis(11, 700, t.sidebarText)}>6e-A · Maths</div>
              <div style={{ fontSize: 13, color: t.sidebarMuted, marginTop: 1 }}>4 participants · live</div>
            </div>
            <MutedHistRow theme={t} label="Révisions BAC — Physique" />
          </HistoryList>
        )}

        <NavItem theme={t} active={view === "tools"} collapsed={collapsed} icon={<IconTools />} label="Tools" onClick={() => setView("tools")} />
        <NavItem theme={t} active={view === "kernel"} collapsed={collapsed} icon={<IconKernel />} label="Mon Kernel" onClick={() => setView("kernel")} />
        <NavItem theme={t} active={view === "settings"} collapsed={collapsed} icon={<IconSettings />} label="Réglages" onClick={() => setView("settings")} />

        <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: 12 }}>
          <SidebarProfile
            theme={t}
            collapsed={collapsed}
            initials="EM"
            name="Emma M."
            avatarBg={status.aiIndigo}
            onClick={() => setView("settings")}
          />
        </div>
      </Sidebar>

      {/* ── MAIN CARD ───────────────────────────────────────── */}
      <MainCard theme={t} minWidth={380}>
        {view === "chat" && (
          <ChatView
            theme={t}
            newSession={newSession}
            chatFilesOpen={chatFilesOpen}
            onToggleFiles={() => setChatFilesOpen((o) => !o)}
            onToggleRight={() => setChatRightOpen((o) => !o)}
            onGoKernel={() => setView("kernel")}
          />
        )}
        {view === "rooms" && (
          <RoomsView theme={t} roomTab={roomTab} onRoomTab={setRoomTab} onToggleRight={() => setRoomsRightOpen((o) => !o)} />
        )}
        {view === "tools" && <ToolsView theme={t} />}
        {view === "kernel" && <KernelView theme={t} />}
        {view === "settings" && <SettingsView theme={t} dark={dark} onToggleDark={toggle} />}
      </MainCard>

      {/* ── RIGHT PANEL (per view) ──────────────────────────── */}
      {view === "chat" && chatRightOpen && <ChatRightPanel theme={t} onGoTools={() => setView("tools")} />}
      {view === "rooms" && roomsRightOpen && <RoomsRightPanel theme={t} />}
    </AppShell>
  );
}

/* ── sidebar history helpers ─────────────────────────────── */
const ellipsis = (size: number, weight: number, color: string) => ({
  fontSize: size,
  fontWeight: weight,
  color,
  whiteSpace: "nowrap" as const,
  overflow: "hidden",
  textOverflow: "ellipsis",
});

function HistoryList({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ padding: "6px 6px 8px 30px", display: "flex", flexDirection: "column", gap: 2 }}>
      {children}
    </div>
  );
}
function NewRow({ theme: t, label, onClick, onActivate }: { theme: AppTheme; label: string; onClick: () => void; onActivate?: () => void }) {
  return (
    <div
      onClick={(e) => {
        e.stopPropagation();
        onClick();
        onActivate?.();
      }}
      style={{
        cursor: "pointer",
        background: t.sidebarActiveBg,
        color: t.sidebarText,
        borderRadius: 9,
        padding: "8px 10px",
        fontSize: 13,
        fontWeight: 600,
        textAlign: "center",
        marginBottom: 2,
      }}
    >
      {label}
    </div>
  );
}
function ActiveHistRow({ theme: t, label }: { theme: AppTheme; label: string }) {
  return (
    <div style={{ background: t.rowActiveBg, borderRadius: 9, padding: "8px 10px" }}>
      <div style={ellipsis(11, 700, t.sidebarText)}>{label}</div>
    </div>
  );
}
function MutedHistRow({ theme: t, label }: { theme: AppTheme; label: string }) {
  return (
    <div style={{ borderRadius: 9, padding: "8px 10px" }}>
      <div style={ellipsis(11, 500, t.sidebarMuted)}>{label}</div>
    </div>
  );
}

/* ── CHAT VIEW ───────────────────────────────────────────── */
function ChatView({
  theme: t,
  newSession,
  chatFilesOpen,
  onToggleFiles,
  onToggleRight,
  onGoKernel,
}: {
  theme: AppTheme;
  newSession: boolean;
  chatFilesOpen: boolean;
  onToggleFiles: () => void;
  onToggleRight: () => void;
  onGoKernel: () => void;
}) {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
      {/* header */}
      <div
        style={{
          position: "relative",
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "16px 24px",
          borderBottom: `1px solid ${t.cardBorder}`,
        }}
      >
        <Avatar initials="AI" size={32} bg={status.aiIndigo} style={{ fontSize: 14 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={ellipsis(13.5, 700, t.text)}>Raya · Fractions — Ch.4</div>
          <div style={{ ...ellipsis(10.5, 400, status.positive) }}>● en session</div>
        </div>
        <span
          onClick={onGoKernel}
          style={{
            flex: "none",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            maxWidth: 150,
            fontSize: 13,
            border: `1px solid ${t.cardBorder}`,
            borderRadius: 99,
            padding: "6px 13px",
            color: t.mutedLight,
            cursor: "pointer",
          }}
        >
          Voir le profil kernel
        </span>
        <IconButton theme={t} onClick={onToggleFiles} bg={chatFilesOpen ? t.sidebarActiveBg : t.cardBg2}>
          <IconFile size={14} />
        </IconButton>
        <IconButton theme={t} onClick={onToggleRight}>
          <IconPanel size={14} />
        </IconButton>
        {chatFilesOpen && (
          <div
            style={{
              position: "absolute",
              top: 56,
              right: 24,
              zIndex: 5,
              width: 240,
              background: t.cardBg2,
              border: `1px solid ${t.cardBorder}`,
              borderRadius: 14,
              boxShadow: t.cardShadow,
              padding: 12,
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 8 }}>Documents de la session</div>
            <FileRow theme={t} icon={<IconFile size={13} style={{ color: t.muted }} />} name="Exercice_fractions.pdf" meta="envoyé par Raya · il y a 3 min" active />
            <FileRow theme={t} icon={<IconImage size={13} style={{ color: t.muted }} />} name="Photo_devoir.jpg" meta="envoyé par toi · hier" />
          </div>
        )}
      </div>

      {newSession ? (
        <NewSessionWelcome theme={t} />
      ) : (
        <div style={{ display: "flex", flex: 1, padding: "28px 32px", flexDirection: "column", gap: 16, overflow: "auto" }}>
          <Bubble theme={t} maxWidth="60%">
            Tu bloques encore sur l&apos;addition de fractions à dénominateurs différents. On reprend avec un exemple concret ?
          </Bubble>
          <Bubble theme={t} maxWidth="50%" me>
            Ok mais je comprends pas pourquoi il faut changer le dénominateur
          </Bubble>
          <Bubble theme={t} maxWidth="62%">
            Bonne question — imagine deux pizzas coupées différemment...
            <div className="shine" style={{ marginTop: 10, background: t.cardBg2, border: `1px solid ${t.cardBorder}`, borderRadius: 12, padding: 12 }}>
              <div style={{ fontSize: 13, color: t.muted }}>Exercice généré</div>
              <div style={{ fontSize: 15, fontWeight: 600, marginTop: 2, color: t.text }}>1/3 + 1/4 = ?</div>
            </div>
          </Bubble>
        </div>
      )}

      {/* composer */}
      <div style={{ padding: "16px 24px", borderTop: `1px solid ${t.cardBorder}`, display: "flex", gap: 8, alignItems: "center" }}>
        <IconButton theme={t} size={38} radius={999}>
          <IconMic size={16} />
        </IconButton>
        <div
          style={{
            flex: 1,
            minWidth: 100,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            background: t.inputBg,
            border: `1px solid ${t.inputBorder}`,
            borderRadius: 99,
            padding: "12px 18px",
            fontSize: 15,
            color: t.mutedLight,
          }}
        >
          Écris ta réponse à Raya...
        </div>
        <IconButton theme={t} size={38} radius={999} title="Joindre un fichier">
          <IconAttach size={16} />
        </IconButton>
        <IconButton theme={t} size={38} radius={999} title="Mode IA — Encourageant" color={t.text}>
          <IconAiMode size={16} />
        </IconButton>
        <span
          style={{
            width: 38,
            height: 38,
            borderRadius: "50%",
            background: t.ctaBg,
            color: t.ctaText,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 16,
            flex: "none",
          }}
        >
          ↑
        </span>
      </div>
    </div>
  );
}

function Bubble({ theme: t, maxWidth, me, children }: { theme: AppTheme; maxWidth: string; me?: boolean; children: React.ReactNode }) {
  return (
    <div
      style={{
        maxWidth,
        alignSelf: me ? "flex-end" : "flex-start",
        background: me ? t.bubbleMineBg : t.bubbleBg,
        color: me ? t.bubbleMineText : t.text,
        borderRadius: me ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
        padding: "13px 16px",
        fontSize: 16,
        lineHeight: 1.65,
      }}
    >
      {children}
    </div>
  );
}

function FileRow({ theme: t, icon, name, meta, active }: { theme: AppTheme; icon: React.ReactNode; name: string; meta: string; active?: boolean }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "7px 8px",
        borderRadius: 9,
        background: active ? t.rowActiveBg : undefined,
        marginBottom: 4,
      }}
    >
      {icon}
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={ellipsis(10.5, 600, t.text)}>{name}</div>
        <div style={{ fontSize: 13, color: t.muted }}>{meta}</div>
      </div>
    </div>
  );
}

function NewSessionWelcome({ theme: t }: { theme: AppTheme }) {
  return (
    <div style={{ flex: 1, position: "relative", overflow: "hidden", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: 24 }}>
      <div style={{ position: "relative", display: "inline-block", maxWidth: 520 }}>
        <h1
          style={{
            fontFamily: hand,
            fontWeight: 700,
            fontSize: "clamp(2.2rem,5vw,3.4rem)",
            lineHeight: 1,
            margin: 0,
            color: t.text,
            animation: "writeReveal 2.2s cubic-bezier(0.65,0,0.35,1) 0.15s 1 both",
          }}
        >
          Salut Emma, prête à apprendre ?
        </h1>
        <Bird variant={1} fill={status.aiIndigo} />
        <Bird variant={2} fill={t.mutedLight} />
      </div>
      <p style={{ maxWidth: 380, margin: "14px 0 26px", fontSize: 15, lineHeight: 1.7, color: t.muted }}>
        Dis-moi ce que tu veux travailler aujourd&apos;hui, ou choisis une reprise rapide.
      </p>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center", maxWidth: 460 }}>
        {[
          { label: "Reprendre les fractions", dur: "6.5s", delay: "0s" },
          { label: "Réviser la grammaire", dur: "7.2s", delay: ".3s" },
          { label: "Quiz surprise", dur: "6.8s", delay: ".6s" },
        ].map((c) => (
          <span
            key={c.label}
            className="shine"
            style={{
              background: t.cardBg2,
              border: `1px solid ${t.cardBorder}`,
              borderRadius: 14,
              padding: "12px 16px",
              fontSize: 14,
              fontWeight: 600,
              color: t.text,
              animation: `floatSm ${c.dur} ease-in-out infinite`,
              animationDelay: c.delay,
            }}
          >
            {c.label}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ── ROOMS VIEW ──────────────────────────────────────────── */
function RoomsView({ theme: t, roomTab, onRoomTab, onToggleRight }: { theme: AppTheme; roomTab: RoomTab; onRoomTab: (v: RoomTab) => void; onToggleRight: () => void }) {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
      <div style={{ padding: "16px 24px", borderBottom: `1px solid ${t.cardBorder}`, display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ fontSize: 16, fontWeight: 700, color: t.text, flex: "none" }}>Room · 6e-A Maths</span>
        <div style={{ marginLeft: 6 }}>
          <SegTabs
            theme={t}
            value={roomTab}
            onChange={onRoomTab}
            options={[
              { value: "group", label: "Chat groupe" },
              { value: "private", label: "Chat privé avec Raya" },
            ]}
          />
        </div>
        <span style={{ marginLeft: "auto", fontSize: 13, color: status.positive, flex: "none" }}>● live</span>
        <IconButton theme={t} onClick={onToggleRight}>
          <IconPanel size={14} />
        </IconButton>
      </div>

      {roomTab === "group" ? (
        <>
          <div style={{ flex: 1, padding: "26px 30px", display: "flex", flexDirection: "column", gap: 14, overflow: "auto" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <Avatar initials="AI" size={26} bg={status.aiIndigo} style={{ fontSize: 13 }} />
              <span style={{ fontSize: 14, fontWeight: 700, color: t.text }}>Raya modère la session</span>
            </div>
            <Bubble theme={t} maxWidth="60%">Léo, tu peux expliquer à Sami comment tu as trouvé le dénominateur commun ?</Bubble>
            <div style={{ maxWidth: "52%", background: t.bubbleAccentBg, color: t.text, borderRadius: "16px 16px 16px 4px", padding: "13px 16px", fontSize: 15, lineHeight: 1.65 }}>
              Léo: on multiplie les deux dénominateurs entre eux
            </div>
            <Bubble theme={t} maxWidth="60%">Exactement. Sami, essaie sur 1/4 + 1/6 →</Bubble>
          </div>
          <RoomComposer theme={t} placeholder="Message au groupe..." />
        </>
      ) : (
        <>
          <div style={{ flex: 1, padding: "26px 30px", display: "flex", flexDirection: "column", gap: 14, overflow: "auto" }}>
            <div style={{ fontSize: 13, color: t.mutedLight, textAlign: "center", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
              <IconLock size={12} />
              Cette conversation n&apos;est visible que par toi et Raya
            </div>
            <Bubble theme={t} maxWidth="62%">Tu veux qu&apos;on revoie ce point tranquillement avant de le refaire devant le groupe ?</Bubble>
            <Bubble theme={t} maxWidth="50%" me>Oui stp, j&apos;ose pas demander devant les autres</Bubble>
          </div>
          <RoomComposer theme={t} placeholder="Écris en privé à Raya..." />
        </>
      )}
    </div>
  );
}

function RoomComposer({ theme: t, placeholder }: { theme: AppTheme; placeholder: string }) {
  return (
    <div style={{ borderTop: `1px solid ${t.cardBorder}`, padding: "14px 24px" }}>
      <div style={{ display: "flex", gap: 10, alignItems: "center", background: t.inputBg, border: `1px solid ${t.inputBorder}`, borderRadius: 99, padding: "7px 7px 7px 18px" }}>
        <span style={{ flex: 1, fontSize: 15, color: t.mutedLight }}>{placeholder}</span>
        <span style={{ width: 34, height: 34, borderRadius: "50%", background: t.ctaBg, color: t.ctaText, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15 }}>↑</span>
      </div>
    </div>
  );
}

/* ── TOOLS VIEW ──────────────────────────────────────────── */
function ToolsView({ theme: t }: { theme: AppTheme }) {
  const cards = [
    { icon: <IconQuiz size={18} />, title: "Quiz express", desc: "5 questions générées depuis ton dernier chapitre." },
    { icon: <IconFlashcards size={18} />, title: "Flashcards", desc: "Cartes de révision à partir de tes notes." },
    { icon: <IconSummary size={18} />, title: "Résumé", desc: "Synthèse d'un cours ou d'un document importé." },
  ];
  return (
    <div style={{ flex: 1, padding: "36px 44px", overflow: "auto" }}>
      <div style={{ fontSize: 23, fontWeight: 800, fontFamily: display, marginBottom: 4, color: t.text }}>Tools Studio</div>
      <div style={{ fontSize: 15, color: t.muted, marginBottom: 26 }}>Génère des quiz, résumés et flashcards depuis n&apos;importe quel cours.</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16, maxWidth: 900 }}>
        {cards.map((c) => (
          <div key={c.title} style={{ background: t.cardBg2, border: `1px solid ${t.cardBorder}`, borderRadius: 18, padding: 20 }}>
            <div style={{ width: 38, height: 38, borderRadius: 12, background: t.ctaBg, color: t.ctaText, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 14 }}>{c.icon}</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: t.text }}>{c.title}</div>
            <div style={{ fontSize: 14, color: t.muted, marginTop: 6, lineHeight: 1.6 }}>{c.desc}</div>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 20, border: `1px dashed ${t.cardBorder}`, borderRadius: 18, padding: 22, maxWidth: 900, textAlign: "center", color: t.mutedLight, fontSize: 14 }}>
        Dépose un PDF, une photo de cours ou un lien pour générer un outil
      </div>
    </div>
  );
}

/* ── MON KERNEL VIEW ─────────────────────────────────────── */
function KernelView({ theme: t }: { theme: AppTheme }) {
  return (
    <div style={{ flex: 1, padding: "36px 44px", overflow: "auto" }}>
      <div style={{ fontSize: 23, fontWeight: 800, fontFamily: display, marginBottom: 4, color: t.text }}>Mon Kernel</div>
      <div style={{ fontSize: 15, color: t.muted, marginBottom: 26 }}>Ta maîtrise, concept par concept — pas une note globale.</div>
      <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 20, maxWidth: 1100 }}>
        <div style={{ background: t.cardBg2, border: `1px solid ${t.cardBorder}`, borderRadius: 20, padding: 20 }}>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 10, color: t.text }}>Maîtrise globale</div>
          <MasteryGauge theme={t} valueLabel="79%" caption="tous sujets" dashoffset={60} />
        </div>
        <div style={{ background: t.cardBg2, border: `1px solid ${t.cardBorder}`, borderRadius: 20, padding: 20 }}>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 14, color: t.text }}>Par concept</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <ConceptLine theme={t} label="Fractions" pct={61} color={status.warn} />
            <ConceptLine theme={t} label="Accords grammaticaux" pct={88} color={status.ok} />
            <ConceptLine theme={t} label="Frise chronologique" pct={92} color={status.ok} />
          </div>
        </div>
      </div>
    </div>
  );
}
function ConceptLine({ theme: t, label, pct, color }: { theme: AppTheme; label: string; pct: number; color: string }) {
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, marginBottom: 6, color: t.text }}>
        <span>{label}</span>
        <span style={{ color: t.muted }}>{pct}%</span>
      </div>
      <div style={{ height: 6, borderRadius: 99, background: t.gaugeTrack }}>
        <span style={{ display: "block", width: `${pct}%`, height: "100%", borderRadius: 99, background: color }} />
      </div>
    </div>
  );
}

/* ── SETTINGS VIEW ───────────────────────────────────────── */
function SettingsView({ theme: t, dark, onToggleDark }: { theme: AppTheme; dark: boolean; onToggleDark: () => void }) {
  return (
    <div style={{ flex: 1, padding: "36px 44px", overflow: "auto" }}>
      <div style={{ fontSize: 23, fontWeight: 800, fontFamily: display, marginBottom: 26, color: t.text }}>Réglages</div>

      <SettingsCard theme={t}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: t.text }}>Thème</div>
            <div style={{ fontSize: 13, color: t.muted, marginTop: 2 }}>Basculer entre mode clair et sombre</div>
          </div>
          <ThemeToggle dark={dark} theme={t} onToggle={onToggleDark} />
        </div>
      </SettingsCard>

      <SettingsCard theme={t}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20 }}>
          <Avatar initials="EM" size={52} bg={status.aiIndigo} style={{ fontSize: 18 }} />
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: t.text }}>Emma M.</div>
            <div style={{ fontSize: 14, color: t.muted }}>6e-A · Lycée Voltaire</div>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <Field theme={t} label="Nom" value="Emma M." />
          <Field theme={t} label="Email" value="emma.m@voltaire.edu" />
          <ToggleRow theme={t} label="Notifications de session" on />
          <ToggleRow theme={t} label="Rappels de révision" />
          <span style={{ marginTop: 6, alignSelf: "flex-start", fontSize: 14, color: status.danger, cursor: "pointer" }}>Se déconnecter</span>
        </div>
      </SettingsCard>

      <SettingsCard theme={t} mt>
        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, color: t.text }}>Facturation</div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: t.rowActiveBg, borderRadius: 12, padding: "14px 16px", marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: t.text }}>Plan Étudiant — Gratuit</div>
            {/* Mirrors RAYA_ENTITLEMENTS.free.messagesPerDay. Hardcoded because
                lib/entitlements.ts is server-only and this is a client mockup —
                if that number moves, move this one with it. It read "Sessions
                Raya solo illimitées", which stopped being true when the free
                tier got a chat cap. */}
            <div style={{ fontSize: 13, color: t.muted, marginTop: 2 }}>30 messages Raya par jour</div>
          </div>
          <span style={{ fontSize: 13, background: t.ctaBg, color: t.ctaText, borderRadius: 99, padding: "8px 14px", fontWeight: 600, whiteSpace: "nowrap" }}>Passer à Classroom</span>
        </div>
        <div style={{ fontSize: 13, color: t.muted, marginBottom: 8 }}>Moyen de paiement</div>
        <div style={{ border: `1px solid ${t.inputBorder}`, background: t.inputBg, borderRadius: 10, padding: "10px 14px", fontSize: 15, color: t.text, marginBottom: 14 }}>Aucun moyen de paiement enregistré</div>
        <div style={{ fontSize: 13, color: t.muted, marginBottom: 8 }}>Historique</div>
        <div style={{ fontSize: 14, color: t.mutedLight }}>Aucune facture — le plan gratuit ne génère pas de facturation.</div>
      </SettingsCard>
    </div>
  );
}

/* ── settings shared bits (also used by Schools) ─────────── */
export function SettingsCard({ theme: t, mt, id, children }: { theme: AppTheme; mt?: boolean; id?: string; children: React.ReactNode }) {
  return (
    <div
      /* An anchor, so the settings sheet can send someone to the one card they
         asked for instead of dropping them at the top of a long page. */
      id={id}
      style={{
        scrollMarginTop: 24,
        background: t.cardBg,
        border: `1px solid ${t.cardBorder}`,
        borderRadius: 20,
        padding: 24,
        width: "100%",
        maxWidth: 700,
        marginBottom: 16,
        marginTop: mt ? 16 : 0,
      }}
    >
      {children}
    </div>
  );
}
export function Field({ theme: t, label, value, letterSpacing }: { theme: AppTheme; label: string; value: string; letterSpacing?: string }) {
  return (
    <div>
      <div style={{ fontSize: 13, color: t.muted, marginBottom: 6 }}>{label}</div>
      <div style={{ border: `1px solid ${t.inputBorder}`, background: t.inputBg, borderRadius: 10, padding: "10px 14px", fontSize: 15, color: t.text, letterSpacing }}>{value}</div>
    </div>
  );
}
export function ToggleRow({ theme: t, label, on }: { theme: AppTheme; label: string; on?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: `1px solid ${t.cardBorder}`, paddingTop: 14 }}>
      <span style={{ fontSize: 15, color: t.text }}>{label}</span>
      <span style={{ width: 38, height: 22, borderRadius: 99, background: on ? t.ctaBg : t.gaugeTrack, position: "relative" }}>
        <span style={{ position: "absolute", [on ? "right" : "left"]: 3, top: 3, width: 16, height: 16, borderRadius: "50%", background: "#fff" } as React.CSSProperties} />
      </span>
    </div>
  );
}

/* ── CHAT RIGHT PANEL ────────────────────────────────────── */
function ChatRightPanel({ theme: t, onGoTools }: { theme: AppTheme; onGoTools: () => void }) {
  return (
    <RightPanel theme={t} width={270}>
      <div>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 10, color: t.text }}>Notifications</div>
        <NotifCard theme={t} title="Léo t'a invité·e dans une room" meta="Il y a 12 min" mb />
        <NotifCard theme={t} title="Nouveau quiz disponible sur les fractions" meta="Hier" />
      </div>
      <div style={{ border: `1px solid ${t.cardBorder}`, borderRadius: 16, padding: 16 }}>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 8, color: t.text }}>Maîtrise — Fractions</div>
        <MasteryGauge
          theme={t}
          valueLabel="61%"
          caption="concept: fractions"
          dashoffset={95}
          valueSize={20}
          stops={[
            { offset: "0%", color: "#f97316" },
            { offset: "50%", color: "#fbbf24" },
            { offset: "100%", color: "#22c55e" },
          ]}
        />
      </div>
      <div style={{ border: `1px solid ${t.cardBorder}`, borderRadius: 16, padding: 16 }}>
        <div style={{ background: t.cardBg2, borderRadius: 12, padding: 11, marginBottom: 10 }}>
          <div style={{ fontSize: 13, color: t.muted }}>Encore bloqué·e ?</div>
          <div style={{ fontSize: 14, fontWeight: 700, marginTop: 3, color: t.text }}>Raya propose 3 exercices ciblés</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div onClick={onGoTools} style={{ cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", background: t.ctaBg, color: t.ctaText, borderRadius: 10, padding: "9px 12px", fontSize: 14, fontWeight: 600 }}>
            <span>Flashcards</span>
            <span>→</span>
          </div>
          <div onClick={onGoTools} style={{ cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", background: t.cardBg2, color: t.text, border: `1px solid ${t.cardBorder}`, borderRadius: 10, padding: "9px 12px", fontSize: 14, fontWeight: 600 }}>
            <span>Quiz express</span>
            <span>→</span>
          </div>
        </div>
      </div>
    </RightPanel>
  );
}

function NotifCard({ theme: t, title, meta, mb }: { theme: AppTheme; title: string; meta: string; mb?: boolean }) {
  return (
    <div style={{ background: t.rowActiveBg, borderRadius: 12, padding: 10, marginBottom: mb ? 6 : 0 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: t.text }}>{title}</div>
      <div style={{ fontSize: 13, color: t.muted, marginTop: 2 }}>{meta}</div>
    </div>
  );
}

/* ── ROOMS RIGHT PANEL ───────────────────────────────────── */
function RoomsRightPanel({ theme: t }: { theme: AppTheme }) {
  return (
    <RightPanel theme={t} width={250} padding={16}>
      <div>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 10, color: t.text }}>Notifications</div>
        <NotifCard theme={t} title="Sami a rejoint la room" meta="À l'instant" />
      </div>
      <div>
        <div style={{ fontSize: 13, color: t.muted, marginBottom: 10 }}>Fichiers partagés</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <SharedFile theme={t} icon={<IconFile size={14} style={{ color: t.muted }} />} name="Exercices_fractions.pdf" meta="par Léo · il y a 8 min" />
          <SharedFile theme={t} icon={<IconImage size={14} style={{ color: t.muted }} />} name="Photo_tableau.jpg" meta="par Emma · toi · hier" />
        </div>
      </div>
      <div>
        <div style={{ fontSize: 13, color: t.muted, marginBottom: 10 }}>Participants (4)</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <Participant theme={t} online avatar="EM" avatarBg="#c7d2fe" name="Emma · toi" />
          <Participant theme={t} online avatar="LT" avatarBg="#fde68a" name="Léo" badge="bloqué" />
          <Participant theme={t} avatar="SA" avatarBg="#a7f3d0" name="Sami" offlineLabel="hors ligne" />
        </div>
        <div style={{ marginTop: 16, fontSize: 14, background: t.cardBg2, color: t.text, borderRadius: 99, padding: "9px 12px", textAlign: "center", fontWeight: 600 }}>+ Inviter</div>
      </div>
    </RightPanel>
  );
}
function SharedFile({ theme: t, icon, name, meta }: { theme: AppTheme; icon: React.ReactNode; name: string; meta: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, background: t.rowActiveBg, borderRadius: 10, padding: "8px 10px" }}>
      {icon}
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={ellipsis(11, 600, t.text)}>{name}</div>
        <div style={{ fontSize: 13, color: t.muted }}>{meta}</div>
      </div>
    </div>
  );
}
function Participant({ theme: t, online, avatar, avatarBg, name, badge, offlineLabel }: { theme: AppTheme; online?: boolean; avatar: string; avatarBg: string; name: string; badge?: string; offlineLabel?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <span className={online ? "online-dot" : "offline-dot"} />
      <span style={{ width: 26, height: 26, borderRadius: "50%", background: avatarBg, fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }}>{avatar}</span>
      <span style={{ fontSize: 15, color: t.text }}>{name}</span>
      {badge && <span style={{ marginLeft: "auto", fontSize: 13, background: "#fee2e2", color: "#dc2626", borderRadius: 99, padding: "2px 8px", fontWeight: 600 }}>{badge}</span>}
      {offlineLabel && <span style={{ marginLeft: "auto", fontSize: 13, color: t.mutedLight }}>{offlineLabel}</span>}
    </div>
  );
}
