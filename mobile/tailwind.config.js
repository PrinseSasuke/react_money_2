/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  darkMode: "media", // follows the phone's light/dark setting (ТЗ: «Доступность»)
  theme: {
    extend: {
      colors: {
        brand: { DEFAULT: "#208AEF", dark: "#1a6fc2" },
      },
    },
  },
  plugins: [],
};
