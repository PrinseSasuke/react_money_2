const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "change_me_in_env";

function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: "Не авторизован" });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.userId = payload.userId;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Невалидный или истёкший токен" });
  }
}

module.exports = { requireAuth, JWT_SECRET };
