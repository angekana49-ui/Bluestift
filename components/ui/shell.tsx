"use client";

import type { CSSProperties, ReactNode } from "react";
import type { AppTheme } from "./tokens";

/**
 * AppShell — the shared frame for the RAYA and Schools apps.
 *
 * Flat by design: no cloud backdrop, no floating cards, no gaps. The content
 * zone is the primary surface and the side panels are simply adjacent panels
 * in a different tone, told apart by a single 1px border — the same language
 * as the sign-in split. Responsive behaviour (panels folding into drawers)
 * lives in the `.app-*` classes in globals.css; see the tier table there.
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
      className="app-shell"
      style={{ background: t.pageBase, color: t.text, transition: "background .4s ease" }}
    >
      {children}
    </div>
  );
}

/**
 * Dimmer behind an open drawer (smallest tier only — it's `display:none`
 * above 900px). Clicking it closes whichever panel is open.
 */
export function Scrim({ open, onClick }: { open: boolean; onClick: () => void }) {
  return (
    <div
      className={`app-scrim${open ? " is-open" : ""}`}
      onClick={onClick}
      aria-hidden={!open}
    />
  );
}

/**
 * Header shown only in the smallest tier: a drawer toggle on each side with
 * the current screen's title between them. Hidden above 900px, where both
 * panels are visible inline and these controls would be redundant.
 */
export function MobileHeader({
  theme: t,
  title,
  onOpenLeft,
  onOpenRight,
}: {
  theme: AppTheme;
  title: string;
  onOpenLeft: () => void;
  onOpenRight?: () => void;
}) {
  return (
    <div
      className="app-mobile-header"
      style={{ borderBottom: `1px solid ${t.cardBorder}`, background: t.cardBg }}
    >
      <IconButton theme={t} onClick={onOpenLeft} title="Open menu" size={34} radius={10}>
        <IconBurger />
      </IconButton>
      <span
        style={{
          flex: 1,
          minWidth: 0,
          textAlign: "center",
          fontSize: 14,
          fontWeight: 700,
          color: t.text,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {title}
      </span>
      {onOpenRight ? (
        <IconButton theme={t} onClick={onOpenRight} title="Open panel" size={34} radius={10}>
          <IconPanelRight />
        </IconButton>
      ) : (
        /* Keeps the title optically centred when there's no right panel. */
        <span style={{ width: 34, flex: "none" }} aria-hidden />
      )}
    </div>
  );
}

function IconBurger() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}

function IconPanelRight() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M15 4v16" />
    </svg>
  );
}


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
  open = false,
  children,
}: {
  theme: AppTheme;
  collapsed: boolean;
  expandedWidth: number;
  onBackgroundClick: () => void;
  /** Drawer state — only meaningful in the smallest tier, where the sidebar
   *  is an overlay. Ignored above 900px, where it is always visible. */
  open?: boolean;
  children: ReactNode;
}) {
  const width = collapsed ? 68 : expandedWidth;
  return (
    <div
      className={`app-sidebar${open ? " is-open" : ""}`}
      onClick={onBackgroundClick}
      style={{
        /* CSS reads these so the drawer tier can override the width without
           an inline style winning the cascade. */
        ["--app-sidebar-w" as string]: `${width}px`,
        ["--app-sidebar-w-open" as string]: `${expandedWidth}px`,
        background: t.sidebarBg,
        borderRight: `1px solid ${t.sidebarBorder}`,
        padding: "20px 14px",
        gap: 3,
        transition: "background .4s ease,border-color .4s ease,width .25s ease",
      }}
    >
      {children}
    </div>
  );
}

/** Small chevron used by the sidebar collapse toggle (down-chevron, rotated). */
function ToggleChevron({ collapsed }: { collapsed: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ transform: collapsed ? "rotate(-90deg)" : "rotate(90deg)", transition: "transform .2s ease" }}
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

/**
 * Brand row (logo + wordmark) at the top of the sidebar. When `onToggle` is
 * given it also carries the collapse/expand button — the explicit affordance for
 * folding the sidebar to the icon rail (previously only a hidden background click).
 */
export function SidebarBrand({
  theme: t,
  collapsed,
  logoSrc,
  logoSrcDark,
  logoRadius = 7,
  logoSize = 26,
  name,
  onToggle,
}: {
  theme: AppTheme;
  collapsed: boolean;
  logoSrc: string;
  /** Optional dark-mode logo (e.g. emerald rosace); falls back to `logoSrc`. */
  logoSrcDark?: string;
  logoRadius?: number;
  logoSize?: number;
  name: string;
  /** Toggle the icon-rail collapse. When set, a chevron button is shown. */
  onToggle?: () => void;
}) {
  const src = t.dark && logoSrcDark ? logoSrcDark : logoSrc;
  const toggleBtn = onToggle ? (
    <button
      type="button"
      className="app-collapse-toggle"
      aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      title={collapsed ? "Expand" : "Collapse"}
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: 28,
        height: 28,
        flex: "none",
        borderRadius: 8,
        border: `1px solid ${t.sidebarBorder}`,
        background: "transparent",
        color: t.sidebarMuted,
        cursor: "pointer",
      }}
    >
      <ToggleChevron collapsed={collapsed} />
    </button>
  ) : null;

  return (
    <div
      className="app-rail-center"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        marginBottom: 20,
        padding: "0 6px",
        justifyContent: collapsed ? "center" : "flex-start",
      }}
    >
      {/* In the collapsed rail the toggle *replaces* the logo, so a single tap
          re-expands; expanded, the logo/name sit left and the toggle sits right. */}
      {collapsed && onToggle ? (
        toggleBtn
      ) : (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt=""
            style={{ width: logoSize, height: logoSize, borderRadius: logoRadius, objectFit: "contain", flex: "none" }}
          />
          {!collapsed && (
            <span
              className="app-rail-hide"
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
          {!collapsed && onToggle && (
            <>
              <span style={{ flex: 1 }} />
              {toggleBtn}
            </>
          )}
        </>
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
      className="navitem app-rail-center"
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
          className="app-rail-hide"
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
      {!collapsed && <span className="app-rail-hide">{trailing}</span>}
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
      className="app-rail-center"
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
        <span className="app-rail-hide" style={{ display: "flex", flexDirection: "column", minWidth: 0, lineHeight: 1.25 }}>
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

/**
 * The primary content zone (chat, dashboard, …). Fills the space the panels
 * leave and is the only child allowed to shrink — hence `min-width:0` in the
 * `.app-main` class rather than the old fixed `minWidth`, which is what used
 * to push the layout off-screen on narrow viewports.
 *
 * `column` stacks header + body vertically. `minWidth` is accepted for
 * backwards compatibility but ignored: a hard floor here is exactly what
 * breaks responsiveness.
 */
export function MainCard({
  theme: t,
  column,
  children,
}: {
  theme: AppTheme;
  column?: boolean;
  /** @deprecated no longer applied — kept so existing call sites still compile. */
  minWidth?: number;
  children: ReactNode;
}) {
  return (
    <div
      className="app-main"
      style={{
        background: t.cardBg,
        flexDirection: column ? "column" : "row",
        transition: "background .4s ease",
      }}
    >
      {children}
    </div>
  );
}

/** Shared height of the header rows, so the panel's title bar lines up with
 *  the content zone's own header instead of sitting a few px off. */
export const RETRACT_HEADER_PAD = "16px 24px";
export const RETRACT_HEADER_MIN_H = 64;

/** Comfortable reading width for a conversation column on wide screens; the
 *  thread and composer centre within it and fall back to full width below it.
 *  Shared by the Raya chat and the Schools RAYA chat so both read identically. */
export const THREAD_MAX_W = 760;

/**
 * Secondary right-hand panel (notifications, recommendations, …). It pushes the
 * content zone inline on wide viewports and only becomes an overlay drawer on
 * small screens, where `open` drives it (see `.app-right` in globals.css).
 *
 * It wears its own `rightBg` tone — related to the sidebar but less blue — so
 * the two navbars frame the content without reading as one flat slab. Pass a
 * `title`; a chevron collapse button is rendered for you and calls `onCollapse`.
 */
export function RightPanel({
  theme: t,
  width = 270,
  padding = 18,
  open = true,
  title,
  onCollapse,
  children,
}: {
  theme: AppTheme;
  width?: number;
  padding?: number;
  /** Defaults to true because every call site already unmounts this panel when
   *  it's hidden — mounted means open. Pass false only to animate it out. */
  open?: boolean;
  title?: ReactNode;
  onCollapse?: () => void;
  children: ReactNode;
}) {
  return (
    <div
      className={`app-right${open ? " is-open" : ""}`}
      style={{
        ["--app-right-w" as string]: `${width}px`,
        background: t.rightBg,
        borderLeft: `1px solid ${t.rightBorder}`,
        transition: "background .4s ease,border-color .4s ease",
      }}
    >
      {(title != null || onCollapse) && (
        <div
          style={{
            flex: "none",
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: RETRACT_HEADER_PAD,
            minHeight: RETRACT_HEADER_MIN_H,
            boxSizing: "border-box",
            borderBottom: `1px solid ${t.rightBorder}`,
          }}
        >
          <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, fontWeight: 700, color: t.text }}>
            {title}
          </span>
          {onCollapse && (
            <IconButton theme={t} onClick={onCollapse} title="Collapse panel">
              <IconCollapseRight />
            </IconButton>
          )}
        </div>
      )}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflow: "auto",
          padding,
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        {children}
      </div>
    </div>
  );
}

function IconCollapseRight() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13 6l6 6-6 6M5 6l6 6-6 6" />
    </svg>
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
