const express = require("express");
const pool = require("../db");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();
router.use(requireAuth);

const ACCOUNT_TYPES = ["cash", "card", "savings"];
const CURRENCIES = ["RUB", "USD", "EUR"];

const mapRow = (row) => ({
  id: row.id,
  name: row.name,
  type: row.type,
  currency: row.currency,
  initialBalance: Number(row.initial_balance),
  balance: row.balance !== undefined ? Number(row.balance) : undefined,
  createdAt: row.created_at,
});

// Получить все счета текущего пользователя вместе с вычисленным балансом
router.get("/", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT a.*,
              a.initial_balance
                + COALESCE(SUM(CASE
                    WHEN t.type = 'Доход' THEN t.summ
                    WHEN t.type = 'Расход' THEN -t.summ
                    ELSE 0
                  END), 0) AS balance
       FROM accounts a
       LEFT JOIN transactions t ON t.account_id = a.id
       WHERE a.user_id = $1
       GROUP BY a.id
       ORDER BY a.created_at`,
      [req.userId]
    );
    res.json(result.rows.map(mapRow));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Ошибка получения счетов" });
  }
});

// Создать счёт
router.post("/", async (req, res) => {
  const { name, type, currency, initialBalance } = req.body;
  if (!name) {
    return res.status(400).json({ error: "Название счёта обязательно" });
  }
  if (type && !ACCOUNT_TYPES.includes(type)) {
    return res.status(400).json({ error: "Некорректный тип счёта" });
  }
  if (currency && !CURRENCIES.includes(currency)) {
    return res.status(400).json({ error: "Некорректная валюта счёта" });
  }
  try {
    const result = await pool.query(
      `INSERT INTO accounts (user_id, name, type, currency, initial_balance)
       VALUES ($1, $2, $3, $4, $5) RETURNING *, initial_balance AS balance`,
      [
        req.userId,
        name,
        type || "card",
        currency || "RUB",
        initialBalance || 0,
      ]
    );
    res.status(201).json(mapRow(result.rows[0]));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Ошибка создания счёта" });
  }
});

// Обновить счёт
router.put("/:id", async (req, res) => {
  const { name, type, currency, initialBalance } = req.body;
  if (type && !ACCOUNT_TYPES.includes(type)) {
    return res.status(400).json({ error: "Некорректный тип счёта" });
  }
  if (currency && !CURRENCIES.includes(currency)) {
    return res.status(400).json({ error: "Некорректная валюта счёта" });
  }
  try {
    const result = await pool.query(
      `UPDATE accounts
       SET name = COALESCE($1, name),
           type = COALESCE($2, type),
           currency = COALESCE($3, currency),
           initial_balance = COALESCE($4, initial_balance)
       WHERE id = $5 AND user_id = $6
       RETURNING *, initial_balance AS balance`,
      [name, type, currency, initialBalance, req.params.id, req.userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Счёт не найден" });
    }
    res.json(mapRow(result.rows[0]));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Ошибка обновления счёта" });
  }
});

// Удалить счёт. Если у счёта есть транзакции, нужно передать reassignTo —
// id другого счёта, на который они будут перенесены перед удалением.
router.delete("/:id", async (req, res) => {
  const { reassignTo } = req.body;
  const client = await pool.connect();
  try {
    const owned = await client.query(
      "SELECT id FROM accounts WHERE user_id = $1",
      [req.userId]
    );
    if (owned.rows.length <= 1) {
      return res
        .status(400)
        .json({ error: "Нельзя удалить единственный счёт" });
    }
    if (!owned.rows.some((r) => r.id === req.params.id)) {
      return res.status(404).json({ error: "Счёт не найден" });
    }

    const { rows: txRows } = await client.query(
      "SELECT id FROM transactions WHERE account_id = $1 LIMIT 1",
      [req.params.id]
    );
    if (txRows.length > 0) {
      if (!reassignTo) {
        return res.status(409).json({
          error:
            "У счёта есть транзакции — укажите другой счёт (reassignTo) для их переноса",
        });
      }
      if (!owned.rows.some((r) => r.id === reassignTo)) {
        return res.status(400).json({ error: "Счёт для переноса не найден" });
      }

      await client.query("BEGIN");
      await client.query(
        "UPDATE transactions SET account_id = $1 WHERE account_id = $2 AND user_id = $3",
        [reassignTo, req.params.id, req.userId]
      );
      await client.query(
        "DELETE FROM accounts WHERE id = $1 AND user_id = $2",
        [req.params.id, req.userId]
      );
      await client.query("COMMIT");
    } else {
      await client.query(
        "DELETE FROM accounts WHERE id = $1 AND user_id = $2",
        [req.params.id, req.userId]
      );
    }

    res.json({ deleted: true });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error(err);
    res.status(500).json({ error: "Ошибка удаления счёта" });
  } finally {
    client.release();
  }
});

module.exports = router;
module.exports.ACCOUNT_TYPES = ACCOUNT_TYPES;
module.exports.CURRENCIES = CURRENCIES;
