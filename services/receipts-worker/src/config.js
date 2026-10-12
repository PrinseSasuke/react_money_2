// All settings come from the environment (ТЗ, section 7).
function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`environment variable ${name} is required`);
  return value;
}

module.exports = {
  metricsPort: Number(process.env.METRICS_PORT || 3101),
  databaseUrl: required("DATABASE_URL"),
  natsUrl: process.env.NATS_URL || "nats://localhost:4222",
  jwtSecret: required("JWT_SECRET"),
  coreApiUrl: required("CORE_API_URL"),
  concurrency: Number(process.env.WORKER_CONCURRENCY || 4),
  parser: process.env.PARSER || "stub",
  parserDelayMs: Number(process.env.PARSER_DELAY_MS || 0),
  parserFailRate: Number(process.env.PARSER_FAIL_RATE || 0),
  // ТЗ, section 4: parse 10 s, core-api call 5 s; ack_wait (30 s) and max_deliver (5) live in the consumer
  parseTimeoutMs: 10000,
  coreApiTimeoutMs: 5000,
  dbTimeoutMs: 3000,
};
