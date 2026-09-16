const pool = require("../db");
const { checkAndNotifyLimit } = require("./limitAlert");

const token = process.env.TELEGRAM_BOT_TOKEN;
let bot = null;

function sendLimitAlert(chatId, text) {
  if (!bot) return Promise.resolve();
  return bot.sendMessage(chatId, text);
}

// Ищет число (сумму) в любом месте сообщения; остаток строки без этого
// числа — описание/категория. Формат нестрогий: "500 такси" и
// "такси 500" оба работают.
function parseAmountAndDescription(text) {
  const match = text.match(/\d+(?:[.,]\d+)?/);
  if (!match) return null;
  const amount = parseFloat(match[0].replace(",", "."));
  if (!amount || amount <= 0) return null;
  const description = text.replace(match[0], "").trim();
  return { amount, description: description || "Остальное" };
}

if (!token) {
  console.log("TELEGRAM_BOT_TOKEN не задан — Telegram-бот отключён");
} else {
  // Ленивая загрузка библиотеки: если TELEGRAM_BOT_TOKEN не задан, модуль
  // node-telegram-bot-api вообще не подключается.
  const TelegramBot = require("node-telegram-bot-api");
  bot = new TelegramBot(token, { polling: true });

  bot.onText(/\/link (.+)/, async (msg, match) => {
    const code = match[1].trim();
    const chatId = msg.chat.id;
    try {
      const { rows } = await pool.query(
        "SELECT id FROM users WHERE telegram_link_code = $1",
        [code]
      );
      if (rows.length === 0) {
        return bot.sendMessage(
          chatId,
          "Код не найден. Получите новый код в настройках профиля на сайте."
        );
      }
      const alreadyLinked = await pool.query(
        "SELECT id FROM users WHERE telegram_chat_id = $1",
        [chatId]
      );
      if (alreadyLinked.rows.length > 0) {
        return bot.sendMessage(
          chatId,
          "Этот Telegram-аккаунт уже привязан к другому пользователю."
        );
      }
      await pool.query(
        "UPDATE users SET telegram_chat_id = $1, telegram_link_code = NULL WHERE id = $2",
        [chatId, rows[0].id]
      );
      bot.sendMessage(
        chatId,
        "Аккаунт привязан! Теперь можно писать траты сюда, например: 500 такси"
      );
    } catch (err) {
      console.error("Ошибка привязки Telegram:", err);
      bot.sendMessage(chatId, "Что-то пошло не так, попробуйте позже.");
    }
  });

  bot.on("message", async (msg) => {
    const text = msg.text || "";
    if (text.startsWith("/")) return; // команды обрабатываются выше
    const chatId = msg.chat.id;

    try {
      const { rows } = await pool.query(
        "SELECT id FROM users WHERE telegram_chat_id = $1",
        [chatId]
      );
      if (rows.length === 0) {
        return bot.sendMessage(
          chatId,
          "Аккаунт не привязан. Получите код в настройках профиля на сайте и напишите /link КОД"
        );
      }
      const userId = rows[0].id;

      const parsed = parseAmountAndDescription(text);
      if (!parsed) {
        return bot.sendMessage(
          chatId,
          "Не понял сумму, напишите, например: 500 такси или продукты 1200"
        );
      }

      const {
        rows: [account],
      } = await pool.query(
        "SELECT id FROM accounts WHERE user_id = $1 ORDER BY created_at LIMIT 1",
        [userId]
      );

      await pool.query(
        `INSERT INTO transactions (user_id, type, source, description, summ, currency, account_id)
         VALUES ($1, 'Расход', 'Остальное', $2, $3, 'Рубль', $4)`,
        [userId, parsed.description, parsed.amount, account?.id || null]
      );

      await bot.sendMessage(
        chatId,
        `Записал: ${parsed.amount}₽ — ${parsed.description}`
      );
      await checkAndNotifyLimit(userId, sendLimitAlert);
    } catch (err) {
      console.error("Ошибка обработки сообщения Telegram-бота:", err);
      bot.sendMessage(chatId, "Не удалось записать операцию, попробуйте ещё раз.");
    }
  });

  console.log("Telegram-бот запущен (long polling)");
}

module.exports = { sendLimitAlert };
