// Валюта в транзакциях исторически хранится по-разному ("Рубль", "rub", "RUB"),
// поэтому символ определяем по нормализованному ключу.
const CURRENCY_SYMBOLS = {
  rub: "₽",
  рубль: "₽",
  usd: "$",
  доллар: "$",
  eur: "€",
  евро: "€",
};

export function currencySymbol(currency) {
  if (!currency) return "₽";
  return CURRENCY_SYMBOLS[String(currency).toLowerCase()] || currency;
}

const moneyFormatter = new Intl.NumberFormat("ru-RU", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const compactFormatter = new Intl.NumberFormat("ru-RU", {
  maximumFractionDigits: 0,
});

export function formatMoney(value, currency) {
  const amount = moneyFormatter.format(Number(value) || 0);
  return currency === undefined ? amount : `${amount} ${currencySymbol(currency)}`;
}

export function formatNumber(value) {
  return compactFormatter.format(Number(value) || 0);
}

// Для очень узких мест (ячейка календаря на телефоне): 120000 -> "120к", 8400 -> "8,4к".
export function formatCompact(value) {
  const n = Math.abs(Number(value) || 0);
  const trim = (x) => String(Number(x.toFixed(1))).replace(".", ",");
  if (n >= 1_000_000) return `${trim(n / 1_000_000)}м`;
  if (n >= 1_000) return `${trim(n / 1_000)}к`;
  return String(Math.round(n));
}

export function formatSignedMoney(value, type, currency) {
  const sign = type === "Расход" ? "−" : "+";
  return `${sign}${formatMoney(value, currency)}`;
}

export function formatPercent(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1).replace(".", ",")}%`;
}

const dateTimeFormatter = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const dateFormatter = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

export function formatDateTime(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : dateTimeFormatter.format(date);
}

export function formatDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : dateFormatter.format(date);
}

// Локальная дата в формате YYYY-MM-DD (ключ дня для календаря и фильтра по дню).
export function toDayKey(value) {
  const date = new Date(value);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function toMonthKey(value) {
  const date = new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

const monthShortFormatter = new Intl.DateTimeFormat("ru-RU", { month: "short" });

export function formatMonthKey(monthKey) {
  const [y, m] = monthKey.split("-").map(Number);
  const label = monthShortFormatter.format(new Date(y, m - 1, 1)).replace(".", "");
  return `${label} ${String(y).slice(2)}`;
}
