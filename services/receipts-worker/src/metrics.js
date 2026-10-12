const client = require("prom-client");
const { STREAM, CONSUMER } = require("./consumer");

// Metrics of receipts-worker (ТЗ, section 6). Queue length and the age of the oldest task are the
// basis of the future predict_linear alert.
function createMetrics() {
  const register = new client.Registry();
  client.collectDefaultMetrics({ register });
  const opts = (o) => ({ ...o, registers: [register] });

  return {
    register,
    processed: new client.Counter(opts({ name: "receipts_processed_total", help: "Receipts finished by the worker", labelNames: ["result"] })),
    parseDuration: new client.Histogram(opts({
      name: "receipts_parse_duration_seconds", help: "Time to parse one receipt",
      buckets: [0.001, 0.01, 0.05, 0.1, 0.5, 1, 2.5, 5, 10],
    })),
    coreApiDuration: new client.Histogram(opts({
      name: "receipts_core_api_duration_seconds", help: "core-api calls by response code", labelNames: ["code"],
      buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
    })),
    queuePending: new client.Gauge(opts({ name: "receipts_queue_pending", help: "Tasks waiting in the queue (consumer num_pending)" })),
    queueOldestAge: new client.Gauge(opts({ name: "receipts_queue_oldest_age_seconds", help: "Age of the oldest task still in the queue" })),
    retries: new client.Counter(opts({ name: "receipts_retries_total", help: "Tasks sent back for a retry, by reason", labelNames: ["reason"] })),
  };
}

// Reads the queue state every 5 s. With workqueue retention an acked task leaves the stream,
// so the stream's first message is the oldest unfinished one.
function watchQueue({ nc, metrics, logger, intervalMs = 5000 }) {
  let jsm;
  const tick = async () => {
    try {
      jsm = jsm || (await nc.jetstreamManager());
      const [ci, si] = await Promise.all([jsm.consumers.info(STREAM, CONSUMER), jsm.streams.info(STREAM)]);
      metrics.queuePending.set(ci.num_pending);
      const oldest = si.state.messages > 0 && si.state.first_ts ? (Date.now() - Date.parse(si.state.first_ts)) / 1000 : 0;
      metrics.queueOldestAge.set(Math.max(0, oldest));
    } catch (err) {
      logger.debug({ err: err.message }, "queue stats unavailable");
    }
  };
  const timer = setInterval(tick, intervalMs);
  tick();
  return () => clearInterval(timer);
}

module.exports = { createMetrics, watchQueue };
