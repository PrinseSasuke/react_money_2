import React, { useContext, useEffect, useState } from "react";
import { Chart } from "react-google-charts";
import { AppContext } from "../../../App";
import { useTheme } from "../../../hooks/useTheme";

// Настройки графиков с различными цветами
const options = (title, colors, isDark) => {
  const textColor = isDark ? "#ececf1" : "#1b1d4e";
  return {
    title,
    pieHole: 0.4,
    colors, // Используем переданную палитру цветов
    backgroundColor: "transparent",
    titleTextStyle: { color: textColor },
    legend: {
      position: "right",
      alignment: "center",
      textStyle: {
        fontSize: 14,
        color: textColor,
      },
    },
  };
};

// Категории транзакций
const CATEGORIES = {
  Расход: [
    "Супермаркеты",
    "Переводы",
    "Фастфуд",
    "Одежда и обувь",
    "Мобильная связь",
    "Аптеки",
    "Транспорт",
    "Остальное",
  ],
  Доход: ["Зарплата", "Доп. зарабаток", "Соц. выплата", "Остальное"],
};

function PieChart({ start, end, type, colors }) {
  const { transactions } = useContext(AppContext);
  const { theme } = useTheme();
  const [chartData, setChartData] = useState([["Категория", "Сумма"]]);

  useEffect(() => {
    const startDate = new Date(start);
    const endDate = new Date(end);

    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(23, 59, 59, 999);

    const formatFirebaseDate = (date) => new Date(date);

    const groupedData = {};

    transactions.forEach((transaction) => {
      const transactionDate = formatFirebaseDate(transaction.date);
      if (
        transactionDate >= startDate &&
        transactionDate <= endDate &&
        transaction.type === type
      ) {
        const categoryList = CATEGORIES[type];
        const category = categoryList.includes(transaction.source)
          ? transaction.source
          : "Остальное";

        groupedData[category] =
          (groupedData[category] || 0) + parseFloat(transaction.summ);
      }
    });

    const dataArray = [["Категория", "Сумма"]];
    Object.entries(groupedData).forEach(([category, sum]) => {
      if (sum > 0) dataArray.push([category, sum]);
    });

    if (dataArray.length === 1) {
      dataArray.push(["Нет данных", 1]);
    }

    setChartData(dataArray);
  }, [transactions, start, end, type]);

  return (
    <div style={{ width: "100%", height: "400px", marginBottom: "30px" }}>
      <Chart
        width="100%"
        height="400px"
        chartType="PieChart"
        loader={<div>Загрузка графика...</div>}
        data={chartData}
        options={options(
          type === "Доход" ? "Доходы по категориям" : "Расходы по категориям",
          colors,
          theme === "dark"
        )}
      />
    </div>
  );
}

export default function PieChartsContainer({ start, end }) {
  return (
    <>
      <PieChart
        start={start}
        end={end}
        type="Доход"
        colors={[
          "#22C55E", // Зеленый для зарплаты (соответствует stats-income.svg)
          "#81C784", // Бледно-зеленый для дополнительного дохода
          "#FFEB3B", // Желтый для соц. выплат
          "#8BC34A", // Лаймовый для остального дохода
        ]}
      />
      <PieChart
        start={start}
        end={end}
        type="Расход"
        colors={[
          "#EF4444", // Ярко-красный для супермаркетов (соответствует stats-outcome.svg)
          "#E57373", // Бледно-красный для переводов
          "#FF9800", // Оранжевый для фастфуда
          "#9C27B0", // Пурпурный для одежды
          "#3F51B5", // Синий для мобильной связи
          "#00BCD4", // Бирюзовый для аптек
          "#8BC34A", // Лаймовый для транспорта
          "#C62828", // Темно-красный для остального
        ]}
      />
    </>
  );
}
