import { AppContext } from "../App";
import { useContext } from "react";
export const useDayDate = (date) => {
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
  const summ = dayTransactions.reduce((acc, item) => {
    return item.type === "Доход"
      ? acc + parseInt(item.summ)
      : acc - parseInt(item.summ);
  }, 0);
  const resultData = { dayTransactions, summ };
  return resultData;
};
