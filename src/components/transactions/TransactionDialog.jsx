import React, { useContext, useEffect, useState } from "react";
import dayjs from "dayjs";
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  IconButton,
  MenuItem,
  Radio,
  RadioGroup,
  TextField,
  Typography,
  useMediaQuery,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import CloseRounded from "@mui/icons-material/CloseRounded";
import * as api from "../../services/api";
import { AppContext } from "../../App";
import { CATEGORIES, EXPENSE, INCOME } from "../../utils/categories";
import AttachmentsPanel from "./AttachmentsPanel";
import { mergeUpdatedTransaction } from "./useTransactionActions";

// Значения валют совпадают с теми, что форма отправляла раньше
// ("Рубль" — дефолт и на бэкенде), поэтому контракт API не меняется.
const CURRENCY_OPTIONS = [
  { value: "Рубль", label: "Рубль (₽)" },
  { value: "usd", label: "Доллар ($)" },
];

const emptyForm = () => ({
  date: dayjs(),
  type: INCOME,
  source: CATEGORIES[INCOME][0],
  description: "",
  summ: "",
  currency: "Рубль",
  account_id: "",
});

const fromTransaction = (t) => ({
  date: dayjs(t.date),
  type: t.type,
  source: t.source,
  description: t.description || "",
  summ: String(t.summ ?? ""),
  currency: t.currency || "Рубль",
  account_id: t.account_id || "",
});

function TypeOption({ value, label, checked }) {
  const key = value === EXPENSE ? "expense" : "income";
  return (
    <FormControlLabel
      value={value}
      control={<Radio sx={{ color: (t) => t.palette.finance[key].text, "&.Mui-checked": { color: (t) => t.palette.finance[key].text } }} />}
      label={label}
      sx={{
        m: 0,
        flex: 1,
        pr: 2,
        borderRadius: 3,
        border: 1,
        borderColor: checked ? (t) => t.palette.finance[key].text : "divider",
        bgcolor: checked ? (t) => t.palette.finance[key].soft : "transparent",
        "& .MuiFormControlLabel-label": { fontWeight: 600 },
      }}
    />
  );
}

export default function TransactionDialog({ open, onClose, mode = "add", initialData = null, onSaved }) {
  const { setTransactions } = useContext(AppContext);
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down("sm"), { noSsr: true });
  const [form, setForm] = useState(emptyForm);
  const [accounts, setAccounts] = useState([]);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const isEdit = mode === "edit" && initialData;

  useEffect(() => {
    if (!open) return;
    setForm(isEdit ? fromTransaction(initialData) : emptyForm());
    setError("");
    api
      .getAccounts()
      .then((data) => {
        setAccounts(data);
        setForm((prev) => (prev.account_id ? prev : { ...prev, account_id: data[0]?.id || "" }));
      })
      .catch((err) => console.error("Не удалось загрузить счета:", err));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const set = (field) => (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const handleTypeChange = (e) => {
    const type = e.target.value;
    setForm((prev) => ({ ...prev, type, source: CATEGORIES[type][0] }));
  };

  // DatePicker отдаёт полночь выбранного дня — сохраняем время исходной даты.
  const handleDateChange = (value) => {
    if (!value || !value.isValid()) return;
    setForm((prev) => ({
      ...prev,
      date: value.hour(prev.date.hour()).minute(prev.date.minute()).second(prev.date.second()),
    }));
  };

  const currencyOptions = CURRENCY_OPTIONS.some((o) => o.value === form.currency)
    ? CURRENCY_OPTIONS
    : [...CURRENCY_OPTIONS, { value: form.currency, label: form.currency }];

  const sourceOptions = CATEGORIES[form.type].includes(form.source)
    ? CATEGORIES[form.type]
    : [...CATEGORIES[form.type], form.source];

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    const payload = {
      type: form.type,
      source: form.source,
      description: form.description,
      summ: form.summ,
      currency: form.currency,
      account_id: form.account_id,
      date: form.date.toDate(),
    };
    try {
      if (isEdit) {
        const updated = await api.updateTransaction(initialData.id, payload);
        const merged = mergeUpdatedTransaction(initialData, updated);
        setTransactions((prev) => prev.map((t) => (t.id === merged.id ? merged : t)));
        onSaved?.(merged);
      } else {
        const created = await api.addTransaction(payload);
        setTransactions((prev) => [...prev, created]);
        onSaved?.(created);
      }
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm" fullScreen={fullScreen} scroll="paper">
      <DialogTitle sx={{ pr: 7 }}>{isEdit ? "Изменить запись" : "Добавить запись"}</DialogTitle>
      <IconButton aria-label="Закрыть" onClick={onClose} sx={{ position: "absolute", right: 12, top: 14 }}>
        <CloseRounded />
      </IconButton>

      <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
        <DialogContent>
          <div className="flex flex-col gap-4 pt-1">
            <div>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1, fontWeight: 500 }}>
                Тип операции
              </Typography>
              <RadioGroup row value={form.type} onChange={handleTypeChange} className="flex gap-3" aria-label="Тип операции">
                <TypeOption value={INCOME} label="Доход" checked={form.type === INCOME} />
                <TypeOption value={EXPENSE} label="Расход" checked={form.type === EXPENSE} />
              </RadioGroup>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <TextField
                id="summ"
                label="Сумма"
                type="number"
                value={form.summ}
                onChange={set("summ")}
                required
                slotProps={{ htmlInput: { min: 0, step: "0.01", inputMode: "decimal" } }}
              />
              <TextField select id="currency" label="Валюта" value={form.currency} onChange={set("currency")}>
                {currencyOptions.map((o) => (
                  <MenuItem key={o.value} value={o.value}>
                    {o.label}
                  </MenuItem>
                ))}
              </TextField>
              <TextField select id="source" label="Категория" value={form.source} onChange={set("source")}>
                {sourceOptions.map((s) => (
                  <MenuItem key={s} value={s}>
                    {s}
                  </MenuItem>
                ))}
              </TextField>
              <DatePicker
                label="Дата"
                value={form.date}
                onChange={handleDateChange}
                format="DD.MM.YYYY"
                slotProps={{ textField: { id: "date-picker" } }}
              />
            </div>

            <TextField
              select
              id="account_id"
              label="Счёт"
              value={accounts.some((a) => a.id === form.account_id) ? form.account_id : ""}
              onChange={set("account_id")}
              disabled={accounts.length === 0}
            >
              {accounts.map((a) => (
                <MenuItem key={a.id} value={a.id}>
                  {a.name}
                </MenuItem>
              ))}
            </TextField>

            <TextField
              id="description"
              label="Описание"
              placeholder="Введите описание операции"
              value={form.description}
              onChange={set("description")}
              multiline
              minRows={2}
              slotProps={{ htmlInput: { maxLength: 250 } }}
            />

            {error && <Alert severity="error">{error}</Alert>}

            {isEdit && (
              <>
                <Divider />
                <AttachmentsPanel transactionId={initialData.id} />
              </>
            )}
          </div>
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 3, pt: 2 }}>
          <Button onClick={onClose} color="inherit">
            Отмена
          </Button>
          <Button type="submit" variant="contained" disabled={submitting}>
            {isEdit ? "Обновить" : "Сохранить"}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
