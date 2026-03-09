import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}", "../../packages/ui/src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        sand: "#f5efe6",
        ink: "#111111",
        clay: "#8f4f32",
        moss: "#5a6b53"
      },
      fontFamily: {
        sans: ["var(--font-manrope)", "var(--font-cairo)", "system-ui", "sans-serif"],
        display: ["var(--font-space-grotesk)", "system-ui", "sans-serif"]
      }
    }
  },
  plugins: []
};

export default config;
