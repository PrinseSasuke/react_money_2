// src/components/FileUpload.js
import React from "react";

function FileUpload({ onFileSelect }) {
  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (
      file &&
      file.type ===
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    ) {
      // Переименовываем файл перед передачей
      const renamedFile = new File([file], `new_name_${file.name}`, {
        type: file.type,
      });
      onFileSelect(renamedFile);
    } else {
      alert("Пожалуйста, загрузите файл формата Excel.");
    }
  };

  return (
    <div>
      <input type="file" accept=".xlsx,.xls" onChange={handleFileChange} />
    </div>
  );
}

export default FileUpload;
