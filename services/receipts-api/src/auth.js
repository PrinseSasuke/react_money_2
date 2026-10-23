const jwt = require("jsonwebtoken");

// The same JWT as core-api: signed with the shared JWT_SECRET, payload { userId }.
function requireAuth(jwtSecret) {
  return (req, res, next) => {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) return sendError(res, 401, "unauthorized", "нет токена");
    try {
      const payload = jwt.verify(token, jwtSecret);
      if (!payload.userId) throw new Error("no userId in token");
      req.userId = payload.userId;
      next();
    } catch {
      sendError(res, 401, "unauthorized", "невалидный или просроченный токен");
    }
  };
}

function sendError(res, status, code, message, extra) {
  res.status(status).json({ error: { code, message, ...extra } });
}

module.exports = { requireAuth, sendError };
