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
});

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
  const { type, source, description, summ, currency, date } = req.body;
  if (!type || !summ) {
    return res.status(400).json({ error: "type и summ обязательны" });
  }
  try {
    const result = await pool.query(
      `INSERT INTO transactions (user_id, type, source, description, summ, currency, date)
       VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7, now())) RETURNING *`,
      [
        req.userId,
        type,
        source || "Остальное",
        description || "",
        summ,
        currency || "Рубль",
        date || null,
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
    const inserted = [];
    for (const tr of transactions) {
      const result = await client.query(
        `INSERT INTO transactions (user_id, type, source, description, summ, currency, date)
         VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7, now())) RETURNING *`,
        [
          req.userId,
          tr.type,
          tr.source || "Остальное",
          tr.description || "",
          tr.summ,
          tr.currency || "Рубль",
          tr.date || null,
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
  const { type, source, description, summ, currency, date } = req.body;
  try {
    const result = await pool.query(
      `UPDATE transactions
       SET type = COALESCE($1, type),
           source = COALESCE($2, source),
           description = COALESCE($3, description),
           summ = COALESCE($4, summ),
           currency = COALESCE($5, currency),
           date = COALESCE($6, date)
       WHERE id = $7 AND user_id = $8
       RETURNING *`,
      [type, source, description, summ, currency, date, req.params.id, req.userId]
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
