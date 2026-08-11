const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const pool = require("../db");
const { requireAuth, JWT_SECRET } = require("../middleware/auth");

const router = express.Router();

router.post("/register", async (req, res) => {
  const { email, password, displayName } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "Email и пароль обязательны" });
  }
  if (password.length < 6) {
    return res
      .status(400)
      .json({ error: "Пароль должен быть не короче 6 символов" });
  }

  try {
    const existing = await pool.query("SELECT id FROM users WHERE email = $1", [
      email.toLowerCase(),
    ]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: "Пользователь уже существует" });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      `INSERT INTO users (email, password_hash, display_name)
       VALUES ($1, $2, $3) RETURNING id, email, display_name`,
      [email.toLowerCase(), passwordHash, displayName || email.split("@")[0]]
    );
    const user = result.rows[0];

    await pool.query("INSERT INTO limits (user_id, amount) VALUES ($1, 50000)", [
      user.id,
    ]);

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, {
      expiresIn: "30d",
    });

    res.status(201).json({
      token,
      user: { id: user.id, email: user.email, displayName: user.display_name },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Ошибка регистрации" });
  }
});

router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "Email и пароль обязательны" });
  }

  try {
    const result = await pool.query("SELECT * FROM users WHERE email = $1", [
      email.toLowerCase(),
    ]);
    const user = result.rows[0];
    if (!user) {
      return res.status(401).json({ error: "Неверный email или пароль" });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: "Неверный email или пароль" });
    }

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, {
      expiresIn: "30d",
    });

    res.json({
      token,
      user: { id: user.id, email: user.email, displayName: user.display_name },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Ошибка входа" });
  }
});

router.get("/me", requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, email, display_name FROM users WHERE id = $1",
      [req.userId]
    );
    const user = result.rows[0];
    if (!user) return res.status(404).json({ error: "Пользователь не найден" });
    res.json({
      user: { id: user.id, email: user.email, displayName: user.display_name },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Ошибка получения профиля" });
  }
});

module.exports = router;
