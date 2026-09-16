const path = require("path");
const { execSync } = require("child_process");

// Прогоняет миграции на тестовой БД (тот же react_money_test на localhost:5433,
// что использует backend/tests) перед стартом веб-серверов, чтобы E2E можно
// было запускать независимо от того, гонялись ли перед этим backend-тесты.
module.exports = async () => {
  execSync("node src/migrate.js", {
    cwd: path.join(__dirname, "..", "backend"),
    env: {
      ...process.env,
      DB_HOST: "localhost",
      DB_PORT: "5433",
      DB_USER: "app",
      DB_PASSWORD: "app",
      DB_NAME: "react_money_test",
    },
    stdio: "inherit",
  });
};
