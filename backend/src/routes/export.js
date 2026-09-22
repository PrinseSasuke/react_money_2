const express = require("express");
const fs = require("fs");
const XLSX = require("xlsx");
const PDFDocument = require("pdfkit");
const pool = require("../db");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();
router.use(requireAuth);

// DejaVu Sans (устанавливается в Dockerfile через apk ttf-dejavu) умеет
// кириллицу, в отличие от встроенных шрифтов pdfkit. Если пакет почему-то не
// установлен (например, локальный запуск не в Docker) — тихо откатываемся на
// стандартный Helvetica, чтобы экспорт не падал (кириллица тогда не отобразится).
const CYRILLIC_FONT_CANDIDATES = [
  "/usr/share/fonts/dejavu/DejaVuSans.ttf",
  "/usr/share/fonts/ttf-dejavu/DejaVuSans.ttf",
  "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
];
const cyrillicFontPath = CYRILLIC_FONT_CANDIDATES.find((p) => fs.existsSync(p));

async function fetchTransactions(userId, from, to, accountId) {
  const conditions = ["user_id = $1"];
  const params = [userId];
  let idx = 2;
  if (from) {
    conditions.push(`date >= $${idx++}`);
    params.push(from);
  }
  if (to) {
    conditions.push(`date <= $${idx++}`);
    params.push(to);
  }
  if (accountId) {
    conditions.push(`account_id = $${idx++}`);
    params.push(accountId);
  }
  const { rows } = await pool.query(
    `SELECT * FROM transactions WHERE ${conditions.join(" AND ")} ORDER BY date`,
    params
  );
  return rows;
}

router.get("/excel", async (req, res) => {
  try {
    const { from, to, accountId } = req.query;
    const transactions = await fetchTransactions(req.userId, from, to, accountId);

    const data = transactions.map((t) => ({
      Дата: new Date(t.date).toLocaleString("ru-RU"),
      Тип: t.type,
      Источник: t.source,
      Описание: t.description,
      Сумма: Number(t.summ),
      Валюта: t.currency,
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Транзакции");
    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Content-Disposition", 'attachment; filename="transactions.xlsx"');
    res.send(buffer);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Ошибка экспорта в Excel" });
  }
});

router.get("/pdf", async (req, res) => {
  try {
    const { from, to } = req.query;
    const transactions = await fetchTransactions(req.userId, from, to, null);

    const doc = new PDFDocument({ margin: 40 });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", 'attachment; filename="transactions.pdf"');
    doc.pipe(res);

    if (cyrillicFontPath) {
      doc.registerFont("main", cyrillicFontPath);
      doc.font("main");
    }

    doc.fontSize(18).text("Отчёт по транзакциям", { align: "center" });
    doc.moveDown();
    if (from || to) {
      doc.fontSize(10).text(`Период: ${from || "…"} — ${to || "…"}`);
      doc.moveDown();
    }

    let totalIncome = 0;
    let totalExpense = 0;

    doc.fontSize(10);
    transactions.forEach((t) => {
      const summ = Number(t.summ);
      if (t.type === "Доход") totalIncome += summ;
      else totalExpense += summ;
      const dateStr = new Date(t.date).toLocaleDateString("ru-RU");
      doc.text(
        `${dateStr}   ${t.type}   ${t.source}   ${t.description || ""}   ${summ} ${t.currency}`
      );
    });

    doc.moveDown();
    doc.fontSize(12);
    doc.text(`Доход: ${totalIncome.toFixed(2)}`);
    doc.text(`Расход: ${totalExpense.toFixed(2)}`);
    doc.text(`Баланс: ${(totalIncome - totalExpense).toFixed(2)}`);

    doc.end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Ошибка экспорта в PDF" });
  }
});

module.exports = router;
