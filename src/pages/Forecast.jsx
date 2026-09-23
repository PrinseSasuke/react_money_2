import React, { useMemo } from "react";
import { useOutletContext } from "react-router-dom";
import { Alert, Card, CardContent } from "@mui/material";
import { LineChart } from "@mui/x-charts/LineChart";
import { useTheme } from "@mui/material/styles";
import AccountBalanceWalletRounded from "@mui/icons-material/AccountBalanceWalletRounded";
import NorthEastRounded from "@mui/icons-material/NorthEastRounded";
import SouthWestRounded from "@mui/icons-material/SouthWestRounded";
import TrendingUpRounded from "@mui/icons-material/TrendingUpRounded";
import PageHeader from "../components/ui/PageHeader";
import SectionCard from "../components/ui/SectionCard";
import StatCard from "../components/ui/StatCard";
import EmptyState from "../components/ui/EmptyState";
import { formatMoney, formatMonthKey, formatNumber, toMonthKey } from "../utils/format";
import { EXPENSE, INCOME } from "../utils/categories";

const MONTHS_AHEAD = 3;

// Линейная регрессия по номерам месяцев. При одной точке наклон не
// определён (деление на ноль) — тогда прогноз просто равен этому значению.
function linearForecast(values, monthsAhead) {
  const n = values.length;
  if (n < 2) return Array.from({ length: monthsAhead }, () => Math.round(values[0] || 0));
  const x = [...Array(n).keys()];
  const sumX = x.reduce((a, b) => a + b, 0);
  const sumY = values.reduce((a, b) => a + b, 0);
  const sumXY = x.reduce((acc, xi, i) => acc + xi * values[i], 0);
  const sumXX = x.reduce((acc, xi) => acc + xi * xi, 0);
  const k = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  const b = (sumY - k * sumX) / n;
  return Array.from({ length: monthsAhead }, (_, i) => Math.max(0, Math.round(k * (n + i) + b)));
}

const nextMonthKeys = (lastKey, count) => {
  const [y, m] = lastKey.split("-").map(Number);
  return Array.from({ length: count }, (_, i) => toMonthKey(new Date(y, m - 1 + i + 1, 1)));
};

function useForecast(transactions) {
  return useMemo(() => {
    if (transactions.length === 0) return null;
    const expenseByMonth = {};
    const incomeByMonth = {};
    transactions.forEach((t) => {
      const key = toMonthKey(t.date);
      const summ = Number(t.summ) || 0;
      if (t.type === EXPENSE) expenseByMonth[key] = (expenseByMonth[key] || 0) + summ;
      if (t.type === INCOME) incomeByMonth[key] = (incomeByMonth[key] || 0) + summ;
    });

    const months = [...new Set([...Object.keys(expenseByMonth), ...Object.keys(incomeByMonth)])].sort();
    const expenses = months.map((m) => expenseByMonth[m] || 0);
    const incomes = months.map((m) => incomeByMonth[m] || 0);
    const expenseAvg = expenses.reduce((a, b) => a + b, 0) / months.length;
    const incomeAvg = incomes.reduce((a, b) => a + b, 0) / months.length;
    const firstExpense = expenses[0];
    const lastExpense = expenses[expenses.length - 1];
    const currentExpense = expenseByMonth[toMonthKey(new Date())] || 0;
    const futureMonths = nextMonthKeys(months[months.length - 1], MONTHS_AHEAD);

    return {
      labels: [...months, ...futureMonths].map(formatMonthKey),
      historyLength: months.length,
      expenses,
      incomes,
      expenseForecast: linearForecast(expenses, MONTHS_AHEAD),
      incomeForecast: linearForecast(incomes, MONTHS_AHEAD),
      expenseAvg,
      incomeAvg,
      balance: incomeAvg - expenseAvg,
      expenseGrowth: firstExpense === 0 ? 0 : ((lastExpense - firstExpense) / firstExpense) * 100,
      overspending: currentExpense > expenseAvg,
    };
  }, [transactions]);
}

function ForecastChart({ labels, history, forecast, color, name }) {
  // Факт и прогноз — две серии; прогноз начинается с последней фактической
  // точки, чтобы линия была непрерывной.
  const pad = Array(forecast.length).fill(null);
  const factData = [...history, ...pad];
  const forecastData = [...Array(history.length - 1).fill(null), history[history.length - 1], ...forecast];

  return (
    <LineChart
      height={300}
      grid={{ horizontal: true }}
      xAxis={[{ scaleType: "point", data: labels }]}
      yAxis={[{ valueFormatter: (v) => formatNumber(v), width: 64 }]}
      series={[
        { data: factData, label: name, color, showMark: true, valueFormatter: (v) => (v == null ? "" : `${formatNumber(v)} ₽`) },
        {
          id: "forecast",
          data: forecastData,
          label: "Прогноз",
          color,
          showMark: true,
          valueFormatter: (v) => (v == null ? "" : `${formatNumber(v)} ₽`),
        },
      ]}
      sx={{ "& .MuiLineElement-series-forecast": { strokeDasharray: "6 5" } }}
    />
  );
}

const ForecastPage = () => {
  const { transactions } = useOutletContext();
  const theme = useTheme();
  const forecast = useForecast(transactions);

  return (
    <div>
      <PageHeader
        title="Прогноз бюджета"
        subtitle={`Средние значения и линейный прогноз на ${MONTHS_AHEAD} месяца вперёд`}
      />

      {!forecast ? (
        <Card>
          <CardContent>
            <EmptyState title="Недостаточно данных" description="Прогноз появится после добавления операций." />
          </CardContent>
        </Card>
      ) : (
        <>
          {forecast.overspending && (
            <Alert severity="warning" sx={{ mb: 3 }}>
              ⚠ Текущие расходы превышают средний прогноз!
            </Alert>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard highlighted label="Прогнозируемый баланс" value={formatMoney(forecast.balance, "RUB")} icon={AccountBalanceWalletRounded} />
            <StatCard label="Средний доход в месяц" value={formatMoney(forecast.incomeAvg, "RUB")} icon={SouthWestRounded} />
            <StatCard label="Средний расход в месяц" value={formatMoney(forecast.expenseAvg, "RUB")} icon={NorthEastRounded} />
            <StatCard
              label="Прирост расходов за период"
              value={`${forecast.expenseGrowth.toFixed(2).replace(".", ",")} %`}
              icon={TrendingUpRounded}
            />
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
            <SectionCard title="Расходы (с прогнозом)" subtitle="Динамика по месяцам">
              <ForecastChart
                labels={forecast.labels}
                history={forecast.expenses}
                forecast={forecast.expenseForecast}
                color={theme.palette.finance.expense.main}
                name="Расходы"
              />
            </SectionCard>
            <SectionCard title="Доходы (с прогнозом)" subtitle="Динамика по месяцам">
              <ForecastChart
                labels={forecast.labels}
                history={forecast.incomes}
                forecast={forecast.incomeForecast}
                color={theme.palette.finance.income.main}
                name="Доходы"
              />
            </SectionCard>
          </div>
        </>
      )}
    </div>
  );
};

export default ForecastPage;
