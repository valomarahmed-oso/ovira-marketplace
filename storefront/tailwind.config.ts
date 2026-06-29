import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx,mdx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        blue: {
          DEFAULT: "var(--ovira-blue)",
          600: "var(--ovira-blue-600)",
          50: "var(--ovira-blue-050)",
        },
        ink: {
          DEFAULT: "var(--ink)",
          600: "var(--ink-600)",
          400: "var(--ink-400)",
        },
        line: "var(--line)",
        canvas: "var(--canvas)",
        surface: "var(--surface)",
        coral: { DEFAULT: "var(--coral)", 50: "var(--coral-050)" },
        mint: "var(--mint)",
        gold: "var(--gold)",
      },
      fontFamily: {
        sans: ["var(--font-readex)", "system-ui", "sans-serif"],
        tech: ["var(--font-grotesk)", "ui-monospace", "monospace"],
      },
      borderRadius: {
        xl: "16px",
        "2xl": "20px",
        "3xl": "28px",
      },
      maxWidth: {
        content: "1280px",
      },
      boxShadow: {
        card: "0 1px 2px rgba(11,31,56,0.04), 0 10px 30px rgba(11,31,56,0.06)",
        lift: "0 18px 50px rgba(14,139,255,0.18)",
      },
      keyframes: {
        "bars-grow": {
          "0%": { transform: "scaleX(0.4)" },
          "100%": { transform: "scaleX(1)" },
        },
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.5s cubic-bezier(0.22,1,0.36,1) both",
      },
    },
  },
  plugins: [],
};

export default config;
