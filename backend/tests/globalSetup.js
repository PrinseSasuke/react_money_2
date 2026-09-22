const path = require("path");
const { execSync } = require("child_process");
require("dotenv").config({ path: path.join(__dirname, "..", ".env.test") });

// Прогоняет миграции на тестовой БД один раз перед всем прогоном тестов
// (отдельный процесс, т.к. globalSetup не делит реестр модулей с тестами —
// это же гарантирует, что migrate.js получит переменные окружения теста).
module.exports = async () => {
  execSync("node src/migrate.js", {
    cwd: path.join(__dirname, ".."),
    env: { ...process.env },
    stdio: "inherit",
  });
};
