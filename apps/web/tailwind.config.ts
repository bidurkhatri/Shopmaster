import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Merchant-branded colors flow in via CSS variables (WEB-01 / FE-09 theming).
        brand: {
          DEFAULT: "var(--brand, #0f766e)",
          accent: "var(--brand-accent, #14b8a6)",
        },
      },
      fontFamily: {
        sans: ["system-ui", "Segoe UI", "Roboto", "Helvetica", "Arial", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
