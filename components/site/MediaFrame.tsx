"use client";

import { useEffect, useRef, useState } from "react";
import type { Theme } from "./theme";

/**
 * A looping illustrative clip that only exists while it's on screen.
 *
 * Three deliberate constraints, because this product sells itself on being
 * usable over a weak connection and a landing page full of autoplaying video is
 * the fastest way to make that claim a lie:
 *
 *  1. `preload="none"` plus a src that is only attached once the frame
 *     intersects — a visitor who never scrolls to a clip never downloads it.
 *  2. Playback pauses the moment it leaves view, so a long page isn't decoding
 *     six videos at once on a cheap phone.
 *  3. Under `prefers-reduced-motion` the src is never attached at all: the
 *     poster is the whole experience, which is what that preference means for
 *     decorative motion.
 *
 * The poster is what carries the layout — it renders at the right aspect ratio
 * immediately, so nothing reflows when (or if) the video arrives. When there's
 * no poster the tinted panel underneath stands in, so a slot is never a black
 * rectangle.
 */

export default function MediaFrame({
  theme: t,
  src,
  poster,
  label,
  badge,
  ratio = "16 / 10",
  radius = 0,
}: {
  theme: Theme;
  /** Public path to the clip, e.g. "/media/kernel.mp4". */
  src: string;
  /** Public path to the still frame. Also the entire reduced-motion fallback. */
  poster?: string;
  /** Screen-reader description of the clip. */
  label: string;
  /** Optional chip drawn over the clip. Omit when the copy underneath already
   *  names the thing — two labels a centimetre apart just read as a mistake. */
  badge?: string;
  ratio?: string;
  radius?: number | string;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const onScreen = useRef(false);
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries.some((e) => e.isIntersecting);
        onScreen.current = visible;
        if (visible) {
          setArmed(true);
          // No-op on the very first pass (src isn't attached yet); onCanPlay
          // below is what actually starts it that time.
          void el.play().catch(() => {});
        } else {
          el.pause();
        }
      },
      { threshold: 0.25 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div
      className="pub-media-wrap"
      style={{
        position: "relative",
        aspectRatio: ratio,
        overflow: "hidden",
        borderRadius: radius,
        // Stands in for the poster while it loads, and for good if there's none.
        background: `linear-gradient(135deg, ${t.sectionAltBg} 0%, ${t.chipBg} 100%)`,
      }}
    >
      <video
        ref={ref}
        className="pub-media"
        src={armed ? src : undefined}
        poster={poster}
        muted
        loop
        playsInline
        preload="none"
        aria-label={label}
        onCanPlay={() => {
          if (onScreen.current) void ref.current?.play().catch(() => {});
        }}
        style={{ display: "block", width: "100%", height: "100%", objectFit: "cover" }}
      />
      {/* Keeps the clip from fighting the copy next to it — video is busier than
          anything else on the page and reads as louder than it should. */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          background: t.dark
            ? "linear-gradient(180deg, rgba(10,15,30,0.12) 0%, rgba(10,15,30,0.3) 100%)"
            : "linear-gradient(180deg, rgba(15,23,42,0.02) 0%, rgba(15,23,42,0.1) 100%)",
        }}
      />
      {badge && (
        <span
          style={{
            position: "absolute",
            left: 14,
            top: 14,
            borderRadius: 999,
            padding: "5px 12px",
            fontSize: 11,
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.12em",
            color: t.text,
            background: t.dark ? "rgba(13,21,38,0.78)" : "rgba(255,255,255,0.82)",
            backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)",
            border: `1px solid ${t.cardBorder}`,
          }}
        >
          {badge}
        </span>
      )}
    </div>
  );
}
