// src/components/FileUpload.js
import React, { useId, useState } from "react";

function FileUpload({ onFileSelect }) {
  const inputId = useId();
  const [fileName, setFileName] = useState("");

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
      setFileName(file.name);
      onFileSelect(renamedFile);
    } else {
      setFileName("");
      alert("Пожалуйста, загрузите файл формата Excel.");
    }
  };

  return (
    <div>
      <input
        id={inputId}
        type="file"
        accept=".xlsx,.xls"
        onChange={handleFileChange}
        style={{
          position: "absolute",
          width: 1,
          height: 1,
          padding: 0,
          margin: -1,
          overflow: "hidden",
          clip: "rect(0,0,0,0)",
          border: 0,
        }}
      />
      <label htmlFor={inputId} className="file-upload-input">
        {fileName || "Выбрать файл Excel"}
      </label>
    </div>
  );
}

export default FileUpload;
