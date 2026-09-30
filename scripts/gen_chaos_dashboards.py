"""Generate Grafana dashboards for the Chaos Mesh experiments on the k3s stand.

Writes k8s/monitoring/grafana-dashboards-chaos.yaml (a ConfigMap, one JSON per dashboard).
Run from the repo root:  python scripts/gen_chaos_dashboards.py
"""
import json
from pathlib import Path

NS = 'namespace="react-money"'
BE = 'service=~"react-money-backend.*"'

Q = {
    "chaos": f'max by (kind) (chaos_controller_manager_chaos_experiments{{{NS},phase=~"(?i)running|injecting"}}) or on() vector(0)',
    "lat_mean": f"sum(rate(traefik_service_request_duration_seconds_sum{{{BE}}}[30s])) / sum(rate(traefik_service_request_duration_seconds_count{{{BE}}}[30s]))",
    "lat_p95": f"histogram_quantile(0.95, sum by (le) (rate(traefik_service_request_duration_seconds_bucket{{{BE}}}[30s])))",
    "lat_p99": f"histogram_quantile(0.99, sum by (le) (rate(traefik_service_request_duration_seconds_bucket{{{BE}}}[30s])))",
    "rps_code": f"sum by (code) (rate(traefik_service_requests_total{{{BE}}}[30s]))",
    "err_pct": f'100 * (sum(rate(traefik_service_requests_total{{{BE},code!~"2.."}}[30s])) or on() vector(0)) / sum(rate(traefik_service_requests_total{{{BE}}}[30s]))',
    "open_conns": 'sum(traefik_open_connections{entrypoint="web"})',
    "ready_backend": f'sum(kube_pod_status_ready{{{NS},pod=~"backend-.*",condition="true"}})',
    "ready_postgres": f'sum(kube_pod_status_ready{{{NS},pod="postgres-0",condition="true"}})',
    "ready_by_pod": f'kube_pod_status_ready{{{NS},pod=~"backend-.*|postgres-0",condition="true"}}',
    "restarts": f"sum by (pod) (kube_pod_container_status_restarts_total{{{NS}}})",
    "hpa_cur": f"kube_horizontalpodautoscaler_status_current_replicas{{{NS}}}",
    "hpa_des": f"kube_horizontalpodautoscaler_status_desired_replicas{{{NS}}}",
    "avail": f"kube_deployment_status_replicas_available{{{NS}}}",
    "waiting": f"sum by (pod, reason) (kube_pod_container_status_waiting_reason{{{NS}}}) > 0",
    "cpu_pod": f'sum by (pod) (rate(container_cpu_usage_seconds_total{{{NS},container="backend"}}[1m]))',
    "cpu_sum": f'sum(rate(container_cpu_usage_seconds_total{{{NS},container="backend"}}[1m]))',
    "cpu_pct_req": f'100 * sum(rate(container_cpu_usage_seconds_total{{{NS},container="backend"}}[1m])) / sum(kube_pod_container_resource_requests{{{NS},container="backend",resource="cpu"}})',
    "throttle": f'100 * sum by (pod) (rate(container_cpu_cfs_throttled_periods_total{{{NS},container="backend"}}[1m])) / sum by (pod) (rate(container_cpu_cfs_periods_total{{{NS},container="backend"}}[1m]))',
    "mem_pod": f'sum by (pod) (container_memory_working_set_bytes{{{NS},container="backend"}})',
    "mem_sum": f'sum(container_memory_working_set_bytes{{{NS},container="backend"}})',
    "pg_up": "pg_up",
    "pg_conns": 'sum by (state) (pg_stat_activity_count{datname="react_money"})',
    "pg_tps": 'sum(rate(pg_stat_database_xact_commit{datname="react_money"}[30s]))',
    "net_tx": f'sum by (pod) (rate(container_network_transmit_bytes_total{{{NS},pod=~"backend-.*"}}[30s]))',
}


def ts(title, targets, unit=None, desc=None, minv=None, maxv=None, step=False):
    fc = {"defaults": {"custom": {}}}
    if unit:
        fc["defaults"]["unit"] = unit
    if minv is not None:
        fc["defaults"]["min"] = minv
    if maxv is not None:
        fc["defaults"]["max"] = maxv
    if step:
        fc["defaults"]["custom"]["lineInterpolation"] = "stepAfter"
        fc["defaults"]["custom"]["fillOpacity"] = 30
    return {
        "type": "timeseries",
        "title": title,
        "description": desc or "",
        "fieldConfig": fc,
        "targets": [{"expr": Q[k], "legendFormat": legend, "refId": chr(65 + i)} for i, (k, legend) in enumerate(targets)],
    }


def text(title, md):
    return {"type": "text", "title": title, "options": {"mode": "markdown", "content": md}}


# Shared building blocks
P_CHAOS = lambda: ts("Хаос активен (1 = идёт эксперимент)", [("chaos", "{{kind}}")], minv=0, maxv=1, step=True,
                     desc="Фаза эксперимента из метрик Chaos Mesh")
P_LAT = lambda: ts("Задержка API (что ждёт пользователь)", [("lat_mean", "среднее"), ("lat_p95", "p95"), ("lat_p99", "p99")], "s",
                   desc="Через Traefik. p95/p99 точны только в пределах бакетов Traefik")
P_RPS = lambda: ts("Ответы backend в секунду по коду", [("rps_code", "{{code}}")], "reqps")
P_ERR = lambda: ts("Доля неуспешных ответов", [("err_pct", "не 2xx")], "percent", minv=0)
P_READY = lambda: ts("Готовность подов (1 = Ready)", [("ready_by_pod", "{{pod}}")], minv=0, maxv=1.2, step=True)
P_RESTARTS = lambda: ts("Перезапуски контейнеров", [("restarts", "{{pod}}")], minv=0, step=True)
P_REPLICAS = lambda: ts("Реплики: HPA и доступные", [("hpa_cur", "HPA текущие"), ("hpa_des", "HPA желаемые"), ("avail", "доступно: {{deployment}}")], minv=0, step=True)
P_OPEN = lambda: ts("Открытые соединения в Traefik", [("open_conns", "web")], desc="Включает простаивающие keep-alive соединения генератора")
P_CPU = lambda: ts("CPU backend", [("cpu_pod", "{{pod}}"), ("cpu_sum", "сумма")], "cores", minv=0)
P_MEM = lambda: ts("Память backend", [("mem_pod", "{{pod}}"), ("mem_sum", "сумма")], "bytes", minv=0)
P_PG_UP = lambda: ts("Postgres доступен (pg_up)", [("pg_up", "pg_up")], minv=0, maxv=1.2, step=True)
P_PG_CONNS = lambda: ts("Соединения к БД по состоянию", [("pg_conns", "{{state}}")], minv=0)
P_PG_TPS = lambda: ts("Транзакций в секунду в БД", [("pg_tps", "commit/s")], "ops", minv=0,
                      desc="Сколько запросов база реально обработала")
P_WAITING = lambda: ts("Контейнеры в ожидании (причина)", [("waiting", "{{pod}}: {{reason}}")], minv=0, step=True)
P_THROTTLE = lambda: ts("Троттлинг CPU (упёрлись в limit)", [("throttle", "{{pod}}")], "percent", minv=0)
P_CPU_PCT = lambda: ts("CPU от requests (метрика HPA, цель 70%)", [("cpu_pct_req", "backend")], "percent", minv=0)
P_NET = lambda: ts("Исходящий трафик backend", [("net_tx", "{{pod}}")], "Bps", minv=0)

COMMON = [
    [(P_LAT, 12), (P_RPS, 6), (P_ERR, 6)],
    [(P_READY, 8), (P_RESTARTS, 8), (P_REPLICAS, 8)],
]

DASHBOARDS = [
    ("chaos-01-overload", "01 · Граница перегрузки (сетевая задержка к БД)",
     "**Network → DELAY** backend → postgres (100 / 200 / 300 мс).\n\n"
     "Потолок ≈ 20 соединений / задержка. Пока он выше нагрузки — просто медленнее; ниже — очередь растёт без конца. "
     "Смотри: задержка и транзакции/с в БД против ответов/с.",
     [[(P_PG_TPS, 8), (P_PG_CONNS, 8), (P_OPEN, 8)], [(P_CPU, 12), (P_MEM, 12)]]),
    ("chaos-02-partition", "02 · Обрыв связи с БД (partition)",
     "**Network → PARTITION** backend → postgres.\n\n"
     "В пуле нет таймаута: запросы будут висеть, а не падать. Вопрос — когда (и появятся ли) ошибки. "
     "Health не ходит в БД, поэтому поды останутся Ready.",
     [[(P_PG_TPS, 8), (P_PG_CONNS, 8), (P_OPEN, 8)], [(P_NET, 12), (P_MEM, 12)]]),
    ("chaos-03-loss", "03 · Потеря пакетов до БД",
     "**Network → LOSS** 30% backend → postgres.\n\n"
     "Большинство запросов быстрые, часть ждёт переотправки TCP. Сравни **среднее** с **p95/p99**: "
     "среднее почти не меняется, хвост растёт.",
     [[(P_PG_TPS, 12), (P_OPEN, 12)]]),
    ("chaos-04-backend-kill", "04 · Падение пода backend под нагрузкой",
     "**Pod Fault → POD KILL** `app: backend`, mode `one`.\n\n"
     "MTTR: от провала готовности до нового Ready-пода. Сколько запросов потерялось (не 2xx) и сколько длилось.",
     [[(P_WAITING, 12), (P_CPU, 12)]]),
    ("chaos-05-postgres-kill", "05 · Падение Postgres",
     "**Pod Fault → POD KILL** `app: postgres`.\n\n"
     "Единственная копия БД: неизбежный простой. Смотри pg_up, ответы 500 от backend и как быстро backend "
     "восстанавливается после возврата базы.",
     [[(P_PG_UP, 8), (P_PG_CONNS, 8), (P_PG_TPS, 8)], [(P_WAITING, 24)]]),
    ("chaos-06-dns", "06 · Сбой DNS у backend",
     "**DNS Fault → ERROR** для `app: backend`.\n\n"
     "«Спящий» отказ: пул держит уже открытые соединения, поэтому сначала ничего не ломается. "
     "Проявится, когда понадобится новое соединение (например, после перезапуска пода backend).",
     [[(P_PG_CONNS, 12), (P_PG_TPS, 12)]]),
    ("chaos-07-clock", "07 · Сдвиг часов на backend",
     "**Clock Skew** `app: backend`, +31 день.\n\n"
     "Токены живут 30 дней: при сдвиге все считаются просроченными — ожидаем лавину **401** на графике кодов.",
     [[(P_CPU, 12), (P_MEM, 12)]]),
    ("chaos-08-cpu", "08 · Перегрузка CPU backend",
     "**Stress Test → CPU** на `app: backend`.\n\n"
     "Этот отказ Kubernetes видит: HPA должен добавить реплики. Смотри CPU от requests (цель HPA 70%), "
     "троттлинг и сколько реплик и за какое время появилось.",
     [[(P_CPU_PCT, 12), (P_CPU, 12)], [(P_THROTTLE, 12), (P_MEM, 12)]]),
]


def build(uid, title, about, specific):
    panels, y, pid = [], 0, 1

    def place(panel, w, h, x):
        nonlocal pid
        panel.update({"id": pid, "gridPos": {"h": h, "w": w, "x": x, "y": y}})
        pid += 1
        panels.append(panel)

    place(text("Что проверяем", about), 16, 5, 0)
    place(P_CHAOS(), 8, 5, 16)
    y += 5
    for row in COMMON + specific:
        x = 0
        for factory, w in row:
            place(factory(), w, 8, x)
            x += w
        y += 8
    return {
        "uid": uid, "title": title, "tags": ["chaos", "react-money"],
        "timezone": "browser", "schemaVersion": 39, "refresh": "5s",
        "time": {"from": "now-30m", "to": "now"}, "panels": panels,
    }


def main():
    out = [
        "# Generated by scripts/gen_chaos_dashboards.py — edit the script, not this file.",
        "apiVersion: v1",
        "kind: ConfigMap",
        "metadata:",
        "  name: grafana-dashboards-chaos",
        "  namespace: monitoring",
        "data:",
    ]
    for uid, title, about, specific in DASHBOARDS:
        body = json.dumps(build(uid, title, about, specific), ensure_ascii=False, indent=1)
        out.append(f"  {uid}.json: |")
        out.extend("    " + line for line in body.splitlines())
    path = Path(__file__).resolve().parent.parent / "k8s" / "monitoring" / "grafana-dashboards-chaos.yaml"
    path.write_text("\n".join(out) + "\n", encoding="utf-8", newline="\n")
    print(f"wrote {path} ({len(DASHBOARDS)} dashboards)")


if __name__ == "__main__":
    main()
