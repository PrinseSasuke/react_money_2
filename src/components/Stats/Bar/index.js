import React, { useEffect, useState, useContext } from "react";
import { Chart } from "react-google-charts";
import styles from "./Bar.module.scss";
import { AppContext } from "../../../App";

const options = {
  title: "Transactions",
  bars: "vertical",
  colors: ["#4CAF50", "#F44336"],
  hAxis: {
    title: "Дата",
  },
  vAxis: {
    title: "Сумма",
  },
  legend: { position: "top" },
};

export default function Bar({ start, end }) {
  const { transactions } = useContext(AppContext);
  const [chartData, setChartData] = useState([["Дата", "Доход", "Расход"]]);

  useEffect(() => {
    const getDatesRange = (startDate, endDate) => {
      const dates = [];
      let current = new Date(startDate);
      while (current <= endDate) {
        dates.push(new Date(current));
        current.setDate(current.getDate() + 1);
      }
      return dates;
    };

    const formatDate = (date) => date.toISOString().split("T")[0];

    const calculateData = () => {
      const datesRange = getDatesRange(new Date(start), new Date(end));

      const newData = datesRange
        .map((date) => {
          const dateStr = formatDate(date);
          const dailyTransactions = transactions.filter((item) => {
            const itemDate = new Date(item.date);
            return formatDate(itemDate) === dateStr;
          });

          const incomeSum = dailyTransactions
            .filter((t) => t.type === "Доход")
            .reduce((acc, curr) => acc + parseFloat(curr.summ), 0);

          const expenseSum = dailyTransactions
            .filter((t) => t.type === "Расход")
            .reduce((acc, curr) => acc + parseFloat(curr.summ), 0);

          if (incomeSum === 0 && expenseSum === 0) return null;
          return [dateStr, incomeSum, expenseSum];
        })
        .filter(Boolean);

      setChartData([["Дата", "Доход", "Расход"], ...newData]);
    };

    calculateData();
  }, [transactions, start, end]);

  return (
    <div
      style={{ width: "100%", height: "400px" }}
      className={styles.bar_container}
    >
      <Chart
        width="100%"
        height="400px"
        chartType="ColumnChart"
        loader={<div>Loading Chart</div>}
        data={chartData}
        options={options}
      />
    </div>
  );
}
