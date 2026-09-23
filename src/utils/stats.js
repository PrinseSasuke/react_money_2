import { EXPENSE, INCOME } from "./categories";

export function filterByRange(transactions, from, to) {
  if (!from || !to) return [];
  const start = from.getTime();
  const end = to.getTime();
  return transactions.filter((t) => {
    const time = new Date(t.date).getTime();
    return time >= start && time <= end;
  });
}

export function sumByType(transactions, type) {
  return transactions
    .filter((t) => t.type === type)
    .reduce((acc, t) => acc + (Number(t.summ) || 0), 0);
}

export function totals(transactions) {
  const income = sumByType(transactions, INCOME);
  const expense = sumByType(transactions, EXPENSE);
  return { income, expense, balance: income - expense };
}

// Изменение в % относительно предыдущего значения. С нуля: +100%, если
// значение появилось, и 0%, если его не было и нет — без деления на ноль.
export function percentChange(current, previous) {
  if (previous === 0) return current === 0 ? 0 : 100;
  return ((current - previous) / Math.abs(previous)) * 100;
}

// Итоги за [from, to] и изменение относительно предыдущего периода той же длины.
export function periodComparison(transactions, from, to) {
  const current = totals(filterByRange(transactions, from, to));
  if (!from || !to) {
    return { current, change: { income: null, expense: null, balance: null } };
  }
  const length = to.getTime() - from.getTime();
  const prevEnd = new Date(from.getTime() - 1);
  const prevStart = new Date(prevEnd.getTime() - length);
  const previous = totals(filterByRange(transactions, prevStart, prevEnd));
  return {
    current,
    change: {
      income: percentChange(current.income, previous.income),
      expense: percentChange(current.expense, previous.expense),
      balance: percentChange(current.balance, previous.balance),
    },
  };
}

// Текущий месяц «на сегодня» против того же отрезка прошлого месяца
// (1–23 сентября против 1–23 августа), а не против окна той же длины.
export function monthToDateComparison(transactions, now = new Date()) {
  const from = startOfMonth(now);
  const to = endOfDay(now);
  const prevFrom = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevMonthDays = new Date(now.getFullYear(), now.getMonth(), 0).getDate();
  const prevTo = endOfDay(
    new Date(now.getFullYear(), now.getMonth() - 1, Math.min(now.getDate(), prevMonthDays))
  );
  const current = totals(filterByRange(transactions, from, to));
  const previous = totals(filterByRange(transactions, prevFrom, prevTo));
  return {
    current,
    change: {
      income: percentChange(current.income, previous.income),
      expense: percentChange(current.expense, previous.expense),
      balance: percentChange(current.balance, previous.balance),
    },
  };
}

export function startOfMonth(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function endOfDay(date = new Date()) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

export function startOfDay(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function sortByDateDesc(transactions) {
  return [...transactions].sort((a, b) => new Date(b.date) - new Date(a.date));
}
