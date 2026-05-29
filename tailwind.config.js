/** @type {import('tailwindcss').Config} */
module.exports = {
  // مسارات الملفات التي يفحصها Tailwind لاستخراج الأصناف
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        // اللون الأساسي للمتجر (متطابق مع config.ts)
        brand: {
          DEFAULT: "#7C3AED",
          dark: "#5B21B6",
          light: "#A78BFA",
        },
      },
    },
  },
  plugins: [],
};
