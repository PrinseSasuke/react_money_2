const http = require("http");
const pino = require("pino");
const { connect } = require("nats");
const config = require("./config");
const { createDb } = require("./db");
const { createParser } = require("./parser");
const { createCoreApi } = require("./coreApi");
const { createMetrics, watchQueue } = require("./metrics");
const { startConsumer } = require("./consumer");

const logger = pino({ name: "receipts-worker" });

async function main() {
  const metrics = createMetrics();
  const db = createDb(config);
  const parser = createParser(config);
  const coreApi = createCoreApi({ ...config, observe: () => { const end = metrics.coreApiDuration.startTimer(); return (code) => end({ code }); } });

  const nc = await connect({ servers: config.natsUrl, name: "receipts-worker", waitOnFirstConnect: true, reconnect: true, maxReconnectAttempts: -1 });
  const consumer = await startConsumer({ nc, deps: { db, parser, coreApi, metrics, config }, logger, concurrency: config.concurrency });
  const stopWatch = watchQueue({ nc, metrics, logger });
  logger.info({ concurrency: config.concurrency, parser: config.parser }, "receipts-worker started");

  // no HTTP API besides /healthz and /metrics (ТЗ, section 4)
  const server = http.createServer(async (req, res) => {
    if (req.url === "/healthz") {
      const ok = !nc.isClosed();
      res.writeHead(ok ? 200 : 503, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ status: ok ? "ok" : "nats closed" }));
    }
    if (req.url === "/metrics") {
      res.writeHead(200, { "Content-Type": metrics.register.contentType });
      return res.end(await metrics.register.metrics());
    }
    res.writeHead(404).end();
  }).listen(config.metricsPort);

  // SIGTERM: stop taking tasks, finish the current ones, close connections (ТЗ, section 4)
  let stopping = false;
  const shutdown = async (signal) => {
    if (stopping) return;
    stopping = true;
    logger.info({ signal }, "shutting down: finishing current tasks");
    setTimeout(() => process.exit(1), 25000).unref();
    await consumer.stop();
    stopWatch();
    server.close();
    await Promise.allSettled([nc.drain(), db.close()]);
    logger.info("stopped");
    process.exit(0);
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

main().catch((err) => {
  logger.fatal({ err: err.message }, "failed to start");
  process.exit(1);
});
