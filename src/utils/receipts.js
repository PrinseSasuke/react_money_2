// Статусы и ошибки чеков по-русски, без кодов. Те же тексты, что в мобильном приложении
// (packages/shared/src/messages.ts): сайт собирается react-scripts и TS-пакет напрямую не подключает.
export const STATUS_LABEL = {
  accepted: "Принят",
  processing: "Обрабатывается",
  parsed: "Трата добавлена",
  duplicate: "Этот чек уже добавлен",
  error: "Ошибка",
};

const ERROR_TEXT = {
  invalid_qr: "QR не похож на чек",
  storage_unavailable: "Сервис был недоступен, фото не сохранилось",
  queue_unavailable: "Сервис был недоступен, чек не ушёл в обработку",
  database_unavailable: "Сервис был недоступен",
  ocr_not_implemented: "QR на фото не найден, а распознавать текст чека пока не умеем",
  no_account: "В react-money нет ни одного счёта — создайте счёт",
  core_api_rejected: "react-money не принял трату",
  max_attempts: "Не получилось добавить трату за несколько попыток",
};

export const receiptErrorText = (code) => (code && ERROR_TEXT[code]) || "Что-то пошло не так";

/** ошибки, которые повторная отправка может исправить (как в receipts-api, POST /receipts/:id/retry) */
export const RETRYABLE = new Set(["max_attempts", "core_api_rejected", "no_account", "queue_unavailable"]);

export const SOURCE_LABEL = { qr: "QR", photo: "Фото" };
