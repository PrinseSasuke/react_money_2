import React, { useState } from "react";
import { useOutletContext } from "react-router-dom";
import { Alert, Box, Chip, CircularProgress, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import UploadFileRounded from "@mui/icons-material/UploadFileRounded";
import * as api from "../services/api";
import PageHeader from "../components/ui/PageHeader";
import SectionCard from "../components/ui/SectionCard";
import TransactionsTable from "../components/transactions/TransactionsTable";
import { EXPECTED_COLUMNS, isExcelFile, parseExcelTransactions } from "../utils/excelImport";

function Excel() {
  const { refreshTransactions } = useOutletContext();
  const [imported, setImported] = useState([]);
  const [fileName, setFileName] = useState("");
  const [status, setStatus] = useState({ state: "idle", message: "" });
  const [dragOver, setDragOver] = useState(false);

  const handleFile = async (file) => {
    if (!isExcelFile(file)) {
      setStatus({ state: "error", message: "Пожалуйста, загрузите файл формата Excel (.xlsx)." });
      return;
    }
    setFileName(file.name);
    setStatus({ state: "loading", message: "" });
    try {
      const rows = await parseExcelTransactions(file);
      setImported(rows);
      try {
        await api.bulkAddTransactions(rows);
        await refreshTransactions();
        setStatus({ state: "success", message: `Импортировано операций: ${rows.length}` });
      } catch (err) {
        setStatus({ state: "error", message: "Не удалось сохранить импортированные операции: " + err.message });
      }
    } catch (err) {
      setImported([]);
      setStatus({ state: "error", message: err.message });
    }
  };

  return (
    <div>
      <PageHeader title="Импорт из Excel" subtitle="Загрузите банковскую выписку — операции добавятся автоматически" />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="min-w-0 lg:col-span-2">
          <SectionCard title="Файл выписки">
            <Box
              component="label"
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                const file = e.dataTransfer.files[0];
                if (file) handleFile(file);
              }}
              className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-3xl px-6 py-12 text-center"
              sx={{
                border: 2,
                borderStyle: "dashed",
                borderColor: dragOver ? "primary.main" : "divider",
                bgcolor: (t) => alpha(t.palette.primary.main, dragOver ? 0.08 : 0.03),
                transition: "all .15s ease",
                "&:hover": { borderColor: "primary.main" },
              }}
            >
              <input
                type="file"
                accept=".xlsx"
                className="sr-only"
                onChange={(e) => {
                  const file = e.target.files[0];
                  if (file) handleFile(file);
                  e.target.value = "";
                }}
              />
              <Box
                className="mb-2 flex h-14 w-14 items-center justify-center rounded-2xl"
                sx={{ bgcolor: (t) => alpha(t.palette.primary.main, 0.12), color: "primary.main" }}
              >
                {status.state === "loading" ? <CircularProgress size={26} /> : <UploadFileRounded />}
              </Box>
              <Typography variant="subtitle1">
                {status.state === "loading" ? "Импортируем…" : "Выбрать файл Excel"}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {fileName || "Перетащите .xlsx сюда или нажмите, чтобы выбрать"}
              </Typography>
            </Box>

            {status.state === "success" && (
              <Alert severity="success" sx={{ mt: 2 }}>
                {status.message}
              </Alert>
            )}
            {status.state === "error" && (
              <Alert severity="error" sx={{ mt: 2 }}>
                {status.message}
              </Alert>
            )}
          </SectionCard>
        </div>

        <SectionCard title="Формат файла" subtitle="Первый лист, строка заголовков с колонками:">
          <div className="flex flex-wrap gap-2">
            {EXPECTED_COLUMNS.map((c) => (
              <Chip key={c} label={c} size="small" variant="outlined" />
            ))}
          </div>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
            Отрицательная сумма считается расходом, положительная — доходом.
          </Typography>
        </SectionCard>
      </div>

      {imported.length > 0 && (
        <div className="mt-6">
          <Typography variant="h6" component="h2" sx={{ mb: 2 }}>
            Импортированные данные
          </Typography>
          <TransactionsTable transactions={imported} readOnly />
        </div>
      )}
    </div>
  );
}

export default Excel;
