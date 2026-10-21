import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Segoe UI"', "Tajawal", "Cairo", "Tahoma", "sans-serif"],
      },
      colors: {
        navy: { DEFAULT: "#13294B", 2: "#1F4E79" },
        gold: "#C9A227",
        cream: "#FFF7DB",
        page: "#EEF2F7",
        line: "#D5DCE6",
        stripe: "#F8FAFC",
        input: "#0000FF",
        calc: { bg: "#EEF2F7", fg: "#475569" },
      },
    },
  },
  plugins: [],
} satisfies Config;
