"use client";

import { useState, type ReactNode } from "react";
import {
  AppShell,
  Sidebar,
  SidebarBrand,
  SidebarProfile,
  NavItem,
  MainCard,
  IconButton,
  MobileHeader,
  PageBody,
  RETRACT_HEADER_PAD,
  RETRACT_HEADER_MIN_H,
  Scrim,
} from "@/components/ui/shell";
import { IconPanel } from "@/components/ui/icons";
import { display, type AppTheme } from "@/components/ui/tokens";
import { RayaText, SchoolsName } from "@/components/ui/brand";
import { DegradedBanner } from "@/components/ui/degraded-banner";
import { initialsOf } from "@/lib/name";

export type SchoolNavItem = {
  key: string;
  label: string;
  icon: ReactNode;
};

/**
 * Shared chrome for the Schools admin/teacher app: the flat shell + sidebar
 * (brand + tab nav + optional Admin/Prof switch + profile) + main card with a
 * header row. Unlike RayaShell the nav drives in-page tab state (passed by the
 * caller via `activeKey`/`onNav`), because school-admin keeps one big tab
 * component rather than separate routes. `rightPanel` is an optional sibling
 * panel; it pushes the content inline on wide screens and becomes an overlay
 * drawer below 900px (see the `.app-*` classes in globals.css).
 */
export function SchoolsShell({
  theme: t,
  brandName = "Schools",
  nav,
  activeKey,
  onNav,
  roleSwitch,
  schoolName,
  schoolInitials,
  profileName,
  profileSubtitle,
  profileAvatarUrl,
  onProfile,
  headerTitle,
  headerSubtitle,
  headerLogoUrl,
  headerRight,
  rightPanel,
  contentFlush = false,
  children,
}: {
  theme: AppTheme;
  brandName?: string;
  nav: SchoolNavItem[];
  activeKey: string;
  onNav: (key: string) => void;
  roleSwitch?: ReactNode;
  schoolName: string;
  schoolInitials: string;
  /** Profile-chip name/subtitle. Defaults to the school name; the teacher
   *  dashboard overrides these with the signed-in teacher's identity. */
  profileName?: string;
  profileSubtitle?: string;
  profileAvatarUrl?: string | null;
  onProfile?: () => void;
  headerTitle?: string;
  headerSubtitle?: string;
  /** School logo shown as a small avatar before the header title, so the header
   *  brands the school (logo + name) instead of a generic dashboard label. */
  headerLogoUrl?: string | null;
  headerRight?: ReactNode;
  rightPanel?: ReactNode;
  /** Drop the content padding/scroll so a child (e.g. a full-height chat) owns
   *  the whole card body. */
  contentFlush?: boolean;
  children: ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [rightOpen, setRightOpen] = useState(true);
  /** Small-screen only: the sidebar is an overlay drawer. */
  const [navOpen, setNavOpen] = useState(false);

  const effectiveCollapsed = navOpen ? false : collapsed;
  const showRight = rightPanel != null && rightOpen;

  const handleNav = (key: string) => {
    setNavOpen(false);
    onNav(key);
  };

  return (
    <AppShell theme={t}>
      <Scrim open={navOpen} onClick={() => setNavOpen(false)} />

      <Sidebar
        theme={t}
        collapsed={effectiveCollapsed}
        expandedWidth={236}
        open={navOpen}
        onBackgroundClick={() => {
          if (!navOpen) setCollapsed((c) => !c);
        }}
      >
        {/* The dashboard brand is Schools (the BlueStift bird). Raya for Schools —
            the assistant — carries the Raya rosette inside its own panel.
            The sidebar always carries the PRODUCT wordmark; `brandName` only
            feeds the header/mobile titles, which show the school. */}
        <SidebarBrand
          theme={t}
          collapsed={effectiveCollapsed}
          logoSrc="/bluestift-mark.png"
          logoSrcDark="/bluestift-mark-dark.png"
          logoRadius={9}
          logoSize={30}
          name={<SchoolsName />}
          onToggle={() => setCollapsed((c) => !c)}
        />

        {nav.map((n) => (
          <NavItem
            key={n.key}
            theme={t}
            active={activeKey === n.key}
            collapsed={effectiveCollapsed}
            icon={n.icon}
            label={n.label}
            onClick={() => handleNav(n.key)}
          />
        ))}

        <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: 12 }}>
          {!effectiveCollapsed && <div className="app-rail-hide">{roleSwitch}</div>}
          <SidebarProfile
            theme={t}
            collapsed={effectiveCollapsed}
            initials={schoolInitials}
            name={profileName ?? schoolName}
            subtitle={profileSubtitle}
            avatarBg="#2f7fe0"
            avatarUrl={profileAvatarUrl}
            onClick={() => onProfile?.()}
          />
        </div>
      </Sidebar>

      <MainCard theme={t} column>
        <MobileHeader
          theme={t}
          title={headerTitle ?? brandName}
          onOpenLeft={() => setNavOpen(true)}
          onOpenRight={rightPanel != null ? () => setRightOpen((o) => !o) : undefined}
        />

        {/* When the content is flush (a full-height chat owns the card), the
            child renders its own header — the shell one would double it up. */}
        {/* RETRACT_HEADER_* — the same pad and height as the chat header and the
            right panel's title bar, so the three line up instead of each
            landing a couple of pixels off the other two. */}
        {!contentFlush && (
        <div
          style={{
            padding: RETRACT_HEADER_PAD,
            minHeight: RETRACT_HEADER_MIN_H,
            boxSizing: "border-box",
            background: t.cardBg,
            display: "flex",
            alignItems: "center",
            gap: 12,
            borderBottom: `1px solid ${t.cardBorder}`,
          }}
        >
          {headerLogoUrl !== undefined && (
            <span
              style={{
                width: 34,
                height: 34,
                borderRadius: 9,
                overflow: "hidden",
                flex: "none",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: headerLogoUrl ? "transparent" : "#2f7fe0",
                color: "#fff",
                fontWeight: 700,
                fontSize: 15,
              }}
            >
              {headerLogoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={headerLogoUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                // The header brands the SCHOOL, so its fallback initials come from
                // the school name (headerTitle) — NOT `schoolInitials`, which is the
                // signed-in person's initials for the sidebar profile chip.
                initialsOf(headerTitle ?? schoolName)
              )}
            </span>
          )}
          <span style={{ display: "flex", flexDirection: "column", minWidth: 0, lineHeight: 1.25 }}>
            <span style={{ fontSize: 18, fontWeight: 800, fontFamily: display, color: t.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              <RayaText>{headerTitle ?? brandName}</RayaText>
            </span>
            {headerSubtitle && (
              <span style={{ fontSize: 14, color: t.muted, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                <RayaText>{headerSubtitle}</RayaText>
              </span>
            )}
          </span>
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 12 }}>
            {headerRight}
            {rightPanel != null && (
              <IconButton
                theme={t}
                onClick={() => setRightOpen((o) => !o)}
                size={34}
                radius={10}
                title={rightOpen ? "Hide panel" : "Show panel"}
                bg={rightOpen ? t.sidebarActiveBg : undefined}
              >
                <IconPanel size={15} />
              </IconButton>
            )}
          </div>
        </div>
        )}
        {contentFlush ? (
          <div style={{ flex: 1, minHeight: 0, minWidth: 0, display: "flex", flexDirection: "column", color: t.text }}>
            <DegradedBanner />
            {children}
          </div>
        ) : (
          /* The same PageBody every Raya route uses. The staff tabs are the
             densest screens in the app, so they get a wider measure than the
             1120px default — but a measure all the same, instead of rows that
             ran the full width of a 27" display. */
          <PageBody maxWidth={1280} style={{ color: t.text }}>
            {/* One honest connectivity strip for every staff tab — each of them
                loads over the network and would otherwise just look empty. */}
            <DegradedBanner />
            {children}
          </PageBody>
        )}
      </MainCard>

      {/* Dimmer behind the right panel while it's an overlay (< 900px). */}
      {showRight && <Scrim open onClick={() => setRightOpen(false)} />}
      {showRight && rightPanel}
    </AppShell>
  );
}
