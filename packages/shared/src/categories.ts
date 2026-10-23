// Expense categories of react-money (core-api transactions.source). The same list as the site's
// src/utils/categories.js; core-api accepts any text, these are the ones the site knows icons for.
export const EXPENSE_CATEGORIES = [
  "Супермаркеты",
  "Переводы",
  "Фастфуд",
  "Одежда и обувь",
  "Мобильная связь",
  "Аптеки",
  "Транспорт",
  "Остальное",
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];
