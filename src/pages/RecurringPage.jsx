import React, { useCallback, useEffect, useState } from "react";
import { Alert, Button, Card, CardContent, IconButton, Skeleton, Switch, Tooltip, Typography } from "@mui/material";
import AddRounded from "@mui/icons-material/AddRounded";
import EditRounded from "@mui/icons-material/EditRounded";
import DeleteOutlineRounded from "@mui/icons-material/DeleteOutlineRounded";
import * as api from "../services/api";
import PageHeader from "../components/ui/PageHeader";
import EmptyState from "../components/ui/EmptyState";
import CategoryAvatar from "../components/ui/CategoryAvatar";
import AmountText from "../components/ui/AmountText";
import RecurringDialog, { FREQUENCY_LABELS } from "../components/recurring/RecurringDialog";
import { formatDate } from "../utils/format";

export default function RecurringPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setItems(await api.getRecurring());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openAdd = () => {
    setEditingItem(null);
    setDialogOpen(true);
  };

  const toggleActive = async (item) => {
    try {
      await api.updateRecurring(item.id, { active: !item.active });
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDelete = async (item) => {
    try {
      await api.deleteRecurring(item.id);
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div>
      <PageHeader
        title="Регулярные платежи"
        subtitle="Подписки, аренда, зарплата — создаются автоматически по расписанию"
        actions={
          <Button variant="contained" startIcon={<AddRounded />} onClick={openAdd}>
            Добавить платёж
          </Button>
        }
      />

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {loading ? (
        <div className="flex flex-col gap-3">
          {[0, 1].map((i) => (
            <Skeleton key={i} variant="rounded" height={88} sx={{ borderRadius: 5 }} />
          ))}
        </div>
      ) : items.length === 0 ? (
        <Card>
          <CardContent>
            <EmptyState
              title="Пока нет регулярных платежей"
              description="Добавьте подписку или ежемесячный платёж — операции будут создаваться сами."
              action={
                <Button variant="contained" onClick={openAdd}>
                  Добавить платёж
                </Button>
              }
            />
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {items.map((item) => (
            <Card key={item.id} sx={{ opacity: item.active ? 1 : 0.6, transition: "opacity .2s" }}>
              <CardContent sx={{ p: 2.5, "&:last-child": { pb: 2.5 } }}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <CategoryAvatar source={item.source} />
                    <div className="min-w-0">
                      <Typography variant="subtitle2" noWrap>
                        {item.source}
                        {item.description && ` — ${item.description}`}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" component="p">
                        {FREQUENCY_LABELS[item.frequency]} · следующее списание {formatDate(item.next_run_date)}
                      </Typography>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-2 sm:justify-end">
                    <AmountText summ={item.summ} type={item.type} currency={item.currency} />
                    <div className="flex items-center">
                      <Tooltip title={item.active ? "Отключить" : "Включить"}>
                        <Switch
                          checked={Boolean(item.active)}
                          onChange={() => toggleActive(item)}
                          slotProps={{ input: { "aria-label": item.active ? "Отключить платёж" : "Включить платёж" } }}
                        />
                      </Tooltip>
                      <Tooltip title="Изменить">
                        <IconButton
                          aria-label="Изменить платёж"
                          onClick={() => {
                            setEditingItem(item);
                            setDialogOpen(true);
                          }}
                        >
                          <EditRounded fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Удалить">
                        <IconButton
                          aria-label="Удалить платёж"
                          onClick={() => handleDelete(item)}
                          sx={{ color: (t) => t.palette.finance.expense.text }}
                        >
                          <DeleteOutlineRounded fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <RecurringDialog
        open={dialogOpen}
        initialData={editingItem}
        onClose={() => setDialogOpen(false)}
        onSaved={load}
      />
    </div>
  );
}
