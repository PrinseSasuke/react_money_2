// What the user reads: Russian, no codes (ТЗ, «Сообщения об ошибках»).
import type { ReceiptStatus } from "./receipts.ts";

/** status of a receipt in the history; "queued" = still on the phone, not sent yet */
export const STATUS_LABEL: Record<ReceiptStatus | "queued", string> = {
  queued: "Ждёт отправки",
  accepted: "Принят",
  processing: "Обрабатывается",
  parsed: "Трата добавлена",
  duplicate: "Этот чек уже добавлен",
  error: "Ошибка",
};

const ERROR_TEXT: Record<string, string> = {
  // receipts-api
  invalid_qr: "QR не похож на чек",
  bad_request: "Не получилось отправить чек",
  unauthorized: "Нужно войти заново",
  file_too_large: "Фото слишком большое",
  unsupported_media_type: "Этот формат фото не подходит",
  storage_unavailable: "Сервис недоступен, чек отправится позже",
  queue_unavailable: "Сервис недоступен, чек отправится позже",
  database_unavailable: "Сервис недоступен, чек отправится позже",
  // receipts-worker
  ocr_not_implemented: "QR на фото не найден, а распознавать текст чека пока не умеем",
  no_account: "В react-money нет ни одного счёта — создайте счёт на сайте",
  core_api_rejected: "react-money не принял трату",
  max_attempts: "Не получилось добавить трату, попробуйте ещё раз позже",
  // the phone itself
  network: "Нет связи, чек отправится позже",
};

export function errorText(code: string | null | undefined): string {
  return (code && ERROR_TEXT[code]) || "Что-то пошло не так";
}

/** Errors after which the phone should try again by itself, keeping the receipt in its queue. */
export const RETRYABLE = new Set(["network", "storage_unavailable", "queue_unavailable", "database_unavailable"]);
