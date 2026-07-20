'use client';

import type { Theme } from '../lib/theme';

interface ThemeToggleProps {
  theme: Theme;
  isDark: boolean;
  onToggle: () => void;
}

/**
 * Pill switch: 66x30px, box-sizing:border-box (do not drop this — without
 * it, padding inflates the box and the knob/label go visually off-center).
 * Knob slides left:3px (Day) <-> left:41px (Night) with a springy
 * cubic-bezier. A single text label sits in the empty half opposite the
 * knob — never both labels, never overlapping the knob's travel path.
 */
export function ThemeToggle({ theme: t, isDark, onToggle }: ThemeToggleProps) {
  const knobLeft = isDark ? '41px' : '3px';
  const modeLabel = isDark ? 'Night' : 'Day';
  const labelSide: 'left' | 'right' = isDark ? 'left' : 'right';
  const labelColor = isDark ? '#e2e8f0' : '#64748b';

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label="Switch theme"
      title="Switch theme"
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        width: 66,
        height: 30,
        borderRadius: 999,
        boxSizing: 'border-box',
        cursor: 'pointer',
        border: `1px solid ${t.switchBorder}`,
        background: t.switchTrackBg,
        boxShadow: '0 10px 24px rgba(15,23,42,0.08)',
        flexShrink: 0,
        transition: 'background 0.4s ease, border-color 0.4s ease',
        padding: 0,
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: 3,
          left: knobLeft,
          width: 22,
          height: 22,
          borderRadius: '50%',
          background: t.switchKnobBg,
          boxShadow: '0 4px 14px rgba(15,23,42,0.2)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'left 0.45s cubic-bezier(0.34,1.56,0.64,1)',
        }}
      >
        {isDark ? (
          <svg width="11" height="11" viewBox="0 0 13 13">
            <circle cx="6.5" cy="6.5" r="5.2" fill="#bae6fd" />
          </svg>
        ) : (
          <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
            <circle cx="7" cy="7" r="3" fill="#f59e0b" />
            <path
              d="M7 1.5V3M7 11V12.5M1.5 7H3M11 7H12.5M3.1 3.1L4.1 4.1M9.9 9.9L10.9 10.9M3.1 10.9L4.1 9.9M9.9 4.1L10.9 3.1"
              stroke="#f59e0b"
              strokeWidth="1.2"
              strokeLinecap="round"
            />
          </svg>
        )}
      </span>
      <span
        style={{
          position: 'absolute',
          top: '50%',
          transform: 'translateY(-50%)',
          [labelSide]: 6,
          fontSize: 9,
          fontWeight: 600,
          color: labelColor,
        }}
      >
        {modeLabel}
      </span>
    </button>
  );
}
