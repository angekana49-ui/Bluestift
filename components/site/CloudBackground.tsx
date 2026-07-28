import type { Theme } from "./theme";

/**
 * Three stacked, full-bleed sky layers (cloud photo → haze → fade-to-solid).
 *
 * variant="hero"  — position:absolute; confined to a `position:relative;
 *                   overflow:hidden` <section> (Home). Render as its FIRST child.
 * variant="fixed" — position:fixed; pinned to the viewport for the whole page
 *                   (Research/Survey/Contact) so the sky shows through content
 *                   gaps as the user scrolls. The page root must be
 *                   position:relative and every section/footer above it needs
 *                   position:relative + z-index:1 or it paints behind the sky.
 *
 * The cloud photo is loaded as a plain CSS background-image (never next/image —
 * automatic optimization recompresses/recrops it and shifts colour balance).
 */
export default function CloudBackground({ theme: t, variant }: { theme: Theme; variant: "hero" | "fixed" }) {
  const wrapperStyle =
    variant === "fixed"
      ? ({ position: "fixed", inset: 0, zIndex: 0, overflow: "hidden", pointerEvents: "none" } as const)
      : ({ position: "absolute", inset: 0, zIndex: 0, pointerEvents: "none" } as const);

  return (
    <div style={wrapperStyle}>
      <div
        // The image itself comes from a class: an inline style can only hold ONE
        // value per property, so it can't carry the WebP/PNG fallback pair (see
        // .bluestift-cloud-photo in globals.css). Theme-dependent values stay
        // inline.
        className="bluestift-cloud-photo"
        style={{
          position: "absolute",
          inset: 0,
          opacity: t.cloudOpacity,
          filter: t.cloudFilter,
          transition: "filter 0.4s ease",
          animation: "cloudZoom 8.5s cubic-bezier(0.33,1,0.68,1) both",
          transformOrigin: "center",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: t.hazeColor,
          animation: "hazeFade 5.2s cubic-bezier(0.22,1,0.36,1) both",
        }}
      />
      <div style={{ position: "absolute", inset: 0, background: t.heroFade }} />
    </div>
  );
}
