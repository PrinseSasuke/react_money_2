import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Avatar,
  Box,
  ButtonBase,
  Divider,
  IconButton,
  ListItemIcon,
  Menu,
  MenuItem,
  Typography,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import MenuRounded from "@mui/icons-material/MenuRounded";
import ExpandMoreRounded from "@mui/icons-material/ExpandMoreRounded";
import SettingsRounded from "@mui/icons-material/SettingsRounded";
import LogoutRounded from "@mui/icons-material/LogoutRounded";
import ThemeToggle from "../ui/ThemeToggle";
import Brand from "./Brand";
import { useAuth } from "../../context/AuthContext";

const todayLabel = () =>
  new Intl.DateTimeFormat("ru-RU", { weekday: "long", day: "numeric", month: "long" }).format(new Date());

export default function Topbar({ isDesktop, onMenuClick }) {
  const { user, logoutUser } = useAuth();
  const navigate = useNavigate();
  const [anchorEl, setAnchorEl] = useState(null);

  const displayName = user?.displayName || user?.email || "";
  const shortName = user?.displayName || (user?.email ? user.email.split("@")[0] : "");
  const initial = (shortName[0] || "?").toUpperCase();

  const go = (path) => {
    setAnchorEl(null);
    navigate(path);
  };

  const handleLogout = () => {
    setAnchorEl(null);
    logoutUser();
    navigate("/login");
  };

  return (
    <Box
      component="header"
      className="sticky top-0 z-10 flex items-center gap-3 px-4 py-3 backdrop-blur sm:px-6 lg:px-8"
      sx={{ minHeight: 72, bgcolor: (t) => alpha(t.palette.background.default, 0.85) }}
    >
      {isDesktop ? (
        <div className="min-w-0">
          <Typography variant="subtitle1" component="p" noWrap>
            Здравствуйте, {shortName}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ textTransform: "capitalize" }}>
            {todayLabel()}
          </Typography>
        </div>
      ) : (
        <>
          <IconButton onClick={onMenuClick} aria-label="Открыть меню" edge="start">
            <MenuRounded />
          </IconButton>
          <Brand />
        </>
      )}

      <div className="ml-auto flex items-center gap-2">
        <ThemeToggle />
        <ButtonBase
          className="profile"
          onClick={(e) => setAnchorEl(e.currentTarget)}
          aria-label="Меню пользователя"
          aria-haspopup="menu"
          sx={{ borderRadius: 3, p: 0.5, pr: { xs: 0.5, sm: 1 }, gap: 1 }}
        >
          <Avatar sx={{ width: 36, height: 36, bgcolor: "primary.main", color: "primary.contrastText", fontWeight: 700, fontSize: "0.95rem" }}>
            {initial}
          </Avatar>
          <Typography
            variant="body2"
            noWrap
            sx={{ display: { xs: "none", sm: "block" }, maxWidth: 180, fontWeight: 600 }}
          >
            {displayName}
          </Typography>
          <ExpandMoreRounded fontSize="small" sx={{ display: { xs: "none", sm: "block" }, color: "text.secondary" }} />
        </ButtonBase>
      </div>

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
      >
        <div className="px-4 pb-2 pt-1">
          <Typography variant="subtitle2" noWrap>
            {shortName}
          </Typography>
          <Typography variant="caption" color="text.secondary" noWrap component="p">
            {user?.email}
          </Typography>
        </div>
        <Divider />
        <MenuItem onClick={() => go("/settings")}>
          <ListItemIcon>
            <SettingsRounded fontSize="small" />
          </ListItemIcon>
          Настройки
        </MenuItem>
        <MenuItem onClick={handleLogout}>
          <ListItemIcon>
            <LogoutRounded fontSize="small" />
          </ListItemIcon>
          Выйти
        </MenuItem>
      </Menu>
    </Box>
  );
}
