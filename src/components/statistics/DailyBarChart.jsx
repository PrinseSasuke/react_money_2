import React, { useMemo } from "react";
import { BarChart } from "@mui/x-charts/BarChart";
import { useTheme } from "@mui/material/styles";
import SectionCard from "../ui/SectionCard";
import EmptyState from "../ui/EmptyState";
import { formatNumber, toDayKey } from "../../utils/format";
import { EXPENSE, INCOME } from "../../utils/categories";
import { amountRub } from "../../utils/currency";

const shortDay = (dayKey) => {
  const [, m, d] = dayKey.split("-");
  return `${d}.${m}`;
};

// Дни без операций не показываем — как и раньше, иначе на длинных периодах
// график превращается в редкие столбики среди пустых дат.
export default function DailyBarChart({ transactions, rates }) {
  const theme = useTheme();

  const { labels, income, expense } = useMemo(() => {
    const byDay = new Map();
    transactions.forEach((t) => {
      const key = toDayKey(t.date);
      const entry = byDay.get(key) || { income: 0, expense: 0 };
      if (t.type === INCOME) entry.income += amountRub(t, rates);
      if (t.type === EXPENSE) entry.expense += amountRub(t, rates);
      byDay.set(key, entry);
    });
    const days = [...byDay.keys()].sort();
    return {
      labels: days.map(shortDay),
      income: days.map((d) => byDay.get(d).income),
      expense: days.map((d) => byDay.get(d).expense),
    };
  }, [transactions, rates]);

  return (
    <SectionCard title="Динамика по дням" subtitle="Доходы и расходы за выбранный период">
      {labels.length === 0 ? (
        <EmptyState title="Нет данных за выбранный период" description="Выберите другой диапазон дат." />
      ) : (
        <BarChart
          height={320}
          borderRadius={6}
          grid={{ horizontal: true }}
          xAxis={[{ scaleType: "band", data: labels, categoryGapRatio: 0.35, barGapRatio: 0.15 }]}
          yAxis={[{ valueFormatter: (v) => formatNumber(v), width: 64 }]}
          series={[
            { data: income, label: "Доходы", color: theme.palette.finance.income.main, valueFormatter: (v) => `${formatNumber(v)} ₽` },
            { data: expense, label: "Расходы", color: theme.palette.finance.expense.main, valueFormatter: (v) => `${formatNumber(v)} ₽` },
          ]}
        />
      )}
    </SectionCard>
  );
}
