const client = require("prom-client");

// Metrics of receipts-api (ТЗ, section 6). A separate registry so tests can build several apps.
function createMetrics() {
  const register = new client.Registry();
  client.collectDefaultMetrics({ register });

  return {
    register,
    received: new client.Counter({
      name: "receipts_received_total",
      help: "Receipts accepted by the API, by source",
      labelNames: ["source"],
      registers: [register],
    }),
    httpDuration: new client.Histogram({
      name: "receipts_http_request_duration_seconds",
      help: "HTTP response time of receipts-api",
      labelNames: ["route", "code"],
      buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
      registers: [register],
    }),
  };
}

module.exports = { createMetrics };
