import { NavLink, useNavigate } from "react-router-dom";
import { List, ListItemButton, ListItemIcon, ListItemText, Typography } from "@mui/material";
import LogoutRounded from "@mui/icons-material/LogoutRounded";
import Brand from "./Brand";
import { MAIN_NAV, SECONDARY_NAV } from "./navItems";
import { useAuth } from "../../context/AuthContext";

export const SIDEBAR_WIDTH = 264;

const itemSx = (theme) => ({
  mb: 0.5,
  px: 1.5,
  py: 1,
  color: "text.secondary",
  "& .MuiListItemIcon-root": { minWidth: 36, color: "inherit" },
  "& .MuiListItemText-primary": { fontWeight: 500, fontSize: "0.9375rem" },
  "&:hover": { bgcolor: "action.hover", color: "text.primary" },
  "&.active": {
    // В тёмной теме основной фиолетовый светлее — под белым текстом берём тёмный оттенок.
    bgcolor: theme.palette.mode === "dark" ? "primary.dark" : "primary.main",
    color: "primary.contrastText",
    "&:hover": { bgcolor: theme.palette.mode === "dark" ? "primary.dark" : "primary.main" },
  },
});

function NavList({ items, onNavigate }) {
  return (
    <List disablePadding>
      {items.map(({ to, label, icon: Icon, end }) => (
        <ListItemButton key={to} component={NavLink} to={to} end={end} onClick={onNavigate} sx={itemSx}>
          <ListItemIcon>
            <Icon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary={label} />
        </ListItemButton>
      ))}
    </List>
  );
}

export default function Sidebar({ onNavigate }) {
  const { logoutUser } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    onNavigate?.();
    logoutUser();
    navigate("/login");
  };

  return (
    <nav
      aria-label="Основная навигация"
      className="flex h-full flex-col px-4 py-6"
      style={{ width: SIDEBAR_WIDTH }}
    >
      <div className="mb-8 px-2">
        <Brand />
      </div>

      <Typography variant="overline" color="text.secondary" sx={{ px: 1.5, mb: 1 }}>
        Меню
      </Typography>
      <NavList items={MAIN_NAV} onNavigate={onNavigate} />

      <div className="mt-auto pt-6">
        <NavList items={SECONDARY_NAV} onNavigate={onNavigate} />
        <ListItemButton onClick={handleLogout} sx={itemSx}>
          <ListItemIcon>
            <LogoutRounded fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="Выйти" />
        </ListItemButton>
      </div>
    </nav>
  );
}
