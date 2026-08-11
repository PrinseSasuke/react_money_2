import React, { useState } from "react";
import FileUpload from "../components/FileUpload/FileUpload";
import ExcelReader from "../components/FileUpload/ExcelReader";
import TransactionsTable from "../components/TransactionsTable";
function Excel() {
  const [excelFile, setExcelFile] = useState(null);
  const [importedTransactions, setImportedTransactions] = useState([]);
  // Функция обратного вызова для получения данных из ExcelReader
  const handleDataLoad = (data) => {
    setImportedTransactions(data);
  };
  return (
    <div className="excel-container">
      <h1 className="excel-title">Загрузка и анализ Excel</h1>
      <FileUpload onFileSelect={setExcelFile} />
      {excelFile && (
        <ExcelReader file={excelFile} onDataLoad={handleDataLoad} />
      )}
      {importedTransactions.length > 0 && (
        <>
          <h2>Импортированные данные</h2>
          <TransactionsTable transactions={importedTransactions} />
        </>
      )}
    </div>
  );
}

export default Excel;
