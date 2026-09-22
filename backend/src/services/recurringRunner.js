const pool = require("../db");

function computeNextRunDate(current, frequency) {
  const date = new Date(current);
  if (frequency === "daily") {
    date.setUTCDate(date.getUTCDate() + 1);
  } else if (frequency === "weekly") {
    date.setUTCDate(date.getUTCDate() + 7);
  } else if (frequency === "monthly") {
    date.setUTCMonth(date.getUTCMonth() + 1);
  }
  return date.toISOString().slice(0, 10);
}

// Находит все активные повторяющиеся платежи, чей next_run_date наступил,
// создаёт по ним реальную транзакцию (is_auto_generated = true) и сдвигает
// next_run_date на один период вперёд. Каждая запись обрабатывается в своей
// транзакции БД, чтобы ошибка на одной не срывала остальные.
async function runDueRecurring() {
  const { rows: due } = await pool.query(
    `SELECT * FROM recurring_transactions
     WHERE active = true AND next_run_date <= CURRENT_DATE`
  );

  let created = 0;
  for (const item of due) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        `INSERT INTO transactions
          (user_id, type, source, description, summ, currency, date, account_id, is_auto_generated)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true)`,
        [
          item.user_id,
          item.type,
          item.source,
          item.description,
          item.summ,
          item.currency,
          item.next_run_date,
          item.account_id,
        ]
      );
      const nextDate = computeNextRunDate(item.next_run_date, item.frequency);
      await client.query(
        `UPDATE recurring_transactions SET next_run_date = $1 WHERE id = $2`,
        [nextDate, item.id]
      );
      await client.query("COMMIT");
      created++;
    } catch (err) {
      await client.query("ROLLBACK");
      console.error("Ошибка создания повторяющейся транзакции:", err);
    } finally {
      client.release();
    }
  }

  if (created > 0) {
    console.log(`Создано ${created} повторяющихся транзакций`);
  }
  return created;
}

module.exports = { runDueRecurring, computeNextRunDate };
