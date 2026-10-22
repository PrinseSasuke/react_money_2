const pino = require("pino");
const config = require("./config");
const { createDb } = require("./db");
const { createStorage } = require("./storage");
const { createQueue } = require("./queue");
const { createMetrics } = require("./metrics");
const { createApp } = require("./app");

// JSON logs to stdout; tokens and photo contents are never logged (ТЗ, section 6)
const logger = pino({ name: "receipts-api", redact: ["req.headers.authorization"] });

async function main() {
  const db = createDb(config);
  await db.migrate();
  logger.info("schema receipts is up to date");

  const storage = createStorage(config);
  const queue = await createQueue({ ...config, logger });
  const metrics = createMetrics();
  const app = createApp({ db, storage, queue, metrics, logger, jwtSecret: config.jwtSecret, maxUploadMb: config.maxUploadMb, corsOrigins: config.corsOrigins });

  const server = app.listen(config.port, () => logger.info({ port: config.port }, "receipts-api listening"));

  // SIGTERM (docker stop, k8s): stop taking requests, finish the current ones, close connections
  const shutdown = (signal) => {
    logger.info({ signal }, "shutting down");
    server.close(async () => {
      await Promise.allSettled([queue.close(), db.close()]);
      storage.close();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10000).unref();
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

main().catch((err) => {
  logger.fatal({ err: err.message }, "failed to start");
  process.exit(1);
});
