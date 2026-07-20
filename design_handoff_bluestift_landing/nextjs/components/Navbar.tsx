import Image from 'next/image';
import type { Theme } from '../lib/theme';
import { ThemeToggle } from './ThemeToggle';

interface NavbarProps {
  theme: Theme;
  isDark: boolean;
  onToggleTheme: () => void;
  activeLink: 'Product' | 'Research' | 'Survey' | 'Pricing' | 'Contact';
}

const LINKS: NavbarProps['activeLink'][] = ['Product', 'Research', 'Survey', 'Pricing', 'Contact'];

export function Navbar({ theme: t, isDark, onToggleTheme, activeLink }: NavbarProps) {
  return (
    <div style={{ position: 'sticky', top: 12, zIndex: 50, padding: '0 16px', marginBottom: -56 }}>
      <div
        style={{
          maxWidth: 1100,
          margin: '0 auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
          background: t.navBg,
          backdropFilter: 'blur(20px)',
          border: `1px solid ${t.navBorder}`,
          borderRadius: 999,
          padding: '8px 10px 8px 14px',
          boxShadow: t.navShadow,
          transition: 'background 0.4s ease, border 0.4s ease',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Image
            src="/bluestift-mark.png"
            alt="BlueStift"
            width={44}
            height={44}
            unoptimized
            style={{ borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
          />
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, letterSpacing: '-0.02em', fontFamily: "'Inter Tight', sans-serif" }}>
              <span style={{ color: t.wordmarkA }}>Blue</span>
              <span style={{ color: t.wordmarkB }}>Stift</span>
            </div>
            <div style={{ fontSize: 9, color: t.text }}>RAYA · AI tutor K-12</div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 2, background: t.pillTrackBg, borderRadius: 999, padding: 4 }}>
          {LINKS.map((link) => (
            <span
              key={link}
              style={{
                padding: '6px 14px',
                borderRadius: 999,
                fontSize: 11,
                fontWeight: link === activeLink ? 600 : 400,
                color: link === activeLink ? undefined : t.muted,
                background: link === activeLink ? t.pillActiveBg : 'transparent',
                boxShadow: link === activeLink ? t.pillActiveShadow : 'none',
              }}
            >
              {link}
            </span>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <ThemeToggle theme={t} isDark={isDark} onToggle={onToggleTheme} />
          <span style={{ fontSize: 12, color: t.text, whiteSpace: 'nowrap' }}>Sign in</span>
          <span
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: t.ctaBg,
              color: t.ctaText,
              borderRadius: 999,
              padding: '8px 16px',
              fontSize: 12,
              fontWeight: 600,
              whiteSpace: 'nowrap',
            }}
          >
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#34d399' }} />
            Free trial
          </span>
        </div>
      </div>
    </div>
  );
}
