import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Alert,
  Avatar,
  Button,
  Chip,
  FormControlLabel,
  Switch,
  Typography,
} from "@mui/material";
import TelegramIcon from "@mui/icons-material/Telegram";
import CheckCircleRounded from "@mui/icons-material/CheckCircleRounded";
import LogoutRounded from "@mui/icons-material/LogoutRounded";
import * as api from "../services/api";
import { useAuth } from "../context/AuthContext";
import { useColorMode } from "../theme/ColorModeContext";
import PageHeader from "../components/ui/PageHeader";
import SectionCard from "../components/ui/SectionCard";

function TelegramCard() {
  const [linked, setLinked] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .getTelegramStatus()
      .then((data) => setLinked(data.linked))
      .catch((err) => console.error("Не удалось получить статус Telegram:", err));
  }, []);

  const handleLink = async () => {
    setError("");
    try {
      const { code: linkCode } = await api.getTelegramLinkCode();
      setCode(linkCode);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <SectionCard
      title="Telegram-бот"
      subtitle="Уведомления о превышении лимита и быстрое добавление трат"
      action={
        linked ? (
          <Chip icon={<CheckCircleRounded />} label="Привязан" color="success" variant="outlined" size="small" />
        ) : null
      }
    >
      {linked ? (
        <Typography variant="body2" color="text.secondary">
          ✅ Telegram привязан — уведомления о лимите и быстрое добавление трат доступны.
        </Typography>
      ) : code ? (
        <Alert severity="info" icon={<TelegramIcon />}>
          Напишите боту <strong>/link {code}</strong>, чтобы привязать аккаунт.
        </Alert>
      ) : (
        <Button variant="contained" startIcon={<TelegramIcon />} onClick={handleLink}>
          Привязать Telegram
        </Button>
      )}
      {error && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {error}
        </Alert>
      )}
    </SectionCard>
  );
}

export default function SettingsPage() {
  const { user, logoutUser } = useAuth();
  const { mode, toggleColorMode } = useColorMode();
  const navigate = useNavigate();
  const name = user?.displayName || user?.email?.split("@")[0] || "";

  return (
    <div>
      <PageHeader title="Настройки" subtitle="Профиль, оформление и интеграции" />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <SectionCard title="Профиль">
          <div className="flex items-center gap-4">
            <Avatar sx={{ width: 56, height: 56, bgcolor: "primary.main", fontSize: "1.4rem", fontWeight: 700 }}>
              {(name[0] || "?").toUpperCase()}
            </Avatar>
            <div className="min-w-0">
              <Typography variant="subtitle1" noWrap>
                {name}
              </Typography>
              <Typography variant="body2" color="text.secondary" noWrap>
                {user?.email}
              </Typography>
            </div>
          </div>
          <Button
            variant="outlined"
            color="error"
            startIcon={<LogoutRounded />}
            sx={{ mt: 3 }}
            onClick={() => {
              logoutUser();
              navigate("/login");
            }}
          >
            Выйти из аккаунта
          </Button>
        </SectionCard>

        <SectionCard title="Оформление" subtitle="Тема сохраняется в этом браузере">
          <FormControlLabel
            control={<Switch checked={mode === "dark"} onChange={toggleColorMode} />}
            label="Тёмная тема"
          />
        </SectionCard>

        <div className="lg:col-span-2">
          <TelegramCard />
        </div>
      </div>
    </div>
  );
}
