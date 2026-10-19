// Failure scenarios of the receipts service on the local docker compose (ТЗ, section 8, stage L3).
// Each scenario breaks something on purpose, then checks the expected result. Run from the repo root:
//   node scripts/scenarios.mjs all
//   node scripts/scenarios.mjs worker-stopped        (or any single name from SCENARIOS below)
// Needs the local environment up (docker compose -f deploy/local/docker-compose.yml up -d) and Node 24.
import { spawnSync } from "node:child_process";

const COMPOSE_FILE = "deploy/local/docker-compose.yml";
const CORE = "http://localhost:4000";
const API = "http://localhost:3100";
const WORKER_METRICS = "http://localhost:3101/metrics";
const EMAIL = process.env.E2E_EMAIL || "e2e@receipts.local.test";
const PASSWORD = process.env.E2E_PASSWORD || "e2e_local_password";

// ---------- helpers ----------

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let failures = 0;
const check = (ok, what, details = "") => {
  console.log(`  ${ok ? "OK  " : "FAIL"} ${what}${details ? `  (${details})` : ""}`);
  if (!ok) failures++;
  return ok;
};
const step = (text) => console.log(`  ·    ${text}`);

function compose(args, env = {}) {
  const r = spawnSync("docker", ["compose", "-f", COMPOSE_FILE, ...args], { encoding: "utf8", env: { ...process.env, ...env } });
  if (r.status !== 0) throw new Error(`docker compose ${args.join(" ")}: ${r.stderr.trim().split("\n").pop()}`);
  return r.stdout;
}
const nats = (args) => compose(["run", "--rm", "--no-deps", "-T", "--entrypoint", "nats", "nats-init", ...args]);
const natsJson = (args) => JSON.parse(nats([...args, "--json"]));

async function http(method, url, { token, body, form } = {}) {
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  let payload = form;
  if (body !== undefined) { payload = JSON.stringify(body); headers["Content-Type"] = "application/json"; }
  const t0 = performance.now();
  try {
    const res = await fetch(url, { method, headers, body: payload });
    const text = await res.text();
    let json; try { json = JSON.parse(text); } catch { json = text; }
    return { status: res.status, body: json, ms: Math.round(performance.now() - t0) };
  } catch (err) {
    return { status: 0, body: err.message, ms: Math.round(performance.now() - t0) };
  }
}

async function login() {
  const reg = await http("POST", `${CORE}/api/auth/register`, { body: { email: EMAIL, password: PASSWORD } });
  if (reg.status === 201) return reg.body.token;
  const res = await http("POST", `${CORE}/api/auth/login`, { body: { email: EMAIL, password: PASSWORD } });
  if (res.status !== 200) throw new Error(`cannot log in as ${EMAIL}: ${res.status}`);
  return res.body.token;
}

// a fresh fiscal receipt every call, so scenarios never collide with each other or earlier runs
let seq = 0;
function newQr() {
  seq++;
  const i = String((Date.now() % 1e8) * 10 + (seq % 10));
  return `t=20261019T1200&s=${(100 + seq).toFixed(2)}&fn=7380440700000001&i=${i}&fp=${i}&n=1`;
}
const postQr = (token, qr = newQr()) => http("POST", `${API}/api/receipts`, { token, body: { qr } });
const getReceipt = (token, id) => http("GET", `${API}/api/receipts/${id}`, { token }).then((r) => r.body);
// retried: core-api may be restarting right then, and an error must never be counted as a number
async function txCount(token) {
  for (let k = 0; k < 30; k++) {
    const r = await http("GET", `${CORE}/api/transactions`, { token });
    if (r.status === 200 && Array.isArray(r.body)) return r.body.length;
    await sleep(1000);
  }
  throw new Error("core-api does not answer GET /api/transactions");
}

async function waitFor(fn, timeoutMs, everyMs = 500) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    const v = await fn();
    if (v) return { value: v, ms: Date.now() - t0 };
    await sleep(everyMs);
  }
  return { value: null, ms: Date.now() - t0 };
}
const waitStatus = (token, id, statuses, timeoutMs) =>
  waitFor(async () => { const r = await getReceipt(token, id); return statuses.includes(r.status) ? r : null; }, timeoutMs);

async function waitAll(token, ids, timeoutMs) {
  const pending = new Set(ids);
  const done = {};
  const t0 = Date.now();
  while (pending.size && Date.now() - t0 < timeoutMs) {
    for (const id of [...pending]) {
      const r = await getReceipt(token, id);
      if (["parsed", "duplicate", "error"].includes(r.status)) { done[r.status] = (done[r.status] || 0) + 1; pending.delete(id); }
    }
    if (pending.size) await sleep(500);
  }
  return { done, left: pending.size, ms: Date.now() - t0 };
}

async function metric(name) {
  const r = await http("GET", WORKER_METRICS);
  if (r.status !== 200) return null;
  return r.body.split("\n").filter((l) => l.startsWith(name)).reduce((s, l) => s + Number(l.split(" ").pop()), 0);
}
const pending = () => natsJson(["consumer", "info", "RECEIPTS", "receipts-worker"]).num_pending;
const dlqCount = () => natsJson(["stream", "info", "RECEIPTS_DLQ"]).state.messages;

// recreate the worker with experiment settings (PARSER_DELAY_MS, ...); {} = back to defaults
function workerEnv(env) {
  // --no-deps: only the worker is recreated, core-api and the rest keep running
  compose(["up", "-d", "--wait", "--no-deps", "receipts-worker"], { PARSER_DELAY_MS: "0", PARSER_FAIL_RATE: "0", ...env });
}

// ---------- scenarios ----------

const SCENARIOS = {
  async "worker-stopped"(token) {
    console.log("\n▶ worker остановлен: 50 чеков ждут в очереди, после старта все обработаны");
    const before = await txCount(token);
    compose(["stop", "receipts-worker"]);
    const ids = [];
    for (let k = 0; k < 50; k++) ids.push((await postQr(token)).body.id);
    check(ids.every(Boolean), "50 чеков приняты, пока worker стоит");
    const q = await waitFor(async () => (pending() >= 50 ? pending() : null), 10000);
    check(q.value >= 50, "очередь выросла до 50", `num_pending = ${q.value ?? pending()}`);
    compose(["start", "receipts-worker"]);
    const res = await waitAll(token, ids, 90000);
    check(res.left === 0 && res.done.parsed === 50, "после старта все 50 → parsed, потерь нет", `${JSON.stringify(res.done)} за ${res.ms} мс`);
    check((await txCount(token)) - before === 50, "ровно 50 новых трат");
  },

  async "worker-killed"(token) {
    console.log("\n▶ worker убит посреди обработки (разбор 5 с): сообщение доставлено снова, трата одна");
    workerEnv({ PARSER_DELAY_MS: "5000" });
    const before = await txCount(token);
    const id = (await postQr(token)).body.id;
    const p = await waitStatus(token, id, ["processing"], 10000);
    check(Boolean(p.value), "worker взял чек в работу", `processing через ${p.ms} мс`);
    compose(["kill", "receipts-worker"]);
    step("docker kill во время разбора; запуск снова");
    compose(["start", "receipts-worker"]);
    const r = await waitStatus(token, id, ["parsed", "duplicate", "error"], 90000);
    check(r.value?.status === "parsed", "после повторной доставки → parsed", `через ${r.ms} мс (ack_wait 30 с + разбор 5 с)`);
    check(r.value?.attempts >= 2, "попыток больше одной", `attempts = ${r.value?.attempts}`);
    const after = await txCount(token);
    check(after - before === 1, "ровно одна трата", `${before} → ${after}`);
    workerEnv({});
  },

  async duplicates(token) {
    console.log("\n▶ дубли: тот же QR дважды и повтор сообщения с другим Nats-Msg-Id");
    const before = await txCount(token);
    const qr = newQr();
    const first = (await postQr(token, qr)).body.id;
    const a = await waitStatus(token, first, ["parsed", "duplicate", "error"], 20000);
    check(a.value?.status === "parsed", "первый чек → parsed");
    const second = (await postQr(token, qr)).body.id;
    const b = await waitStatus(token, second, ["parsed", "duplicate", "error"], 20000);
    check(b.value?.status === "duplicate" && b.value?.transactionId === a.value?.transactionId, "тот же QR → duplicate, ссылка на ту же трату");
    nats(["pub", "receipts.parse", JSON.stringify({ receiptId: first, source: "qr" }), "-H", `Nats-Msg-Id:replay-${first}`]);
    step("задача первого чека опубликована повторно с другим Nats-Msg-Id");
    await sleep(4000);
    check((await getReceipt(token, first)).status === "parsed", "повтор задачи не изменил чек");
    check((await txCount(token)) - before === 1, "трата одна на все три доставки");
  },

  async "storage-down"(token) {
    console.log("\n▶ SeaweedFS недоступен: фото → 503 за ≤ 3 с, QR принимается");
    compose(["stop", "seaweedfs"]);
    const form = new FormData();
    form.append("image", new Blob([Buffer.from("89504e470d0a1a0a", "hex")], { type: "image/png" }), "r.png");
    const photo = await http("POST", `${API}/api/receipts`, { token, form });
    check(photo.status === 503 && photo.ms <= 3000, "фото → 503", `${photo.status} ${photo.body?.error?.code} за ${photo.ms} мс`);
    const qr = await postQr(token);
    check(qr.status === 202, "QR → 202 без хранилища");
    const r = await waitStatus(token, qr.body.id, ["parsed", "duplicate", "error"], 20000);
    check(r.value?.status === "parsed", "QR-чек → parsed");
    compose(["start", "seaweedfs"]);
    const ready = await waitFor(async () => (await http("GET", `${API}/readyz`)).status === 200, 90000, 2000);
    check(Boolean(ready.value), "после подъёма readyz → 200", `через ${ready.ms} мс`);
  },

  async "queue-down"(token) {
    console.log("\n▶ NATS недоступен: 503 за ≤ 3 с, чек в error / queue_unavailable");
    compose(["stop", "nats"]);
    const res = await postQr(token);
    check(res.status === 503 && res.ms <= 3000, "QR → 503", `${res.status} ${res.body?.error?.code} за ${res.ms} мс`);
    const row = res.body?.error?.id ? await getReceipt(token, res.body.error.id) : null;
    check(row?.status === "error" && row?.error?.code === "queue_unavailable", "чек помечен error / queue_unavailable");
    compose(["start", "nats"]);
    const ready = await waitFor(async () => (await http("GET", `${API}/readyz`)).status === 200, 60000, 1000);
    check(Boolean(ready.value), "после подъёма NATS API снова готов, без перезапуска", `через ${ready.ms} мс`);
    const after = await postQr(token);
    const r = await waitStatus(token, after.body.id, ["parsed", "duplicate", "error"], 30000);
    check(r.value?.status === "parsed", "новый чек снова → parsed (worker переподключился сам)");
  },

  async "core-api-down"(token) {
    console.log("\n▶ core-api недоступен 1 минуту: повторы с задержкой, после подъёма → parsed");
    const retriesBefore = (await metric("receipts_retries_total")) || 0;
    compose(["stop", "core-api"]);
    const id = (await postQr(token)).body.id;
    await sleep(60000);
    const mid = await getReceipt(token, id);
    check(mid.status === "processing", "через минуту чек ждёт в processing", `attempts = ${mid.attempts}, ${mid.error?.code}`);
    compose(["start", "core-api"]);
    step("core-api поднят");
    const r = await waitStatus(token, id, ["parsed", "duplicate", "error"], 180000);
    check(r.value?.status === "parsed", "после подъёма → parsed", `ещё ${Math.round(r.ms / 1000)} с, attempts = ${r.value?.attempts}`);
    const retries = ((await metric("receipts_retries_total")) || 0) - retriesBefore;
    check(retries >= 3, "повторы видны в метрике receipts_retries_total", `+${retries}`);
  },

  async "core-api-long"(token) {
    console.log("\n▶ core-api недоступен дольше всех попыток: error / max_attempts и копия в DLQ");
    const dlqBefore = dlqCount();
    compose(["stop", "core-api"]);
    const id = (await postQr(token)).body.id;
    const r = await waitFor(async () => {
      const row = await http("GET", `${API}/api/receipts/${id}`, { token });
      return row.body.status === "error" ? row.body : null;
    }, 240000, 2000);
    check(r.value?.error?.code === "max_attempts", "после 5 попыток → error / max_attempts", `через ${Math.round(r.ms / 1000)} с`);
    check(dlqCount() - dlqBefore === 1, "копия задачи в receipts.dlq");
    compose(["start", "core-api"]);
    await waitFor(async () => (await http("GET", `${CORE}/api/health`)).status === 200, 60000, 1000);
  },

  async "slow-parser"(token) {
    console.log("\n▶ медленный разбор (3 с, 4 потока): очередь растёт, но всё обрабатывается");
    workerEnv({ PARSER_DELAY_MS: "3000" });
    const ids = [];
    for (let k = 0; k < 40; k++) ids.push((await postQr(token)).body.id);
    let maxPending = 0;
    let maxAge = 0;
    const sampler = setInterval(async () => {
      maxPending = Math.max(maxPending, (await metric("receipts_queue_pending")) || 0);
      maxAge = Math.max(maxAge, (await metric("receipts_queue_oldest_age_seconds")) || 0);
    }, 2000);
    const res = await waitAll(token, ids, 120000);
    clearInterval(sampler);
    check(res.left === 0 && res.done.parsed === 40, "все 40 → parsed", `за ${Math.round(res.ms / 1000)} с (расчёт ≈ 40 × 3 с / 4 = 30 с)`);
    check(maxPending > 0, "рост очереди виден в метриках", `receipts_queue_pending до ${maxPending}, старейшая задача до ${Math.round(maxAge)} с`);
    workerEnv({});
  },
};

// ---------- main ----------

const wanted = process.argv[2] || "all";
const names = wanted === "all" ? Object.keys(SCENARIOS) : [wanted];
if (!names.every((n) => SCENARIOS[n])) {
  console.log(`unknown scenario. Available: all, ${Object.keys(SCENARIOS).join(", ")}`);
  process.exit(2);
}
const token = await login();
for (const name of names) {
  try {
    await SCENARIOS[name](token);
  } catch (err) {
    check(false, `${name}: сценарий упал`, err.message);
    // leave the environment whole for the next scenario
    try { compose(["start", "nats", "seaweedfs", "core-api", "receipts-worker"]); } catch { /* ignore */ }
  }
}
console.log(failures ? `\nСЦЕНАРИИ: ${failures} проверок не прошли` : "\nСЦЕНАРИИ: все проверки прошли");
process.exit(failures ? 1 : 0);
