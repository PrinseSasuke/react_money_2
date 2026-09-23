import React, { useCallback, useEffect, useState } from "react";
import { Alert, Box, CircularProgress, IconButton, Tooltip, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import CloudUploadRounded from "@mui/icons-material/CloudUploadRounded";
import PictureAsPdfRounded from "@mui/icons-material/PictureAsPdfRounded";
import ImageRounded from "@mui/icons-material/ImageRounded";
import OpenInNewRounded from "@mui/icons-material/OpenInNewRounded";
import DeleteOutlineRounded from "@mui/icons-material/DeleteOutlineRounded";
import * as api from "../../services/api";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "application/pdf"];
const MAX_SIZE = 10 * 1024 * 1024;

const formatSize = (bytes) =>
  bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} МБ` : `${Math.max(1, Math.round(bytes / 1024))} КБ`;

function AttachmentItem({ attachment, onDeleted }) {
  const [previewUrl, setPreviewUrl] = useState(null);
  const isImage = attachment.mime_type.startsWith("image/");

  // <img src> не может отправить Bearer-токен — грузим blob и показываем object URL.
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
    <Box
      className="flex items-center gap-3 rounded-2xl p-2 pr-1"
      sx={{ border: 1, borderColor: "divider", bgcolor: "background.paper" }}
    >
      <Box
        component="button"
        type="button"
        onClick={handleOpen}
        aria-label={`Открыть ${attachment.file_name}`}
        className="flex h-14 w-14 flex-shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-xl p-0"
        sx={{ border: 0, bgcolor: (t) => alpha(t.palette.primary.main, 0.08), color: "primary.main" }}
      >
        {isImage && previewUrl ? (
          <img src={previewUrl} alt="" className="h-full w-full object-cover" />
        ) : isImage ? (
          <ImageRounded />
        ) : (
          <PictureAsPdfRounded />
        )}
      </Box>
      <div className="min-w-0 flex-1">
        <Typography variant="body2" noWrap title={attachment.file_name} sx={{ fontWeight: 600 }}>
          {attachment.file_name}
        </Typography>
        {attachment.file_size ? (
          <Typography variant="caption" color="text.secondary">
            {formatSize(attachment.file_size)}
          </Typography>
        ) : null}
      </div>
      <Tooltip title="Открыть">
        <IconButton size="small" onClick={handleOpen} aria-label="Открыть файл">
          <OpenInNewRounded fontSize="small" />
        </IconButton>
      </Tooltip>
      <Tooltip title="Удалить">
        <IconButton
          size="small"
          onClick={handleDelete}
          aria-label="Удалить файл"
          sx={{ color: (t) => t.palette.finance.expense.text }}
        >
          <DeleteOutlineRounded fontSize="small" />
        </IconButton>
      </Tooltip>
    </Box>
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
      setAttachments(await api.getAttachments(transactionId));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [transactionId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleFile = async (file) => {
    setError("");
    if (!ALLOWED_TYPES.includes(file.type)) {
      setError("Разрешены только JPG, PNG и PDF файлы");
      return;
    }
    if (file.size > MAX_SIZE) {
      setError("Файл слишком большой (максимум 10MB)");
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

  return (
    <div className="flex flex-col gap-3">
      <Typography variant="subtitle1" component="h3">
        Чеки и квитанции
      </Typography>

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
        className="flex cursor-pointer flex-col items-center justify-center gap-1 rounded-2xl px-4 py-6 text-center"
        sx={{
          border: 2,
          borderStyle: "dashed",
          borderColor: dragOver ? "primary.main" : "divider",
          bgcolor: (t) => (dragOver ? alpha(t.palette.primary.main, 0.06) : "transparent"),
          transition: "all .15s ease",
          "&:hover": { borderColor: "primary.main" },
        }}
      >
        <input
          type="file"
          accept="image/jpeg,image/png,application/pdf"
          className="sr-only"
          disabled={uploading}
          onChange={(e) => {
            const file = e.target.files[0];
            if (file) handleFile(file);
            e.target.value = "";
          }}
        />
        {uploading ? <CircularProgress size={28} /> : <CloudUploadRounded color="primary" />}
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          {uploading ? "Загрузка..." : "Перетащите файл сюда или нажмите, чтобы выбрать"}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          JPG, PNG или PDF, до 10MB
        </Typography>
      </Box>

      {error && <Alert severity="error">{error}</Alert>}

      {!loading && attachments.length > 0 && (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {attachments.map((a) => (
            <AttachmentItem
              key={a.id}
              attachment={a}
              onDeleted={(id) => setAttachments((prev) => prev.filter((x) => x.id !== id))}
            />
          ))}
        </div>
      )}
    </div>
  );
}
