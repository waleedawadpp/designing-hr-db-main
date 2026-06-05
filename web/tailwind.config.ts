import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Cairo", "system-ui", "sans-serif"],
      },
      colors: {
        brand: {
          DEFAULT: "#0f766e", // teal-700 — modern/premium
          dark: "#115e59",
          light: "#5eead4",
        },
      },
    },
  },
  plugins: [],
};

export default config;
