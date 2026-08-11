import { AppContext } from "../App";
import { useContext } from "react";
export const useDayStats = (date) => {
  const formatToDateOnly = (date) => {
    const dateObj = new Date(date);
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, "0");
    const day = String(dateObj.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
  };
  const { transactions } = useContext(AppContext);
  const dayTransactions = transactions.filter(
    (item) => formatToDateOnly(item.date) === date
  );
  const dayExpenses = dayTransactions.filter((item) => item.type === "Расход");
  const dayIncome = dayTransactions.filter((item) => item.type === "Доход");
  const resultData = { dayExpenses, dayIncome };
  return resultData;
};
