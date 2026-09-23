import React, { useEffect, useState } from "react";
import dayjs from "dayjs";
import {
  Alert,
  Autocomplete,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  MenuItem,
  Radio,
  RadioGroup,
  TextField,
  useMediaQuery,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import CloseRounded from "@mui/icons-material/CloseRounded";
import * as api from "../../services/api";
import { CATEGORIES, EXPENSE, INCOME } from "../../utils/categories";

export const FREQUENCY_LABELS = {
  daily: "Ежедневно",
  weekly: "Еженедельно",
  monthly: "Ежемесячно",
};

const initialState = () => ({
  type: EXPENSE,
  source: "Остальное",
  description: "",
  summ: "",
  currency: "RUB",
  frequency: "monthly",
  next_run_date: dayjs(),
  account_id: "",
});

export default function RecurringDialog({ open, onClose, initialData = null, onSaved }) {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down("sm"), { noSsr: true });
  const isEdit = Boolean(initialData);
  const [form, setForm] = useState(initialState);
  const [accounts, setAccounts] = useState([]);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm(
      isEdit
        ? {
            type: initialData.type,
            source: initialData.source,
            description: initialData.description || "",
            summ: String(initialData.summ),
            currency: initialData.currency,
            frequency: initialData.frequency,
            next_run_date: dayjs(String(initialData.next_run_date).slice(0, 10)),
            account_id: initialData.account_id || "",
          }
        : initialState()
    );
    setError("");
    api
      .getAccounts()
      .then((data) => {
        setAccounts(data);
        setForm((prev) => (prev.account_id ? prev : { ...prev, account_id: data[0]?.id || "" }));
      })
      .catch((err) => console.error("Не удалось загрузить счета:", err));
  }, [open, isEdit, initialData]);

  const set = (field) => (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!form.summ || Number(form.summ) <= 0) {
      setError("Укажите сумму больше нуля");
      return;
    }
    if (!form.next_run_date?.isValid()) {
      setError("Укажите дату следующего списания");
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        ...form,
        summ: Number(form.summ),
        next_run_date: form.next_run_date.format("YYYY-MM-DD"),
      };
      if (isEdit) await api.updateRecurring(initialData.id, payload);
      else await api.createRecurring(payload);
      onSaved();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm" fullScreen={fullScreen} scroll="paper">
      <DialogTitle sx={{ pr: 7 }}>{isEdit ? "Изменить платёж" : "Новый регулярный платёж"}</DialogTitle>
      <IconButton aria-label="Закрыть" onClick={onClose} sx={{ position: "absolute", right: 12, top: 14 }}>
        <CloseRounded />
      </IconButton>
      <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
        <DialogContent>
          <div className="flex flex-col gap-4 pt-1">
            <RadioGroup
              row
              value={form.type}
              onChange={(e) => setForm((prev) => ({ ...prev, type: e.target.value }))}
              aria-label="Тип операции"
            >
              <FormControlLabel value={INCOME} control={<Radio />} label="Доход" />
              <FormControlLabel value={EXPENSE} control={<Radio />} label="Расход" />
            </RadioGroup>

            {/* Категория — свободный ввод с подсказками: бэкенд принимает любую строку */}
            <Autocomplete
              freeSolo
              options={CATEGORIES[form.type]}
              value={form.source}
              onInputChange={(_, value) => setForm((prev) => ({ ...prev, source: value }))}
              renderInput={(params) => <TextField {...params} id="source" label="Источник / категория" />}
            />

            <TextField id="description" label="Описание" value={form.description} onChange={set("description")} />

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <TextField
                id="summ"
                label="Сумма"
                type="number"
                value={form.summ}
                onChange={set("summ")}
                slotProps={{ htmlInput: { min: 0, step: "0.01" } }}
              />
              <TextField select id="frequency" label="Периодичность" value={form.frequency} onChange={set("frequency")}>
                {Object.entries(FREQUENCY_LABELS).map(([value, label]) => (
                  <MenuItem value={value} key={value}>
                    {label}
                  </MenuItem>
                ))}
              </TextField>
              <DatePicker
                label="Следующее списание"
                value={form.next_run_date}
                onChange={(value) => setForm((prev) => ({ ...prev, next_run_date: value }))}
                format="DD.MM.YYYY"
              />
              <TextField
                select
                id="account_id"
                label="Счёт"
                value={accounts.some((a) => a.id === form.account_id) ? form.account_id : ""}
                onChange={set("account_id")}
                disabled={accounts.length === 0}
              >
                {accounts.map((a) => (
                  <MenuItem value={a.id} key={a.id}>
                    {a.name}
                  </MenuItem>
                ))}
              </TextField>
            </div>

            {error && <Alert severity="error">{error}</Alert>}
          </div>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3, pt: 2 }}>
          <Button onClick={onClose} color="inherit">
            Отмена
          </Button>
          <Button type="submit" variant="contained" disabled={submitting}>
            {isEdit ? "Сохранить" : "Создать"}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
