// Те же правила, что и на бэкенде (backend/src/services/currency.js):
// "Рубль"/"rub"/"₽" -> RUB, "usd"/"доллар"/"$" -> USD, "eur"/"евро"/"€" -> EUR.
const ALIASES = {
  rub: "RUB",
  rur: "RUB",
  руб: "RUB",
  рубль: "RUB",
  "₽": "RUB",
  usd: "USD",
  доллар: "USD",
  $: "USD",
  eur: "EUR",
  евро: "EUR",
  "€": "EUR",
};

export const DEFAULT_RATES = { RUB: 1 };

export function normalizeCurrency(value) {
  if (!value) return "RUB";
  const key = String(value).trim().toLowerCase();
  return ALIASES[key] || String(value).trim().toUpperCase();
}

// Сумма в рублях по последнему курсу ЦБ. Пока курсы не загружены (или ЦБ
// не отвечал) — оставляем сумму как есть, а не обнуляем её.
export function toRub(amount, currency, rates = DEFAULT_RATES) {
  const value = Number(amount) || 0;
  const code = normalizeCurrency(currency);
  if (code === "RUB") return value;
  const rate = rates[code];
  return rate ? value * rate : value;
}

export function hasRate(currency, rates = DEFAULT_RATES) {
  const code = normalizeCurrency(currency);
  return code === "RUB" || Boolean(rates[code]);
}

export const amountRub = (transaction, rates) => toRub(transaction.summ, transaction.currency, rates);
