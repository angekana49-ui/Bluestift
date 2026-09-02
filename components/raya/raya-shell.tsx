"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { clearLocalData } from "@/lib/net/local-data";
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
import { SettingsSheet, type SettingsGroup } from "@/components/ui/settings-sheet";
import {
  IconChat,
  IconRooms,
  IconTools,
  IconQuiz,
  IconKernel,
  IconSettings,
  IconChevron,
  IconMail,
  IconUpgrade,
  IconBilling,
  IconLock,
  IconAttach,
  IconFile,
} from "@/components/ui/icons";
import type { AppTheme } from "@/components/ui/tokens";
import { RayaName } from "@/components/ui/brand";
import { useTranslate } from "@/components/ui/locale";

/** Raya student-app nav → real routes. `key` matches each page's `active` prop;
 *  `labelKey` is resolved through the message catalogue at render time. */
const NAV = [
  { key: "chat", labelKey: "nav.chat", href: "/chat", Icon: IconChat },
  { key: "rooms", labelKey: "nav.rooms", href: "/rooms", Icon: IconRooms },
  { key: "tools", labelKey: "nav.tools", href: "/tools", Icon: IconTools },
  { key: "assignments", labelKey: "nav.assignments", href: "/assignments", Icon: IconQuiz },
  { key: "kernel", labelKey: "nav.kernel", href: "/profile", Icon: IconKernel },
  { key: "settings", labelKey: "nav.settings", href: "/account", Icon: IconSettings },
] as const;

export type RayaNav = (typeof NAV)[number]["key"];

/**
 * Shared chrome for the Raya student app: the cloud shell + collapsible sidebar
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
  const tr = useTranslate();
  const [supabase] = useState(() => createClient());
  const [collapsed, setCollapsed] = useState(false);
  const [chatHistOpen, setChatHistOpen] = useState(true);
  /** Small-screen only: the sidebar is an overlay drawer. */
  const [navOpen, setNavOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  // The real email, or null for an anonymous account — the synthetic recovery
  // address is not one and must never surface as the learner's. Drives both the
  // "Add your email" incentive and the identity line at the top of the sheet.
  const [email, setEmail] = useState<string | null>(null);
  const isAnon = email == null;

  useEffect(() => {
    let active = true;
    void supabase.auth.getUser().then(({ data }) => {
      if (!active) return;
      const addr = data.user?.email?.toLowerCase() ?? null;
      setEmail(!addr || addr.endsWith("@anon.bluestift.local") ? null : addr);
    });
    return () => {
      active = false;
    };
  }, [supabase]);

  async function signOut() {
    // Shared school machines: queued messages / cached data must not survive
    // into the next student's session.
    await clearLocalData();
    await supabase.auth.signOut();
    router.refresh();
    router.push("/login");
  }

  // While the drawer is open the sidebar is always full width, so the collapsed
  // icon-rail must not apply — otherwise labels vanish inside a wide drawer.
  const effectiveCollapsed = navOpen ? false : collapsed;

  const showChatList =
    active === "chat" && !effectiveCollapsed && chatHistOpen && chatHistory != null;

  const go = (href: string) => {
    setNavOpen(false);
    router.push(href);
  };

  /**
   * The learner's settings, as the sheet lays them out.
   *
   * Two groups, because they answer two different questions: "my account" and
   * "my learning". The Kernel sits in the second on purpose — it is not a
   * preference, it is the record of what Raya knows, and filing it under
   * Account next to the sign-in details would misdescribe it.
   *
   * The rows that point into /account point at a CARD, not at the page: the
   * page is long and three rows landing at its top would be three rows that
   * look like they do the same nothing.
   */
  const settingsGroups: SettingsGroup[] = [
    {
      key: "account",
      title: tr("settings.group.account"),
      rows: [
        // An anonymous account is one cleared browser away from gone, and the
        // learner has no way to know that. Kept first, and kept an incentive
        // rather than a warning.
        ...(isAnon
          ? [{
              key: "email",
              icon: <IconMail />,
              label: tr("menu.addEmail"),
              sublabel: tr("menu.addEmail.sub"),
              tone: "accent" as const,
              onSelect: () => go("/account"),
            }]
          : []),
        {
          key: "profile",
          icon: <IconSettings />,
          label: tr("settings.row.profile"),
          sublabel: tr("settings.row.profile.sub"),
          onSelect: () => go("/account"),
        },
        {
          key: "plan",
          icon: <IconBilling />,
          label: tr("settings.row.plan"),
          value: profileSubtitle,
          onSelect: () => go("/account#plan"),
        },
        {
          key: "upgrade",
          icon: <IconUpgrade />,
          label: tr("menu.upgrade"),
          sublabel: tr("menu.upgrade.sub"),
          tone: "accent",
          onSelect: () => go("/pricing"),
        },
        {
          key: "shares",
          icon: <IconAttach />,
          label: tr("settings.row.shares"),
          sublabel: tr("settings.row.shares.sub"),
          onSelect: () => go("/account#shares"),
        },
        {
          key: "privacy",
          icon: <IconLock />,
          label: tr("settings.row.privacy"),
          sublabel: tr("settings.row.privacy.sub"),
          onSelect: () => go("/account#data"),
        },
        // The controls are one row up; this is the reasoning behind them. Kept
        // as its own row rather than folded into "Privacy" because they answer
        // different questions — "what can I change" and "what are you doing" —
        // and the second one had no route into it from inside the app at all.
        {
          key: "legal",
          icon: <IconFile />,
          label: tr("settings.row.legal"),
          sublabel: tr("settings.row.legal.sub"),
          onSelect: () => go("/legal"),
        },
      ],
    },
    {
      key: "learning",
      title: tr("settings.group.learning"),
      rows: [
        {
          key: "kernel",
          icon: <IconKernel />,
          label: tr("settings.row.kernel"),
          sublabel: tr("settings.row.kernel.sub"),
          onSelect: () => go("/profile"),
        },
      ],
    },
  ];

  return (
    <AppShell theme={t}>
      <Scrim open={navOpen} onClick={() => setNavOpen(false)} />

      <Sidebar
        theme={t}
        collapsed={effectiveCollapsed}
        expandedWidth={236}
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
          logoSrcDark="/raya-mark-dark.png"
          logoRadius={0}
          logoSize={52}
          name={<RayaName />}
          onToggle={() => setCollapsed((c) => !c)}
        />

        {NAV.map(({ key, labelKey, href, Icon }) => {
          const isChat = key === "chat";
          return (
            <div key={key}>
              <NavItem
                theme={t}
                active={active === key}
                collapsed={effectiveCollapsed}
                icon={<Icon />}
                label={tr(labelKey)}
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
            onClick={() => setSettingsOpen(true)}
          />
        </div>
      </Sidebar>

      <MainCard theme={t} column>
        <MobileHeader
          theme={t}
          title={(() => {
            const item = NAV.find((n) => n.key === active);
            return item ? tr(item.labelKey) : "Raya";
          })()}
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

      {settingsOpen && (
        <SettingsSheet
          title={tr("settings.title")}
          identity={email ?? profileName}
          identitySub={email ? profileName : tr("settings.anonymous")}
          groups={settingsGroups}
          onSignOut={signOut}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </AppShell>
  );
}
