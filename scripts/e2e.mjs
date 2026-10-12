// End-to-end check of the receipts service on the local docker compose (ТЗ, section 8):
//   a QR receipt → "parsed" → the expense exists in core-api; the same QR again → "duplicate", no second expense.
// Run from the repo root with the local environment up:  node scripts/e2e.mjs
// No dependencies: Node 24 fetch only. The test user lives in the local core-api database only.
const CORE = process.env.CORE_API_URL || "http://localhost:4000";
const RECEIPTS = process.env.RECEIPTS_API_URL || "http://localhost:3100";
const EMAIL = process.env.E2E_EMAIL || "e2e@receipts.local.test";
const PASSWORD = process.env.E2E_PASSWORD || "e2e_local_password";
const TIMEOUT_MS = 30000;

let failed = false;
const check = (ok, what, details = "") => {
  console.log(`${ok ? "OK  " : "FAIL"} ${what}${details ? `  (${details})` : ""}`);
  if (!ok) failed = true;
  return ok;
};

async function json(method, url, token, body) {
  const res = await fetch(url, {
    method,
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  try { return { status: res.status, body: JSON.parse(text) }; } catch { return { status: res.status, body: text }; }
}

// register the test user once, log in on later runs
async function login() {
  const reg = await json("POST", `${CORE}/api/auth/register`, null, { email: EMAIL, password: PASSWORD, displayName: "e2e" });
  if (reg.status === 201) return reg.body.token;
  const res = await json("POST", `${CORE}/api/auth/login`, null, { email: EMAIL, password: PASSWORD });
  if (res.status !== 200) throw new Error(`cannot log in as ${EMAIL}: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body.token;
}

async function waitFinal(id, token) {
  const t0 = Date.now();
  while (Date.now() - t0 < TIMEOUT_MS) {
    const r = await json("GET", `${RECEIPTS}/api/receipts/${id}`, token);
    if (["parsed", "duplicate", "error"].includes(r.body.status)) return { ...r.body, ms: Date.now() - t0 };
    await new Promise((res) => setTimeout(res, 200));
  }
  return { status: "timeout", ms: Date.now() - t0 };
}

const token = await login();
check(Boolean(token), `logged in to core-api as ${EMAIL}`);

// a unique fiscal receipt per run, so repeated runs do not collide with earlier ones
const i = String(Date.now() % 1e9);
const sum = (100 + (Date.now() % 90000) / 100).toFixed(2);
const qr = `t=20261012T1530&s=${sum}&fn=7380440700000000&i=${i}&fp=${i}&n=1`;
const before = (await json("GET", `${CORE}/api/transactions`, token)).body.length;

const first = await json("POST", `${RECEIPTS}/api/receipts`, token, { qr });
check(first.status === 202, "QR accepted", `${first.status}, receipt ${first.body.id}`);
const done = await waitFinal(first.body.id, token);
check(done.status === "parsed", "receipt parsed", `${done.status} in ${done.ms} ms`);

if (done.transactionId) {
  const tx = await json("GET", `${CORE}/api/transactions/${done.transactionId}`, token);
  check(tx.status === 200 && tx.body.summ === Number(sum) && tx.body.type === "Расход",
    "expense exists in core-api", `${tx.body.summ} ₽, «${tx.body.description}»`);
}

const second = await json("POST", `${RECEIPTS}/api/receipts`, token, { qr });
check(second.status === 202, "the same QR accepted again", `receipt ${second.body.id}`);
const dup = await waitFinal(second.body.id, token);
check(dup.status === "duplicate" && dup.transactionId === done.transactionId,
  "second receipt is a duplicate of the first", `${dup.status}, same expense: ${dup.transactionId === done.transactionId}`);

const after = (await json("GET", `${CORE}/api/transactions`, token)).body.length;
check(after - before === 1, "exactly one expense created", `${before} → ${after}`);

console.log(failed ? "\nE2E FAILED" : "\nE2E PASSED");
process.exit(failed ? 1 : 0);
