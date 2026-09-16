const xml2js = require("xml2js");
const pool = require("../db");

const SUPPORTED_CODES = ["USD", "EUR"];
const CBR_URL = "https://www.cbr.ru/scripts/XML_daily.asp";

// Забирает свежий XML-фид ЦБ РФ и кэширует курсы поддерживаемых валют на
// сегодняшнюю дату (по UTC — ЦБ обновляет фид раз в сутки, точность до дня
// достаточна).
async function fetchAndStoreRates() {
  const response = await fetch(CBR_URL);
  if (!response.ok) {
    throw new Error(`Не удалось получить курс ЦБ: HTTP ${response.status}`);
  }
  const xml = await response.text();
  const parsed = await xml2js.parseStringPromise(xml);
  const valutes = parsed.ValCurs.Valute || [];
  const today = new Date().toISOString().slice(0, 10);

  for (const valute of valutes) {
    const charCode = valute.CharCode?.[0];
    if (!SUPPORTED_CODES.includes(charCode)) continue;

    const nominal = parseFloat(valute.Nominal[0]);
    // ЦБ отдаёт значение с запятой как десятичным разделителем ("93,4432")
    const value = parseFloat(valute.Value[0].replace(",", "."));
    const rate = value / nominal;

    await pool.query(
      `INSERT INTO exchange_rates (currency_code, rate_to_rub, fetched_at)
       VALUES ($1, $2, $3)
       ON CONFLICT (currency_code, fetched_at) DO UPDATE SET rate_to_rub = $2`,
      [charCode, rate, today]
    );
  }

  console.log(`Курсы валют обновлены (${today})`);
}

// Последний закэшированный курс каждой поддерживаемой валюты + RUB=1
async function getLatestRates() {
  const { rows } = await pool.query(`
    SELECT DISTINCT ON (currency_code) currency_code, rate_to_rub
    FROM exchange_rates
    ORDER BY currency_code, fetched_at DESC
  `);

  const rates = { RUB: 1 };
  for (const row of rows) {
    rates[row.currency_code] = Number(row.rate_to_rub);
  }
  return rates;
}

module.exports = { fetchAndStoreRates, getLatestRates, SUPPORTED_CODES };
