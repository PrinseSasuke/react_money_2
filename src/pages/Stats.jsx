import React, { useState, useContext, useEffect } from "react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import Bar from "../components/Stats/Bar";
import { AppContext } from "../App"; // Путь к AppContext
import PieChartsContainer from "../components/Stats/Pie";
import * as api from "../services/api";
export default function Stats() {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const { transactions } = useContext(AppContext); // Получаем транзакции из контекста
  const [startDate, setStartDate] = useState(yesterday);
  const [endDate, setEndDate] = useState(today);
  const [balance, setBalance] = useState(0);
  const [totalIncome, setTotalIncome] = useState(0);
  const [totalOutcome, setTotalOutcome] = useState(0);
  const [balanceChangePct, setBalanceChangePct] = useState(null);
  const [incomeChangePct, setIncomeChangePct] = useState(null);
  const [outcomeChangePct, setOutcomeChangePct] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");

  const handleExport = async (type) => {
    setExportError("");
    setExporting(true);
    try {
      await api.downloadExport(type, {
        from: startDate?.toISOString(),
        to: endDate?.toISOString(),
      });
    } catch (err) {
      setExportError(err.message);
    } finally {
      setExporting(false);
    }
  };

  const onChange = (dates) => {
    const [start, end] = dates;
    setStartDate(start);
    setEndDate(end);
  };

  // Функция для фильтрации транзакций в заданном диапазоне дат
  const filterTransactionsInRange = (from, to) => {
    if (!from || !to) return [];

    return transactions.filter((transaction) => {
      const transactionDate = new Date(transaction.date);
      return transactionDate >= from && transactionDate <= to;
    });
  };

  const sumByType = (list, type) =>
    list
      .filter((transaction) => transaction.type === type)
      .reduce((acc, transaction) => acc + parseInt(transaction.summ), 0);

  // Изменение в % относительно предыдущего периода такой же длины.
  // prev === 0: считаем "с нуля" рост как +100%, если появились деньги,
  // и 0%, если ничего не изменилось (не было и нет) — деления на 0 избегаем.
  const percentChange = (current, previous) => {
    if (previous === 0) return current === 0 ? 0 : 100;
    return ((current - previous) / Math.abs(previous)) * 100;
  };

  // Функция для расчета баланса, дохода и расхода
  const calculateStats = () => {
    const filteredTransactions = filterTransactionsInRange(startDate, endDate);

    const totalIncome = sumByType(filteredTransactions, "Доход");
    const totalOutcome = sumByType(filteredTransactions, "Расход");
    const balance = totalIncome - totalOutcome;

    setTotalIncome(totalIncome);
    setTotalOutcome(totalOutcome);
    setBalance(balance);

    // Предыдущий период той же длины, сразу перед выбранным
    if (startDate && endDate) {
      const periodMs = endDate.getTime() - startDate.getTime();
      const prevEnd = new Date(startDate.getTime() - 1);
      const prevStart = new Date(prevEnd.getTime() - periodMs);
      const prevTransactions = filterTransactionsInRange(prevStart, prevEnd);

      const prevIncome = sumByType(prevTransactions, "Доход");
      const prevOutcome = sumByType(prevTransactions, "Расход");
      const prevBalance = prevIncome - prevOutcome;

      setIncomeChangePct(percentChange(totalIncome, prevIncome));
      setOutcomeChangePct(percentChange(totalOutcome, prevOutcome));
      setBalanceChangePct(percentChange(balance, prevBalance));
    }
  };

  // Вызов calculateStats при изменении дат
  useEffect(() => {
    calculateStats();
  }, [startDate, endDate, transactions]);

  const formatPercent = (pct) => {
    if (pct === null || Number.isNaN(pct)) return "—";
    const sign = pct >= 0 ? "+" : "";
    return `${sign}${pct.toFixed(2).replace(".", ",")}%`;
  };

  return (
    <div className="stats-container">
      <div className="stats-card">
        <h2 className="stats-title">Статистика</h2>

        <div className="date-picker-container">
          <DatePicker
            selected={startDate}
            onChange={onChange}
            startDate={startDate}
            endDate={endDate}
            selectsRange
            className="date-picker"
            placeholderText="Выберите диапазон дат"
          />
        </div>

        <div className="selected-dates">
          {startDate && endDate ? (
            <p>
              Выбранный диапазон:{" "}
              <span className="date-highlight">
                {startDate.toLocaleDateString()} -{" "}
                {endDate.toLocaleDateString()}
              </span>
            </p>
          ) : (
            <p>Выберите даты</p>
          )}
        </div>

        <div className="export-actions">
          <button
            type="button"
            className="button__export"
            disabled={exporting}
            onClick={() => handleExport("excel")}
          >
            Экспорт в Excel
          </button>
          <button
            type="button"
            className="button__export"
            disabled={exporting}
            onClick={() => handleExport("pdf")}
          >
            Экспорт в PDF
          </button>
        </div>
        {exportError && (
          <p style={{ color: "var(--color-expense-text)" }}>{exportError}</p>
        )}
      </div>

      <div className="stats-info">
        <div className="income">
          <img src="/img/balance.svg" alt="" className="income-img" />
          <span className="income-text">Баланс</span>
          <div className="income__container">
            <span className="income-count">{balance.toFixed(2)}</span>
            <span className="income-percent">{formatPercent(balanceChangePct)}</span>
          </div>
        </div>
        <div className="income">
          <img src="/img/stats-income.svg" alt="" className="income-img" />
          <span className="income-text">Общий доход</span>
          <div className="income__container">
            <span className="income-count">{totalIncome.toFixed(2)}</span>
            <span className="income-percent">{formatPercent(incomeChangePct)}</span>
          </div>
        </div>
        <div className="outcome">
          <img src="/img/stats-outcome.svg" alt="" className="outcome-img" />
          <span className="outcome-text">Общий расход</span>
          <div className="outcome__container">
            <span className="outcome-count">{totalOutcome.toFixed(2)}</span>
            <span className="outcome-percent">{formatPercent(outcomeChangePct)}</span>
          </div>
        </div>
      </div>
      <div className="stats_container">
        <Bar start={startDate} end={endDate} />
        <PieChartsContainer start={startDate} end={endDate} />
      </div>
    </div>
  );
}
