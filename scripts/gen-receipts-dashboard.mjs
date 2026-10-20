// Generates the Grafana dashboard of the receipts service (ТЗ, stage L4):
//   node scripts/gen-receipts-dashboard.mjs   →   deploy/local/grafana/dashboards/receipts.json
// Edit this script, not the JSON (Grafana loads the file read-only). Queries are the same ones the alerts use.
import { writeFileSync, mkdirSync } from "node:fs";

const PENDING = 'jetstream_consumer_num_pending{consumer_name="receipts-worker"}';
const API = 'receipts_http_request_duration_seconds';

const Q = {
  received: "sum by (source) (rate(receipts_received_total[1m]))",
  processed: "sum by (result) (rate(receipts_processed_total[1m]))",
  pending: PENDING,
  forecast: `clamp_min(predict_linear(${PENDING}[2m], 600), 0)`,
  ackPending: 'jetstream_consumer_num_ack_pending{consumer_name="receipts-worker"}',
  oldest: "receipts_queue_oldest_age_seconds",
  apiCodes: `sum by (code) (rate(${API}_count{route=~"/api/receipts.*"}[1m]))`,
  apiP50: `histogram_quantile(0.5, sum by (le) (rate(${API}_bucket{route="/api/receipts/"}[1m])))`,
  apiP95: `histogram_quantile(0.95, sum by (le) (rate(${API}_bucket{route="/api/receipts/"}[1m])))`,
  parseP95: "histogram_quantile(0.95, sum by (le) (rate(receipts_parse_duration_seconds_bucket[1m])))",
  coreP95: "histogram_quantile(0.95, sum by (le, code) (rate(receipts_core_api_duration_seconds_bucket[1m])))",
  retries: "sum by (reason) (rate(receipts_retries_total[1m]))",
  dlqTotal: 'jetstream_stream_total_messages{stream_name="RECEIPTS_DLQ"}',
  dlqUnwritten: 'sum(increase(receipts_dlq_total{status_written="false"}[30m])) or on() vector(0)',
  up: 'up{job=~"receipts-api|receipts-worker|nats|seaweedfs"}',
  alerts: 'sum by (alertname) (ALERTS{alertstate="firing"})',
};

const panel = (title, targets, { unit, desc, min = 0, step = false, stack = false } = {}) => ({
  type: "timeseries",
  title,
  description: desc || "",
  datasource: { type: "prometheus", uid: "prometheus" },
  fieldConfig: {
    defaults: {
      unit,
      min,
      custom: {
        lineInterpolation: step ? "stepAfter" : "smooth",
        fillOpacity: stack ? 40 : 10,
        stacking: { mode: stack ? "normal" : "none" },
        showPoints: "never",
      },
    },
    overrides: [],
  },
  options: { legend: { displayMode: "list", placement: "bottom" }, tooltip: { mode: "multi" } },
  targets: targets.map(([expr, legend], i) => ({ expr, legendFormat: legend, refId: String.fromCharCode(65 + i) })),
});

const text = (title, content) => ({ type: "text", title, options: { mode: "markdown", content } });

// rows of [panel, width]; 24 columns per row
const rows = [
  [[text("Что здесь", [
    "Путь чека: **receipts-api** принимает → очередь **NATS** → **receipts-worker** разбирает → трата в **core-api**.",
    "Главный ранний сигнал — **длина очереди и её прогноз**: если прогноз уходит вверх, worker не успевает раньше, чем это заметят пользователи.",
    "Алерты: http://localhost:9090/alerts",
  ].join("\n\n")), 16], [panel("Сработавшие алерты", [[Q.alerts, "{{alertname}}"]], { step: true, desc: "ALERTS из Prometheus" }), 8]],
  [[panel("Очередь: ждут разбора и прогноз через 10 мин", [[Q.pending, "ждут"], [Q.forecast, "прогноз через 10 мин"], [Q.ackPending, "в работе у worker"]],
    { desc: "Из экспортёра NATS — видно и когда worker лежит. Прогноз = predict_linear за 2 мин; алерт при прогнозе > 1000" }), 12],
   [panel("Поток чеков: приняты и обработаны (в секунду)", [[Q.received, "принято: {{source}}"], [Q.processed, "обработано: {{result}}"]], { unit: "reqps" }), 12]],
  [[panel("Возраст самой старой задачи", [[Q.oldest, "старейшая задача"]], { unit: "s", desc: "Сколько ждёт чек, стоящий в очереди дольше всех (метрика worker)" }), 8],
   [panel("Разбор чека и вызов core-api, p95", [[Q.parseP95, "разбор"], [Q.coreP95, "core-api {{code}}"]], { unit: "s" }), 8],
   [panel("Повторы по причинам (в секунду)", [[Q.retries, "{{reason}}"]], { unit: "reqps", desc: "Временные ошибки: worker вернул задачу в очередь с задержкой" }), 8]],
  [[panel("receipts-api: ответы по кодам", [[Q.apiCodes, "{{code}}"]], { unit: "reqps", stack: true }), 8],
   [panel("receipts-api: время приёма чека", [[Q.apiP50, "p50"], [Q.apiP95, "p95"]], { unit: "s" }), 8],
   [panel("DLQ", [[Q.dlqTotal, "задач в receipts.dlq"], [Q.dlqUnwritten, "без записанного статуса (нужен человек)"]], { step: true }), 8]],
  [[panel("Сервисы живы (1 = да)", [[Q.up, "{{job}}"]], { step: true, desc: "up из Prometheus: отвечает ли /metrics" }), 24]],
];

const panels = [];
let y = 0;
let id = 1;
for (const row of rows) {
  let x = 0;
  const h = row[0][0].type === "text" ? 6 : 8;
  for (const [p, w] of row) {
    panels.push({ ...p, id: id++, gridPos: { x, y, w, h } });
    x += w;
  }
  y += h;
}

const dashboard = {
  uid: "receipts-local",
  title: "Сервис чеков",
  tags: ["receipts"],
  timezone: "browser",
  schemaVersion: 39,
  refresh: "5s",
  time: { from: "now-30m", to: "now" },
  panels,
};

const out = new URL("../deploy/local/grafana/dashboards/receipts.json", import.meta.url);
mkdirSync(new URL(".", out), { recursive: true });
writeFileSync(out, JSON.stringify(dashboard, null, 2) + "\n");
console.log(`wrote ${out.pathname} (${panels.length} panels)`);
