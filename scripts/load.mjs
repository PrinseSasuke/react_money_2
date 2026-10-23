// Stage L5 (ТЗ, section 8): runs the k6 scenario scripts/load.js against the local compose, waits until the
// worker has finished every receipt, then checks in the database that nothing was lost or doubled.
//   node scripts/load.mjs                (500 receipts in 1 minute)
//   RATE=1000 DURATION=2m node scripts/load.mjs
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const COMPOSE = ["compose", "-f", "deploy/local/docker-compose.yml"];
const RATE = Number(process.env.RATE || 500);
const DURATION = process.env.DURATION || "1m";
const EMAIL = process.env.E2E_EMAIL || "e2e@receipts.local.test";
const RUN = String(Date.now() % 1e6);
const minutes = parseInt(DURATION, 10) / (DURATION.endsWith("s") ? 60 : 1);
const TOTAL = Math.round(RATE * minutes);

let failures = 0;
const check = (ok, what, details = "") => {
  console.log(`${ok ? "OK  " : "FAIL"} ${what}${details ? `  (${details})` : ""}`);
  if (!ok) failures++;
};
const sql = (q) => {
  const r = spawnSync("docker", [...COMPOSE, "exec", "-T", "postgres", "psql", "-U", "app", "-d", "react_money", "-tA", "-F", "|", "-c", q], { encoding: "utf8" });
  if (r.status !== 0) throw new Error(r.stderr);
  return r.stdout.trim();
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// the receipts of this run are recognised by their fiscal numbers: i starts with RUN
const MINE = `qr_raw LIKE '%&i=${RUN}%'`;
const userId = sql(`SELECT id FROM users WHERE email = '${EMAIL}'`);
if (!userId) throw new Error(`user ${EMAIL} not found — run scripts/e2e.mjs once first`);

console.log(`▶ ${TOTAL} чеков за ${DURATION} (каждый 10-й — повтор предыдущего QR), прогон ${RUN}`);
const out = mkdtempSync(join(tmpdir(), "k6-"));
const k6 = spawnSync("docker", [
  "run", "--rm", "--network", "react-money-local_default",
  "-v", `${process.cwd()}/scripts:/scripts:ro`, "-v", `${out}:/out`,
  "grafana/k6:1.3.0", "run", "--quiet", "--summary-export", "/out/summary.json",
  "-e", `RUN=${RUN}`, "-e", `RATE=${RATE}`, "-e", `DURATION=${DURATION}`, "/scripts/load.js",
], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
if (k6.status !== 0 && k6.status !== 99) throw new Error(`k6 failed: ${k6.stderr || k6.stdout}`); // 99 = a threshold failed
const s = JSON.parse(readFileSync(join(out, "summary.json"), "utf8")).metrics;
const dur = s["http_req_duration{name:post_receipt}"] || s.http_req_duration;
const failedRate = (s["http_req_failed{name:post_receipt}"] || s.http_req_failed).value;
const sent = s.iterations.count;
// k6's constant-arrival-rate may start one extra iteration exactly at the end, so 500 can be 501;
// what matters is that the expected outcome is computed from what was really sent
check(Math.abs(sent - TOTAL) <= 1, "k6 отправил все чеки", `${sent} из ${TOTAL}, ${s.iterations.rate.toFixed(1)}/с`);
const EXPECT = { duplicate: Math.floor(sent / 10), parsed: sent - Math.floor(sent / 10) };
check(failedRate < 0.01, "API принял почти все", `не 202: ${(failedRate * 100).toFixed(2)} %`);
check(dur["p(95)"] < 500, "p95 приёма чека < 500 мс", `p50 ${dur["p(50)"].toFixed(1)} мс, p95 ${dur["p(95)"].toFixed(1)} мс, max ${dur.max.toFixed(0)} мс`);

// wait until the worker has finished every receipt of the run
const t0 = Date.now();
let left;
do {
  left = Number(sql(`SELECT count(*) FROM receipts.receipts WHERE ${MINE} AND status IN ('accepted', 'processing')`));
  if (left) await sleep(1000);
} while (left && Date.now() - t0 < 300000);
check(left === 0, "worker закончил все чеки", `ещё ${Math.round((Date.now() - t0) / 1000)} с после конца нагрузки`);

const byStatus = Object.fromEntries(sql(`SELECT status, count(*) FROM receipts.receipts WHERE ${MINE} GROUP BY 1`)
  .split("\n").filter(Boolean).map((l) => l.split("|")).map(([k, v]) => [k, Number(v)]));
check(byStatus.parsed === EXPECT.parsed && byStatus.duplicate === EXPECT.duplicate && !byStatus.error,
  "статусы как ожидалось", `${JSON.stringify(byStatus)}, ожидалось ${JSON.stringify(EXPECT)}`);

const [tx, distinctKeys] = sql(`SELECT count(*), count(DISTINCT external_id) FROM transactions
  WHERE user_id = '${userId}' AND external_id LIKE '7380440700000002:${RUN}%'`).split("|").map(Number);
check(tx === EXPECT.parsed && distinctKeys === tx, "без потерь и дублей", `трат ${tx}, разных фискальных ключей ${distinctKeys}, ожидалось ${EXPECT.parsed}`);

const [p50, p95, max] = sql(`SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY d), percentile_cont(0.95) WITHIN GROUP (ORDER BY d), max(d)
  FROM (SELECT extract(epoch FROM updated_at - created_at) AS d FROM receipts.receipts WHERE ${MINE}) x`).split("|").map(Number);
console.log(`     время от приёма до готового статуса: p50 ${(p50 * 1000).toFixed(0)} мс, p95 ${(p95 * 1000).toFixed(0)} мс, max ${(max * 1000).toFixed(0)} мс`);

console.log(failures ? `\nL5: ${failures} проверок не прошли` : `\nL5: ${sent} чеков за ${DURATION} — без потерь и дублей`);
process.exit(failures ? 1 : 0);
