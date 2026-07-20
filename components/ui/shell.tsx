"use client";

import type { CSSProperties, ReactNode } from "react";
import type { AppTheme } from "./tokens";

/**
 * AppShell — the shared BlueStift sky/cloud frame + floating-card row used by
 * both the RAYA and Schools apps. Two fixed background layers (cloud image +
 * flat haze) sit under a `z-index:1` flex row that holds the sidebar, main card,
 * and optional right panel as *separate* floating cards (an explicit design
 * decision — they are not fused). Every fixed-width flex child keeps a matching
 * `min-width` + `box-sizing:border-box` so it never overflows the viewport.
 */
export function AppShell({
  theme: t,
  children,
}: {
  theme: AppTheme;
  children: ReactNode;
}) {
  return (
    <div
      style={{
        position: "relative",
        minHeight: "100vh",
        width: "100vw",
        overflow: "hidden",
        background: t.pageBase,
        transition: "background .4s ease",
      }}
    >
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 0,
          backgroundImage: "url('/clouds-wide.png')",
          backgroundSize: "cover",
          backgroundPosition: "center 65%",
          opacity: t.cloudOpacity,
          filter: t.cloudFilter,
          transition: "opacity .4s ease,filter .4s ease",
        }}
      />
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 0,
          background: t.hazeOverlay,
          transition: "background .4s ease",
        }}
      />
      <div
        style={{
          position: "relative",
          zIndex: 1,
          display: "flex",
          height: "100vh",
          boxSizing: "border-box",
          padding: 20,
          gap: 18,
        }}
      >
        {children}
      </div>
    </div>
  );
}

const CARD_SHADOW = (t: AppTheme) => t.cardShadow;

/**
 * Sidebar card. Clicking its empty background toggles `collapsed` (nav items
 * inside must stopPropagation — NavItem does this for you). Collapses to a 68px
 * icon rail.
 */
export function Sidebar({
  theme: t,
  collapsed,
  expandedWidth,
  onBackgroundClick,
  children,
}: {
  theme: AppTheme;
  collapsed: boolean;
  expandedWidth: number;
  onBackgroundClick: () => void;
  children: ReactNode;
}) {
  const width = collapsed ? 68 : expandedWidth;
  return (
    <div
      onClick={onBackgroundClick}
      style={{
        boxSizing: "border-box",
        width,
        flex: "none",
        minWidth: width,
        background: t.sidebarBg,
        border: `1px solid ${t.sidebarBorder}`,
        borderRadius: 22,
        boxShadow: CARD_SHADOW(t),
        padding: "20px 14px",
        display: "flex",
        flexDirection: "column",
        gap: 3,
        transition:
          "background .4s ease,border-color .4s ease,width .25s ease",
      }}
    >
      {children}
    </div>
  );
}

/** Brand row (logo + wordmark) at the top of the sidebar. */
export function SidebarBrand({
  theme: t,
  collapsed,
  logoSrc,
  logoSrcDark,
  logoRadius = 7,
  logoSize = 26,
  name,
}: {
  theme: AppTheme;
  collapsed: boolean;
  logoSrc: string;
  /** Optional dark-mode logo (e.g. emerald rosace); falls back to `logoSrc`. */
  logoSrcDark?: string;
  logoRadius?: number;
  logoSize?: number;
  name: string;
}) {
  const src = t.dark && logoSrcDark ? logoSrcDark : logoSrc;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        marginBottom: 20,
        padding: "0 6px",
        justifyContent: collapsed ? "center" : "flex-start",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        style={{
          width: logoSize,
          height: logoSize,
          borderRadius: logoRadius,
          objectFit: "contain",
          flex: "none",
        }}
      />
      {!collapsed && (
        <span
          style={{
            fontSize: 12.5,
            fontWeight: 800,
            color: t.sidebarText,
            fontFamily: "var(--font-inter-tight),'Inter Tight',sans-serif",
          }}
        >
          {name}
        </span>
      )}
    </div>
  );
}

/** A sidebar nav row. `trailing` renders at the row's trailing edge (chevron). */
export function NavItem({
  theme: t,
  active,
  collapsed,
  icon,
  label,
  onClick,
  trailing,
}: {
  theme: AppTheme;
  active: boolean;
  collapsed: boolean;
  icon: ReactNode;
  label: string;
  onClick: () => void;
  trailing?: ReactNode;
}) {
  return (
    <div
      className="navitem"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      style={{
        background: active ? t.sidebarActiveBg : "transparent",
        color: active ? t.sidebarText : t.sidebarMuted,
        fontWeight: active ? 600 : 400,
        justifyContent: collapsed ? "center" : "flex-start",
      }}
    >
      {icon}
      {!collapsed && (
        <span
          style={{
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            flex: 1,
          }}
        >
          {label}
        </span>
      )}
      {!collapsed && trailing}
    </div>
  );
}

/**
 * Bottom-pinned profile row → routes to Settings. Shows the user's profile photo
 * when `avatarUrl` is set (like Claude/OpenAI/Google apps); otherwise falls back
 * to the tinted initials chip.
 */
export function SidebarProfile({
  theme: t,
  collapsed,
  initials,
  name,
  subtitle,
  avatarBg,
  avatarUrl,
  onClick,
}: {
  theme: AppTheme;
  collapsed: boolean;
  initials: string;
  name: string;
  /** Optional second line under the name (e.g. "Teacher · Math"). */
  subtitle?: string;
  avatarBg: string;
  avatarUrl?: string | null;
  onClick: () => void;
}) {
  return (
    <div
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      style={{
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "12px 6px",
        borderTop: `1px solid ${t.sidebarDivider}`,
        justifyContent: collapsed ? "center" : "flex-start",
        borderRadius: 10,
      }}
    >
      <span
        style={{
          width: 28,
          height: 28,
          borderRadius: "50%",
          overflow: "hidden",
          background: avatarUrl ? "transparent" : avatarBg,
          color: "#fff",
          fontSize: 11,
          fontWeight: 700,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flex: "none",
        }}
      >
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatarUrl}
            alt=""
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          initials
        )}
      </span>
      {!collapsed && (
        <span style={{ display: "flex", flexDirection: "column", minWidth: 0, lineHeight: 1.25 }}>
          <span
            style={{
              fontSize: 11.5,
              color: t.sidebarText,
              fontWeight: subtitle ? 600 : 400,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {name}
          </span>
          {subtitle && (
            <span
              style={{
                fontSize: 9.5,
                color: t.sidebarMuted,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {subtitle}
            </span>
          )}
        </span>
      )}
    </div>
  );
}

/** Main content card (flex:1). `column` = stack header + body vertically. */
export function MainCard({
  theme: t,
  column,
  minWidth = 380,
  children,
}: {
  theme: AppTheme;
  column?: boolean;
  minWidth?: number;
  children: ReactNode;
}) {
  return (
    <div
      style={{
        boxSizing: "border-box",
        flex: 1,
        minWidth,
        background: t.cardBg,
        backdropFilter: "blur(24px)",
        border: `1px solid ${t.cardBorder}`,
        borderRadius: 22,
        boxShadow: CARD_SHADOW(t),
        overflow: "hidden",
        display: "flex",
        flexDirection: column ? "column" : "row",
        transition: "background .4s ease,border-color .4s ease",
      }}
    >
      {children}
    </div>
  );
}

/** Optional right panel — a separate sibling card with its own gap. */
export function RightPanel({
  theme: t,
  width = 270,
  padding = 18,
  children,
}: {
  theme: AppTheme;
  width?: number;
  padding?: number;
  children: ReactNode;
}) {
  return (
    <div
      style={{
        boxSizing: "border-box",
        width,
        flex: "none",
        minWidth: width,
        background: t.cardBg,
        backdropFilter: "blur(24px)",
        border: `1px solid ${t.cardBorder}`,
        borderRadius: 22,
        boxShadow: CARD_SHADOW(t),
        padding,
        display: "flex",
        flexDirection: "column",
        gap: 16,
        overflow: "auto",
        transition: "background .4s ease,border-color .4s ease",
      }}
    >
      {children}
    </div>
  );
}

/** Small rounded icon button (right-panel toggle, files button, etc.). */
export function IconButton({
  theme: t,
  onClick,
  title,
  bg,
  color,
  size = 28,
  radius = 8,
  children,
  style,
}: {
  theme: AppTheme;
  onClick?: () => void;
  title?: string;
  bg?: string;
  color?: string;
  size?: number;
  radius?: number;
  children: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <span
      role="button"
      title={title}
      onClick={
        onClick
          ? (e) => {
              e.stopPropagation();
              onClick();
            }
          : undefined
      }
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        background: bg ?? t.cardBg2,
        color: color ?? t.mutedLight,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        flex: "none",
        ...style,
      }}
    >
      {children}
    </span>
  );
}
