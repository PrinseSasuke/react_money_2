const { Pool } = require("pg");

const pool = new Pool({
  host: process.env.DB_HOST || "postgres",
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER || "app",
  password: process.env.DB_PASSWORD || "app",
  database: process.env.DB_NAME || "react_money",
});

module.exports = pool;
