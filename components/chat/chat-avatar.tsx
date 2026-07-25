"use client";

import type { AppTheme } from "@/components/ui/tokens";

/**
 * A small round chat avatar shared by every chat surface. Raya always wears its
 * logo (theme-aware mark); a human wears their profile photo when we have one,
 * otherwise a coloured circle with their initials (e.g. "J" / "AR"). Kept in one
 * place so the solo chat, the school chat and both room channels stay identical.
 */
export function ChatAvatar({
  theme: t,
  size = 28,
  isRaya = false,
  initials,
  avatarUrl,
  bg,
}: {
  theme: AppTheme;
  size?: number;
  isRaya?: boolean;
  initials?: string;
  avatarUrl?: string | null;
  bg?: string;
}) {
  const base: React.CSSProperties = {
    width: size,
    height: size,
    borderRadius: "50%",
    flexShrink: 0,
    overflow: "hidden",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: Math.round(size * 0.4),
    fontWeight: 700,
    lineHeight: 1,
  };

  if (isRaya) {
    return (
      <span style={{ ...base, background: t.dark ? "#141b2e" : "#ffffff", border: `1px solid ${t.cardBorder}` }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={t.dark ? "/raya-mark-violet.png" : "/raya-mark.png"}
          alt="Raya"
          style={{ width: "82%", height: "82%", objectFit: "contain" }}
        />
      </span>
    );
  }

  if (avatarUrl) {
    return (
      <span style={base}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={avatarUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      </span>
    );
  }

  return (
    <span style={{ ...base, background: bg ?? (t.dark ? "#334155" : "#c7d2fe"), color: t.dark ? "#e2e8f0" : "#1e293b" }}>
      {initials || "?"}
    </span>
  );
}
