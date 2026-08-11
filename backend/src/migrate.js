const fs = require("fs");
const path = require("path");
const pool = require("./db");

async function migrate() {
  const sql = fs.readFileSync(
    path.join(__dirname, "..", "migrations", "init.sql"),
    "utf8"
  );
  await pool.query(sql);
  console.log("Миграции применены успешно");
  await pool.end();
}

migrate().catch((err) => {
  console.error("Ошибка миграции:", err);
  process.exit(1);
});
