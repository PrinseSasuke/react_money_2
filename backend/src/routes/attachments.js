const express = require("express");
const fs = require("fs");
const path = require("path");
const pool = require("../db");
const { requireAuth } = require("../middleware/auth");
const { UPLOAD_DIR } = require("../middleware/upload");

const router = express.Router();
router.use(requireAuth);

// Находит вложение и проверяет, что его транзакция принадлежит текущему
// пользователю (JOIN на transactions), иначе возвращает null.
async function findOwnedAttachment(attachmentId, userId) {
  const { rows } = await pool.query(
    `SELECT a.* FROM transaction_attachments a
     JOIN transactions t ON t.id = a.transaction_id
     WHERE a.id = $1 AND t.user_id = $2`,
    [attachmentId, userId]
  );
  return rows[0] || null;
}

router.get("/:attachmentId", async (req, res) => {
  try {
    const attachment = await findOwnedAttachment(req.params.attachmentId, req.userId);
    if (!attachment) {
      return res.status(404).json({ error: "Вложение не найдено" });
    }
    const filePath = path.join(UPLOAD_DIR, attachment.file_path);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: "Файл не найден на диске" });
    }
    res.setHeader("Content-Type", attachment.mime_type);
    res.setHeader(
      "Content-Disposition",
      `inline; filename="${encodeURIComponent(attachment.file_name)}"`
    );
    fs.createReadStream(filePath).pipe(res);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Ошибка получения вложения" });
  }
});

router.delete("/:attachmentId", async (req, res) => {
  try {
    const attachment = await findOwnedAttachment(req.params.attachmentId, req.userId);
    if (!attachment) {
      return res.status(404).json({ error: "Вложение не найдено" });
    }
    await pool.query("DELETE FROM transaction_attachments WHERE id = $1", [
      attachment.id,
    ]);
    fs.unlink(path.join(UPLOAD_DIR, attachment.file_path), () => {});
    res.json({ deleted: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Ошибка удаления вложения" });
  }
});

module.exports = router;
