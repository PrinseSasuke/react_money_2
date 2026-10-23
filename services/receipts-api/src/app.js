const express = require("express");
const { requireAuth, sendError } = require("./auth");
const { receiptsRouter } = require("./routes/receipts");

// Dependencies (db, storage, queue) are passed in, so tests can replace them with fakes.
function createApp({ db, storage, queue, metrics, logger, jwtSecret, maxUploadMb, corsOrigins = [] }) {
  const app = express();
  app.disable("x-powered-by");

  // the react-money site calls this service from the browser («Чеки» section, live updates); the phone needs no CORS
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin && corsOrigins.includes(origin)) {
      res.set("Access-Control-Allow-Origin", origin);
      res.set("Vary", "Origin");
      if (req.method === "OPTIONS") {
        res.set("Access-Control-Allow-Methods", "GET, POST");
        res.set("Access-Control-Allow-Headers", "Authorization, Content-Type");
        res.set("Access-Control-Max-Age", "600");
        return res.status(204).end();
      }
    }
    next();
  });
  app.use(express.json({ limit: "16kb" }));

  // response time by route template, not by raw URL (ids would explode the label set)
  app.use((req, res, next) => {
    const end = metrics.httpDuration.startTimer();
    res.on("finish", () => {
      // Express restores req.baseUrl after the router, so the mount path is re-added here
      const mount = req.originalUrl.startsWith("/api/receipts") ? "/api/receipts" : "";
      const route = req.route ? mount + req.route.path : "unmatched";
      end({ route, code: res.statusCode });
    });
    next();
  });

  app.get("/healthz", (req, res) => res.json({ status: "ok" }));

  app.get("/readyz", async (req, res) => {
    const checks = { postgres: db.ping(), nats: queue.ping(), s3: storage.ping() };
    const down = [];
    await Promise.all(Object.entries(checks).map(([name, p]) => p.catch(() => down.push(name))));
    if (down.length) return res.status(503).json({ status: "unavailable", down: down.sort() });
    res.json({ status: "ok" });
  });

  app.get("/metrics", async (req, res) => {
    res.set("Content-Type", metrics.register.contentType);
    res.send(await metrics.register.metrics());
  });

  app.use("/api/receipts", requireAuth(jwtSecret), receiptsRouter({ db, storage, queue, metrics, logger, maxUploadMb }));

  app.use((req, res) => sendError(res, 404, "not_found", "нет такого адреса"));
  // malformed JSON body and anything unexpected
  app.use((err, req, res, next) => {
    if (err.type === "entity.parse.failed") return sendError(res, 400, "bad_request", "тело запроса — неверный JSON");
    logger.error({ err: err.message }, "unhandled error");
    sendError(res, 500, "internal", "внутренняя ошибка");
  });

  return app;
}

module.exports = { createApp };
