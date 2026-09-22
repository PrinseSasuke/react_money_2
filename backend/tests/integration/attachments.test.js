const path = require("path");
const fs = require("fs");
const os = require("os");
const { app, request, registerUserWithAccount } = require("../helpers");

// Минимальный валидный PNG (1x1 красный пиксель) для тестовой загрузки
const PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

function writeTempFile(name, content) {
  const filePath = path.join(os.tmpdir(), `${Date.now()}_${name}`);
  fs.writeFileSync(filePath, content);
  return filePath;
}

async function createTransaction(token, accountId) {
  const res = await request(app)
    .post("/api/transactions")
    .set("Authorization", `Bearer ${token}`)
    .send({ type: "Расход", summ: 100, account_id: accountId });
  return res.body.id;
}

describe("transaction attachments", () => {
  it("uploads an image and lists it back", async () => {
    const { token, accountId } = await registerUserWithAccount();
    const transactionId = await createTransaction(token, accountId);
    const filePath = writeTempFile("receipt.png", Buffer.from(PNG_BASE64, "base64"));

    const uploadRes = await request(app)
      .post(`/api/transactions/${transactionId}/attachments`)
      .set("Authorization", `Bearer ${token}`)
      .attach("file", filePath, { filename: "receipt.png", contentType: "image/png" });

    expect(uploadRes.status).toBe(201);
    expect(uploadRes.body.file_name).toBe("receipt.png");

    const listRes = await request(app)
      .get(`/api/transactions/${transactionId}/attachments`)
      .set("Authorization", `Bearer ${token}`);
    expect(listRes.body).toHaveLength(1);

    fs.unlinkSync(filePath);
  });

  it("rejects a disallowed file type", async () => {
    const { token, accountId } = await registerUserWithAccount();
    const transactionId = await createTransaction(token, accountId);
    const filePath = writeTempFile("evil.txt", "not an image");

    const res = await request(app)
      .post(`/api/transactions/${transactionId}/attachments`)
      .set("Authorization", `Bearer ${token}`)
      .attach("file", filePath, { filename: "evil.txt", contentType: "text/plain" });

    expect(res.status).toBe(400);

    fs.unlinkSync(filePath);
  });

  it("downloads and deletes an uploaded attachment", async () => {
    const { token, accountId } = await registerUserWithAccount();
    const transactionId = await createTransaction(token, accountId);
    const filePath = writeTempFile("receipt.png", Buffer.from(PNG_BASE64, "base64"));

    const uploadRes = await request(app)
      .post(`/api/transactions/${transactionId}/attachments`)
      .set("Authorization", `Bearer ${token}`)
      .attach("file", filePath, { filename: "receipt.png", contentType: "image/png" });
    const attachmentId = uploadRes.body.id;

    const downloadRes = await request(app)
      .get(`/api/attachments/${attachmentId}`)
      .set("Authorization", `Bearer ${token}`);
    expect(downloadRes.status).toBe(200);
    expect(downloadRes.headers["content-type"]).toBe("image/png");

    const deleteRes = await request(app)
      .delete(`/api/attachments/${attachmentId}`)
      .set("Authorization", `Bearer ${token}`);
    expect(deleteRes.status).toBe(200);

    const afterDelete = await request(app)
      .get(`/api/attachments/${attachmentId}`)
      .set("Authorization", `Bearer ${token}`);
    expect(afterDelete.status).toBe(404);

    fs.unlinkSync(filePath);
  });

  it("can't upload to, list, or download another user's transaction's attachments", async () => {
    const owner = await registerUserWithAccount();
    const stranger = await registerUserWithAccount();
    const transactionId = await createTransaction(owner.token, owner.accountId);
    const filePath = writeTempFile("receipt.png", Buffer.from(PNG_BASE64, "base64"));

    const uploadRes = await request(app)
      .post(`/api/transactions/${transactionId}/attachments`)
      .set("Authorization", `Bearer ${stranger.token}`)
      .attach("file", filePath, { filename: "receipt.png", contentType: "image/png" });
    expect(uploadRes.status).toBe(404);

    const listRes = await request(app)
      .get(`/api/transactions/${transactionId}/attachments`)
      .set("Authorization", `Bearer ${stranger.token}`);
    expect(listRes.status).toBe(404);

    // Загружаем настоящим владельцем, затем пробуем скачать/удалить чужаком
    const ownerUpload = await request(app)
      .post(`/api/transactions/${transactionId}/attachments`)
      .set("Authorization", `Bearer ${owner.token}`)
      .attach("file", filePath, { filename: "receipt.png", contentType: "image/png" });
    const attachmentId = ownerUpload.body.id;

    const downloadRes = await request(app)
      .get(`/api/attachments/${attachmentId}`)
      .set("Authorization", `Bearer ${stranger.token}`);
    expect(downloadRes.status).toBe(404);

    const deleteRes = await request(app)
      .delete(`/api/attachments/${attachmentId}`)
      .set("Authorization", `Bearer ${stranger.token}`);
    expect(deleteRes.status).toBe(404);

    fs.unlinkSync(filePath);
  });
});
