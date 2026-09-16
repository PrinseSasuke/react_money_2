import React, { useCallback, useEffect, useState } from "react";
import styles from "./AttachmentsPanel.module.scss";
import * as api from "../../services/api";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "application/pdf"];
const MAX_SIZE = 10 * 1024 * 1024;

function AttachmentItem({ attachment, onDeleted }) {
  const [previewUrl, setPreviewUrl] = useState(null);
  const isImage = attachment.mime_type.startsWith("image/");

  useEffect(() => {
    let objectUrl;
    let cancelled = false;
    if (isImage) {
      api
        .fetchAttachmentBlob(attachment.id)
        .then((blob) => {
          if (cancelled) return;
          objectUrl = URL.createObjectURL(blob);
          setPreviewUrl(objectUrl);
        })
        .catch(() => {});
    }
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [attachment.id, isImage]);

  const handleOpen = async () => {
    try {
      const blob = await api.fetchAttachmentBlob(attachment.id);
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Удалить файл "${attachment.file_name}"?`)) return;
    try {
      await api.deleteAttachment(attachment.id);
      onDeleted(attachment.id);
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div className={styles.item}>
      {isImage ? (
        previewUrl ? (
          <img
            src={previewUrl}
            alt={attachment.file_name}
            className={styles.thumb}
            onClick={handleOpen}
          />
        ) : (
          <div className={styles.pdfIcon}>🖼️</div>
        )
      ) : (
        <div className={styles.pdfIcon} onClick={handleOpen} title="Открыть PDF">
          📄
        </div>
      )}
      <span className={styles.fileName} title={attachment.file_name}>
        {attachment.file_name}
      </span>
      <button type="button" className={styles.deleteButton} onClick={handleDelete}>
        Удалить
      </button>
    </div>
  );
}

export default function AttachmentsPanel({ transactionId }) {
  const [attachments, setAttachments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await api.getAttachments(transactionId);
      setAttachments(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [transactionId]);

  useEffect(() => {
    load();
  }, [load]);

  const validateFile = (file) => {
    if (!ALLOWED_TYPES.includes(file.type)) {
      return "Разрешены только JPG, PNG и PDF файлы";
    }
    if (file.size > MAX_SIZE) {
      return "Файл слишком большой (максимум 10MB)";
    }
    return null;
  };

  const handleFile = async (file) => {
    setError("");
    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }
    setUploading(true);
    try {
      const created = await api.uploadAttachment(transactionId, file);
      setAttachments((prev) => [...prev, created]);
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleInputChange = (e) => {
    const file = e.target.files[0];
    if (file) handleFile(file);
    e.target.value = "";
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleDeleted = (id) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  return (
    <div className={styles.panel}>
      <div className={styles.title}>Чеки и квитанции</div>

      <label
        className={`${styles.dropzone} ${dragOver ? styles.dragOver : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
      >
        <input
          type="file"
          accept="image/jpeg,image/png,application/pdf"
          onChange={handleInputChange}
          disabled={uploading}
        />
        {uploading ? "Загрузка..." : "Перетащите файл сюда или нажмите, чтобы выбрать"}
        <div className={styles.hint}>JPG, PNG или PDF, до 10MB</div>
      </label>

      {error && <p className={styles.error}>{error}</p>}

      {!loading && attachments.length > 0 && (
        <div className={styles.list}>
          {attachments.map((a) => (
            <AttachmentItem key={a.id} attachment={a} onDeleted={handleDeleted} />
          ))}
        </div>
      )}
    </div>
  );
}
