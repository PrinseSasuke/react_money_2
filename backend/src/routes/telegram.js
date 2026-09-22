const express = require("express");
const crypto = require("crypto");
const pool = require("../db");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();
router.use(requireAuth);

router.get("/status", async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT telegram_chat_id IS NOT NULL AS linked FROM users WHERE id = $1",
      [req.userId]
    );
    res.json({ linked: rows[0]?.linked || false });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Ошибка проверки статуса Telegram" });
  }
});

router.post("/link-code", async (req, res) => {
  try {
    const code = crypto.randomBytes(4).toString("hex");
    await pool.query("UPDATE users SET telegram_link_code = $1 WHERE id = $2", [
      code,
      req.userId,
    ]);
    res.json({ code });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Ошибка генерации кода привязки" });
  }
});

module.exports = router;
