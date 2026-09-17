// Each test file gets its own module registry (hence its own `pool`
// instance from src/db.js). Close it after that file's tests finish so
// Jest doesn't hang on open Postgres connections.
const pool = require("../src/db");

afterAll(async () => {
  await pool.end();
});
