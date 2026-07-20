import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // BlueStift sky palette
        sky: {
          50: "#f0f8ff",
          100: "#dce8f0",
          200: "#c8dfe9",
          300: "#b0cfdf",
          400: "#8eb9d0",
        },
        "gray-25": "#fafafa",
        "gray-50": "#f8f8f7",
        "gray-100": "#f3f3f2",
        // Brand accents
        "bluestift-navy": "#173d8a",
        "bluestift-blue": "#2f7fe0",
        "bluestift-indigo": "#4f46e5",
        "bluestift-orange": "#f97316",
        "bluestift-green": "#22c55e",
      },
      fontFamily: {
        sans: ["Inter", "Helvetica Neue", "-apple-system", "sans-serif"],
        display: ["Inter Tight", "Helvetica Neue", "-apple-system", "sans-serif"],
        hand: ["Caveat", "cursive"],
        accent: ["Instrument Serif", "Georgia", "serif"],
      },
      fontSize: {
        "2xs": ["10px", { lineHeight: "14px" }],
      },
      borderRadius: {
        xl: "16px",
        "2xl": "20px",
        "3xl": "24px",
      },
      boxShadow: {
        card: "0 1px 8px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.05)",
        "card-lg": "0 4px 32px rgba(0,0,0,0.10), 0 0 0 1px rgba(0,0,0,0.06)",
        float: "0 20px 60px rgba(0,0,0,0.12), 0 4px 16px rgba(0,0,0,0.06)",
      },
      backdropBlur: {
        xs: "4px",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(16px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-6px)" },
        },
        "float-soft": {
          "0%, 100%": { transform: "translateY(0px) scale(1)" },
          "50%": { transform: "translateY(-10px) scale(1.01)" },
        },
        "float-sm": {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-6px)" },
        },
        drift: {
          "0%, 100%": { transform: "translate3d(0,0,0)" },
          "50%": { transform: "translate3d(12px,-10px,0)" },
        },
        shine: {
          "0%": { backgroundPosition: "-120% 0" },
          "100%": { backgroundPosition: "120% 0" },
        },
        "pulse-soft": {
          "0%, 100%": { opacity: "0.55" },
          "50%": { opacity: "1" },
        },
        write: {
          from: { clipPath: "inset(0 101% 0 0)" },
          to: { clipPath: "inset(0 -1% 0 0)" },
        },
        pen: {
          "0%": { left: "0%", opacity: "0" },
          "6%": { opacity: "1" },
          "92%": { opacity: "1" },
          "100%": { left: "100%", opacity: "0" },
        },
        morph: {
          "0%": { borderRadius: "42% 58% 65% 35% / 45% 45% 55% 55%", transform: "translate(-8%, -6%) scale(1)" },
          "50%": { borderRadius: "58% 42% 38% 62% / 60% 55% 45% 40%", transform: "translate(10%, 8%) scale(1.18)" },
          "100%": { borderRadius: "42% 58% 65% 35% / 45% 45% 55% 55%", transform: "translate(-8%, -6%) scale(1)" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.5s ease forwards",
        float: "float 4s ease-in-out infinite",
        "float-soft": "float-soft 7s ease-in-out infinite",
        "float-sm": "float-sm 6.5s ease-in-out infinite",
        drift: "drift 16s ease-in-out infinite",
        shine: "shine 6s linear infinite",
        "pulse-soft": "pulse-soft 3.5s ease-in-out infinite",
        write: "write 2.6s cubic-bezier(0.65,0,0.35,1) 0.3s 1 both",
        pen: "pen 2.6s cubic-bezier(0.65,0,0.35,1) 0.3s 1 both",
        morph: "morph 9s ease-in-out infinite",
      },
    },
  },
  darkMode: ["selector", '[data-theme="night"]'],
  plugins: [],
};

export default config;
