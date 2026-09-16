require("dotenv").config();
const express = require("express");
const cors = require("cors");

const authRoutes = require("./routes/auth");
const transactionsRoutes = require("./routes/transactions");
const limitsRoutes = require("./routes/limits");
const accountsRoutes = require("./routes/accounts");
const exchangeRatesRoutes = require("./routes/exchangeRates");
const recurringRoutes = require("./routes/recurring");
const exportRoutes = require("./routes/export");
const telegramRoutes = require("./routes/telegram");
const attachmentsRoutes = require("./routes/attachments");

const app = express();

app.use(cors());
app.use(express.json());

app.get("/api/health", (req, res) => res.json({ status: "ok" }));

app.use("/api/auth", authRoutes);
app.use("/api/transactions", transactionsRoutes);
app.use("/api/limits", limitsRoutes);
app.use("/api/accounts", accountsRoutes);
app.use("/api/exchange-rates", exchangeRatesRoutes);
app.use("/api/recurring", recurringRoutes);
app.use("/api/export", exportRoutes);
app.use("/api/telegram", telegramRoutes);
app.use("/api/attachments", attachmentsRoutes);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Внутренняя ошибка сервера" });
});

module.exports = app;
