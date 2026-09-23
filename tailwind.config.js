/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx}", "./public/index.html"],
  // Единственный reset — CssBaseline из MUI. Preflight Tailwind выключен,
  // иначе два глобальных сброса спорят за базовые стили элементов.
  corePlugins: {
    preflight: false,
  },
  // Тёмная тема переключается атрибутом <html data-theme="dark">, который
  // выставляет ColorModeProvider — так dark:-утилиты синхронны с MUI-палитрой.
  darkMode: ["selector", '[data-theme="dark"]'],
  theme: {
    // Брейкпоинты совпадают с MUI (theme.breakpoints), чтобы md: в Tailwind
    // и useMediaQuery(theme.breakpoints.up("md")) означали одно и то же.
    screens: {
      sm: "600px",
      md: "900px",
      lg: "1200px",
      xl: "1536px",
    },
    extend: {
      colors: {
        brand: {
          DEFAULT: "#4E36FC",
          light: "#8B7DFF",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
      },
    },
  },
  plugins: [],
};
