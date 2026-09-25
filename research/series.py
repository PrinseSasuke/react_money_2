"""series.py — словарь серий метрик Prometheus для сборки датасета (этап M3).

Самостоятельная копия набора запросов из дипломной работы
(scripts/gen_chaos_dashboards.py::Q и scripts/chaos_run.py::SERIES), расширенная
сериями, специфичными для атак (§5.2 TZ). Копия, а НЕ импорт — по правилу
изоляции RULES.md §1.3 (файлы диплома не трогаем и не тянем зависимостями).

Каждая серия — PromQL, возвращающий один скаляр во времени (query_range).
Отсутствующие в стенде серии (нет экспортёра) вернут пусто — dataset build это
переживёт и отметит признак как недоступный (см. ограничения в TZ §8).
"""

NS = 'namespace="react-money"'
BE = 'service=~"react-money-backend.*"'

_rps = f"rate(traefik_service_requests_total{{{BE}}}[30s])"

# --- базовые серии (совпадают с SERIES диплома, только на чтение) ---
BASE = {
    "rps_total":   f"sum({_rps}) or on() vector(0)",
    "rps_4xx":     f'sum(rate(traefik_service_requests_total{{{BE},code=~"4.."}}[30s])) or on() vector(0)',
    "rps_5xx":     f'sum(rate(traefik_service_requests_total{{{BE},code=~"5.."}}[30s])) or on() vector(0)',
    "err_pct":     f'100 * (sum(rate(traefik_service_requests_total{{{BE},code!~"2.."}}[30s])) or on() vector(0)) / (sum({_rps}) > 0)',
    "lat_mean_s":  f"sum(rate(traefik_service_request_duration_seconds_sum{{{BE}}}[30s])) / sum(rate(traefik_service_request_duration_seconds_count{{{BE}}}[30s]))",
    "lat_p95_s":   f"histogram_quantile(0.95, sum by (le) (rate(traefik_service_request_duration_seconds_bucket{{{BE}}}[30s])))",
    "req_p99_s":   f"histogram_quantile(0.99, sum by (le) (rate(traefik_service_request_duration_seconds_bucket{{{BE}}}[30s])))",
    "open_conns":  'sum(traefik_open_connections{entrypoint="web"})',
    "ready_backend": f'sum(kube_pod_status_ready{{{NS},pod=~"backend-.*",condition="true"}})',
    "cpu_cores":   f'sum(rate(container_cpu_usage_seconds_total{{{NS},container="backend"}}[1m]))',
    "cpu_pct_req": f'100 * sum(rate(container_cpu_usage_seconds_total{{{NS},container="backend"}}[1m])) / sum(kube_pod_container_resource_requests{{{NS},container="backend",resource="cpu"}})',
    "mem_bytes":   f'sum(container_memory_working_set_bytes{{{NS},container="backend"}})',
    "hpa_replicas": f"sum(kube_horizontalpodautoscaler_status_current_replicas{{{NS}}})",
    "restarts":    f"sum(kube_pod_container_status_restarts_total{{{NS}}})",
    "pg_up":       "max(pg_up) or on() vector(0)",
    "pg_tps":      'sum(rate(pg_stat_database_xact_commit{datname="react_money"}[30s]))',
    "pg_active":   'sum(pg_stat_activity_count{datname="react_money",state="active"}) or on() vector(0)',
}

# --- серии, специфичные для атак (§5.2) ---
# Могут отсутствовать в стенде — тогда столбцы будут пустыми (проверяем на M3).
ATTACK = {
    # сигнатура brute-force: всплеск 401/403 на API
    "rps_401_403": f'sum(rate(traefik_service_requests_total{{{BE},code=~"401|403"}}[30s])) or on() vector(0)',
    # сигнатура эксфильтрации/флуда: сетевой трафик подов backend
    "net_tx_bytes": f'sum(rate(container_network_transmit_bytes_total{{{NS},pod=~"backend-.*"}}[30s])) or on() vector(0)',
    "net_rx_bytes": f'sum(rate(container_network_receive_bytes_total{{{NS},pod=~"backend-.*"}}[30s])) or on() vector(0)',
    # рост откатов транзакций при SQLi (нужен postgres_exporter; иначе пусто)
    "pg_rollbacks": 'sum(rate(pg_stat_database_xact_rollback{datname="react_money"}[30s])) or on() vector(0)',
}

SERIES = {**BASE, **ATTACK}

# Порядок признаков фиксирован для воспроизводимости CSV/npz (R-10, R-11).
FEATURE_ORDER = list(SERIES.keys())
