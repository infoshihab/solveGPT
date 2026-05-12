import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-geist-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "monospace"],
      },
      colors: {
        surface: {
          DEFAULT: "#0c0f14",
          raised: "#121722",
          border: "#1e2636",
        },
        accent: "#3b82f6",
      },
    },
  },
  plugins: [],
} satisfies Config;
