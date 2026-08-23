import type { ReactNode } from "react";
import type { Theme } from "./theme";

/**
 * The window chrome the product mockups are shown inside.
 *
 * The mockups themselves (DashboardMockup, the shots in ProductShots.tsx) are
 * real DOM rather than screenshots, which is the right call — they re-theme with
 * the page, stay sharp at any density and never 404. But it costs them the one
 * thing a screenshot gets for free: a screenshot is obviously a picture OF
 * something, and a rounded rectangle floating on a marketing page is just a
 * rounded rectangle. The mockups were reading as diagrams of the product rather
 * than as the product.
 *
 * This supplies the missing frame — the edge, the rail and the address that say
 * "you are looking at an application at a URL you could visit". Everything here
 * is drawn, so it costs no assets and inherits the theme.
 *
 * Deliberately NOT skeuomorphic. No macOS traffic lights (this site has no red
 * or yellow anywhere else, and coloured dots are the single most copied detail
 * on the internet), no laptop bezel with a camera notch, no perspective tilt —
 * a tilted screen is a poster of a product, and it makes the UI inside it
 * unreadable, which is the opposite of the point. The frame is flat, square to
 * the page, and quiet enough that the content stays the loudest thing in it.
 *
 * `size` is not a scale factor — the two variants carry different amounts of
 * detail. At the 340px of a feature card the address pill would be four
 * illegible pixels of text, so `sm` drops it and keeps only the rail.
 */

export type FrameSize = "lg" | "sm";

const LOCK_PATH =
  "M5 7V5a3 3 0 0 1 6 0v2h.5A1.5 1.5 0 0 1 13 8.5v4A1.5 1.5 0 0 1 11.5 14h-7A1.5 1.5 0 0 1 3 12.5v-4A1.5 1.5 0 0 1 4.5 7H5Zm1.5 0h3V5a1.5 1.5 0 0 0-3 0v2Z";

export default function BrowserFrame({
  theme: t,
  url,
  size = "lg",
  children,
}: {
  theme: Theme;
  /** Shown in the address pill. Omitted entirely at `size="sm"`. */
  url?: string;
  size?: FrameSize;
  children: ReactNode;
}) {
  const lg = size === "lg";
  const barH = lg ? 42 : 26;
  const dot = lg ? 10 : 6;
  const radius = lg ? 18 : 12;

  return (
    <div
      className={`pub-frame pub-frame-${size}`}
      style={{
        position: "relative",
        borderRadius: radius,
        // The bezel. A single border reads as a drawn outline; a border plus a
        // hairline of light along the top edge reads as a physical edge catching
        // the room, which is most of the difference between the two.
        border: `1px solid ${t.dark ? "rgba(255,255,255,0.10)" : "rgba(15,23,42,0.10)"}`,
        background: t.dark
          ? "linear-gradient(180deg,#141d33 0%,#0f1729 100%)"
          : "linear-gradient(180deg,#fbfcfe 0%,#f1f5fa 100%)",
        boxShadow: lg
          ? // Contact shadow, mid, and a wide soft one. Three layers because a
            // single large blur floats and never lands — the tight first layer
            // is what puts the frame ON the page rather than above it.
            t.dark
            ? "0 1px 2px rgba(0,0,0,0.5), 0 12px 28px rgba(0,0,0,0.36), 0 44px 96px rgba(0,0,0,0.44)"
            : "0 1px 2px rgba(15,23,42,0.07), 0 12px 28px rgba(15,23,42,0.09), 0 44px 96px rgba(15,23,42,0.16)"
          : t.dark
            ? "0 1px 2px rgba(0,0,0,0.4), 0 8px 20px rgba(0,0,0,0.3)"
            : "0 1px 2px rgba(15,23,42,0.06), 0 8px 20px rgba(15,23,42,0.08)",
        overflow: "hidden",
      }}
    >
      {/* The rail. */}
      <div
        style={{
          position: "relative",
          zIndex: 2,
          display: "flex",
          alignItems: "center",
          gap: lg ? 10 : 6,
          height: barH,
          padding: `0 ${lg ? 14 : 9}px`,
          // Sides one by one rather than `border` + a `borderBottom` override:
          // React warns when a shorthand and a longhand for the same property
          // both change across a rerender (the theme toggle does exactly that),
          // and the order they land in is not guaranteed.
          borderTop: "none",
          borderRight: "none",
          borderLeft: "none",
          borderBottom: `1px solid ${t.dark ? "rgba(255,255,255,0.07)" : "rgba(15,23,42,0.07)"}`,
        }}
      >
        <div style={{ display: "flex", gap: lg ? 7 : 4, flex: "none" }}>
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              style={{
                width: dot,
                height: dot,
                borderRadius: "50%",
                background: t.dark ? "rgba(255,255,255,0.16)" : "rgba(15,23,42,0.13)",
              }}
            />
          ))}
        </div>

        {lg && url ? (
          <div
            style={{
              // Centred in the rail, not after the dots — an address pill that
              // starts where the dots end is a toolbar; one centred in the bar
              // is a browser.
              position: "absolute",
              left: "50%",
              transform: "translateX(-50%)",
              display: "flex",
              alignItems: "center",
              gap: 6,
              maxWidth: "58%",
              borderRadius: 999,
              padding: "4px 14px",
              background: t.dark ? "rgba(255,255,255,0.05)" : "rgba(15,23,42,0.04)",
              color: t.mutedLight,
              fontSize: 12.5,
              lineHeight: 1.5,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            <svg width="11" height="11" viewBox="0 0 16 16" aria-hidden style={{ flex: "none", opacity: 0.65 }}>
              <path d={LOCK_PATH} fill="currentColor" />
            </svg>
            {url}
          </div>
        ) : null}
      </div>

      {/* The screen. */}
      <div style={{ position: "relative" }}>
        {children}
        {/* Glass. A single wide, very low-opacity diagonal — the reflection an
            actual display has under a window. It has to sit above the content
            and ignore the pointer, and it is the one part of this component
            that must stay almost invisible: at any opacity where you can
            consciously see it, it has stopped reading as glass and started
            reading as a gradient someone put there. */}
        <span
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            background: t.dark
              ? "linear-gradient(122deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.015) 26%, rgba(255,255,255,0) 46%)"
              : "linear-gradient(122deg, rgba(255,255,255,0.5) 0%, rgba(255,255,255,0.16) 26%, rgba(255,255,255,0) 46%)",
          }}
        />
      </div>

      {/* The hairline of light along the very top edge of the bezel. Drawn as an
          overlay rather than an inset box-shadow so it survives `overflow:
          hidden` clipping the rail's own background. */}
      <span
        aria-hidden
        style={{
          position: "absolute",
          insetInline: 0,
          top: 0,
          height: 1,
          pointerEvents: "none",
          background: t.dark ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.9)",
        }}
      />
    </div>
  );
}
