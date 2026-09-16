require("dotenv").config();
const express = require("express");
const cors = require("cors");
const cron = require("node-cron");

const authRoutes = require("./routes/auth");
const transactionsRoutes = require("./routes/transactions");
const limitsRoutes = require("./routes/limits");
const accountsRoutes = require("./routes/accounts");
const exchangeRatesRoutes = require("./routes/exchangeRates");
const recurringRoutes = require("./routes/recurring");
const exportRoutes = require("./routes/export");
const telegramRoutes = require("./routes/telegram");
const { fetchAndStoreRates } = require("./services/exchangeRates");
const { runDueRecurring } = require("./services/recurringRunner");
require("./services/telegramBot"); // запускает long polling, если задан TELEGRAM_BOT_TOKEN

const app = express();
const PORT = process.env.PORT || 4000;

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

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Внутренняя ошибка сервера" });
});

app.listen(PORT, () => {
  console.log(`Backend запущен на порту ${PORT}`);
});

// Обновляем курс валют раз в сутки в 6:00 по серверному времени, плюс сразу
// при старте (с небольшой задержкой, чтобы сеть контейнера успела подняться),
// чтобы таблица не была пустой после первого деплоя.
setTimeout(() => {
  fetchAndStoreRates().catch((err) =>
    console.error("Не удалось получить курс валют при старте:", err.message)
  );
}, 5000);
cron.schedule("0 6 * * *", () => {
  fetchAndStoreRates().catch((err) =>
    console.error("Не удалось обновить курс валют:", err.message)
  );
});

// Генерируем due-транзакции по активным повторяющимся платежам раз в сутки.
cron.schedule("0 6 * * *", () => {
  runDueRecurring().catch((err) =>
    console.error("Ошибка запуска повторяющихся платежей:", err.message)
  );
});
