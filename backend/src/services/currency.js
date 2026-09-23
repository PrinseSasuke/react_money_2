// Валюта операций исторически хранится по-разному: форма отправляла
// "Рубль"/"usd", импорт из Excel — "rub", регулярные платежи — "RUB".
// Приводим всё к ISO-коду, чтобы пересчитывать по курсам ЦБ.
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

function normalizeCurrency(value) {
  if (!value) return "RUB";
  const key = String(value).trim().toLowerCase();
  return ALIASES[key] || String(value).trim().toUpperCase();
}

// rates: { RUB: 1, USD: <руб. за 1 $>, EUR: ... } из getLatestRates().
// Если курса одной из валют нет (ЦБ ещё ни разу не ответил) — сумму не
// пересчитываем, чтобы не обнулять её.
function convert(amount, from, to, rates) {
  const fromCode = normalizeCurrency(from);
  const toCode = normalizeCurrency(to);
  if (fromCode === toCode) return amount;
  const fromRate = rates[fromCode];
  const toRate = rates[toCode];
  if (!fromRate || !toRate) return amount;
  return (amount * fromRate) / toRate;
}

const toRub = (amount, currency, rates) => convert(amount, currency, "RUB", rates);

const round2 = (n) => Math.round(n * 100) / 100;

module.exports = { normalizeCurrency, convert, toRub, round2 };
