const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");

function createDb({ databaseUrl, dependencyTimeoutMs }) {
  const pool = new Pool({
    connectionString: databaseUrl,
    max: 10,
    // fail fast instead of hanging when Postgres is gone (ТЗ: answer within 3 s)
    connectionTimeoutMillis: dependencyTimeoutMs,
    query_timeout: dependencyTimeoutMs,
  });

  return {
    pool,

    async migrate() {
      const sql = fs.readFileSync(path.join(__dirname, "migrations", "init.sql"), "utf8");
      await pool.query(sql);
    },

    async ping() {
      await pool.query("SELECT 1");
    },

    async insertReceipt(r) {
      await pool.query(
        `INSERT INTO receipts.receipts (id, user_id, account_id, category, source, qr_raw, image_key, status, error_code, error_message)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [r.id, r.userId, r.accountId, r.category || null, r.source, r.qrRaw, r.imageKey, r.status, r.errorCode || null, r.errorMessage || null]
      );
    },

    /** an errored receipt whose error a new attempt can fix goes back to "accepted"; null if not allowed */
    async resetForRetry(id, userId, codes) {
      const { rows } = await pool.query(
        `UPDATE receipts.receipts SET status = 'accepted', error_code = NULL, error_message = NULL, updated_at = now()
         WHERE id = $1 AND user_id = $2 AND status = 'error' AND error_code = ANY($3)
         RETURNING *`,
        [id, userId, codes]
      );
      return rows[0] || null;
    },

    async markError(id, code, message) {
      await pool.query(
        `UPDATE receipts.receipts SET status = 'error', error_code = $2, error_message = $3, updated_at = now()
         WHERE id = $1`,
        [id, code, message]
      );
    },

    async getReceipt(id, userId) {
      const { rows } = await pool.query("SELECT * FROM receipts.receipts WHERE id = $1 AND user_id = $2", [id, userId]);
      return rows[0] || null;
    },

    async listReceipts(userId, limit, offset) {
      const { rows } = await pool.query(
        `SELECT * FROM receipts.receipts WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
        [userId, limit, offset]
      );
      return rows;
    },

    close: () => pool.end(),
  };
}

module.exports = { createDb };
