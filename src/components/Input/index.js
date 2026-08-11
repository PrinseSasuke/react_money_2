import React, { useState } from "react";
import PDFReader from "../PdfReader";

function FileUpload() {
  const [file, setFile] = useState(null);

  const handleFileChange = (event) => {
    const selectedFile = event.target.files[0];
    if (selectedFile && selectedFile.type === "application/pdf") {
      setFile(selectedFile);
    } else {
      alert("Пожалуйста, загрузите PDF документ.");
    }
  };

  return (
    <div>
      <input type="file" accept=".pdf" onChange={handleFileChange} />
      {file && <PDFReader file={file} />}
    </div>
  );
}

export default FileUpload;
