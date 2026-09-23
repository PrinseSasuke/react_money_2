import React, { useContext, useMemo, useState } from "react";
import dayjs from "dayjs";
import { Alert, Button, Card, CardContent, Chip } from "@mui/material";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import TableChartRounded from "@mui/icons-material/TableChartRounded";
import PictureAsPdfRounded from "@mui/icons-material/PictureAsPdfRounded";
import AccountBalanceWalletRounded from "@mui/icons-material/AccountBalanceWalletRounded";
import SouthWestRounded from "@mui/icons-material/SouthWestRounded";
import NorthEastRounded from "@mui/icons-material/NorthEastRounded";
import { AppContext } from "../App";
import * as api from "../services/api";
import PageHeader from "../components/ui/PageHeader";
import StatCard from "../components/ui/StatCard";
import DailyBarChart from "../components/statistics/DailyBarChart";
import CategoryDonut from "../components/statistics/CategoryDonut";
import { formatMoney } from "../utils/format";
import { EXPENSE, INCOME } from "../utils/categories";
import { endOfDay, filterByRange, periodComparison, startOfDay } from "../utils/stats";

const PRESETS = [
  { key: "7d", label: "7 дней", range: () => [dayjs().subtract(6, "day"), dayjs()] },
  { key: "30d", label: "30 дней", range: () => [dayjs().subtract(29, "day"), dayjs()] },
  { key: "month", label: "Этот месяц", range: () => [dayjs().startOf("month"), dayjs()] },
  { key: "year", label: "Этот год", range: () => [dayjs().startOf("year"), dayjs()] },
];

export default function Stats() {
  const { transactions, rates } = useContext(AppContext);
  const [preset, setPreset] = useState("month");
  const [startDate, setStartDate] = useState(() => dayjs().startOf("month"));
  const [endDate, setEndDate] = useState(() => dayjs());
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");

  const from = startDate?.isValid() ? startOfDay(startDate.toDate()) : null;
  const to = endDate?.isValid() ? endOfDay(endDate.toDate()) : null;
  const rangeValid = from && to && from <= to;

  const inRange = useMemo(
    () => (rangeValid ? filterByRange(transactions, from, to) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [transactions, from?.getTime(), to?.getTime(), rangeValid]
  );
  const { current, change } = useMemo(
    () => periodComparison(transactions, rangeValid ? from : null, rangeValid ? to : null, rates),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [transactions, rates, from?.getTime(), to?.getTime(), rangeValid]
  );

  const applyPreset = (p) => {
    const [start, end] = p.range();
    setPreset(p.key);
    setStartDate(start);
    setEndDate(end);
  };

  const handleExport = async (type) => {
    setExportError("");
    setExporting(true);
    try {
      await api.downloadExport(type, { from: from?.toISOString(), to: to?.toISOString() });
    } catch (err) {
      setExportError(err.message);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Статистика"
        subtitle="Доходы и расходы за выбранный период"
        actions={
          <>
            <Button
              variant="outlined"
              startIcon={<TableChartRounded />}
              disabled={exporting || !rangeValid}
              onClick={() => handleExport("excel")}
            >
              Экспорт в Excel
            </Button>
            <Button
              variant="outlined"
              startIcon={<PictureAsPdfRounded />}
              disabled={exporting || !rangeValid}
              onClick={() => handleExport("pdf")}
            >
              Экспорт в PDF
            </Button>
          </>
        }
      />

      <Card sx={{ mb: 3 }}>
        <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="flex flex-wrap gap-2">
              {PRESETS.map((p) => (
                <Chip
                  key={p.key}
                  label={p.label}
                  onClick={() => applyPreset(p)}
                  color={preset === p.key ? "primary" : "default"}
                  variant={preset === p.key ? "filled" : "outlined"}
                />
              ))}
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:ml-auto lg:w-[420px]">
              <DatePicker
                label="С"
                value={startDate}
                onChange={(v) => {
                  setStartDate(v);
                  setPreset(null);
                }}
                format="DD.MM.YYYY"
                maxDate={endDate || undefined}
                slotProps={{ textField: { size: "small" } }}
              />
              <DatePicker
                label="По"
                value={endDate}
                onChange={(v) => {
                  setEndDate(v);
                  setPreset(null);
                }}
                format="DD.MM.YYYY"
                minDate={startDate || undefined}
                slotProps={{ textField: { size: "small" } }}
              />
            </div>
          </div>
          {!rangeValid && (
            <Alert severity="warning" sx={{ mt: 2 }}>
              Выберите корректный диапазон дат.
            </Alert>
          )}
          {exportError && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {exportError}
            </Alert>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatCard
          highlighted
          label="Баланс за период"
          value={formatMoney(current.balance, "RUB")}
          icon={AccountBalanceWalletRounded}
          change={change.balance}
        />
        <StatCard
          label="Общий доход"
          value={formatMoney(current.income, "RUB")}
          icon={SouthWestRounded}
          change={change.income}
        />
        <StatCard
          label="Общий расход"
          value={formatMoney(current.expense, "RUB")}
          icon={NorthEastRounded}
          change={change.expense}
          positiveIsGood={false}
        />
      </div>

      <div className="mt-4">
        <DailyBarChart transactions={inRange} rates={rates} />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <CategoryDonut title="Доходы по категориям" transactions={inRange} type={INCOME} rates={rates} />
        <CategoryDonut title="Расходы по категориям" transactions={inRange} type={EXPENSE} rates={rates} />
      </div>
    </div>
  );
}
