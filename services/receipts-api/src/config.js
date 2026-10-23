// All settings come from the environment (ТЗ, section 6). Missing required values stop the process at start.
function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`environment variable ${name} is required`);
  return value;
}

module.exports = {
  port: Number(process.env.PORT || 3100),
  databaseUrl: required("DATABASE_URL"),
  natsUrl: process.env.NATS_URL || "nats://localhost:4222",
  jwtSecret: required("JWT_SECRET"),
  s3: {
    endpoint: required("S3_ENDPOINT"),
    bucket: process.env.S3_BUCKET || "receipts",
    region: process.env.S3_REGION || "us-east-1",
    accessKeyId: required("S3_ACCESS_KEY"),
    secretAccessKey: required("S3_SECRET_KEY"),
  },
  // browser origins allowed to call the API (the react-money site), comma-separated
  corsOrigins: (process.env.CORS_ORIGINS || "http://localhost:3000").split(",").map((s) => s.trim()).filter(Boolean),
  maxUploadMb: Number(process.env.MAX_UPLOAD_MB || 10),
  // a dependency that does not answer within this time is reported as unavailable (ТЗ: 503 within 3 s)
  dependencyTimeoutMs: Number(process.env.DEPENDENCY_TIMEOUT_MS || 2500),
};
