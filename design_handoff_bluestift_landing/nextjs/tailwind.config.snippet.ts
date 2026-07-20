// Merge this `keyframes` / `animation` block into your existing
// tailwind.config.{ts,js} under theme.extend. Component code in this
// handoff uses inline `style={{ animation: '...' }}` (framework-agnostic,
// works with plain CSS Modules / styled-components too) — this Tailwind
// version is provided in case you'd rather reference them as utility
// classes (e.g. `className="animate-cloudZoom"`).

const keyframes = {
  cloudZoom: {
    '0%': { transform: 'scale(2.2) translateY(6%)' },
    '100%': { transform: 'scale(1) translateY(0)' },
  },
  hazeFade: {
    '0%': { opacity: '0.96' },
    '60%': { opacity: '0.5' },
    '100%': { opacity: '0' },
  },
  writeReveal: {
    from: { clipPath: 'inset(0 101% 0 0)' },
    to: { clipPath: 'inset(0 -1% 0 0)' },
  },
  birdFly: {
    '0%': { left: '-4%', top: '62%', opacity: '0', transform: 'translateY(0) rotate(-6deg) scale(0.9)' },
    '6%': { opacity: '1' },
    '22%': { top: '38%', transform: 'translateY(-12px) rotate(6deg) scale(1)' },
    '45%': { top: '58%', transform: 'translateY(6px) rotate(-5deg) scale(0.95)' },
    '68%': { top: '32%', transform: 'translateY(-10px) rotate(5deg) scale(1)' },
    '92%': { opacity: '1', top: '42%' },
    '100%': { left: '102%', top: '46%', opacity: '0', transform: 'translateY(-4px) rotate(2deg) scale(0.9)' },
  },
  birdFly2: {
    '0%': { left: '-6%', top: '78%', opacity: '0', transform: 'translateY(0) rotate(-4deg) scale(0.75)' },
    '8%': { opacity: '1' },
    '30%': { top: '66%', transform: 'translateY(-8px) rotate(5deg) scale(0.8)' },
    '50%': { top: '80%', transform: 'translateY(5px) rotate(-4deg) scale(0.75)' },
    '74%': { top: '60%', transform: 'translateY(-9px) rotate(4deg) scale(0.8)' },
    '93%': { opacity: '1', top: '68%' },
    '100%': { left: '98%', top: '70%', opacity: '0', transform: 'translateY(-3px) rotate(2deg) scale(0.75)' },
  },
  wingFlap: {
    '0%, 100%': { transform: 'scaleY(1)' },
    '50%': { transform: 'scaleY(0.5)' },
  },
  floatSm: {
    '0%, 100%': { transform: 'translateY(0)' },
    '50%': { transform: 'translateY(-6px)' },
  },
  shine: {
    '0%': { backgroundPosition: '-120% 0' },
    '100%': { backgroundPosition: '120% 0' },
  },
  morphBlob: {
    '0%': { borderRadius: '42% 58% 65% 35% / 45% 45% 55% 55%', transform: 'translate(-8%,-6%) scale(1)' },
    '50%': { borderRadius: '58% 42% 38% 62% / 60% 55% 45% 40%', transform: 'translate(10%,8%) scale(1.18)' },
    '100%': { borderRadius: '42% 58% 65% 35% / 45% 45% 55% 55%', transform: 'translate(-8%,-6%) scale(1)' },
  },
};

const animation = {
  cloudZoom: 'cloudZoom 5.2s cubic-bezier(0.22,1,0.36,1) both',
  hazeFade: 'hazeFade 5.2s cubic-bezier(0.22,1,0.36,1) both',
  writeReveal: 'writeReveal 2.6s cubic-bezier(0.65,0,0.35,1) 0.3s 1 both',
  birdFly: 'birdFly 2.6s cubic-bezier(0.65,0,0.35,1) 0.3s 1 both',
  birdFly2: 'birdFly2 2.8s cubic-bezier(0.65,0,0.35,1) 0.55s 1 both',
  wingFlap: 'wingFlap 0.22s ease-in-out infinite',
  floatSm: 'floatSm 6.5s ease-in-out infinite',
  shine: 'shine 6s linear infinite',
  morphBlob: 'morphBlob 9s ease-in-out infinite',
};

export default { keyframes, animation };
