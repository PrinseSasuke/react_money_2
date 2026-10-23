const crypto = require("crypto");
const express = require("express");
const multer = require("multer");
const { validateQr } = require("../qr");
const { sendError } = require("../auth");

const IMAGE_TYPES = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const MAX_CATEGORY = 64;
// errors a new attempt can fix; invalid_qr or ocr_not_implemented would fail again the same way,
// storage_unavailable has no photo stored to retry with
const RETRYABLE = ["max_attempts", "core_api_rejected", "no_account", "queue_unavailable"];
const PING_MS = 25000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// POST /api/receipts accepts and queues; it never parses (ТЗ, section 3).
function receiptsRouter({ db, storage, queue, metrics, logger, maxUploadMb }) {
  const router = express.Router();
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: maxUploadMb * 1024 * 1024, files: 1 } });

  router.post("/", (req, res, next) => {
    upload.single("image")(req, res, (err) => {
      if (!err) return next();
      if (err.code === "LIMIT_FILE_SIZE") return sendError(res, 413, "file_too_large", `файл больше ${maxUploadMb} МБ`);
      return sendError(res, 400, "bad_request", err.message);
    });
  }, async (req, res) => {
    const qrRaw = req.body && typeof req.body.qr === "string" ? req.body.qr : null;
    const file = req.file || null;
    const accountId = req.body && req.body.accountId ? String(req.body.accountId) : null;
    const category = req.body && req.body.category ? String(req.body.category).trim() : null;

    if (!qrRaw && !file) return sendError(res, 400, "bad_request", "нужно фото (поле image) или строка QR (поле qr)");
    if (qrRaw && file) return sendError(res, 400, "bad_request", "передайте что-то одно: фото или строку QR");
    if (accountId && !UUID.test(accountId)) return sendError(res, 400, "bad_request", "accountId должен быть UUID");
    if (category && category.length > MAX_CATEGORY) return sendError(res, 400, "bad_request", `category длиннее ${MAX_CATEGORY} символов`);

    let qr = null;
    if (qrRaw) {
      const check = validateQr(qrRaw);
      if (!check.ok) return sendError(res, 400, "invalid_qr", check.message);
      qr = check.value;
    }
    if (file && !IMAGE_TYPES[file.mimetype]) {
      return sendError(res, 415, "unsupported_media_type", "поддерживаются JPEG, PNG и WebP");
    }

    const receipt = {
      id: crypto.randomUUID(),
      userId: req.userId,
      accountId,
      category: category || null,
      source: qr ? "qr" : "photo",
      qrRaw: qr,
      imageKey: null,
      status: "accepted",
    };
    if (file) receipt.imageKey = `${req.userId}/${receipt.id}.${IMAGE_TYPES[file.mimetype]}`; // {userId}/{receiptId}.{ext}
    const log = logger.child({ receiptId: receipt.id, userId: req.userId });

    try {
      // 1. photo to storage; a QR receipt does not depend on it
      if (file) {
        try {
          await storage.put(receipt.imageKey, file.buffer, file.mimetype);
        } catch (err) {
          log.warn({ err: err.message }, "storage unavailable");
          await db.insertReceipt({ ...receipt, status: "error", errorCode: "storage_unavailable", errorMessage: err.message })
            .catch((e) => log.error({ err: e.message }, "could not record the failed receipt"));
          return sendError(res, 503, "storage_unavailable", "хранилище фото недоступно, попробуйте позже", { id: receipt.id });
        }
      }

      // 2. the receipt row, 3. the task; the task goes last so the worker always finds the row
      await db.insertReceipt(receipt);
      try {
        await queue.publish({ receiptId: receipt.id, userId: receipt.userId, source: receipt.source, enqueuedAt: new Date().toISOString() });
      } catch (err) {
        log.warn({ err: err.message }, "queue unavailable");
        await db.markError(receipt.id, "queue_unavailable", err.message)
          .catch((e) => log.error({ err: e.message }, "could not mark the receipt"));
        return sendError(res, 503, "queue_unavailable", "очередь недоступна, попробуйте позже", { id: receipt.id });
      }
    } catch (err) {
      log.error({ err: err.message }, "database unavailable");
      return sendError(res, 503, "database_unavailable", "база данных недоступна, попробуйте позже");
    }

    queue.publishEvent(receipt.userId, { receiptId: receipt.id, status: "accepted" });
    metrics.received.inc({ source: receipt.source });
    log.info({ source: receipt.source }, "receipt accepted");
    res.status(202).json({ id: receipt.id, status: "accepted" });
  });

  router.get("/", async (req, res) => {
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);
    const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);
    try {
      const rows = await db.listReceipts(req.userId, limit, offset);
      res.json({ items: rows.map(toDto), limit, offset });
    } catch (err) {
      logger.error({ err: err.message, userId: req.userId }, "list failed");
      sendError(res, 503, "database_unavailable", "база данных недоступна, попробуйте позже");
    }
  });

  // Server-sent events: one "receipt" event each time a receipt of this user is accepted or finished.
  // The site reads it with fetch() (EventSource cannot send the Authorization header).
  router.get("/events", (req, res) => {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no", // nginx in front must not buffer the stream
    });
    res.write("retry: 3000\n\n");
    const stop = queue.subscribe(req.userId, (event) => res.write(`event: receipt\ndata: ${JSON.stringify(event)}\n\n`));
    const ping = setInterval(() => res.write(": ping\n\n"), PING_MS); // keeps proxies from closing an idle stream
    req.on("close", () => {
      clearInterval(ping);
      stop();
    });
  });

  // «Повторить» for a receipt that ended in an error a new attempt can fix (site's «Чеки» section)
  router.post("/:id/retry", async (req, res) => {
    if (!UUID.test(req.params.id)) return sendError(res, 404, "not_found", "чек не найден");
    let row;
    try {
      row = await db.resetForRetry(req.params.id, req.userId, RETRYABLE);
      if (!row) {
        const existing = await db.getReceipt(req.params.id, req.userId);
        if (!existing) return sendError(res, 404, "not_found", "чек не найден");
        return sendError(res, 409, "not_retryable", "этот чек повторная отправка не исправит");
      }
    } catch (err) {
      logger.error({ err: err.message, receiptId: req.params.id }, "retry failed");
      return sendError(res, 503, "database_unavailable", "база данных недоступна, попробуйте позже");
    }
    try {
      const task = { receiptId: row.id, userId: row.user_id, source: row.source, enqueuedAt: new Date().toISOString() };
      await queue.publish(task, `${row.id}:retry:${Date.now()}`);
    } catch (err) {
      await db.markError(row.id, "queue_unavailable", err.message).catch(() => {});
      return sendError(res, 503, "queue_unavailable", "очередь недоступна, попробуйте позже", { id: row.id });
    }
    queue.publishEvent(row.user_id, { receiptId: row.id, status: "accepted" });
    res.status(202).json({ id: row.id, status: "accepted" });
  });

  router.get("/:id", async (req, res) => {
    if (!UUID.test(req.params.id)) return sendError(res, 404, "not_found", "чек не найден");
    try {
      const row = await db.getReceipt(req.params.id, req.userId);
      if (!row) return sendError(res, 404, "not_found", "чек не найден");
      res.json(toDto(row));
    } catch (err) {
      logger.error({ err: err.message, receiptId: req.params.id }, "get failed");
      sendError(res, 503, "database_unavailable", "база данных недоступна, попробуйте позже");
    }
  });

  return router;
}

function toDto(r) {
  return {
    id: r.id,
    status: r.status,
    source: r.source,
    accountId: r.account_id,
    category: r.category ?? null,
    amount: r.amount === null ? null : Number(r.amount),
    purchasedAt: r.purchased_at,
    transactionId: r.transaction_id,
    error: r.error_code ? { code: r.error_code, message: r.error_message } : null,
    attempts: r.attempts,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

module.exports = { receiptsRouter };
