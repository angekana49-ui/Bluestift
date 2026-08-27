/**
 * Inline line-icons for the marketing site (survey / feedback / walls).
 * No icon font or library — every glyph is a minimal stroke-based SVG on a
 * 24×24 grid, `currentColor`, round caps/joins — matching the connected app's
 * set in `components/ui/icons.tsx`. `filled` variants use the current color as
 * a soft fill for "active" states (rating stars, reactions).
 */
import type { CSSProperties } from "react";

type IconProps = { size?: number; strokeWidth?: number; filled?: boolean; style?: CSSProperties };

function Svg({
  size = 16,
  strokeWidth = 1.7,
  filled = false,
  style,
  children,
}: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ flex: "none", ...style }}
    >
      {children}
    </svg>
  );
}

/** Teacher — a presentation board on a stand. */
export const IconTeacher = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3 4h18" />
    <path d="M20 4v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4" />
    <path d="m8 21 4-4 4 4" />
    <path d="M12 16v5" />
  </Svg>
);

/** Globe — a circle with one meridian ellipse and the equator, for the
 *  language switcher. */
export const IconGlobe = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18" />
    <path d="M12 3c2.8 2.5 4.4 5.7 4.4 9s-1.6 6.5-4.4 9c-2.8-2.5-4.4-5.7-4.4-9s1.6-6.5 4.4-9Z" />
  </Svg>
);

/** Student — a graduation cap. */
export const IconStudent = (p: IconProps) => (
  <Svg {...p}>
    <path d="M21.5 9.5 12 5 2.5 9.5 12 14l9.5-4.5Z" />
    <path d="M6 11.4V16c0 1.1 2.7 2.5 6 2.5s6-1.4 6-2.5v-4.6" />
    <path d="M21.5 9.5v4.5" />
  </Svg>
);

/** Anonymous — a generic person bust. */
export const IconUser = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="8" r="3.6" />
    <path d="M4.5 20c.6-4 3.8-6 7.5-6s6.9 2 7.5 6" />
  </Svg>
);

/** Suggestion — a lightbulb. */
export const IconLightbulb = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 3a6 6 0 0 0-3.9 10.6c.6.5.9 1.2.9 2v.4h6v-.4c0-.8.3-1.5.9-2A6 6 0 0 0 12 3Z" />
    <path d="M9.5 20h5" />
    <path d="M10 22h4" />
  </Svg>
);

/** Bug — a rounded body with legs and antennae. */
export const IconBug = (p: IconProps) => (
  <Svg {...p}>
    <rect x="8" y="8" width="8" height="10" rx="4" />
    <path d="M9 9.2V6.5a3 3 0 0 1 6 0v2.7" />
    <path d="M8 12H4M20 12h-4M8 16l-3 2M19 18l-3-2M8.2 8.2 5.5 6M18.5 6l-2.7 2.2" />
  </Svg>
);

/** Feature — a pair of sparkles. */
export const IconSparkle = (p: IconProps) => (
  <Svg {...p}>
    <path d="M11 3.5 12.7 8 17 9.7 12.7 11.4 11 16l-1.7-4.6L5 9.7 9.3 8 11 3.5Z" />
    <path d="M18 14.5 18.9 17 21.5 18l-2.6 1 -.9 2.5-.9-2.5L14.5 18l2.6-1 .9-2.5Z" />
  </Svg>
);

/** Praise / thanks — a heart. */
export const IconHeart = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 20.3 4.5 13a4.6 4.6 0 0 1 0-6.5 4.6 4.6 0 0 1 6.5 0l1 1 1-1a4.6 4.6 0 0 1 6.5 0 4.6 4.6 0 0 1 0 6.5L12 20.3Z" />
  </Svg>
);

/** Other — a speech bubble. */
export const IconChatBubble = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 5.5A1.5 1.5 0 0 1 5.5 4h13A1.5 1.5 0 0 1 20 5.5v9a1.5 1.5 0 0 1-1.5 1.5H9l-4 3.5v-3.5H5.5A1.5 1.5 0 0 1 4 14.5v-9Z" />
  </Svg>
);

/** Rating — a five-point star. */
export const IconStar = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 3.5 14.6 8.8l5.9.9-4.25 4.15 1 5.85L12 17.1 6.75 19.7l1-5.85L3.5 9.7l5.9-.9L12 3.5Z" />
  </Svg>
);

/** Important — a flame. */
export const IconFlame = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 3c.5 2.5 2 4.3 3.5 5.6C17 10 18 11.6 18 13.5a6 6 0 0 1-12 0c0-1 .3-1.9.9-2.6.3.9 1 1.3 1.7 1.3 1.2 0 1.7-1 1.2-2.6C9.3 6.9 10 4.7 12 3Z" />
  </Svg>
);

/** Share freely — a pencil. */
export const IconPencil = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 20h4L18.5 9.5a2.12 2.12 0 0 0-3-3L5 17v3Z" />
    <path d="m13.5 6.5 3 3" />
  </Svg>
);

/** Confirm — a check mark. */
export const IconCheck = (p: IconProps) => (
  <Svg strokeWidth={2.2} {...p}>
    <path d="M5 12.5 9.5 17 19 7.5" />
  </Svg>
);
