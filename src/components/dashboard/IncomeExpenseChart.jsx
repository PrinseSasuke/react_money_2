import React, { useMemo } from "react";
import { BarChart } from "@mui/x-charts/BarChart";
import { useTheme } from "@mui/material/styles";
import SectionCard from "../ui/SectionCard";
import EmptyState from "../ui/EmptyState";
import { formatMonthKey, formatNumber, toMonthKey } from "../../utils/format";
import { EXPENSE, INCOME } from "../../utils/categories";
import { amountRub } from "../../utils/currency";

const MONTHS = 6;

export default function IncomeExpenseChart({ transactions, rates }) {
  const theme = useTheme();

  const { labels, income, expense, hasData } = useMemo(() => {
    const now = new Date();
    const keys = Array.from({ length: MONTHS }, (_, i) =>
      toMonthKey(new Date(now.getFullYear(), now.getMonth() - (MONTHS - 1 - i), 1))
    );
    const inc = Object.fromEntries(keys.map((k) => [k, 0]));
    const exp = Object.fromEntries(keys.map((k) => [k, 0]));
    transactions.forEach((t) => {
      const key = toMonthKey(t.date);
      if (!(key in inc)) return;
      if (t.type === INCOME) inc[key] += amountRub(t, rates);
      if (t.type === EXPENSE) exp[key] += amountRub(t, rates);
    });
    const incomeValues = keys.map((k) => inc[k]);
    const expenseValues = keys.map((k) => exp[k]);
    return {
      labels: keys.map(formatMonthKey),
      income: incomeValues,
      expense: expenseValues,
      hasData: [...incomeValues, ...expenseValues].some((v) => v > 0),
    };
  }, [transactions, rates]);

  return (
    <SectionCard title="Доходы и расходы" subtitle={`За последние ${MONTHS} месяцев`}>
      {hasData ? (
        <BarChart
          height={280}
          borderRadius={6}
          grid={{ horizontal: true }}
          xAxis={[{ scaleType: "band", data: labels, categoryGapRatio: 0.35, barGapRatio: 0.15 }]}
          yAxis={[{ valueFormatter: (v) => formatNumber(v), width: 64 }]}
          series={[
            { data: income, label: "Доходы", color: theme.palette.finance.income.main, valueFormatter: (v) => `${formatNumber(v)} ₽` },
            { data: expense, label: "Расходы", color: theme.palette.finance.expense.main, valueFormatter: (v) => `${formatNumber(v)} ₽` },
          ]}
        />
      ) : (
        <EmptyState title="Пока нечего показать" description="График появится, когда вы добавите операции." />
      )}
    </SectionCard>
  );
}
