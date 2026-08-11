import React from "react";
import { render, screen } from "@testing-library/react";
import TransactionsTable from "./TransactionsTable";

const transactionsMock = [
  {
    id: "1",
    date: "2025-05-20",
    type: "Доход",
    source: "Работа",
    description: "Зарплата",
    summ: 50000,
    currency: "₽",
  },
  {
    id: "2",
    date: "2025-05-21",
    type: "Расход",
    source: "Магазин",
    description: "Покупка продуктов",
    summ: 3000,
    currency: "₽",
  },
];

// Мокаем useOutletContext, чтобы возвращал нужные значения
jest.mock("react-router-dom", () => ({
  ...jest.requireActual("react-router-dom"),
  useOutletContext: () => ({
    transactions: transactionsMock,
    setTransactions: jest.fn(),
  }),
}));

describe("TransactionsTable", () => {
  test("отображает таблицу с транзакциями", () => {
    render(<TransactionsTable />);

    expect(screen.getByText(/зарплата/i)).toBeInTheDocument();
    expect(screen.getByText(/покупка продуктов/i)).toBeInTheDocument();
  });
});
