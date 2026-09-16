const express = require("express");
const pool = require("../db");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();
router.use(requireAuth);

const FREQUENCIES = ["daily", "weekly", "monthly"];

const mapRow = (row) => ({
  id: row.id,
  account_id: row.account_id,
  type: row.type,
  source: row.source,
  description: row.description,
  summ: Number(row.summ),
  currency: row.currency,
  frequency: row.frequency,
  next_run_date: row.next_run_date,
  active: row.active,
  created_at: row.created_at,
});

router.get("/", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM recurring_transactions WHERE user_id = $1 ORDER BY created_at DESC",
      [req.userId]
    );
    res.json(result.rows.map(mapRow));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Ошибка получения регулярных платежей" });
  }
});

router.post("/", async (req, res) => {
  const {
    account_id,
    type,
    source,
    description,
    summ,
    currency,
    frequency,
    next_run_date,
  } = req.body;

  if (!type || !summ || !frequency || !next_run_date) {
    return res.status(400).json({
      error: "type, summ, frequency и next_run_date обязательны",
    });
  }
  if (!FREQUENCIES.includes(frequency)) {
    return res.status(400).json({ error: "Некорректная периодичность" });
  }
  if (account_id) {
    const owns = await pool.query(
      "SELECT id FROM accounts WHERE id = $1 AND user_id = $2",
      [account_id, req.userId]
    );
    if (owns.rows.length === 0) {
      return res.status(400).json({ error: "Счёт не найден" });
    }
  }

  try {
    const result = await pool.query(
      `INSERT INTO recurring_transactions
        (user_id, account_id, type, source, description, summ, currency, frequency, next_run_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        req.userId,
        account_id || null,
        type,
        source || "Остальное",
        description || "",
        summ,
        currency || "RUB",
        frequency,
        next_run_date,
      ]
    );
    res.status(201).json(mapRow(result.rows[0]));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Ошибка создания регулярного платежа" });
  }
});

router.put("/:id", async (req, res) => {
  const {
    account_id,
    type,
    source,
    description,
    summ,
    currency,
    frequency,
    next_run_date,
    active,
  } = req.body;

  if (frequency && !FREQUENCIES.includes(frequency)) {
    return res.status(400).json({ error: "Некорректная периодичность" });
  }

  try {
    const result = await pool.query(
      `UPDATE recurring_transactions
       SET account_id = COALESCE($1, account_id),
           type = COALESCE($2, type),
           source = COALESCE($3, source),
           description = COALESCE($4, description),
           summ = COALESCE($5, summ),
           currency = COALESCE($6, currency),
           frequency = COALESCE($7, frequency),
           next_run_date = COALESCE($8, next_run_date),
           active = COALESCE($9, active)
       WHERE id = $10 AND user_id = $11
       RETURNING *`,
      [
        account_id,
        type,
        source,
        description,
        summ,
        currency,
        frequency,
        next_run_date,
        active,
        req.params.id,
        req.userId,
      ]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Регулярный платёж не найден" });
    }
    res.json(mapRow(result.rows[0]));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Ошибка обновления регулярного платежа" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const result = await pool.query(
      "DELETE FROM recurring_transactions WHERE id = $1 AND user_id = $2 RETURNING id",
      [req.params.id, req.userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Регулярный платёж не найден" });
    }
    res.json({ deleted: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Ошибка удаления регулярного платежа" });
  }
});

module.exports = router;
