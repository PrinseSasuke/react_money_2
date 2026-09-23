import React, { useMemo, useState } from "react";
import { useNavigate, useOutletContext, useParams } from "react-router-dom";
import {
  Button,
  Card,
  CardContent,
  Chip,
  InputAdornment,
  MenuItem,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
} from "@mui/material";
import AddRounded from "@mui/icons-material/AddRounded";
import SearchRounded from "@mui/icons-material/SearchRounded";
import PageHeader from "../components/ui/PageHeader";
import EmptyState from "../components/ui/EmptyState";
import TransactionsTable from "../components/transactions/TransactionsTable";
import TransactionDialog from "../components/transactions/TransactionDialog";
import { toDayKey } from "../utils/format";

const SORTS = {
  newest: { label: "Сначала новые", fn: (a, b) => new Date(b.date) - new Date(a.date) },
  oldest: { label: "Сначала старые", fn: (a, b) => new Date(a.date) - new Date(b.date) },
  amountDesc: { label: "Сумма по убыванию", fn: (a, b) => b.summ - a.summ },
  amountAsc: { label: "Сумма по возрастанию", fn: (a, b) => a.summ - b.summ },
};

const dayLabel = (dayKey) => {
  const [y, m, d] = dayKey.split("-");
  return `${d}.${m}.${y}`;
};

function Transactions() {
  const { transactions } = useOutletContext();
  const { date } = useParams();
  const navigate = useNavigate();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [type, setType] = useState("all");
  const [sort, setSort] = useState("newest");

  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    return transactions
      .filter((t) => !date || toDayKey(t.date) === date)
      .filter(
        (t) =>
          !query ||
          (t.description || "").toLowerCase().includes(query) ||
          (t.source || "").toLowerCase().includes(query)
      )
      .filter((t) => type === "all" || t.type === type)
      .sort(SORTS[sort].fn);
  }, [transactions, date, search, type, sort]);

  const isFiltered = Boolean(search.trim()) || type !== "all";

  return (
    <div>
      <PageHeader
        title={date ? `Операции за ${dayLabel(date)}` : "Операции"}
        subtitle={`Найдено: ${visible.length}`}
        actions={
          <Button variant="contained" startIcon={<AddRounded />} onClick={() => setDialogOpen(true)}>
            Добавить запись
          </Button>
        }
      />

      <Card sx={{ mb: 3 }}>
        <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <TextField
              placeholder="Поиск по описанию"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              size="small"
              className="md:flex-1"
              slotProps={{
                htmlInput: { "aria-label": "Поиск по описанию" },
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchRounded fontSize="small" />
                    </InputAdornment>
                  ),
                },
              }}
            />
            <ToggleButtonGroup
              value={type}
              exclusive
              size="small"
              onChange={(_, value) => value && setType(value)}
              aria-label="Тип операций"
            >
              <ToggleButton value="all">Все</ToggleButton>
              <ToggleButton value="Доход">Доходы</ToggleButton>
              <ToggleButton value="Расход">Расходы</ToggleButton>
            </ToggleButtonGroup>
            <TextField
              select
              size="small"
              label="Сортировка"
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              sx={{ minWidth: 210 }}
            >
              {Object.entries(SORTS).map(([key, { label }]) => (
                <MenuItem key={key} value={key}>
                  {label}
                </MenuItem>
              ))}
            </TextField>
          </div>
          {date && (
            <Chip
              label={`День: ${dayLabel(date)}`}
              onDelete={() => navigate("/transactions")}
              sx={{ mt: 2 }}
              color="primary"
              variant="outlined"
            />
          )}
        </CardContent>
      </Card>

      <TransactionsTable
        transactions={visible}
        emptyState={
          <EmptyState
            title={isFiltered || date ? "Ничего не найдено" : "Операций пока нет"}
            description={
              isFiltered || date
                ? "Попробуйте изменить фильтры или поисковый запрос."
                : "Добавьте первую операцию или импортируйте выписку из Excel."
            }
          />
        }
      />

      {dialogOpen && <TransactionDialog open={dialogOpen} onClose={() => setDialogOpen(false)} />}
    </div>
  );
}

export default Transactions;
