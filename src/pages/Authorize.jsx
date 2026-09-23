import React, { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import {
  Alert,
  Button,
  Card,
  CardContent,
  IconButton,
  InputAdornment,
  TextField,
  Typography,
} from "@mui/material";
import VisibilityRounded from "@mui/icons-material/VisibilityRounded";
import VisibilityOffRounded from "@mui/icons-material/VisibilityOffRounded";
import ShieldRounded from "@mui/icons-material/ShieldRounded";
import InsightsRounded from "@mui/icons-material/InsightsRounded";
import TelegramIcon from "@mui/icons-material/Telegram";
import { useAuth } from "../context/AuthContext";
import ThemeToggle from "../components/ui/ThemeToggle";
import Brand from "../components/layout/Brand";

const FEATURES = [
  { icon: InsightsRounded, text: "Статистика и прогноз бюджета по категориям" },
  { icon: ShieldRounded, text: "Лимиты расходов с предупреждениями" },
  { icon: TelegramIcon, text: "Быстрое добавление трат через Telegram-бота" },
];

function PromoPanel() {
  return (
    <div
      className="relative hidden overflow-hidden rounded-[28px] p-10 text-white md:flex md:flex-col md:justify-between"
      style={{ background: "linear-gradient(145deg, #4E36FC 0%, #2A1B9E 60%, #17104F 100%)" }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full"
        style={{ background: "rgba(255,255,255,0.08)" }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-32 -left-16 h-80 w-80 rounded-full"
        style={{ background: "rgba(255,255,255,0.06)" }}
      />

      <div className="relative">
        <Typography variant="overline" sx={{ color: "rgba(255,255,255,0.8)" }}>
          Личные финансы
        </Typography>
        <Typography component="p" sx={{ fontSize: "2.25rem", fontWeight: 800, lineHeight: 1.15, mt: 1 }}>
          Все деньги — <br /> в одном месте
        </Typography>
        <Typography sx={{ mt: 2, color: "rgba(255,255,255,0.85)", maxWidth: 380 }}>
          Счета, операции, лимиты и регулярные платежи. Понятная картина расходов без таблиц в Excel.
        </Typography>
      </div>

      {/* Декоративная «карточка баланса» — собрана вёрсткой, без сторонних изображений */}
      <div
        aria-hidden
        className="relative my-10 max-w-sm rounded-3xl p-6"
        style={{ background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.18)" }}
      >
        <p className="m-0 text-sm opacity-80">Общий баланс</p>
        <p className="m-0 mt-2 text-3xl font-bold tracking-tight">248 350,00 ₽</p>
        <div className="mt-5 flex gap-3">
          <div className="flex-1 rounded-2xl p-3" style={{ background: "rgba(255,255,255,0.12)" }}>
            <p className="m-0 text-xs opacity-80">Доходы</p>
            <p className="m-0 mt-1 font-semibold">+92 000 ₽</p>
          </div>
          <div className="flex-1 rounded-2xl p-3" style={{ background: "rgba(255,255,255,0.12)" }}>
            <p className="m-0 text-xs opacity-80">Расходы</p>
            <p className="m-0 mt-1 font-semibold">−41 780 ₽</p>
          </div>
        </div>
      </div>

      <ul className="relative m-0 flex list-none flex-col gap-3 p-0">
        {FEATURES.map(({ icon: Icon, text }) => (
          <li key={text} className="flex items-center gap-3">
            <span
              className="flex h-9 w-9 items-center justify-center rounded-xl"
              style={{ background: "rgba(255,255,255,0.14)" }}
            >
              <Icon fontSize="small" />
            </span>
            <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.92)" }}>
              {text}
            </Typography>
          </li>
        ))}
      </ul>
    </div>
  );
}

const Authorize = () => {
  const [mode, setMode] = useState("login"); // login | register
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { user, loading, loginUser, registerUser } = useAuth();
  const navigate = useNavigate();
  const isLogin = mode === "login";

  if (!loading && user) return <Navigate to="/" replace />;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      if (isLogin) {
        await loginUser(email, password);
      } else {
        await registerUser(email, password, displayName.trim() || undefined);
      }
      navigate("/");
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const switchMode = () => {
    setMode(isLogin ? "register" : "login");
    setError("");
  };

  return (
    <div className="grid min-h-screen grid-cols-1 gap-6 p-4 sm:p-6 md:grid-cols-2">
      <PromoPanel />

      <div className="relative flex items-center justify-center py-10">
        <div className="absolute right-0 top-0">
          <ThemeToggle />
        </div>

        <Card sx={{ width: "100%", maxWidth: 440 }}>
          <CardContent sx={{ p: { xs: 3, sm: 5 } }}>
            <Brand />
            <Typography variant="h5" component="h1" sx={{ mt: 4 }}>
              {isLogin ? "Войдите" : "Зарегистрируйтесь"}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 3 }}>
              {isLogin
                ? "Рады видеть снова. Введите данные аккаунта."
                : "Создайте аккаунт — это займёт меньше минуты."}
            </Typography>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              {!isLogin && (
                <TextField
                  label="Имя (необязательно)"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  autoComplete="name"
                  fullWidth
                />
              )}
              <TextField
                type="email"
                label="Электронная почта"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
                fullWidth
              />
              <TextField
                type={showPassword ? "text" : "password"}
                label="Пароль"
                placeholder="Пароль (мин. 6 символов)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={isLogin ? "current-password" : "new-password"}
                helperText={isLogin ? undefined : "Минимум 6 символов"}
                required
                fullWidth
                slotProps={{
                  htmlInput: { minLength: 6 },
                  input: {
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          onClick={() => setShowPassword((v) => !v)}
                          aria-label={showPassword ? "Скрыть пароль" : "Показать пароль"}
                          edge="end"
                        >
                          {showPassword ? <VisibilityOffRounded /> : <VisibilityRounded />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  },
                }}
              />

              {error && <Alert severity="error">{error}</Alert>}

              <Button type="submit" variant="contained" size="large" disabled={submitting} fullWidth>
                {isLogin ? "Войти" : "Зарегистрироваться"}
              </Button>
            </form>

            <Button onClick={switchMode} fullWidth sx={{ mt: 2 }}>
              {isLogin ? "Нет аккаунта? Зарегистрироваться" : "Уже есть аккаунт? Войти"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Authorize;
