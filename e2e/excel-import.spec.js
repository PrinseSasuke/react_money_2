const path = require("path");
const os = require("os");
const fs = require("fs");
const { test, expect } = require("@playwright/test");
const XLSX = require("xlsx");
const { loginAsNewUser, visibleText } = require("./helpers");

function buildFixtureFile() {
  const description = `E2E импорт ${Date.now()}`;
  const rows = [
    {
      "ДАТА ОПЕРАЦИИ (МСК)": "16.09.2026",
      "СУММА В ВАЛЮТЕ СЧЁТА": -1234,
      КАТЕГОРИЯ: "Супермаркеты",
      "Описание операции": description,
      Валюта: "rub",
    },
  ];
  const sheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Транзакции");

  const filePath = path.join(os.tmpdir(), `e2e_import_${Date.now()}.xlsx`);
  XLSX.writeFile(workbook, filePath);
  return { filePath, description };
}

test("import transactions from an Excel file", async ({ page }) => {
  const { filePath, description } = buildFixtureFile();
  await loginAsNewUser(page);

  await page.goto("/import");
  await page.locator('input[type="file"]').setInputFiles(filePath);

  await expect(visibleText(page, description)).toBeVisible({ timeout: 15000 });

  fs.unlinkSync(filePath);
});
