import { percentChange, periodComparison, totals } from "./stats";
import { currencySymbol, formatPercent } from "./format";

const tx = (date, type, summ) => ({ date, type, summ });

test("totals splits income and expense", () => {
  expect(totals([tx("2026-09-01", "Доход", 100), tx("2026-09-02", "Расход", 30)])).toEqual({
    income: 100,
    expense: 30,
    balance: 70,
  });
});

test("totals convert dollar operations to rubles instead of adding them as-is", () => {
  const list = [
    { date: "2026-09-01", type: "Доход", summ: 1000, currency: "Рубль" },
    { date: "2026-09-02", type: "Расход", summ: 10, currency: "usd" },
  ];
  expect(totals(list, { RUB: 1, USD: 90 })).toEqual({ income: 1000, expense: 900, balance: 100 });
});

test("percentChange handles zero previous value without dividing by zero", () => {
  expect(percentChange(0, 0)).toBe(0);
  expect(percentChange(50, 0)).toBe(100);
  expect(percentChange(150, 100)).toBe(50);
  expect(percentChange(-50, 100)).toBe(-150);
});

test("periodComparison compares with the previous period of equal length", () => {
  const list = [
    tx("2026-09-10T12:00:00", "Доход", 200),
    tx("2026-09-03T12:00:00", "Доход", 100),
  ];
  const { current, change } = periodComparison(
    list,
    new Date("2026-09-08T00:00:00"),
    new Date("2026-09-14T23:59:59")
  );
  expect(current.income).toBe(200);
  expect(change.income).toBe(100);
});

test("formatting helpers", () => {
  expect(formatPercent(12.345)).toBe("+12,3%");
  expect(formatPercent(null)).toBe("—");
  expect(currencySymbol("Рубль")).toBe("₽");
  expect(currencySymbol("usd")).toBe("$");
});
