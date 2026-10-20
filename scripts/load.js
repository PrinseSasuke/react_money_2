// k6 scenario of stage L5 (ТЗ, section 8): 500 receipts in a minute through receipts-api.
// Every 10th request repeats the previous QR ~0.1 s later, so the worker meets two identical receipts at
// almost the same moment: expected 450 "parsed" + 50 "duplicate" and exactly 450 expenses.
// Normally started by scripts/load.mjs (it also checks the outcome in the database); by hand:
//   docker run --rm --network react-money-local_default -v C:/2/scripts:/scripts:ro grafana/k6:1.3.0 run /scripts/load.js
import http from "k6/http";
import { check, fail } from "k6";
import exec from "k6/execution";

const API = __ENV.API || "http://receipts-api:3100";
const CORE = __ENV.CORE || "http://core-api:4000";
const EMAIL = __ENV.E2E_EMAIL || "e2e@receipts.local.test";
const PASSWORD = __ENV.E2E_PASSWORD || "e2e_local_password";
const RUN = __ENV.RUN || String(Date.now() % 1e6); // 6 digits that make this run's fiscal numbers unique

export const options = {
  scenarios: {
    receipts: {
      executor: "constant-arrival-rate", // open model: new receipts keep coming even if answers slow down
      rate: Number(__ENV.RATE || 500),
      timeUnit: "1m",
      duration: __ENV.DURATION || "1m",
      preAllocatedVUs: 20,
      maxVUs: 100,
    },
  },
  thresholds: {
    "http_req_failed{name:post_receipt}": ["rate<0.01"],
    "http_req_duration{name:post_receipt}": ["p(95)<500"],
  },
  summaryTrendStats: ["avg", "p(50)", "p(95)", "p(99)", "max"],
};

export function setup() {
  const body = JSON.stringify({ email: EMAIL, password: PASSWORD });
  const params = { headers: { "Content-Type": "application/json" } };
  let res = http.post(`${CORE}/api/auth/login`, body, params);
  if (res.status !== 200) res = http.post(`${CORE}/api/auth/register`, body, params);
  if (![200, 201].includes(res.status)) fail(`cannot log in as ${EMAIL}: ${res.status}`);
  return { token: res.json("token") };
}

export default function (data) {
  const n = exec.scenario.iterationInTest;
  const source = n % 10 === 9 ? n - 1 : n; // the repeat carries the previous receipt's fiscal numbers
  const i = `${RUN}${String(source).padStart(4, "0")}`;
  const qr = `t=20261020T1200&s=${(100 + source / 100).toFixed(2)}&fn=7380440700000002&i=${i}&fp=${i}&n=1`;
  const res = http.post(`${API}/api/receipts`, JSON.stringify({ qr }), {
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.token}` },
    tags: { name: "post_receipt" },
  });
  check(res, { "202 accepted": (r) => r.status === 202 });
}
