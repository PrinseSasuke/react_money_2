import * as XLSX from "xlsx";

export const EXPECTED_COLUMNS = [
  "ДАТА ОПЕРАЦИИ (МСК)",
  "СУММА В ВАЛЮТЕ СЧЁТА",
  "КАТЕГОРИЯ",
  "Описание операции",
  "Валюта",
];

const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export function isExcelFile(file) {
  return Boolean(file) && (file.type === XLSX_MIME || /\.xlsx$/i.test(file.name));
}

const parseDate = (value) => {
  if (!value) return new Date();
  if (value instanceof Date) return value;
  if (typeof value === "number") {
    const { y, m, d } = XLSX.SSF.parse_date_code(value);
    return new Date(y, m - 1, d);
  }
  if (typeof value === "string") {
    const parts = value.split(/[./-]/);
    if (parts.length === 3) {
      const [day, month, year] = parts.map(Number);
      return new Date(year, month - 1, day);
    }
  }
  return new Date(value);
};

// Формат банковской выписки: отрицательная сумма — расход, положительная — доход.
export function parseExcelTransactions(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Не удалось прочитать файл"));
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target.result, { type: "array" });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet);
        resolve(
          rows.map((row) => {
            const amount = Number(row["СУММА В ВАЛЮТЕ СЧЁТА"]);
            return {
              date: parseDate(row["ДАТА ОПЕРАЦИИ (МСК)"]),
              type: amount < 0 ? "Расход" : "Доход",
              source: row["КАТЕГОРИЯ"] || "Остальное",
              description: row["Описание операции"] || "",
              summ: Math.abs(amount),
              currency: row["Валюта"] || "rub",
            };
          })
        );
      } catch (err) {
        reject(new Error("Файл не похож на выписку Excel: " + err.message));
      }
    };
    reader.readAsArrayBuffer(file);
  });
}
