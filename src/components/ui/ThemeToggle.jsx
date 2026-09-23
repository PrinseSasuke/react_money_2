import { IconButton, Tooltip } from "@mui/material";
import DarkModeRounded from "@mui/icons-material/DarkModeRounded";
import LightModeRounded from "@mui/icons-material/LightModeRounded";
import { useColorMode } from "../../theme/ColorModeContext";

export default function ThemeToggle({ sx }) {
  const { mode, toggleColorMode } = useColorMode();
  const isDark = mode === "dark";

  return (
    <Tooltip title={isDark ? "Включить светлую тему" : "Включить тёмную тему"}>
      <IconButton
        onClick={toggleColorMode}
        aria-label="Переключить тему"
        aria-pressed={isDark}
        sx={{ border: 1, borderColor: "divider", ...sx }}
      >
        {isDark ? <LightModeRounded fontSize="small" /> : <DarkModeRounded fontSize="small" />}
      </IconButton>
    </Tooltip>
  );
}
