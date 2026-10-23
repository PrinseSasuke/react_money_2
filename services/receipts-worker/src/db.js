const { Pool } = require("pg");

// The worker's view of the "receipts" schema. It never touches core-api tables (no access anyway).
function createDb({ databaseUrl, dbTimeoutMs }) {
  const pool = new Pool({ connectionString: databaseUrl, max: 10, connectionTimeoutMillis: dbTimeoutMs, query_timeout: dbTimeoutMs });

  return {
    async getReceipt(id) {
      const { rows } = await pool.query("SELECT * FROM receipts.receipts WHERE id = $1", [id]);
      return rows[0] || null;
    },

    async startProcessing(id) {
      await pool.query(
        `UPDATE receipts.receipts SET status = 'processing', attempts = attempts + 1, updated_at = now() WHERE id = $1`,
        [id]
      );
    },

    async saveParsed(id, { amount, purchasedAt, fiscalKey }) {
      await pool.query(
        `UPDATE receipts.receipts SET amount = $2, purchased_at = $3, fiscal_key = $4, updated_at = now() WHERE id = $1`,
        [id, amount, purchasedAt, fiscalKey]
      );
    },

    // Takes the fiscal key for this receipt. Returns the existing claim when another receipt already holds it.
    async claimFiscalKey(userId, fiscalKey, receiptId) {
      const inserted = await pool.query(
        `INSERT INTO receipts.fiscal_claims (user_id, fiscal_key, receipt_id) VALUES ($1, $2, $3)
         ON CONFLICT (user_id, fiscal_key) DO NOTHING RETURNING receipt_id`,
        [userId, fiscalKey, receiptId]
      );
      if (inserted.rows.length) return { ownedByUs: true };
      const { rows } = await pool.query(
        "SELECT receipt_id, transaction_id FROM receipts.fiscal_claims WHERE user_id = $1 AND fiscal_key = $2",
        [userId, fiscalKey]
      );
      // the same receipt after a crash between claiming and finishing: still ours
      return { ownedByUs: rows[0].receipt_id === receiptId, claim: rows[0] };
    },

    async finishParsed(receipt, transactionId) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await client.query(
          `UPDATE receipts.receipts SET status = 'parsed', transaction_id = $2, error_code = NULL, error_message = NULL,
             updated_at = now() WHERE id = $1`,
          [receipt.id, transactionId]
        );
        await client.query(
          "UPDATE receipts.fiscal_claims SET transaction_id = $3 WHERE user_id = $1 AND fiscal_key = $2",
          [receipt.user_id, receipt.fiscal_key, transactionId]
        );
        await client.query("COMMIT");
      } catch (err) {
        await client.query("ROLLBACK").catch(() => {});
        throw err;
      } finally {
        client.release();
      }
    },

    async finishDuplicate(id, transactionId, originalReceiptId) {
      await pool.query(
        `UPDATE receipts.receipts SET status = 'duplicate', transaction_id = $2, error_code = 'duplicate',
           error_message = $3, updated_at = now() WHERE id = $1`,
        [id, transactionId, `same fiscal receipt as ${originalReceiptId}`]
      );
    },

    async finishError(id, code, message) {
      await pool.query(
        `UPDATE receipts.receipts SET status = 'error', error_code = $2, error_message = $3, updated_at = now() WHERE id = $1`,
        [id, code, message]
      );
    },

    // a temporary failure: the receipt stays "processing", the reason is kept for whoever looks at it
    async noteRetry(id, code, message) {
      await pool.query(
        "UPDATE receipts.receipts SET error_code = $2, error_message = $3, updated_at = now() WHERE id = $1",
        [id, code, message]
      );
    },

    close: () => pool.end(),
  };
}

module.exports = { createDb };
