'use client';

/**
 * Composition example: Research/Survey/Contact pattern — the 'fixed'
 * CloudBackground variant that stays pinned behind the ENTIRE page as the
 * user scrolls (not just the hero). This is the pattern to copy for any
 * page where the sky should show through content gaps all the way down.
 */

import { useThemeMode } from '../hooks/useThemeMode';
import { getTheme } from '../lib/theme';
import { Navbar } from '../components/Navbar';
import { CloudBackground } from '../components/CloudBackground';

export default function ResearchPageExample() {
  const { isDark, toggle } = useThemeMode();
  const theme = getTheme(isDark);

  return (
    // position:relative on the page root is required for the fixed
    // CloudBackground child to size/attach correctly.
    <div
      style={{
        fontFamily: "'Inter', sans-serif",
        color: theme.text,
        minHeight: '100vh',
        background: theme.pageBg,
        transition: 'background 0.4s ease, color 0.4s ease',
        position: 'relative',
      }}
    >
      <CloudBackground theme={theme} variant="fixed" />

      <Navbar theme={theme} isDark={isDark} onToggleTheme={toggle} activeLink="Research" />

      {/* Every section/footer below needs position:relative + z-index:1
          (or higher) to render ABOVE the fixed, z-index:0 sky layer. Skip
          this on any one of them and that block will render fully
          transparent-looking (painted behind the sky) even though its own
          background color is set correctly — this is the #1 way the sky
          effect "disappears" when porting. */}
      <section style={{ position: 'relative', zIndex: 1, overflow: 'hidden', padding: '150px 24px 60px' }}>
        {/* ...hero content (badge, heading, segmented control)... */}
      </section>

      <div style={{ position: 'relative', zIndex: 1, maxWidth: 760, margin: '0 auto', padding: '0 24px 96px' }}>
        {/* ...featured article card + recent publications... */}
      </div>

      <footer
        style={{
          position: 'relative',
          zIndex: 1,
          background: theme.footerBg,
          borderTop: `1px solid ${theme.footerBorder}`,
          padding: '48px 24px 28px',
          textAlign: 'center',
        }}
      >
        <span style={{ fontSize: 10, color: theme.footerMuted }}>© 2026 BlueStift. All rights reserved.</span>
      </footer>
    </div>
  );
}
