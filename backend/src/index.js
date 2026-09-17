const app = require("./app");
const cron = require("node-cron");
const { fetchAndStoreRates } = require("./services/exchangeRates");
const { runDueRecurring } = require("./services/recurringRunner");
require("./services/telegramBot"); // запускает long polling, если задан TELEGRAM_BOT_TOKEN

const PORT = process.env.PORT || 4000;

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
