const pool = require("../db");
const { getLatestRates } = require("./exchangeRates");
const { toRub } = require("./currency");

// Проверяет лимит расходов пользователя за текущий месяц; если он превышен
// и уведомление за этот месяц ещё не отправлялось — вызывает sendMessage
// (chatId, text) и помечает месяц как уведомлённый, чтобы не дублировать
// оповещение при каждой следующей транзакции. Ничего не делает, если у
// пользователя не привязан Telegram.
async function checkAndNotifyLimit(userId, sendMessage) {
  const {
    rows: [user],
  } = await pool.query(
    "SELECT telegram_chat_id, last_limit_notified_month FROM users WHERE id = $1",
    [userId]
  );
  if (!user || !user.telegram_chat_id) return;

  const {
    rows: [limitRow],
  } = await pool.query("SELECT amount FROM limits WHERE user_id = $1", [
    userId,
  ]);
  const limit = limitRow ? Number(limitRow.amount) : 50000;

  const currentMonth = new Date().toISOString().slice(0, 7); // "2026-09"
  // Лимит задан в рублях — расходы в других валютах пересчитываем по курсу ЦБ.
  const [{ rows: sums }, rates] = await Promise.all([
    pool.query(
      `SELECT currency, SUM(summ) AS total FROM transactions
       WHERE user_id = $1 AND type = 'Расход' AND to_char(date, 'YYYY-MM') = $2
       GROUP BY currency`,
      [userId, currentMonth]
    ),
    getLatestRates(),
  ]);
  const spent = sums.reduce((acc, row) => acc + toRub(Number(row.total), row.currency, rates), 0);

  if (spent > limit && user.last_limit_notified_month !== currentMonth) {
    await sendMessage(
      user.telegram_chat_id,
      `⚠ Превышен лимит расходов за месяц: потрачено ${spent.toFixed(
        2
      )} из ${limit.toFixed(2)} ₽`
    );
    await pool.query(
      "UPDATE users SET last_limit_notified_month = $1 WHERE id = $2",
      [currentMonth, userId]
    );
  }
}

module.exports = { checkAndNotifyLimit };
