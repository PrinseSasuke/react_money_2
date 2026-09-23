import React, { useEffect, useMemo, useState } from "react";
import { Link as RouterLink, useOutletContext } from "react-router-dom";
import { Alert, Button, Card, CardContent, InputAdornment, LinearProgress, TextField, Typography } from "@mui/material";
import EditRounded from "@mui/icons-material/EditRounded";
import TelegramIcon from "@mui/icons-material/Telegram";
import * as api from "../services/api";
import PageHeader from "../components/ui/PageHeader";
import SectionCard from "../components/ui/SectionCard";
import { formatMoney, formatNumber, toMonthKey } from "../utils/format";
import { EXPENSE } from "../utils/categories";

function Metric({ label, value, color }) {
  return (
    <div className="flex flex-col gap-0.5">
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="h6" component="p" sx={{ color, fontWeight: 700 }}>
        {value}
      </Typography>
    </div>
  );
}

const LimitsPage = () => {
  const { transactions } = useOutletContext();
  const [limit, setLimit] = useState(50000);
  const [editing, setEditing] = useState(false);
  const [newLimit, setNewLimit] = useState("50000");
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .getLimit()
      .then((data) => {
        setLimit(data.amount);
        setNewLimit(String(data.amount));
      })
      .catch((err) => console.error("Не удалось загрузить лимит:", err));
  }, []);

  const currentExpenses = useMemo(() => {
    const monthKey = toMonthKey(new Date());
    return transactions
      .filter((t) => t.type === EXPENSE && toMonthKey(t.date) === monthKey)
      .reduce((acc, t) => acc + (Number(t.summ) || 0), 0);
  }, [transactions]);

  const remaining = limit - currentExpenses;
  const isExceeded = currentExpenses > limit;
  const usedPercent = limit > 0 ? (currentExpenses / limit) * 100 : 0;
  const progressColor = isExceeded ? "error" : usedPercent >= 80 ? "warning" : "primary";

  const handleSave = async () => {
    const parsed = Number(newLimit);
    if (Number.isNaN(parsed) || parsed < 0) {
      setError("Введите неотрицательное число");
      return;
    }
    setError("");
    try {
      const result = await api.setLimit(parsed);
      setLimit(result.amount);
      setEditing(false);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div>
      <PageHeader title="Лимит расходов" subtitle="Контроль трат в текущем месяце" />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardContent>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <Typography variant="body1">
                  Лимит расходов на месяц: <strong>{formatNumber(limit)} ₽</strong>
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  Использовано {Math.round(usedPercent)}%
                </Typography>
              </div>
              {!editing && (
                <Button
                  variant="outlined"
                  startIcon={<EditRounded />}
                  onClick={() => {
                    setEditing(true);
                    setNewLimit(String(limit));
                  }}
                >
                  Редактировать лимит
                </Button>
              )}
            </div>

            {editing && (
              <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-start">
                <TextField
                  type="number"
                  label="Новый лимит"
                  size="small"
                  value={newLimit}
                  onChange={(e) => setNewLimit(e.target.value)}
                  slotProps={{
                    htmlInput: { min: 0 },
                    input: { endAdornment: <InputAdornment position="end">₽</InputAdornment> },
                  }}
                  autoFocus
                />
                <div className="flex gap-2">
                  <Button variant="contained" onClick={handleSave}>
                    Сохранить
                  </Button>
                  <Button color="inherit" onClick={() => setEditing(false)}>
                    Отмена
                  </Button>
                </div>
              </div>
            )}

            <LinearProgress
              variant="determinate"
              value={Math.min(usedPercent, 100)}
              color={progressColor}
              sx={{ mt: 3 }}
              aria-label="Использование лимита"
            />

            <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Metric label="Потрачено в текущем месяце" value={formatMoney(currentExpenses, "RUB")} />
              <Metric
                label={isExceeded ? "Превышение лимита" : "Осталось до лимита"}
                value={formatMoney(Math.abs(remaining), "RUB")}
                color={(t) => (isExceeded ? t.palette.finance.expense.text : t.palette.finance.income.text)}
              />
            </div>

            {error && (
              <Alert severity="error" sx={{ mt: 3 }}>
                {error}
              </Alert>
            )}
            {isExceeded && (
              <Alert severity="error" icon={false} sx={{ mt: 3, fontWeight: 600 }}>
                ⚠ Лимит расходов превышен!
              </Alert>
            )}
          </CardContent>
        </Card>

        <SectionCard title="Уведомления" subtitle="Узнавайте о превышении лимита сразу">
          <div className="flex flex-col items-start gap-3">
            <Typography variant="body2" color="text.secondary">
              Привяжите Telegram-бота — он пришлёт сообщение, как только траты превысят лимит, и
              позволит добавлять расходы прямо из чата.
            </Typography>
            <Button component={RouterLink} to="/settings" variant="outlined" startIcon={<TelegramIcon />}>
              Настроить в профиле
            </Button>
          </div>
        </SectionCard>
      </div>
    </div>
  );
};

export default LimitsPage;
