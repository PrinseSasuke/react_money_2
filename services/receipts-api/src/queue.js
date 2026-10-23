const { connect, StringCodec } = require("nats");

const SUBJECT = "receipts.parse";
// «receipt changed» events for the site's live update (mobile ТЗ, M4). Plain NATS, not JetStream: an event
// nobody listens to is simply dropped, and a listener that missed one refetches when it reconnects.
const EVENTS = "receipts.events";
const sc = StringCodec();

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
    // msgId becomes the Nats-Msg-Id header; resolves only after the stream confirms it stored the message.
    // A retry passes its own msgId: the receipt id alone would be dropped as a duplicate within 2 minutes.
    async publish(task, msgId = task.receiptId) {
      await js.publish(SUBJECT, JSON.stringify(task), { msgID: msgId, timeout: dependencyTimeoutMs });
    },
    publishEvent(userId, event) {
      nc.publish(`${EVENTS}.${userId}`, JSON.stringify(event));
    },
    /** onEvent for every event of this user until the returned function is called */
    subscribe(userId, onEvent) {
      const sub = nc.subscribe(`${EVENTS}.${userId}`);
      (async () => {
        for await (const m of sub) {
          try {
            onEvent(JSON.parse(sc.decode(m.data)));
          } catch (err) {
            logger.warn({ err: err.message }, "bad receipt event");
          }
        }
      })().catch(() => {});
      return () => sub.unsubscribe();
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

module.exports = { createQueue, SUBJECT, EVENTS };
