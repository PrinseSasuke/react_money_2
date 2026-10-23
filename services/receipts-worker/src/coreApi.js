const jwt = require("jsonwebtoken");
const { TemporaryError, PermanentError } = require("./errors");

// core-api only checks the JWT signature and takes userId from it, so the worker signs a 60-second token
// on behalf of the receipt's owner with the shared JWT_SECRET (ТЗ, section 10, question 3).
// Known limitation: the worker can act as any user; a service token is planned for the stand.
function createCoreApi({ coreApiUrl, jwtSecret, coreApiTimeoutMs, observe = () => {} }) {
  async function call(method, path, userId, body) {
    const token = jwt.sign({ userId }, jwtSecret, { expiresIn: 60 });
    const end = observe();
    let res;
    try {
      res = await fetch(coreApiUrl + path, {
        method,
        headers: { Authorization: `Bearer ${token}`, ...(body ? { "Content-Type": "application/json" } : {}) },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(coreApiTimeoutMs),
      });
    } catch (err) {
      end("network");
      throw new TemporaryError("core_api_unavailable", `core-api ${method} ${path}: ${err.name === "TimeoutError" ? "timeout" : err.message}`);
    }
    end(String(res.status));
    const text = await res.text();
    let json = null;
    try { json = text ? JSON.parse(text) : null; } catch { /* keep text */ }
    if (res.status >= 500 || res.status === 429) {
      throw new TemporaryError("core_api_unavailable", `core-api ${method} ${path} → ${res.status}`);
    }
    if (res.status >= 400) {
      throw new PermanentError("core_api_rejected", `core-api ${method} ${path} → ${res.status}: ${(json && json.error) || text}`);
    }
    return json;
  }

  return {
    // the oldest account of the user, the same default as core-api's bulk import
    async defaultAccountId(userId) {
      const accounts = await call("GET", "/api/accounts", userId);
      if (!Array.isArray(accounts) || accounts.length === 0) {
        throw new PermanentError("no_account", "the user has no account in core-api");
      }
      return accounts[0].id;
    },

    // externalId = the fiscal key: a repeated call returns the expense created the first time
    async createExpense(userId, { accountId, category, amount, purchasedAt, fiscalKey }) {
      const fn = fiscalKey.split(":")[0];
      const tx = await call("POST", "/api/transactions", userId, {
        type: "Расход",
        source: category || undefined, // core-api falls back to «Остальное»
        summ: amount,
        date: purchasedAt.toISOString(),
        description: `Чек ФН ${fn}`,
        account_id: accountId,
        externalId: fiscalKey,
      });
      return tx.id;
    },
  };
}

module.exports = { createCoreApi };
