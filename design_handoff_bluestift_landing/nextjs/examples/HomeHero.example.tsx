'use client';

/**
 * Composition example: Home page HERO section only (the trickiest part —
 * cloud background contained to the hero, handwriting reveal, flying
 * birds). Wire this into your actual page.tsx alongside Navbar and the
 * rest of the sections (Features/Differentiators/Pricing/Footer), which
 * are plain JSX using the same `theme` tokens documented in the README —
 * not reproduced here for brevity, but structurally identical: a
 * `position:relative` <section> per block, each background/color driven by
 * `theme.<token>`.
 */

import { useThemeMode } from '../hooks/useThemeMode';
import { getTheme } from '../lib/theme';
import { Navbar } from '../components/Navbar';
import { CloudBackground } from '../components/CloudBackground';

export default function HomeHeroExample() {
  const { isDark, toggle } = useThemeMode();
  const theme = getTheme(isDark);

  const birdPath =
    'M12 6 C9 2 4 1 0 3 C4 4 7 6 9 8 C7 10 4 12 0 13 C4 15 9 14 12 10 C15 14 20 15 24 13 C20 12 17 10 15 8 C17 6 20 4 24 3 C20 1 15 2 12 6 Z';

  return (
    <div
      style={{
        fontFamily: "'Inter', sans-serif",
        color: theme.text,
        minHeight: '100vh',
        background: theme.pageBg,
        transition: 'background 0.4s ease, color 0.4s ease',
      }}
    >
      <Navbar theme={theme} isDark={isDark} onToggleTheme={toggle} activeLink="Product" />

      {/* HERO — position:relative + overflow:hidden is required so the
          'hero' CloudBackground variant (position:absolute inset:0) stays
          contained and doesn't bleed into Features below. Bottom padding
          is 180px (not the visual 96px look) specifically to give the
          heroFade gradient's ~260px fade zone room to resolve below the
          floating dashboard mockup — trim this and the fade will look
          abrupt again. */}
      <section
        style={{
          position: 'relative',
          overflow: 'hidden',
          padding: '150px 24px 180px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
        }}
      >
        <CloudBackground theme={theme} variant="hero" />

        <div style={{ position: 'relative', zIndex: 1, maxWidth: 820 }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              background: theme.chipBg,
              border: `1px solid ${theme.chipBorder}`,
              borderRadius: 999,
              padding: '6px 16px',
              fontSize: 11,
              fontWeight: 500,
              marginBottom: 20,
              color: theme.text,
            }}
          >
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: theme.text }} />
            AI tutor · K-12 · Cameroon &amp; US
          </div>

          <div style={{ position: 'relative', display: 'inline-block', maxWidth: 820 }}>
            <h1
              style={{
                fontFamily: "'Caveat', cursive",
                fontWeight: 700,
                fontSize: 'clamp(3.2rem, 9vw, 6.4rem)',
                lineHeight: 0.92,
                margin: 0,
                animation: 'writeReveal 2.6s cubic-bezier(0.65,0,0.35,1) 0.3s 1 both',
              }}
            >
              The AI tutor that remembers every student.
            </h1>

            {/* Two birds, staggered timing/size, theme-aware fill color
                (dark navy in light mode, off-white in dark mode) — this
                replaces an earlier "pen dot" version of this animation. */}
            <span
              style={{
                position: 'absolute',
                width: 22,
                height: 16,
                pointerEvents: 'none',
                animation: 'birdFly 2.6s cubic-bezier(0.65,0,0.35,1) 0.3s 1 both',
              }}
            >
              <svg
                width="22"
                height="16"
                viewBox="0 0 24 16"
                style={{ display: 'block', animation: 'wingFlap 0.22s ease-in-out infinite', transformOrigin: 'center' }}
              >
                <path d={birdPath} fill={theme.birdColor} />
              </svg>
            </span>
            <span
              style={{
                position: 'absolute',
                width: 16,
                height: 12,
                pointerEvents: 'none',
                animation: 'birdFly2 2.8s cubic-bezier(0.65,0,0.35,1) 0.55s 1 both',
              }}
            >
              <svg
                width="16"
                height="12"
                viewBox="0 0 24 16"
                style={{ display: 'block', animation: 'wingFlap 0.19s ease-in-out infinite', transformOrigin: 'center' }}
              >
                <path d={birdPath} fill={theme.birdColor} />
              </svg>
            </span>
          </div>

          <p style={{ maxWidth: 560, margin: '20px auto 0', fontSize: 16, lineHeight: 1.7, color: theme.text }}>
            RAYA adapts every session to each student&apos;s real cognitive profile — solo, in groups, in real time.
            Not a chatbot. A tutor.
          </p>

          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 28, flexWrap: 'wrap' }}>
            <span
              style={{
                background: theme.ctaBg,
                color: theme.ctaText,
                borderRadius: 999,
                padding: '13px 24px',
                fontSize: 14,
                fontWeight: 500,
              }}
            >
              Try it free
            </span>
            <span
              style={{
                background: theme.chipBg,
                border: `1px solid ${theme.chipBorder}`,
                borderRadius: 999,
                padding: '13px 22px',
                fontSize: 14,
                fontWeight: 500,
                color: theme.text,
              }}
            >
              See how it works
            </span>
          </div>
        </div>

        {/* ...dashboard mockup card goes here, position:relative z-index:1,
            animation: floatSm 7s ease-in-out infinite — see README for its
            full content spec (stat tiles, grouped bar chart, gauge). */}
      </section>

      {/* FEATURES section must start with EXACTLY theme.sectionAltBg as its
          background (no gradient) — that equality with theme.heroFade's
          final stop is what makes the hero→features seam disappear. */}
      <section style={{ position: 'relative', background: theme.sectionAltBg, padding: '96px 24px' }}>
        {/* ...features content... */}
      </section>
    </div>
  );
}
