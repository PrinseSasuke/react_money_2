// src/components/ExcelReader.js
import React, { useState, useEffect } from "react";
import * as XLSX from "xlsx";
import * as api from "../../services/api";
import { useAuth } from "../../context/AuthContext";

const parseDate = (value) => {
  if (!value) return new Date(); // fallback
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

function ExcelReader({ file, onDataLoad }) {
  const [data, setData] = useState([]);
  const { user } = useAuth();

  useEffect(() => {
    if (data.length > 0 && onDataLoad) {
      onDataLoad(data);
    }
  }, [data, onDataLoad]);

  const readExcelFile = (file) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      const ab = e.target.result;
      const wb = XLSX.read(ab, { type: "array" });
      const sheetName = wb.SheetNames[0];
      const sheet = wb.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(sheet);

      const formattedData = jsonData.map((row) => {
        const parsedDate = parseDate(row["ДАТА ОПЕРАЦИИ (МСК)"]);
        const type =
          Number(row["СУММА В ВАЛЮТЕ СЧЁТА"]) < 0 ? "Расход" : "Доход";
        const source = row["КАТЕГОРИЯ"] || "Остальное";
        const description = row["Описание операции"] || "";
        const summ = Math.abs(Number(row["СУММА В ВАЛЮТЕ СЧЁТА"]));
        const currency = row["Валюта"] || "rub";

        return {
          date: parsedDate,
          type,
          source,
          description,
          summ,
          currency,
        };
      });

      setData(formattedData);

      try {
        await api.bulkAddTransactions(formattedData);
      } catch (error) {
        console.error("Ошибка при импорте транзакций:", error);
        alert("Не удалось сохранить импортированные операции: " + error.message);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  useEffect(() => {
    if (file && user) {
      readExcelFile(file);
    }
  }, [file, user]);

  return <div></div>;
}

export default ExcelReader;
