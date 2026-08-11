const express = require("express");
const pool = require("../db");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();
router.use(requireAuth);

router.get("/", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT amount FROM limits WHERE user_id = $1",
      [req.userId]
    );
    if (result.rows.length === 0) {
      return res.json({ amount: 50000 });
    }
    res.json({ amount: Number(result.rows[0].amount) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Ошибка получения лимита" });
  }
});

router.put("/", async (req, res) => {
  const { amount } = req.body;
  if (typeof amount !== "number" || amount < 0) {
    return res.status(400).json({ error: "amount должен быть положительным числом" });
  }
  try {
    const result = await pool.query(
      `INSERT INTO limits (user_id, amount, updated_at)
       VALUES ($1, $2, now())
       ON CONFLICT (user_id) DO UPDATE SET amount = $2, updated_at = now()
       RETURNING amount`,
      [req.userId, amount]
    );
    res.json({ amount: Number(result.rows[0].amount) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Ошибка обновления лимита" });
  }
});

module.exports = router;
