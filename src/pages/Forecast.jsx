import React, { useEffect, useState } from "react";
import * as api from "../services/api";
import { useAuth } from "../context/AuthContext";
import { Chart } from "react-google-charts";

const ForecastPage = () => {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState([]);
  const [expenseForecast, setExpenseForecast] = useState(0);
  const [incomeForecast, setIncomeForecast] = useState(0);
  const [expenseChartData, setExpenseChartData] = useState([]);
  const [incomeChartData, setIncomeChartData] = useState([]);
  const [balanceForecast, setBalanceForecast] = useState(0);
  const [expenseGrowth, setExpenseGrowth] = useState(0);
  const [overspending, setOverspending] = useState(false);

  useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      try {
        const data = await api.getTransactions();
        setTransactions(data);
      } catch (err) {
        console.error("Не удалось загрузить транзакции:", err);
      }
    };

    fetchData();
  }, [user]);

  useEffect(() => {
    if (transactions.length === 0) return;

    const expenseGrouped = {};
    const incomeGrouped = {};

    transactions.forEach((tx) => {
      const parsedDate = new Date(tx.date);
      const month =
        parsedDate.getFullYear() +
        "-" +
        String(parsedDate.getMonth() + 1).padStart(2, "0");
      const summ = Number(tx.summ);

      if (tx.type === "Расход") {
        expenseGrouped[month] = (expenseGrouped[month] || 0) + summ;
      } else if (tx.type === "Доход") {
        incomeGrouped[month] = (incomeGrouped[month] || 0) + summ;
      }
    });

    const allMonths = Array.from(
      new Set([...Object.keys(expenseGrouped), ...Object.keys(incomeGrouped)])
    ).sort();

    const expenseValues = allMonths.map((month) => [
      month,
      expenseGrouped[month] || 0,
    ]);
    const incomeValues = allMonths.map((month) => [
      month,
      incomeGrouped[month] || 0,
    ]);

    // Базовые прогнозы
    const expenseSum = expenseValues.reduce((acc, item) => acc + item[1], 0);
    const expenseAvg = expenseSum / allMonths.length;
    setExpenseForecast(expenseAvg.toFixed(2));

    const incomeSum = incomeValues.reduce((acc, item) => acc + item[1], 0);
    const incomeAvg = incomeSum / allMonths.length;
    setIncomeForecast(incomeAvg.toFixed(2));

    const balance = (incomeAvg - expenseAvg).toFixed(2);
    setBalanceForecast(balance);

    const firstExpense = expenseValues[0][1];
    const lastExpense = expenseValues[expenseValues.length - 1][1];
    const growth =
      firstExpense === 0
        ? 0
        : (((lastExpense - firstExpense) / firstExpense) * 100).toFixed(2);
    setExpenseGrowth(growth);

    const currentDate = new Date();
    const currentMonthStr = `${currentDate.getFullYear()}-${String(
      currentDate.getMonth() + 1
    ).padStart(2, "0")}`;
    const currentExpense = expenseGrouped[currentMonthStr] || 0;
    setOverspending(currentExpense > expenseAvg);

    // Линейная регрессия
    const linearRegressionForecast = (values, monthsAhead = 3) => {
      const n = values.length;
      const x = [...Array(n).keys()];
      const y = values.map((item) => item[1]);

      const sumX = x.reduce((a, b) => a + b, 0);
      const sumY = y.reduce((a, b) => a + b, 0);
      const sumXY = x.reduce((acc, xi, i) => acc + xi * y[i], 0);
      const sumXX = x.reduce((acc, xi) => acc + xi * xi, 0);

      const k = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
      const b = (sumY - k * sumX) / n;

      const forecast = [];
      for (let i = 1; i <= monthsAhead; i++) {
        const nextX = n + i - 1;
        const nextMonthValue = k * nextX + b;
        forecast.push(Math.round(nextMonthValue));
      }

      return forecast;
    };

    // Прогноз по расходам
    const expenseForecastValues = linearRegressionForecast(expenseValues, 3);
    const [lastExpenseYear, lastExpenseMonth] = expenseValues[
      expenseValues.length - 1
    ][0]
      .split("-")
      .map(Number);
    const expenseForecastMonths = [];
    for (let i = 1; i <= 3; i++) {
      const nextDate = new Date(lastExpenseYear, lastExpenseMonth - 1 + i, 1);
      const monthStr = `${nextDate.getFullYear()}-${String(
        nextDate.getMonth() + 1
      ).padStart(2, "0")}`;
      expenseForecastMonths.push([monthStr, expenseForecastValues[i - 1]]);
    }
    const fullExpenseData = [...expenseValues, ...expenseForecastMonths];
    setExpenseChartData([["Месяц", "Расходы"], ...fullExpenseData]);

    // Прогноз по доходам
    const incomeForecastValues = linearRegressionForecast(incomeValues, 3);
    const [lastIncomeYear, lastIncomeMonth] = incomeValues[
      incomeValues.length - 1
    ][0]
      .split("-")
      .map(Number);
    const incomeForecastMonths = [];
    for (let i = 1; i <= 3; i++) {
      const nextDate = new Date(lastIncomeYear, lastIncomeMonth - 1 + i, 1);
      const monthStr = `${nextDate.getFullYear()}-${String(
        nextDate.getMonth() + 1
      ).padStart(2, "0")}`;
      incomeForecastMonths.push([monthStr, incomeForecastValues[i - 1]]);
    }
    const fullIncomeData = [...incomeValues, ...incomeForecastMonths];
    setIncomeChartData([["Месяц", "Доходы"], ...fullIncomeData]);
  }, [transactions]);

  return (
    <div style={{ padding: "20px" }}>
      <h2>Прогноз бюджета</h2>

      <div style={{ marginBottom: "20px" }}>
        <h3>Итоговый прогноз</h3>
        <p>
          Прогнозируемый баланс: <strong>{balanceForecast} ₽</strong>
        </p>
        <p>
          Прирост расходов за период: <strong>{expenseGrowth} %</strong>
        </p>
        {overspending && (
          <p style={{ color: "red" }}>
            ⚠ Текущие расходы превышают средний прогноз!
          </p>
        )}
      </div>

      <div style={{ marginBottom: "20px" }}>
        <h3>Расходы (с прогнозом)</h3>
        <p>
          Средний расход: <strong>{expenseForecast} ₽</strong>
        </p>
        <Chart
          chartType="LineChart"
          width="100%"
          height="400px"
          data={expenseChartData}
          options={{
            title: "Динамика расходов + прогноз",
            curveType: "function",
            legend: { position: "bottom" },
            vAxis: { title: "Расходы (₽)" },
            hAxis: { title: "Месяц" },
          }}
        />
      </div>

      <div style={{ marginBottom: "20px" }}>
        <h3>Доходы (с прогнозом)</h3>
        <p>
          Средний доход: <strong>{incomeForecast} ₽</strong>
        </p>
        <Chart
          chartType="LineChart"
          width="100%"
          height="400px"
          data={incomeChartData}
          options={{
            title: "Динамика доходов + прогноз",
            curveType: "function",
            legend: { position: "bottom" },
            vAxis: { title: "Доходы (₽)" },
            hAxis: { title: "Месяц" },
          }}
        />
      </div>
    </div>
  );
};

export default ForecastPage;
