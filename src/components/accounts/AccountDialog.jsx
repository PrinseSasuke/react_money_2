import React, { useEffect, useState } from "react";
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  TextField,
} from "@mui/material";
import CloseRounded from "@mui/icons-material/CloseRounded";
import * as api from "../../services/api";
import { ACCOUNT_CURRENCIES, ACCOUNT_TYPES } from "./accountMeta";

const INITIAL_STATE = { name: "", type: "card", currency: "RUB", initialBalance: "" };

export default function AccountDialog({ open, onClose, initialData = null, onSaved }) {
  const isEdit = Boolean(initialData);
  const [form, setForm] = useState(INITIAL_STATE);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm(
      isEdit
        ? {
            name: initialData.name,
            type: initialData.type,
            currency: initialData.currency,
            initialBalance: String(initialData.initialBalance ?? ""),
          }
        : INITIAL_STATE
    );
    setError("");
  }, [open, isEdit, initialData]);

  const set = (field) => (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!form.name.trim()) {
      setError("Введите название счёта");
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        name: form.name.trim(),
        type: form.type,
        currency: form.currency,
        initialBalance: form.initialBalance === "" ? 0 : Number(form.initialBalance),
      };
      if (isEdit) await api.updateAccount(initialData.id, payload);
      else await api.createAccount(payload);
      onSaved();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle sx={{ pr: 7 }}>{isEdit ? "Изменить счёт" : "Новый счёт"}</DialogTitle>
      <IconButton aria-label="Закрыть" onClick={onClose} sx={{ position: "absolute", right: 12, top: 14 }}>
        <CloseRounded />
      </IconButton>
      <form onSubmit={handleSubmit}>
        <DialogContent>
          <div className="flex flex-col gap-4 pt-1">
            <TextField id="name" label="Название" value={form.name} onChange={set("name")} autoFocus required />
            <TextField select id="type" label="Тип" value={form.type} onChange={set("type")}>
              {Object.entries(ACCOUNT_TYPES).map(([value, { label }]) => (
                <MenuItem key={value} value={value}>
                  {label}
                </MenuItem>
              ))}
            </TextField>
            <TextField select id="currency" label="Валюта" value={form.currency} onChange={set("currency")}>
              {ACCOUNT_CURRENCIES.map((c) => (
                <MenuItem key={c} value={c}>
                  {c}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              id="initialBalance"
              label="Начальный баланс"
              type="number"
              value={form.initialBalance}
              onChange={set("initialBalance")}
              placeholder="0"
              slotProps={{ htmlInput: { step: "0.01" } }}
            />
            {error && <Alert severity="error">{error}</Alert>}
          </div>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
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
