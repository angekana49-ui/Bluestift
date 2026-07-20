import type { Theme } from '../lib/theme';

interface CloudBackgroundProps {
  theme: Theme;
  /**
   * 'hero'  — confined to a `position:relative; overflow:hidden` hero
   *           section (used on Home). The section's own padding must give
   *           the fade at least ~260px of room below the last piece of
   *           foreground content, or the fade-to-solid will look abrupt.
   * 'fixed' — pinned to the viewport for the whole page (used on
   *           Research/Survey/Contact) so the sky stays visible behind
   *           content gaps as the user scrolls. The PARENT page wrapper
   *           must have `position: relative`, and every section/footer
   *           that should render above the sky needs
   *           `position: relative; z-index: 1` (or higher) — a
   *           non-positioned block paints BEHIND a z-index:0 fixed
   *           sibling per CSS stacking rules, so it'll look transparent
   *           if you skip this.
   */
  variant: 'hero' | 'fixed';
}

/**
 * Three stacked, full-bleed layers:
 *  1. the cloud photo itself (zooms in from 2.2x on mount, themed via
 *     `filter` so the SAME photo reads as day or night — never swap the
 *     asset between themes)
 *  2. a flat haze color that fades from ~opaque to transparent on mount
 *     (a "mist clearing" effect, layered with the zoom)
 *  3. a gradient that fades the sky into a flat foreground color — on the
 *     'hero' variant its LAST color stop must exactly equal the next
 *     section's background color (see README) for the seam to disappear.
 *
 * Load `hero-clouds-wide.png` from your public/ folder as a plain CSS
 * background-image (as below) or a plain <img>. Do NOT run it through
 * next/image — automatic optimization recompresses/recrops the PNG and
 * shifts its color balance.
 */
export function CloudBackground({ theme: t, variant }: CloudBackgroundProps) {
  const wrapperStyle =
    variant === 'fixed'
      ? ({ position: 'fixed', inset: 0, zIndex: 0, overflow: 'hidden', pointerEvents: 'none' } as const)
      : ({ position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none' } as const);
  // Note: for the 'hero' variant, render <CloudBackground variant="hero" />
  // as the FIRST child of a `position:relative; overflow:hidden` <section>,
  // with wrapperStyle above using position:absolute (matching the section).

  return (
    <div style={wrapperStyle}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: "url('/hero-clouds-wide.png')",
          backgroundSize: 'cover',
          backgroundPosition: 'center 30%',
          opacity: t.cloudOpacity,
          filter: t.cloudFilter,
          animation: 'cloudZoom 5.2s cubic-bezier(0.22,1,0.36,1) both',
          transformOrigin: 'center',
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: t.hazeColor,
          animation: 'hazeFade 5.2s cubic-bezier(0.22,1,0.36,1) both',
        }}
      />
      <div style={{ position: 'absolute', inset: 0, background: t.heroFade }} />
    </div>
  );
}
