/**
 * Line-icon set for the connected app. No icon font/library anywhere — every
 * icon is a minimal inline SVG (stroke-based, `stroke-width` 1.7–2.2, round
 * caps/joins), matching the marketing site's "no icon set" rule. Paths are
 * ported verbatim from the design handoff references. Color = `currentColor`.
 */
import type { CSSProperties } from "react";

type IconProps = { size?: number; strokeWidth?: number; style?: CSSProperties };

function Svg({
  size = 16,
  strokeWidth = 1.7,
  style,
  children,
}: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
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

export const IconChat = (p: IconProps) => (
  <Svg {...p}>
    <path d="M21 12c0 4.1-4 7.5-9 7.5-1.1 0-2.2-.16-3.2-.47L4 20.5l1.2-3.4C4.44 15.9 4 14.5 4 13 4 8.9 8 5.5 13 5.5s8 3.4 8 6.5Z" />
  </Svg>
);

export const IconRooms = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="9" cy="8" r="3" />
    <path d="M3.5 19c.7-2.8 3-4.5 5.5-4.5s4.8 1.7 5.5 4.5" />
    <circle cx="17" cy="8" r="2.4" />
    <path d="M15.2 14.6c2.1.2 4 1.8 4.6 4.4" />
  </Svg>
);

export const IconTools = (p: IconProps) => (
  <Svg {...p}>
    <path d="M14.7 6.3a4 4 0 0 0-5.4 4.9l-6 6a2 2 0 0 0 2.8 2.8l6-6a4 4 0 0 0 4.9-5.4l-2.6 2.6-2.3-2.3Z" />
  </Svg>
);

export const IconKernel = (p: IconProps) => (
  <Svg {...p}>
    <path d="M9 4.5a3 3 0 0 0-3 3v.2A3 3 0 0 0 4.5 10.5a3 3 0 0 0 1 5.6A3 3 0 0 0 9 19.5h1v-15Z" />
    <path d="M15 4.5a3 3 0 0 1 3 3v.2a3 3 0 0 1 1.5 2.8 3 3 0 0 1-1 5.6 3 3 0 0 1-3.5 3.4h-1v-15Z" />
  </Svg>
);

export const IconSettings = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 13.5a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.9 2.9l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V20a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.9-2.9l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H4a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.9-2.9l.1.1a1.7 1.7 0 0 0 1.9.3H10a1.7 1.7 0 0 0 1-1.5V4a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.9 2.9l-.1.1a1.7 1.7 0 0 0-.3 1.9V10a1.7 1.7 0 0 0 1.5 1H20a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
  </Svg>
);

export const IconBilling = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3" y="5.5" width="18" height="13" rx="2.5" />
    <path d="M3 9.5h18" />
    <path d="M6.5 14.5h3" />
  </Svg>
);

export const IconOverview = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 20V10M10 20V4M16 20v-7M20 20v-4" />
  </Svg>
);

export const IconClasses = (p: IconProps) => (
  <Svg {...p}>
    <path d="M5 20V9l7-4.5L19 9v11" />
    <path d="M9.5 20v-6h5v6" />
  </Svg>
);

export const IconChevron = (p: IconProps) => (
  <Svg strokeWidth={2.2} {...p}>
    <path d="M6 9l6 6 6-6" />
  </Svg>
);

export const IconFile = (p: IconProps) => (
  <Svg strokeWidth={1.8} {...p}>
    <path d="M8 3.5h6l4 4V19a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 6 19V5A1.5 1.5 0 0 1 8 3.5Z" />
    <path d="M14 3.5V8h4" />
  </Svg>
);

export const IconImage = (p: IconProps) => (
  <Svg strokeWidth={1.8} {...p}>
    <rect x="4" y="4" width="16" height="16" rx="2.5" />
    <circle cx="9" cy="10" r="1.6" />
    <path d="M5 17l4.5-4.5 3 3L18 10" />
  </Svg>
);

/** Right-panel toggle — rect + vertical line ("sidebar" glyph). */
export const IconPanel = (p: IconProps) => (
  <Svg strokeWidth={1.8} {...p}>
    <rect x="3" y="4" width="18" height="16" rx="3" />
    <path d="M15 4v16" />
  </Svg>
);

export const IconMic = (p: IconProps) => (
  <Svg strokeWidth={1.8} {...p}>
    <rect x="9" y="3" width="6" height="11" rx="3" />
    <path d="M5 11a7 7 0 0 0 14 0" />
    <path d="M12 18v3" />
  </Svg>
);

export const IconAttach = (p: IconProps) => (
  <Svg strokeWidth={1.8} {...p}>
    <path d="M17.5 8.5 9.9 16.1a3 3 0 0 1-4.24-4.24l7.6-7.6a2 2 0 0 1 2.83 2.83l-7.24 7.24a1 1 0 0 1-1.42-1.41l6.36-6.36" />
  </Svg>
);

/** AI-mode toggle — radiant sun/sparkle. */
export const IconAiMode = (p: IconProps) => (
  <Svg strokeWidth={1.8} {...p}>
    <path d="M12 3v3M12 18v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M3 12h3M18 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" />
    <circle cx="12" cy="12" r="3.2" />
  </Svg>
);

export const IconLock = (p: IconProps) => (
  <Svg strokeWidth={2} {...p}>
    <rect x="5" y="11" width="14" height="9" rx="2" />
    <path d="M8 11V7a4 4 0 0 1 8 0v4" />
  </Svg>
);

export const IconQuiz = (p: IconProps) => (
  <Svg {...p}>
    <rect x="5" y="3.5" width="14" height="17" rx="2" />
    <path d="M8.5 8.5h7M8.5 12h7M8.5 15.5h4" />
  </Svg>
);

export const IconFlashcards = (p: IconProps) => (
  <Svg {...p}>
    <rect x="6" y="6.5" width="14" height="10" rx="2" />
    <rect x="4" y="9" width="14" height="10" rx="2" />
  </Svg>
);

export const IconSummary = (p: IconProps) => (
  <Svg {...p}>
    <path d="M8 3.5h6l4 4V19a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 6 19V5A1.5 1.5 0 0 1 8 3.5Z" />
    <path d="M14 3.5V8h4" />
    <path d="M9 12h6M9 15.5h6" />
  </Svg>
);

export const IconCheck = (p: IconProps) => (
  <Svg strokeWidth={2.2} {...p}>
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </Svg>
);
