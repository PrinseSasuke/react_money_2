import React, { createContext, useCallback, useContext, useLayoutEffect, useMemo, useState } from "react";
import { CssBaseline, ThemeProvider } from "@mui/material";
import { createAppTheme } from "./theme";

const STORAGE_KEY = "theme";

const readStoredMode = () => {
  try {
    return localStorage.getItem(STORAGE_KEY) === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
};

const ColorModeContext = createContext({ mode: "light", toggleColorMode: () => {} });

export function ColorModeProvider({ children }) {
  const [mode, setMode] = useState(readStoredMode);

  // data-theme на <html> — источник для dark:-утилит Tailwind и для E2E.
  useLayoutEffect(() => {
    const root = document.documentElement;
    root.setAttribute("data-theme", mode);
    root.style.colorScheme = mode;
    try {
      localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      // localStorage может быть недоступен (приватный режим) — тема просто не запомнится
    }
  }, [mode]);

  const toggleColorMode = useCallback(
    () => setMode((prev) => (prev === "light" ? "dark" : "light")),
    []
  );

  const theme = useMemo(() => createAppTheme(mode), [mode]);
  const value = useMemo(() => ({ mode, toggleColorMode }), [mode, toggleColorMode]);

  return (
    <ColorModeContext.Provider value={value}>
      <ThemeProvider theme={theme}>
        <CssBaseline enableColorScheme />
        {children}
      </ThemeProvider>
    </ColorModeContext.Provider>
  );
}

export function useColorMode() {
  return useContext(ColorModeContext);
}
