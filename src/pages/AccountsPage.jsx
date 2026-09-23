import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Avatar,
  Button,
  Card,
  CardContent,
  MenuItem,
  Skeleton,
  TextField,
  Typography,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import AddRounded from "@mui/icons-material/AddRounded";
import EditRounded from "@mui/icons-material/EditRounded";
import DeleteOutlineRounded from "@mui/icons-material/DeleteOutlineRounded";
import * as api from "../services/api";
import PageHeader from "../components/ui/PageHeader";
import EmptyState from "../components/ui/EmptyState";
import AccountDialog from "../components/accounts/AccountDialog";
import { accountTypeMeta } from "../components/accounts/accountMeta";
import { formatMoney } from "../utils/format";

function AccountCard({ account, accounts, onEdit, onDelete, reassignOpen }) {
  const meta = accountTypeMeta(account.type);
  const Icon = meta.icon;
  const [reassignTarget, setReassignTarget] = useState("");

  return (
    <Card sx={{ height: "100%" }}>
      <CardContent sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
        <div className="flex items-start justify-between gap-3">
          <Avatar
            variant="rounded"
            sx={{ width: 44, height: 44, borderRadius: 3, bgcolor: alpha(meta.color, 0.14), color: meta.color }}
          >
            <Icon />
          </Avatar>
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
            {meta.label} · {account.currency}
          </Typography>
        </div>
        <Typography variant="subtitle1" sx={{ mt: 2 }} noWrap>
          {account.name}
        </Typography>
        <Typography sx={{ fontSize: "1.6rem", fontWeight: 700, letterSpacing: "-0.02em", overflowWrap: "anywhere" }}>
          {formatMoney(account.balance, account.currency)}
        </Typography>

        <div className="mt-auto flex flex-wrap gap-2 pt-4">
          <Button size="small" variant="outlined" startIcon={<EditRounded />} onClick={() => onEdit(account)}>
            Изменить
          </Button>
          <Button
            size="small"
            variant="outlined"
            color="error"
            startIcon={<DeleteOutlineRounded />}
            onClick={() => onDelete(account, null)}
          >
            Удалить
          </Button>
        </div>

        {reassignOpen && (
          <Alert severity="warning" sx={{ mt: 2 }}>
            <Typography variant="body2" sx={{ mb: 1.5 }}>
              У счёта есть транзакции. Выберите счёт для переноса:
            </Typography>
            <div className="flex flex-col gap-2 sm:flex-row">
              <TextField
                select
                size="small"
                label="Счёт"
                value={reassignTarget}
                onChange={(e) => setReassignTarget(e.target.value)}
                sx={{ minWidth: 160, flex: 1 }}
              >
                {accounts
                  .filter((a) => a.id !== account.id)
                  .map((a) => (
                    <MenuItem value={a.id} key={a.id}>
                      {a.name}
                    </MenuItem>
                  ))}
              </TextField>
              <Button
                size="small"
                variant="contained"
                color="error"
                disabled={!reassignTarget}
                onClick={() => onDelete(account, reassignTarget)}
              >
                Перенести и удалить
              </Button>
            </div>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}

export default function AccountsPage() {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState(null);
  const [reassignFor, setReassignFor] = useState(null);
  const [error, setError] = useState("");

  const loadAccounts = useCallback(async () => {
    try {
      setAccounts(await api.getAccounts());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  const openAdd = () => {
    setEditingAccount(null);
    setDialogOpen(true);
  };

  const openEdit = (account) => {
    setEditingAccount(account);
    setDialogOpen(true);
  };

  // Бэкенд отвечает ошибкой с упоминанием reassignTo, если у счёта есть
  // операции — тогда показываем выбор счёта для переноса.
  const handleDelete = async (account, reassignTo) => {
    setError("");
    try {
      await api.deleteAccount(account.id, reassignTo);
      setReassignFor(null);
      loadAccounts();
    } catch (err) {
      if (err.message.includes("reassignTo")) setReassignFor(account.id);
      else setError(err.message);
    }
  };

  return (
    <div>
      <PageHeader
        title="Счета"
        subtitle="Карты, наличные и накопления"
        actions={
          <Button variant="contained" startIcon={<AddRounded />} onClick={openAdd}>
            Добавить счёт
          </Button>
        }
      />

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} variant="rounded" height={200} sx={{ borderRadius: 5 }} />
          ))}
        </div>
      ) : accounts.length === 0 ? (
        <Card>
          <CardContent>
            <EmptyState
              title="Счетов пока нет"
              description="Добавьте карту, наличные или накопительный счёт."
              action={
                <Button variant="contained" onClick={openAdd}>
                  Добавить счёт
                </Button>
              }
            />
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {accounts.map((account) => (
            <AccountCard
              key={account.id}
              account={account}
              accounts={accounts}
              onEdit={openEdit}
              onDelete={handleDelete}
              reassignOpen={reassignFor === account.id}
            />
          ))}
        </div>
      )}

      <AccountDialog
        open={dialogOpen}
        initialData={editingAccount}
        onClose={() => setDialogOpen(false)}
        onSaved={loadAccounts}
      />
    </div>
  );
}
