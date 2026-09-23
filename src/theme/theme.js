import { alpha, createTheme } from "@mui/material/styles";
import { ruRU } from "@mui/material/locale";
import { ruRU as pickersRuRU } from "@mui/x-date-pickers/locales";

const BRAND = "#4E36FC";

// Цвета доходов/расходов подобраны под контраст WCAG AA (≥4.5:1) и для
// текста на белом фоне, и для текста на «мягкой» заливке чипа.
const FINANCE = {
  light: {
    income: { main: "#16A34A", text: "#15803D", soft: "#DCFCE7" },
    expense: { main: "#EF4444", text: "#B91C1C", soft: "#FEE2E2" },
  },
  dark: {
    income: { main: "#22C55E", text: "#4ADE80", soft: alpha("#22C55E", 0.14) },
    expense: { main: "#EF4444", text: "#F87171", soft: alpha("#EF4444", 0.14) },
  },
};

const getPalette = (mode) =>
  mode === "light"
    ? {
        mode,
        primary: { main: BRAND, light: "#7B68FF", dark: "#3A24D6", contrastText: "#FFFFFF" },
        secondary: { main: "#1A1C2B", contrastText: "#FFFFFF" },
        success: { main: "#16A34A" },
        error: { main: "#DC2626" },
        warning: { main: "#D97706" },
        background: { default: "#F4F5F9", paper: "#FFFFFF", sidebar: "#FFFFFF" },
        text: { primary: "#1A1C2B", secondary: "#5F6377" },
        divider: "#E7E8EF",
        finance: FINANCE.light,
      }
    : {
        mode,
        // На тёмном фоне фирменный #4E36FC как цвет текста/иконок слишком
        // тёмный — берём более светлый оттенок той же гаммы.
        primary: { main: "#8B7DFF", light: "#A99FFF", dark: "#5B47FF", contrastText: "#FFFFFF" },
        secondary: { main: "#ECECF2", contrastText: "#111116" },
        success: { main: "#22C55E" },
        error: { main: "#F87171" },
        warning: { main: "#FBBF24" },
        background: { default: "#111116", paper: "#1B1B22", sidebar: "#16161C" },
        text: { primary: "#ECECF2", secondary: "#A3A3B3" },
        divider: alpha("#FFFFFF", 0.08),
        finance: FINANCE.dark,
      };

export function createAppTheme(mode) {
  const palette = getPalette(mode);
  const isDark = mode === "dark";
  const cardShadow = isDark
    ? "0 1px 2px rgba(0,0,0,0.4)"
    : "0 1px 2px rgba(17, 24, 39, 0.04), 0 8px 24px rgba(17, 24, 39, 0.05)";

  return createTheme(
    {
      palette,
      shape: { borderRadius: 12 },
      custom: { cardShadow },
      typography: {
        fontFamily: '"Inter", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
        h4: { fontSize: "1.75rem", fontWeight: 700, letterSpacing: "-0.02em" },
        h5: { fontSize: "1.375rem", fontWeight: 700, letterSpacing: "-0.01em" },
        h6: { fontSize: "1.125rem", fontWeight: 600 },
        subtitle1: { fontWeight: 600 },
        subtitle2: { fontWeight: 600 },
        body2: { fontSize: "0.875rem" },
        button: { fontWeight: 600, textTransform: "none" },
        overline: { fontWeight: 600, letterSpacing: "0.06em" },
      },
      components: {
        MuiCssBaseline: {
          styleOverrides: {
            body: {
              WebkitFontSmoothing: "antialiased",
              MozOsxFontSmoothing: "grayscale",
            },
          },
        },
        MuiPaper: {
          styleOverrides: { root: { backgroundImage: "none" } },
        },
        MuiCard: {
          defaultProps: { elevation: 0 },
          styleOverrides: {
            root: ({ theme }) => ({
              borderRadius: 20,
              border: `1px solid ${theme.palette.divider}`,
              boxShadow: theme.custom.cardShadow,
            }),
          },
        },
        MuiCardContent: {
          styleOverrides: {
            root: ({ theme }) => ({
              padding: 16,
              "&:last-child": { paddingBottom: 16 },
              [theme.breakpoints.up("sm")]: {
                padding: 24,
                "&:last-child": { paddingBottom: 24 },
              },
            }),
          },
        },
        MuiButton: {
          defaultProps: { disableElevation: true },
          styleOverrides: {
            root: { borderRadius: 10, paddingInline: 18, minHeight: 40 },
            sizeSmall: { minHeight: 32, paddingInline: 12 },
            sizeLarge: { minHeight: 48 },
            // Белый текст на светлом #8B7DFF в тёмной теме не проходит по
            // контрасту — заливку основной кнопки делаем на тон темнее.
            containedPrimary: isDark
              ? { backgroundColor: "#5B47FF", "&:hover": { backgroundColor: BRAND } }
              : {},
          },
        },
        MuiIconButton: {
          styleOverrides: { root: { borderRadius: 10 } },
        },
        MuiOutlinedInput: {
          styleOverrides: { root: { borderRadius: 10 } },
        },
        MuiDialog: {
          styleOverrides: {
            paper: { borderRadius: 20 },
          },
        },
        MuiDialogTitle: {
          styleOverrides: { root: { fontSize: "1.25rem", fontWeight: 700, padding: "20px 24px 8px" } },
        },
        MuiTableCell: {
          styleOverrides: {
            root: ({ theme }) => ({ borderColor: theme.palette.divider }),
            head: ({ theme }) => ({
              fontSize: "0.75rem",
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.04em",
              color: theme.palette.text.secondary,
              whiteSpace: "nowrap",
            }),
          },
        },
        MuiChip: {
          styleOverrides: { root: { fontWeight: 600, borderRadius: 8 } },
        },
        MuiListItemButton: {
          styleOverrides: { root: { borderRadius: 10 } },
        },
        MuiMenu: {
          styleOverrides: {
            paper: ({ theme }) => ({
              borderRadius: 12,
              border: `1px solid ${theme.palette.divider}`,
              boxShadow: "0 12px 32px rgba(17, 24, 39, 0.12)",
            }),
          },
        },
        MuiToggleButton: {
          styleOverrides: { root: { textTransform: "none", fontWeight: 600 } },
        },
        MuiTooltip: {
          defaultProps: { arrow: true },
        },
        MuiLinearProgress: {
          styleOverrides: { root: { borderRadius: 999, height: 10 }, bar: { borderRadius: 999 } },
        },
      },
    },
    ruRU,
    pickersRuRU
  );
}
