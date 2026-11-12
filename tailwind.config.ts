import type { Config } from "tailwindcss";

/**
 * Design token CipiSMP Store. Semua warna, radius, shadow, dan spacing berasal
 * dari sini — tidak ada nilai ad-hoc di komponen.
 */
const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "rgb(var(--bg) / <alpha-value>)",
        surface: "rgb(var(--surface) / <alpha-value>)",
        "surface-2": "rgb(var(--surface-2) / <alpha-value>)",
        "surface-3": "rgb(var(--surface-3) / <alpha-value>)",
        line: "rgb(var(--line) / <alpha-value>)",
        "line-strong": "rgb(var(--line-strong) / <alpha-value>)",
        ink: "rgb(var(--ink) / <alpha-value>)",
        muted: "rgb(var(--muted) / <alpha-value>)",
        "muted-2": "rgb(var(--muted-2) / <alpha-value>)",
        accent: "rgb(var(--accent) / <alpha-value>)",
        "accent-strong": "rgb(var(--accent-strong) / <alpha-value>)",
        "accent-ink": "rgb(var(--accent-ink) / <alpha-value>)",
        success: "rgb(var(--success) / <alpha-value>)",
        warning: "rgb(var(--warning) / <alpha-value>)",
        danger: "rgb(var(--danger) / <alpha-value>)",
        info: "rgb(var(--info) / <alpha-value>)",
        iron: "rgb(var(--tier-iron) / <alpha-value>)",
        gold: "rgb(var(--tier-gold) / <alpha-value>)",
        diamond: "rgb(var(--tier-diamond) / <alpha-value>)",
      },
      fontFamily: {
        display: ["var(--font-display)", "Bricolage Grotesque", "Georgia", "serif"],
        sans: ["var(--font-sans)", "Instrument Sans", "system-ui", "sans-serif"],
      },
      fontSize: {
        "2xs": ["0.6875rem", { lineHeight: "1rem", letterSpacing: "0.02em" }],
        display: ["clamp(2.5rem, 6vw, 4.25rem)", { lineHeight: "0.98", letterSpacing: "-0.03em" }],
        h1: ["clamp(2rem, 4vw, 3rem)", { lineHeight: "1.05", letterSpacing: "-0.02em" }],
        h2: ["clamp(1.5rem, 2.6vw, 2rem)", { lineHeight: "1.15", letterSpacing: "-0.015em" }],
        h3: ["1.25rem", { lineHeight: "1.3", letterSpacing: "-0.01em" }],
      },
      spacing: {
        "4.5": "1.125rem",
        "18": "4.5rem",
        "22": "5.5rem",
        "30": "7.5rem",
      },
      borderRadius: {
        sm: "6px",
        md: "10px",
        lg: "14px",
        xl: "20px",
        "2xl": "28px",
      },
      boxShadow: {
        raise: "0 1px 0 0 rgb(255 255 255 / 0.8) inset, 0 8px 24px -12px rgb(52 39 50 / 0.14)",
        card: "0 1px 2px rgb(52 39 50 / 0.04), 0 16px 32px -24px rgb(80 42 64 / 0.18)",
        focus: "0 0 0 3px rgb(var(--accent) / 0.2)",
        pop: "0 16px 36px -24px rgb(52 39 50 / 0.28)",
      },
      transitionTimingFunction: {
        out: "cubic-bezier(0.22, 1, 0.36, 1)",
      },
      transitionDuration: {
        "150": "150ms",
        "200": "200ms",
        "250": "250ms",
      },
      keyframes: {
        "fade-in": {
          from: { opacity: "0", transform: "translateY(4px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "slide-in": {
          from: { transform: "translateX(100%)" },
          to: { transform: "translateX(0)" },
        },
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
        pulse_dot: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.35" },
        },
      },
      animation: {
        "fade-in": "fade-in 200ms cubic-bezier(0.22,1,0.36,1) both",
        "slide-in": "slide-in 250ms cubic-bezier(0.22,1,0.36,1) both",
        shimmer: "shimmer 1.6s infinite",
        "pulse-dot": "pulse_dot 2.4s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
