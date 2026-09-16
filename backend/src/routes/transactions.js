const express = require("express");
const pool = require("../db");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();
router.use(requireAuth);

const mapRow = (row) => ({
  id: row.id,
  type: row.type,
  source: row.source,
  description: row.description,
  summ: Number(row.summ),
  currency: row.currency,
  date: row.date,
  user_id: row.user_id,
  account_id: row.account_id,
});

// Проверяет, что счёт с данным id принадлежит текущему пользователю
async function assertOwnsAccount(client, accountId, userId) {
  const { rows } = await client.query(
    "SELECT id FROM accounts WHERE id = $1 AND user_id = $2",
    [accountId, userId]
  );
  return rows.length > 0;
}

// Получить все транзакции текущего пользователя
router.get("/", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM transactions WHERE user_id = $1 ORDER BY date DESC",
      [req.userId]
    );
    res.json(result.rows.map(mapRow));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Ошибка получения транзакций" });
  }
});

// Получить одну транзакцию по id
router.get("/:id", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM transactions WHERE id = $1 AND user_id = $2",
      [req.params.id, req.userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Транзакция не найдена" });
    }
    res.json(mapRow(result.rows[0]));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Ошибка получения транзакции" });
  }
});

// Создать транзакцию
router.post("/", async (req, res) => {
  const { type, source, description, summ, currency, date, account_id } =
    req.body;
  if (!type || !summ) {
    return res.status(400).json({ error: "type и summ обязательны" });
  }
  if (!account_id) {
    return res.status(400).json({ error: "account_id обязателен" });
  }
  try {
    if (!(await assertOwnsAccount(pool, account_id, req.userId))) {
      return res.status(400).json({ error: "Счёт не найден" });
    }
    const result = await pool.query(
      `INSERT INTO transactions (user_id, type, source, description, summ, currency, date, account_id)
       VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7, now()), $8) RETURNING *`,
      [
        req.userId,
        type,
        source || "Остальное",
        description || "",
        summ,
        currency || "Рубль",
        date || null,
        account_id,
      ]
    );
    res.status(201).json(mapRow(result.rows[0]));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Ошибка создания транзакции" });
  }
});

// Массовое создание (для импорта из Excel)
router.post("/bulk", async (req, res) => {
  const { transactions } = req.body;
  if (!Array.isArray(transactions) || transactions.length === 0) {
    return res.status(400).json({ error: "transactions должен быть непустым массивом" });
  }
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Для строк без account_id (например, импорт из Excel) используем
    // самый старый счёт пользователя по умолчанию.
    const {
      rows: [defaultAccount],
    } = await client.query(
      "SELECT id FROM accounts WHERE user_id = $1 ORDER BY created_at LIMIT 1",
      [req.userId]
    );

    const inserted = [];
    for (const tr of transactions) {
      const accountId = tr.account_id || defaultAccount?.id || null;
      const result = await client.query(
        `INSERT INTO transactions (user_id, type, source, description, summ, currency, date, account_id)
         VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7, now()), $8) RETURNING *`,
        [
          req.userId,
          tr.type,
          tr.source || "Остальное",
          tr.description || "",
          tr.summ,
          tr.currency || "Рубль",
          tr.date || null,
          accountId,
        ]
      );
      inserted.push(mapRow(result.rows[0]));
    }
    await client.query("COMMIT");
    res.status(201).json(inserted);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ error: "Ошибка массового импорта" });
  } finally {
    client.release();
  }
});

// Обновить транзакцию
router.put("/:id", async (req, res) => {
  const { type, source, description, summ, currency, date, account_id } =
    req.body;
  if (account_id && !(await assertOwnsAccount(pool, account_id, req.userId))) {
    return res.status(400).json({ error: "Счёт не найден" });
  }
  try {
    const result = await pool.query(
      `UPDATE transactions
       SET type = COALESCE($1, type),
           source = COALESCE($2, source),
           description = COALESCE($3, description),
           summ = COALESCE($4, summ),
           currency = COALESCE($5, currency),
           date = COALESCE($6, date),
           account_id = COALESCE($9, account_id)
       WHERE id = $7 AND user_id = $8
       RETURNING *`,
      [
        type,
        source,
        description,
        summ,
        currency,
        date,
        req.params.id,
        req.userId,
        account_id,
      ]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Транзакция не найдена" });
    }
    res.json(mapRow(result.rows[0]));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Ошибка обновления транзакции" });
  }
});

// Удалить транзакцию
router.delete("/:id", async (req, res) => {
  try {
    const result = await pool.query(
      "DELETE FROM transactions WHERE id = $1 AND user_id = $2 RETURNING id",
      [req.params.id, req.userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Транзакция не найдена" });
    }
    res.json({ deleted: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Ошибка удаления транзакции" });
  }
});

module.exports = router;
