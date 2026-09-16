const fs = require("fs");
const path = require("path");
const pool = require("./db");

// Гарантирует, что у каждого пользователя есть хотя бы один счёт: создаёт
// дефолтный счёт "Основной" тем, у кого нет ни одного, и переносит на него
// их транзакции без account_id. Идемпотентно — на уже промигрированной базе
// просто не находит таких пользователей и ничего не делает.
async function backfillDefaultAccounts() {
  const { rows: usersWithoutAccounts } = await pool.query(`
    SELECT u.id FROM users u
    WHERE NOT EXISTS (SELECT 1 FROM accounts a WHERE a.user_id = u.id)
  `);

  for (const user of usersWithoutAccounts) {
    const {
      rows: [account],
    } = await pool.query(
      `INSERT INTO accounts (user_id, name, type, currency, initial_balance)
       VALUES ($1, 'Основной', 'card', 'RUB', 0) RETURNING id`,
      [user.id]
    );
    await pool.query(
      `UPDATE transactions SET account_id = $1 WHERE user_id = $2 AND account_id IS NULL`,
      [account.id, user.id]
    );
  }

  if (usersWithoutAccounts.length > 0) {
    console.log(
      `Созданы дефолтные счета для ${usersWithoutAccounts.length} пользователей`
    );
  }
}

async function migrate() {
  const sql = fs.readFileSync(
    path.join(__dirname, "..", "migrations", "init.sql"),
    "utf8"
  );
  await pool.query(sql);
  await backfillDefaultAccounts();
  console.log("Миграции применены успешно");
  await pool.end();
}

migrate().catch((err) => {
  console.error("Ошибка миграции:", err);
  process.exit(1);
});
