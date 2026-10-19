const { StringCodec, headers } = require("nats");
const { processTask, retryDelay } = require("./processor");
const { classify } = require("./errors");

const STREAM = "RECEIPTS";
const CONSUMER = "receipts-worker";
const DLQ_SUBJECT = "receipts.dlq";
const sc = StringCodec();

// WORKER_CONCURRENCY independent loops pull one message at a time from the durable consumer.
// stop() lets every loop finish its current message, then returns (graceful shutdown on SIGTERM).
async function startConsumer({ nc, deps, logger, concurrency }) {
  const js = nc.jetstream();
  const consumer = await js.consumers.get(STREAM, CONSUMER);
  const maxDeliver = (await consumer.info()).config.max_deliver;
  let running = true;

  async function handle(m) {
    const delivery = { count: m.info.redeliveryCount, max: maxDeliver };
    let task;
    try {
      task = JSON.parse(sc.decode(m.data));
    } catch {
      logger.error({ seq: m.seq }, "unreadable task, dropped");
      m.term();
      return;
    }
    const log = logger.child({ receiptId: task.receiptId, userId: task.userId, delivery: delivery.count });

    let decision;
    try {
      decision = await processTask(task, delivery, deps);
    } catch (e) {
      // the database failed even before or after the work itself: retry the whole task later
      const err = classify(e);
      decision = delivery.count >= delivery.max
        ? { action: "dlq", result: "error", reason: err.code, statusWritten: false }
        : { action: "nak", delayMs: retryDelay(delivery.count), result: "retry", reason: err.code };
      log.warn({ err: err.message }, "task failed before a status could be written");
    }

    if (decision.action === "ack") {
      await m.ackAck();
    } else if (decision.action === "nak") {
      deps.metrics.retries.inc({ reason: decision.reason });
      m.nak(decision.delayMs);
    } else {
      const h = headers();
      h.set("Receipt-Id", String(task.receiptId));
      h.set("Error-Code", String(decision.reason));
      h.set("Deliveries", String(delivery.count));
      h.set("Status-Written", String(decision.statusWritten));
      await js.publish(DLQ_SUBJECT, m.data, { headers: h });
      await m.ackAck();
      deps.metrics.dlq.inc({ status_written: String(decision.statusWritten) });
      if (!decision.statusWritten) log.error("moved to DLQ, but the receipt status could not be written: it stays 'processing'");
    }
    if (["parsed", "duplicate", "error"].includes(decision.result)) deps.metrics.processed.inc({ result: decision.result });
    log.info({ action: decision.action, result: decision.result, reason: decision.reason, delayMs: decision.delayMs }, "task handled");
  }

  const loops = Array.from({ length: concurrency }, async () => {
    while (running) {
      let m;
      try {
        m = await consumer.next({ expires: 5000 });
      } catch (err) {
        logger.warn({ err: err.message }, "could not pull from JetStream, retrying in 1 s");
        await new Promise((r) => setTimeout(r, 1000));
        continue;
      }
      if (!m) continue;
      try {
        await handle(m);
      } catch (err) {
        // ack/nak itself failed (NATS gone): JetStream redelivers after ack_wait
        logger.error({ err: err.message }, "could not settle the message");
      }
    }
  });

  return {
    async stop() {
      running = false;
      await Promise.all(loops);
    },
  };
}

module.exports = { startConsumer, STREAM, CONSUMER };
