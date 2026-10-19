const { classify, TemporaryError } = require("./errors");

const FINAL = new Set(["parsed", "duplicate", "error"]);
// nak delays by delivery number: 1 s → 5 s → 30 s → 2 min (ТЗ, section 4)
const RETRY_DELAYS_MS = [1000, 5000, 30000, 120000];
const retryDelay = (deliveryCount) => RETRY_DELAYS_MS[Math.min(deliveryCount - 1, RETRY_DELAYS_MS.length - 1)];

// One parse task → a decision for the message: ack, nak (retry later) or dlq (give up, keep a copy).
// The receipt's final status is always written BEFORE the decision is returned, so an ack never
// loses a receipt: if the worker dies earlier, JetStream redelivers the message after ack_wait.
async function processTask(task, delivery, { db, parser, coreApi, metrics, config }) {
  const receipt = await db.getReceipt(task.receiptId);
  if (!receipt) return { action: "ack", result: "missing" };
  if (FINAL.has(receipt.status)) return { action: "ack", result: "redelivered" }; // already done earlier

  await db.startProcessing(receipt.id);
  try {
    const endParse = metrics.parseDuration.startTimer();
    const parsed = await withTimeout(parser.parse(receipt), config.parseTimeoutMs, "parse_timeout");
    endParse();
    await db.saveParsed(receipt.id, parsed);

    const claim = await db.claimFiscalKey(receipt.user_id, parsed.fiscalKey, receipt.id);
    if (!claim.ownedByUs) {
      await db.finishDuplicate(receipt.id, claim.claim.transaction_id, claim.claim.receipt_id);
      return { action: "ack", result: "duplicate" };
    }

    const accountId = receipt.account_id || (await coreApi.defaultAccountId(receipt.user_id));
    const transactionId = await coreApi.createExpense(receipt.user_id, { accountId, ...parsed });
    await db.finishParsed({ ...receipt, fiscal_key: parsed.fiscalKey }, transactionId);
    return { action: "ack", result: "parsed", transactionId };
  } catch (e) {
    const err = classify(e);
    if (!err.temporary) {
      await db.finishError(receipt.id, err.code, err.message);
      return { action: "ack", result: "error", reason: err.code };
    }
    if (delivery.count >= delivery.max) {
      // the task goes to the DLQ even when the status cannot be written (database down on the last try):
      // the DLQ copy then says so in its headers, so the receipt is not silently stuck in "processing"
      const statusWritten = await db.finishError(receipt.id, "max_attempts", `${delivery.count} attempts, last: ${err.message}`)
        .then(() => true, () => false);
      return { action: "dlq", result: "error", reason: err.code, statusWritten };
    }
    await db.noteRetry(receipt.id, err.code, err.message).catch(() => {});
    return { action: "nak", delayMs: retryDelay(delivery.count), result: "retry", reason: err.code };
  }
}

function withTimeout(promise, ms, code) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => { timer = setTimeout(() => reject(new TemporaryError(code, `no answer in ${ms} ms`)), ms); }),
  ]).finally(() => clearTimeout(timer));
}

module.exports = { processTask, retryDelay, RETRY_DELAYS_MS };
