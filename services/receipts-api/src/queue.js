const { connect } = require("nats");

const SUBJECT = "receipts.parse";

// Parse tasks go to JetStream. The message carries only a reference to the receipt (ТЗ, section 5);
// Nats-Msg-Id = receiptId, so a repeated publish inside the 2-minute window is dropped by the stream.
async function createQueue({ natsUrl, dependencyTimeoutMs, logger }) {
  const nc = await connect({
    servers: natsUrl,
    name: "receipts-api",
    waitOnFirstConnect: true, // start even if NATS is not up yet; /readyz shows it
    reconnect: true,
    maxReconnectAttempts: -1,
  });
  (async () => {
    for await (const s of nc.status()) logger.info({ nats: s.type }, "nats status");
  })().catch(() => {});
  const js = nc.jetstream();

  return {
    async publish(task) {
      // msgID becomes the Nats-Msg-Id header; resolves only after the stream confirms it stored the message
      await js.publish(SUBJECT, JSON.stringify(task), { msgID: task.receiptId, timeout: dependencyTimeoutMs });
    },
    async ping() {
      await withTimeout(nc.flush(), dependencyTimeoutMs);
    },
    close: () => nc.drain(),
  };
}

function withTimeout(promise, ms) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`timeout after ${ms} ms`)), ms); }),
  ]).finally(() => clearTimeout(timer));
}

module.exports = { createQueue, SUBJECT };
