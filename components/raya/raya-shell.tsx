"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  AppShell,
  Sidebar,
  SidebarBrand,
  SidebarProfile,
  NavItem,
  MainCard,
  MobileHeader,
  Scrim,
} from "@/components/ui/shell";
import {
  IconChat,
  IconRooms,
  IconTools,
  IconKernel,
  IconSettings,
  IconChevron,
} from "@/components/ui/icons";
import type { AppTheme } from "@/components/ui/tokens";

/** RAYA student-app nav → real routes. `key` matches each page's `active` prop. */
const NAV = [
  { key: "chat", label: "Chat", href: "/chat", Icon: IconChat },
  { key: "rooms", label: "Rooms", href: "/rooms", Icon: IconRooms },
  { key: "tools", label: "Tools", href: "/tools", Icon: IconTools },
  { key: "kernel", label: "My Kernel", href: "/profile", Icon: IconKernel },
  { key: "settings", label: "Settings", href: "/account", Icon: IconSettings },
] as const;

export type RayaNav = (typeof NAV)[number]["key"];

/**
 * Shared chrome for the RAYA student app: the cloud shell + collapsible sidebar
 * (nav routes to /chat, /rooms, /tools, /profile, /account) + the main card, with
 * optional `chatHistory` (rendered under the Chat item on the chat route) and an
 * optional `rightPanel` sibling card. The page owns the theme (via useDarkMode)
 * and passes it in, so the whole surface stays on one dark-mode source of truth.
 */
export function RayaShell({
  theme: t,
  active,
  profileName,
  profileInitials,
  profileSubtitle,
  profileAvatarBg = "#6366f1",
  profileAvatarUrl,
  chatHistory,
  rightPanel,
  onToggleRight,
  children,
}: {
  theme: AppTheme;
  active: RayaNav;
  profileName: string;
  profileInitials: string;
  /** Optional second line under the name (e.g. the plan/forfait). */
  profileSubtitle?: string;
  profileAvatarBg?: string;
  profileAvatarUrl?: string | null;
  chatHistory?: ReactNode;
  rightPanel?: ReactNode;
  /** Lets the small-screen header toggle the caller's right panel. Without it
   *  the header shows no right-hand button. */
  onToggleRight?: () => void;
  /** @deprecated the content zone no longer takes a width floor. */
  mainMinWidth?: number;
  children: ReactNode;
}) {
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [chatHistOpen, setChatHistOpen] = useState(true);
  /** Small-screen only: the sidebar is an overlay drawer. */
  const [navOpen, setNavOpen] = useState(false);

  // While the drawer is open the sidebar is always full width, so the collapsed
  // icon-rail must not apply — otherwise labels vanish inside a wide drawer.
  const effectiveCollapsed = navOpen ? false : collapsed;

  const showChatList =
    active === "chat" && !effectiveCollapsed && chatHistOpen && chatHistory != null;

  const go = (href: string) => {
    setNavOpen(false);
    router.push(href);
  };

  return (
    <AppShell theme={t}>
      <Scrim open={navOpen} onClick={() => setNavOpen(false)} />

      <Sidebar
        theme={t}
        collapsed={effectiveCollapsed}
        expandedWidth={212}
        open={navOpen}
        // Clicking the sidebar background toggles the icon rail, but only when
        // it's a real sidebar — inside an open drawer that gesture is a no-op.
        onBackgroundClick={() => {
          if (!navOpen) setCollapsed((c) => !c);
        }}
      >
        <SidebarBrand
          theme={t}
          collapsed={effectiveCollapsed}
          logoSrc="/raya-mark.png"
          logoSrcDark="/raya-mark-violet.png"
          logoRadius={0}
          logoSize={52}
          name="RAYA"
          onToggle={() => setCollapsed((c) => !c)}
        />

        {NAV.map(({ key, label, href, Icon }) => {
          const isChat = key === "chat";
          return (
            <div key={key}>
              <NavItem
                theme={t}
                active={active === key}
                collapsed={effectiveCollapsed}
                icon={<Icon />}
                label={label}
                onClick={() => go(href)}
                trailing={
                  isChat && chatHistory != null && !effectiveCollapsed ? (
                    <span
                      role="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setChatHistOpen((o) => !o);
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
                        style={{ transform: chatHistOpen ? "rotate(0deg)" : "rotate(-90deg)" }}
                      />
                    </span>
                  ) : undefined
                }
              />
              {isChat && showChatList && (
                <div className="app-rail-hide" style={{ padding: "6px 6px 8px 30px", display: "flex", flexDirection: "column", gap: 2 }}>
                  {chatHistory}
                </div>
              )}
            </div>
          );
        })}

        <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: 12 }}>
          <SidebarProfile
            theme={t}
            collapsed={effectiveCollapsed}
            initials={profileInitials}
            name={profileName}
            subtitle={profileSubtitle}
            avatarBg={profileAvatarBg}
            avatarUrl={profileAvatarUrl}
            onClick={() => go("/account")}
          />
        </div>
      </Sidebar>

      <MainCard theme={t} column>
        <MobileHeader
          theme={t}
          title={NAV.find((n) => n.key === active)?.label ?? "RAYA"}
          onOpenLeft={() => setNavOpen(true)}
          onOpenRight={onToggleRight}
        />
        <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
          {children}
        </div>
      </MainCard>

      {/* Dimmer behind the right panel when it's an overlay (< 900px). The
          panel is unmounted when closed, so "present" means "open". Harmless
          above 900px, where the scrim CSS is display:none and the panel is
          inline. */}
      {rightPanel != null && onToggleRight && (
        <Scrim open onClick={onToggleRight} />
      )}
      {rightPanel}
    </AppShell>
  );
}
