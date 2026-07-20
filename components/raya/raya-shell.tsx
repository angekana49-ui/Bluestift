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
  profileAvatarBg = "#6366f1",
  profileAvatarUrl,
  chatHistory,
  rightPanel,
  mainMinWidth = 380,
  children,
}: {
  theme: AppTheme;
  active: RayaNav;
  profileName: string;
  profileInitials: string;
  profileAvatarBg?: string;
  profileAvatarUrl?: string | null;
  chatHistory?: ReactNode;
  rightPanel?: ReactNode;
  mainMinWidth?: number;
  children: ReactNode;
}) {
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [chatHistOpen, setChatHistOpen] = useState(true);

  const showChatList =
    active === "chat" && !collapsed && chatHistOpen && chatHistory != null;

  return (
    <AppShell theme={t}>
      <Sidebar
        theme={t}
        collapsed={collapsed}
        expandedWidth={212}
        onBackgroundClick={() => setCollapsed((c) => !c)}
      >
        <SidebarBrand theme={t} collapsed={collapsed} logoSrc="/raya-mark.png" logoSrcDark="/raya-mark-violet.png" logoRadius={0} logoSize={52} name="RAYA" />

        {NAV.map(({ key, label, href, Icon }) => {
          const isChat = key === "chat";
          return (
            <div key={key}>
              <NavItem
                theme={t}
                active={active === key}
                collapsed={collapsed}
                icon={<Icon />}
                label={label}
                onClick={() => router.push(href)}
                trailing={
                  isChat && chatHistory != null && !collapsed ? (
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
                <div style={{ padding: "6px 6px 8px 30px", display: "flex", flexDirection: "column", gap: 2 }}>
                  {chatHistory}
                </div>
              )}
            </div>
          );
        })}

        <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: 12 }}>
          <SidebarProfile
            theme={t}
            collapsed={collapsed}
            initials={profileInitials}
            name={profileName}
            avatarBg={profileAvatarBg}
            avatarUrl={profileAvatarUrl}
            onClick={() => router.push("/account")}
          />
        </div>
      </Sidebar>

      <MainCard theme={t} minWidth={mainMinWidth}>
        {children}
      </MainCard>

      {rightPanel}
    </AppShell>
  );
}
