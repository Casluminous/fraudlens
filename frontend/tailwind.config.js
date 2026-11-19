/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          950: "#070B10",
          900: "#0A1017",
          850: "#0D141C",
          800: "#111A24",
          700: "#182430",
          600: "#22313F",
        },
        mint: {
          200: "#B9FBDD",
          300: "#7CF0C0",
          400: "#4BE3A6",
          500: "#21C98A",
          600: "#12A571",
          700: "#0C7D57",
        },
        amber: {
          400: "#F5C15C",
          500: "#EAA83A",
        },
        coral: {
          400: "#FF8585",
          500: "#F26060",
        },
        azure: {
          400: "#6CB6FF",
          500: "#4795E8",
        },
      },
      fontFamily: {
        sans: ['"Be Vietnam Pro"', "system-ui", "sans-serif"],
        mono: ['"JetBrains Mono"', "ui-monospace", "monospace"],
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(75,227,166,0.25), 0 12px 40px -12px rgba(33,201,138,0.35)",
        panel: "0 24px 60px -30px rgba(0,0,0,0.7)",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        shimmer: {
          "0%": { backgroundPosition: "200% 0" },
          "100%": { backgroundPosition: "-200% 0" },
        },
        "pulse-soft": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.45" },
        },
        "scan-line": {
          "0%": { transform: "translateY(-100%)" },
          "100%": { transform: "translateY(400%)" },
        },
        "spin-slow": {
          "0%": { transform: "rotate(0deg)" },
          "100%": { transform: "rotate(360deg)" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.45s cubic-bezier(0.2, 0.7, 0.3, 1) both",
        "fade-in": "fade-in 0.3s ease both",
        shimmer: "shimmer 1.6s linear infinite",
        "pulse-soft": "pulse-soft 2.4s ease-in-out infinite",
        "scan-line": "scan-line 3.2s linear infinite",
        "spin-slow": "spin-slow 18s linear infinite",
      },
    },
  },
  plugins: [],
};
