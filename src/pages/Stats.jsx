import React, { useState, useContext, useEffect } from "react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import Bar from "../components/Stats/Bar";
import { AppContext } from "../App"; // Путь к AppContext
import PieChartsContainer from "../components/Stats/Pie";
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

  const onChange = (dates) => {
    const [start, end] = dates;
    setStartDate(start);
    setEndDate(end);
  };

  // Функция для фильтрации транзакций в выбранном диапазоне дат
  const filterTransactionsByDate = () => {
    if (!startDate || !endDate) return [];

    return transactions.filter((transaction) => {
      const transactionDate = new Date(transaction.date);
      return transactionDate >= startDate && transactionDate <= endDate;
    });
  };

  // Функция для расчета баланса, дохода и расхода
  const calculateStats = () => {
    const filteredTransactions = filterTransactionsByDate();

    const incomeTransactions = filteredTransactions.filter(
      (transaction) => transaction.type === "Доход"
    );
    const outcomeTransactions = filteredTransactions.filter(
      (transaction) => transaction.type === "Расход"
    );

    const totalIncome = incomeTransactions.reduce(
      (acc, transaction) => acc + parseInt(transaction.summ),
      0
    );

    const totalOutcome = outcomeTransactions.reduce(
      (acc, transaction) => acc + parseInt(transaction.summ),
      0
    );

    const balance = totalIncome - totalOutcome;

    setTotalIncome(totalIncome);
    setTotalOutcome(totalOutcome);
    setBalance(balance);
  };

  // Вызов calculateStats при изменении дат
  useEffect(() => {
    calculateStats();
  }, [startDate, endDate, transactions]);

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
      </div>

      <div className="stats-info">
        <div className="income">
          <img src="/img/balance.svg" alt="" className="income-img" />
          <span className="income-text">Баланс</span>
          <div className="income__container">
            <span className="income-count">{balance.toFixed(2)}</span>
            <span className="income-percent">
              {balance >= 0
                ? `+${((balance / totalIncome) * 100).toFixed(2)}%`
                : `-${((Math.abs(balance) / totalIncome) * 100).toFixed(2)}%`}
            </span>
          </div>
        </div>
        <div className="income">
          <img src="/img/stats-income.svg" alt="" className="income-img" />
          <span className="income-text">Общий доход</span>
          <div className="income__container">
            <span className="income-count">{totalIncome.toFixed(2)}</span>
            <span className="income-percent">+1,29%</span>
          </div>
        </div>
        <div className="outcome">
          <img src="/img/stats-outcome.svg" alt="" className="outcome-img" />
          <span className="outcome-text">Общий расход</span>
          <div className="outcome__container">
            <span className="outcome-count">{totalOutcome.toFixed(2)}</span>
            <span className="outcome-percent">+1,29%</span>
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
