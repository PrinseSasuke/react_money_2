#!/usr/bin/env python3
"""Chaos experiment runner for the react-money k3s stand.

    chaos list                      experiments available in this folder
    chaos run 01-overload-300ms     load -> baseline -> chaos -> recovery -> report
    chaos run all                   every experiment in order, with cooldowns
    chaos status                    what is running right now
    chaos stop                      emergency: remove runner chaos + load
    chaos report NAME --load-start ... --chaos-start ... --chaos-end ... --load-end ...
                                    build a report for a run done by hand (times are local)
"""
import argparse
import csv
import datetime as dt
import json
import math
import re
import subprocess
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

import yaml

from gen_chaos_dashboards import BE, DASHBOARDS, NS, Q

HERE = Path(__file__).resolve().parent
RESULTS = HERE / "results"
LOAD_FILE = HERE / "k6-api-me.yaml"
APP_NS, LOAD_NS, LOAD_JOB = "react-money", "loadtest", "k6-api-me"
CHAOS_KINDS = ["networkchaos", "podchaos", "dnschaos", "timechaos", "stresschaos", "iochaos", "httpchaos"]
RUN_LABEL = "chaos-run"
GRAFANA = "http://localhost:3001"
DASH = {uid.split("-")[1]: uid for uid, *_ in DASHBOARDS}

try:
    from zoneinfo import ZoneInfo
    TZ = ZoneInfo("Europe/Moscow")
except Exception:
    TZ = dt.timezone(dt.timedelta(hours=3))

# Experiments that need more than "apply the YAML and wait for its duration".
SPECIAL = {
    "04-kill-backend": {"observe": 300, "mttr": "ready_backend"},
    "05-kill-postgres": {"observe": 300, "mttr": "ready_postgres", "downtime": "pg_up"},
    "06-dns-error": {"extra": [(60, "04-kill-backend")]},
}

_rps = f"rate(traefik_service_requests_total{{{BE}}}[30s])"
SERIES = {
    "chaos": f"max({Q['chaos']})",
    "lat_mean_s": Q["lat_mean"],
    "lat_p95_s": Q["lat_p95"],
    "rps_total": f"sum({_rps})",
    "rps_4xx": f'sum(rate(traefik_service_requests_total{{{BE},code=~"4.."}}[30s])) or on() vector(0)',
    "rps_5xx": f'sum(rate(traefik_service_requests_total{{{BE},code=~"5.."}}[30s])) or on() vector(0)',
    "err_pct": Q["err_pct"],
    "open_conns": Q["open_conns"],
    "ready_backend": Q["ready_backend"],
    "ready_postgres": Q["ready_postgres"],
    "restarts": f"sum(kube_pod_container_status_restarts_total{{{NS}}})",
    "hpa_replicas": f"sum({Q['hpa_cur']})",
    "cpu_cores": Q["cpu_sum"],
    "cpu_pct_req": Q["cpu_pct_req"],
    "mem_bytes": Q["mem_sum"],
    "pg_up": f"max({Q['pg_up']})",
    "pg_tps": Q["pg_tps"],
    "pg_active": 'sum(pg_stat_activity_count{datname="react_money",state="active"})',
}


# ---------- formatting ----------

def now():
    return time.time()


def fmt_t(ts):
    return dt.datetime.fromtimestamp(ts, TZ).strftime("%H:%M:%S")


def fmt_dur(sec):
    if sec is None:
        return "—"
    sec = int(round(sec))
    return f"{sec} с" if sec < 60 else f"{sec // 60} мин {sec % 60:02d} с"


def fmt_lat(v):
    if v is None:
        return "—"
    if v < 0.01:
        return f"{v * 1000:.1f} мс"
    return f"{v * 1000:.0f} мс" if v < 1 else f"{v:.1f} с"


def fmt_num(v, digits=1, suffix=""):
    return "—" if v is None else f"{v:.{digits}f}{suffix}"


def fmt_mb(v):
    return "—" if v is None else f"{v / 1e6:.0f} МБ"


class Log:
    def __init__(self):
        self.file = None

    def attach(self, path):
        self.file = open(path, "a", encoding="utf-8")

    def __call__(self, icon, msg):
        line = f"[{fmt_t(now())}] {icon} {msg}"
        print(line, flush=True)
        if self.file:
            self.file.write(line + "\n")
            self.file.flush()


log = Log()


# ---------- cluster access ----------

def kubectl(*args, input=None, check=True):
    p = subprocess.run(["kubectl", *args], input=input, capture_output=True, text=True)
    if check and p.returncode != 0:
        raise RuntimeError(f"kubectl {' '.join(args)}: {p.stderr.strip()}")
    return p.stdout


def _num(v):
    f = float(v)
    return None if math.isnan(f) or math.isinf(f) else f


class Prom:
    def __init__(self):
        ip = kubectl("-n", "monitoring", "get", "svc", "prometheus", "-o", "jsonpath={.spec.clusterIP}").strip()
        self.base = f"http://{ip}:9090/api/v1"

    def _get(self, path, params):
        url = f"{self.base}/{path}?{urllib.parse.urlencode(params)}"
        with urllib.request.urlopen(url, timeout=30) as r:
            return json.load(r)["data"]["result"]

    def instant(self, q):
        res = self._get("query", {"query": q})
        return _num(res[0]["value"][1]) if res else None

    def range(self, q, start, end, step=5):
        res = self._get("query_range", {"query": q, "start": f"{start:.0f}", "end": f"{end:.0f}", "step": step})
        return {float(ts): _num(v) for ts, v in res[0]["values"]} if res else {}


def parse_duration(s):
    if not s:
        return None
    total = 0
    for n, unit in re.findall(r"(\d+)(ms|s|m|h)", str(s)):
        total += int(n) * {"ms": 0.001, "s": 1, "m": 60, "h": 3600}[unit]
    return total or None


def parse_ts(s):
    return dt.datetime.strptime(s.replace("Z", "+0000"), "%Y-%m-%dT%H:%M:%S%z").timestamp()


def experiments():
    out = {}
    for f in sorted(HERE.glob("0*.yaml")):
        text = f.read_text(encoding="utf-8")
        head = [line[1:].strip() for line in text.splitlines() if line.startswith("#")]
        doc = yaml.safe_load(text)
        out[f.stem] = {
            "file": f,
            "title": head[0] if head else f.stem,
            "hypothesis": next((h.split(":", 1)[1].strip() for h in head if h.startswith("Гипотеза")), ""),
            "doc": doc,
            "kind": doc["kind"].lower(),
            "duration": parse_duration(doc["spec"].get("duration")),
        }
    return out


def chaos_objects():
    items = []
    for kind in CHAOS_KINDS:
        try:
            data = json.loads(kubectl("-n", APP_NS, "get", kind, "-o", "json"))
        except RuntimeError:
            continue
        for it in data["items"]:
            it["_kind"] = kind
            items.append(it)
    return items


def is_active(obj):
    st = obj.get("status") or {}
    conds = {c["type"]: c["status"] for c in st.get("conditions") or []}
    instant = obj["_kind"] == "podchaos" and obj["spec"].get("action") in ("pod-kill", "container-kill")
    return (st.get("experiment") or {}).get("desiredPhase") == "Run" and conds.get("AllRecovered") != "True" and not instant


def load_active():
    try:
        job = json.loads(kubectl("-n", LOAD_NS, "get", "job", LOAD_JOB, "-o", "json"))
    except RuntimeError:
        return False
    return (job.get("status") or {}).get("active", 0) > 0


def chaos_events(kind, name):
    obj = json.loads(kubectl("-n", APP_NS, "get", kind, name, "-o", "json"))
    st = obj.get("status") or {}
    conds = {c["type"]: c["status"] for c in st.get("conditions") or []}
    events = [e for r in (st.get("experiment") or {}).get("containerRecords") or [] for e in r.get("events") or []]
    applied = [parse_ts(e["timestamp"]) for e in events if e.get("operation") == "Apply"]
    recovered = [parse_ts(e["timestamp"]) for e in events if e.get("operation") == "Recover"]
    return conds, applied, recovered


# ---------- run steps ----------

def sleep_until(ts):
    while True:
        left = ts - now()
        if left <= 0:
            return
        time.sleep(min(5, left))


def wait_stable(timeout=600):
    deadline, said = now() + timeout, False
    while now() < deadline:
        hpa = json.loads(kubectl("-n", APP_NS, "get", "hpa", "backend", "-o", "json"))
        dep = json.loads(kubectl("-n", APP_NS, "get", "deploy", "backend", "-o", "json"))
        sts = json.loads(kubectl("-n", APP_NS, "get", "sts", "postgres", "-o", "json"))
        cur = (hpa.get("status") or {}).get("currentReplicas")
        ready = (dep.get("status") or {}).get("readyReplicas", 0)
        pg_ready = (sts.get("status") or {}).get("readyReplicas", 0)
        if cur == hpa["spec"]["minReplicas"] and ready == cur and pg_ready == 1:
            if said:
                log("✓", f"стенд в исходном состоянии: backend {ready}/{cur}, postgres готов")
            return
        if not said:
            log("⏳", f"жду исходного состояния стенда (backend {ready}/{cur}, HPA min {hpa['spec']['minReplicas']}, postgres {pg_ready}/1)")
            said = True
        time.sleep(10)
    raise RuntimeError("стенд не вернулся в исходное состояние за 10 минут")


def start_load(rate, seconds, run_id):
    docs = list(yaml.safe_load_all(LOAD_FILE.read_text(encoding="utf-8")))
    for doc in docs:
        if doc and doc["kind"] == "Job":
            doc["metadata"].setdefault("labels", {})[RUN_LABEL] = run_id
            for env in doc["spec"]["template"]["spec"]["containers"][0]["env"]:
                if env["name"] == "RATE":
                    env["value"] = str(rate)
                if env["name"] == "DURATION":
                    env["value"] = f"{int(seconds)}s"
    kubectl("-n", LOAD_NS, "delete", "job", LOAD_JOB, "--ignore-not-found", "--wait=true")
    kubectl("apply", "-f", "-", input=yaml.safe_dump_all(docs, allow_unicode=True))


def wait_traffic(prom, rate, timeout=150):
    deadline = now() + timeout
    while now() < deadline:
        rps = prom.instant(SERIES["rps_total"])
        if rps and rps >= 0.8 * rate:
            return rps, prom.instant(SERIES["lat_mean_s"])
        time.sleep(5)
    raise RuntimeError("трафик не дошёл до backend за 2.5 минуты — проверь под k6 в namespace loadtest")


def create_chaos(exp, run_id):
    doc = json.loads(json.dumps(exp["doc"]))
    doc["metadata"].setdefault("labels", {}).update({RUN_LABEL: "true", "chaos-run-id": run_id})
    return kubectl("create", "-f", "-", "-o", "jsonpath={.metadata.name}", input=yaml.safe_dump(doc, allow_unicode=True)).strip()


def wait_applied(kind, name, timeout=90):
    deadline = now() + timeout
    while now() < deadline:
        conds, applied, _ = chaos_events(kind, name)
        if applied:
            return min(applied)
        if conds.get("AllInjected") == "True":
            return now()
        time.sleep(2)
    raise RuntimeError(f"{kind}/{name} не применился за {timeout} с — смотри kubectl describe {kind} {name} -n {APP_NS}")


def wait_recovered(kind, name, timeout):
    deadline = now() + timeout
    while now() < deadline:
        conds, _, recovered = chaos_events(kind, name)
        if conds.get("AllRecovered") == "True" and recovered:
            return max(recovered)
        time.sleep(5)
    log("⚠", f"{name}: не дождался снятия хаоса за {fmt_dur(timeout)}, считаю от текущего момента")
    return now()


def wait_load_done(timeout):
    deadline = now() + timeout
    while now() < deadline:
        job = json.loads(kubectl("-n", LOAD_NS, "get", "job", LOAD_JOB, "-o", "json"))
        st = job.get("status") or {}
        if st.get("succeeded") or st.get("failed"):
            return parse_ts(st["completionTime"]) if st.get("completionTime") else now()
        time.sleep(10)
    raise RuntimeError("нагрузка не завершилась вовремя")


def cleanup(created, stop_load):
    for kind, name in created:
        kubectl("-n", APP_NS, "delete", kind, name, "--ignore-not-found", "--wait=false", check=False)
    if stop_load:
        kubectl("-n", LOAD_NS, "delete", "job", LOAD_JOB, "--ignore-not-found", "--wait=false", check=False)


# ---------- analysis & report ----------

def window(series, a, b):
    return [v for ts, v in sorted(series.items()) if a <= ts < b and v is not None]


def agg(vals, fn):
    return fn(vals) if vals else None


def mean(vals):
    return sum(vals) / len(vals)


def first_where(series, a, b, pred):
    for ts, v in sorted(series.items()):
        if a <= ts <= b and v is not None and pred(v):
            return ts
    return None


def analyze(data, t, special):
    base_w = (max(t["load_start"] + 45, t["chaos_start"] - 150), t["chaos_start"])
    during_w = (t["chaos_start"], t["during_end"])
    traffic = [ts for ts, v in data["rps_total"].items() if v and v > 1 and ts <= t["load_end"] + 15]
    last = max(traffic) if traffic else t["load_end"]
    after_w = (last - 120, last - 30)  # rate[30s] decays for 30 s after the load stops
    W = {"base": base_w, "during": during_w, "after": after_w}

    def stat(key, fn_by_phase):
        return {ph: agg(window(data[key], *W[ph]), fn) for ph, fn in fn_by_phase.items()}

    s = {
        "lat": stat("lat_mean_s", {"base": mean, "during": max, "after": mean}),
        "p95": stat("lat_p95_s", {"base": mean, "during": max, "after": mean}),
        "rps": stat("rps_total", {"base": mean, "during": min, "after": mean}),
        "err": stat("err_pct", {"base": max, "during": max, "after": max}),
        "r4xx": stat("rps_4xx", {"base": max, "during": max, "after": max}),
        "r5xx": stat("rps_5xx", {"base": max, "during": max, "after": max}),
        "ready_be": stat("ready_backend", {"base": min, "during": min, "after": min}),
        "ready_pg": stat("ready_postgres", {"base": min, "during": min, "after": min}),
        "pg_up": stat("pg_up", {"base": min, "during": min, "after": min}),
        "pg_tps": stat("pg_tps", {"base": mean, "during": min, "after": mean}),
        "hpa": stat("hpa_replicas", {"base": max, "during": max, "after": max}),
        "cpu": stat("cpu_cores", {"base": mean, "during": max, "after": mean}),
        "mem": stat("mem_bytes", {"base": max, "during": max, "after": max}),
        "conns": stat("open_conns", {"base": max, "during": max, "after": max}),
    }
    restarts = window(data["restarts"], t["load_start"], t["load_end"] + 10)
    s["restarts_delta"] = (restarts[-1] - restarts[0]) if restarts else None

    base_lat, base_rps = s["lat"]["base"], s["rps"]["base"]
    lat, err, rps = data["lat_mean_s"], data["err_pct"], data["rps_total"]

    def normal(ts):
        if base_lat is None or base_rps is None:
            return True
        l, e, r = lat.get(ts), err.get(ts), rps.get(ts)
        if l is None or r is None:
            return True
        return l <= max(3 * base_lat, base_lat + 0.05) and (e or 0) <= 1 and r >= 0.9 * base_rps

    stamps = sorted(lat)
    impact = next((ts for ts in stamps if t["chaos_start"] <= ts <= t["during_end"] + 60 and not normal(ts)), None)
    s["impact_after"] = impact - t["chaos_start"] if impact else None
    s["recovered_after"] = None
    if impact:
        ref = max(t["chaos_end"], impact)
        for ts in stamps:
            if ts >= ref and all(normal(x) for x in stamps if ts <= x <= ts + 30):
                s["recovered_after"] = ts - t["chaos_end"]
                break

    s["mttr"] = s["downtime"] = None
    if special.get("mttr"):
        ser = data[special["mttr"]]
        base = agg(window(ser, *base_w), max)
        if base is not None:
            drop = first_where(ser, t["chaos_start"], t["during_end"], lambda v: v < base)
            if drop:
                back = first_where(ser, drop + 1, t["load_end"], lambda v: v >= base)
                s["mttr"] = back - drop if back else None
    if special.get("downtime"):
        ser = data[special["downtime"]]
        down = first_where(ser, t["chaos_start"], t["during_end"], lambda v: v < 1)
        if down:
            up = first_where(ser, down + 1, t["load_end"], lambda v: v >= 1)
            s["downtime"] = up - down if up else None

    hpa_base = s["hpa"]["base"]
    scale = first_where(data["hpa_replicas"], t["chaos_start"], t["load_end"], lambda v: hpa_base is not None and v > hpa_base)
    s["hpa_scaled_after"] = scale - t["chaos_start"] if scale else None

    s["k8s_noticed"] = any([
        s["ready_be"]["during"] is not None and s["ready_be"]["base"] is not None and s["ready_be"]["during"] < s["ready_be"]["base"],
        s["ready_pg"]["during"] is not None and s["ready_pg"]["during"] < 1,
        (s["restarts_delta"] or 0) > 0,
        s["hpa_scaled_after"] is not None,
    ])
    return s


K6_KEYS = {
    "http_reqs": "Всего запросов",
    "http_req_failed": "Неуспешных запросов (k6)",
    "http_req_duration": "Время ответа",
    "dropped_iterations": "Не удалось отправить (генератор упёрся в лимит)",
}


def parse_k6(text):
    out = {}
    for line in text.splitlines():
        m = re.match(r"\s*([a-z_]+)\.{2,}:\s*(.+)$", line)
        if m and m.group(1) in K6_KEYS:
            out[m.group(1)] = re.sub(r"\s{2,}", " ", m.group(2).strip())
    return out


def grafana_link(name, t):
    uid = DASH.get(name[:2])
    if not uid:
        return None
    return f"{GRAFANA}/d/{uid}?from={int((t['load_start'] - 30) * 1000)}&to={int((t['load_end'] + 30) * 1000)}"


def write_report(rdir, name, exp, t, s, k6, created):
    link = grafana_link(name, t)
    instant = exp["duration"] is None
    L = [f"# {name}", "", f"**{exp['title']}**", ""]
    if exp["hypothesis"]:
        L += [f"**Гипотеза:** {exp['hypothesis']}", ""]
    L += [f"Дата: {dt.datetime.fromtimestamp(t['load_start'], TZ):%Y-%m-%d}, время московское.", ""]
    if link:
        L += [f"[Открыть в Grafana на этом отрезке]({link}) (нужен SSH-туннель на порт 3001)", ""]

    L += ["## Хронология", "", "| Событие | Время |", "|---|---|",
          f"| Нагрузка пошла | {fmt_t(t['load_start'])} |",
          f"| Хаос включён | {fmt_t(t['chaos_start'])} |"]
    L += [f"| Доп. шаг: {n} | {fmt_t(ts)} |" for n, ts in t.get("extra", [])]
    L += [f"| {'Конец окна наблюдения' if instant else 'Хаос снят'} | {fmt_t(t['during_end'])} |",
          f"| Нагрузка закончилась | {fmt_t(t['load_end'])} |", ""]
    if created:
        L += ["Объекты Chaos Mesh: " + ", ".join(f"`{k}/{n}`" for k, n in created), ""]

    during = "за окно наблюдения" if instant else "во время"
    rows = [
        ("Задержка API, среднее", s["lat"], fmt_lat, "среднее", "пик", "среднее"),
        ("Ответов в секунду", s["rps"], lambda v: fmt_num(v, 1), "среднее", "минимум", "среднее"),
        ("Неуспешных ответов (не 2xx)", s["err"], lambda v: fmt_num(v, 1, " %"), "макс", "макс", "макс"),
        ("Ответов 4xx в секунду", s["r4xx"], lambda v: fmt_num(v, 1), "макс", "макс", "макс"),
        ("Ответов 5xx в секунду", s["r5xx"], lambda v: fmt_num(v, 1), "макс", "макс", "макс"),
        ("Готовых подов backend", s["ready_be"], lambda v: fmt_num(v, 0), "мин", "мин", "мин"),
        ("Postgres готов (1 = да)", s["ready_pg"], lambda v: fmt_num(v, 0), "мин", "мин", "мин"),
        ("Postgres отвечает (pg_up)", s["pg_up"], lambda v: fmt_num(v, 0), "мин", "мин", "мин"),
        ("Транзакций в секунду в БД", s["pg_tps"], lambda v: fmt_num(v, 1), "среднее", "минимум", "среднее"),
        ("Реплик backend (HPA)", s["hpa"], lambda v: fmt_num(v, 0), "макс", "макс", "макс"),
        ("CPU backend, ядер", s["cpu"], lambda v: fmt_num(v, 3), "среднее", "пик", "среднее"),
        ("Память backend", s["mem"], fmt_mb, "макс", "макс", "макс"),
        ("Открытых соединений в Traefik", s["conns"], lambda v: fmt_num(v, 0), "макс", "макс", "макс"),
    ]
    L += ["## До / во время / после", "",
          f"| Метрика | До хаоса | {during.capitalize()} | После (последние 1.5 мин) |", "|---|---|---|---|"]
    for label, st, f, a, b, c in rows:
        if all(st[p] is None for p in ("base", "during", "after")):
            continue
        L.append(f"| {label} | {f(st['base'])} ({a}) | {f(st['during'])} ({b}) | {f(st['after'])} ({c}) |")
    L.append("")

    L += ["## Главное", ""]
    if s["impact_after"] is None:
        L.append("- **Пользователь:** заметного влияния нет (задержка, ошибки и число ответов остались в норме).")
    else:
        L.append(f"- **Пользователь почувствовал сбой** через {fmt_dur(s['impact_after'])} после включения хаоса.")
        rec = fmt_dur(s["recovered_after"]) if s["recovered_after"] is not None else "не восстановился до конца нагрузки"
        L.append(f"- **Восстановление:** {rec} после {'начала' if instant else 'снятия'} хаоса.")
    L.append(f"- **Kubernetes {'заметил' if s['k8s_noticed'] else 'НЕ заметил'} проблему** "
             f"(готовность backend: мин {fmt_num(s['ready_be']['during'], 0)}, перезапусков +{fmt_num(s['restarts_delta'], 0)}, "
             f"HPA: {'масштабировал через ' + fmt_dur(s['hpa_scaled_after']) if s['hpa_scaled_after'] is not None else 'не масштабировал'}).")
    if s["mttr"] is not None:
        L.append(f"- **MTTR:** {fmt_dur(s['mttr'])} от потери готовности до возврата (точность ±5 с, шаг метрик).")
    if s["downtime"] is not None:
        L.append(f"- **База недоступна (pg_up = 0):** {fmt_dur(s['downtime'])}.")
    L.append("")

    if k6:
        L += ["## Итог нагрузки (k6)", "", "| | |", "|---|---|"]
        L += [f"| {label} | {k6[key]} |" for key, label in K6_KEYS.items() if key in k6]
        L.append("")
    L += ["## Файлы", "", "- `timeseries.csv` — все метрики с шагом 5 с",
          "- `k6.txt` — полный вывод генератора нагрузки", "- `chaos.yaml`, `events.txt` — что применялось и события Chaos Mesh",
          "- `run.log` — журнал прогона", ""]
    (rdir / "report.md").write_text("\n".join(L), encoding="utf-8")


SUMMARY_HEAD = ("| Дата | Эксперимент | Задержка: норма → пик | Ответов/с: норма → мин | Ошибки, макс | "
                "Сбой почувствован через | Восстановление | Kubernetes заметил | MTTR | Реплик HPA, макс | Отчёт |\n"
                "|---|---|---|---|---|---|---|---|---|---|---|\n")


def append_summary(rdir, name, t, s):
    path = RESULTS / "summary.md"
    if not path.exists():
        path.write_text("# Сводка экспериментов\n\n" + SUMMARY_HEAD, encoding="utf-8")
    row = (f"| {dt.datetime.fromtimestamp(t['load_start'], TZ):%d.%m %H:%M} | {name} "
           f"| {fmt_lat(s['lat']['base'])} → {fmt_lat(s['lat']['during'])} "
           f"| {fmt_num(s['rps']['base'], 0)} → {fmt_num(s['rps']['during'], 0)} "
           f"| {fmt_num(s['err']['during'], 1, ' %')} | {fmt_dur(s['impact_after'])} | {fmt_dur(s['recovered_after'])} "
           f"| {'да' if s['k8s_noticed'] else 'нет'} | {fmt_dur(s['mttr'])} | {fmt_num(s['hpa']['during'], 0)} "
           f"| [report](./{rdir.name}/report.md) |\n")
    with path.open("a", encoding="utf-8") as f:
        f.write(row)


def collect(name, exp, t, rdir, prom, created, special):
    log("📊", "собираю метрики из Prometheus")
    start, end = t["load_start"] - 30, t["load_end"] + 15
    data = {k: prom.range(q, start, end) for k, q in SERIES.items()}
    stamps = sorted(set().union(*[d.keys() for d in data.values()]))
    with (rdir / "timeseries.csv").open("w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["time_msk"] + list(SERIES))
        for ts in stamps:
            w.writerow([fmt_t(ts)] + ["" if data[k].get(ts) is None else round(data[k][ts], 6) for k in SERIES])

    with (rdir / "chaos.yaml").open("w", encoding="utf-8") as fy, (rdir / "events.txt").open("w", encoding="utf-8") as fe:
        for kind, n in created:
            fy.write(kubectl("-n", APP_NS, "get", kind, n, "-o", "yaml", check=False) + "---\n")
            fe.write(kubectl("-n", APP_NS, "describe", kind, n, check=False) + "\n")

    k6_text = ""
    try:
        job = json.loads(kubectl("-n", LOAD_NS, "get", "job", LOAD_JOB, "-o", "json"))
        started = parse_ts(job["status"]["startTime"])
        if abs(started - t["load_start"]) <= 90:
            k6_text = kubectl("-n", LOAD_NS, "logs", f"job/{LOAD_JOB}", check=False)
        else:
            log("⚠", "итог k6 от другого запуска нагрузки — в отчёт не беру")
    except (RuntimeError, KeyError):
        log("⚠", "job нагрузки не найден — итога k6 в отчёте не будет")
    (rdir / "k6.txt").write_text(k6_text, encoding="utf-8")
    k6 = parse_k6(k6_text)

    s = analyze(data, t, special)
    write_report(rdir, name, exp, t, s, k6, created)
    append_summary(rdir, name, t, s)

    log("━", f"задержка {fmt_lat(s['lat']['base'])} → пик {fmt_lat(s['lat']['during'])}; "
             f"ответов/с {fmt_num(s['rps']['base'], 0)} → {fmt_num(s['rps']['during'], 0)}; "
             f"ошибки до {fmt_num(s['err']['during'], 1, ' %')}")
    log("━", f"сбой почувствован через {fmt_dur(s['impact_after'])}, восстановление {fmt_dur(s['recovered_after'])}, "
             f"Kubernetes {'заметил' if s['k8s_noticed'] else 'НЕ заметил'}"
             + (f", MTTR {fmt_dur(s['mttr'])}" if s["mttr"] is not None else ""))
    log("📁", f"отчёт: {rdir / 'report.md'}")


def run_experiment(name, args, prom):
    exps = experiments()
    if name not in exps:
        raise RuntimeError(f"нет эксперимента {name} — см. chaos list")
    exp, special = exps[name], SPECIAL.get(name, {})
    run_id = f"{dt.datetime.fromtimestamp(now(), TZ):%Y-%m-%d_%H%M}_{name}"[:63]
    rdir = RESULTS / run_id
    rdir.mkdir(parents=True, exist_ok=True)
    log.attach(rdir / "run.log")
    log("▶", f"{name} — {exp['title']}")
    if exp["hypothesis"]:
        log("💡", f"гипотеза: {exp['hypothesis']}")

    active = [f"{o['_kind']}/{o['metadata']['name']}" for o in chaos_objects() if is_active(o)]
    if active:
        raise RuntimeError(f"уже идёт хаос: {', '.join(active)} — дождись окончания или chaos stop")
    if load_active():
        raise RuntimeError("уже идёт нагрузка (job loadtest/k6-api-me) — дождись окончания или chaos stop")
    wait_stable()

    window_len = exp["duration"] or special.get("observe") or args.observe
    load_len = args.baseline + window_len + args.recovery + 30
    created, t, done = [], {}, False
    try:
        start_load(args.rate, load_len, run_id)
        t["load_start"] = now()
        log("⏵", f"нагрузка: {args.rate} запросов/с на {fmt_dur(load_len)}")
        rps, lat = wait_traffic(prom, args.rate)
        log("✓", f"трафик идёт: {rps:.0f} ответов/с, задержка {fmt_lat(lat)}")
        log("⏳", f"снимаю «норму» до {fmt_t(t['load_start'] + args.baseline)}")
        sleep_until(t["load_start"] + args.baseline)

        cname = create_chaos(exp, run_id)
        created.append((exp["kind"], cname))
        t["chaos_start"] = wait_applied(exp["kind"], cname)
        log("⚡", f"хаос включён: {exp['kind']}/{cname}")

        t["extra"] = []
        for delay, extra_name in special.get("extra", []):
            sleep_until(t["chaos_start"] + delay)
            extra = exps[extra_name]
            en = create_chaos(extra, run_id)
            created.append((extra["kind"], en))
            t["extra"].append((extra_name, wait_applied(extra["kind"], en)))
            log("⚡", f"доп. шаг через {delay} с: {extra_name} ({extra['kind']}/{en})")

        if exp["duration"]:
            log("⏳", f"хаос идёт, должен сняться около {fmt_t(t['chaos_start'] + exp['duration'])}")
            t["chaos_end"] = t["during_end"] = wait_recovered(exp["kind"], cname, exp["duration"] + 120)
            log("✓", f"хаос снят через {fmt_dur(t['chaos_end'] - t['chaos_start'])}")
        else:
            t["chaos_end"], t["during_end"] = t["chaos_start"], t["chaos_start"] + window_len
            log("⏳", f"наблюдаю последствия до {fmt_t(t['during_end'])}")
            sleep_until(t["during_end"])

        log("⏳", "наблюдаю восстановление до конца нагрузки")
        t["load_end"] = wait_load_done(load_len + 300)
        log("⏹", "нагрузка закончилась")
        collect(name, exp, t, rdir, prom, created, special)
        done = True
    finally:
        cleanup(created, stop_load=not done)
        if not done:
            log("🧹", "прогон прерван: хаос снят, нагрузка остановлена")
        log.file = None


# ---------- commands ----------

def cmd_list(_args):
    for name, e in experiments().items():
        dur = fmt_dur(e["duration"]) if e["duration"] else "мгновенно"
        print(f"{name:22} {dur:>10}  {e['title']}")


def cmd_status(_args):
    objs = chaos_objects()
    print("Хаос в react-money:")
    for o in objs:
        conds = {c["type"]: c["status"] for c in (o.get("status") or {}).get("conditions") or []}
        state = "ИДЁТ" if is_active(o) else ("пауза" if conds.get("Paused") == "True" else "завершён")
        mark = " (дирижёр)" if (o["metadata"].get("labels") or {}).get(RUN_LABEL) else ""
        print(f"  {state:9} {o['_kind']}/{o['metadata']['name']}{mark}")
    if not objs:
        print("  нет")
    print(f"Нагрузка: {'ИДЁТ' if load_active() else 'нет'}")
    print(kubectl("-n", APP_NS, "get", "hpa,deploy", "--no-headers").rstrip())
    summary = RESULTS / "summary.md"
    if summary.exists():
        rows = [l for l in summary.read_text(encoding="utf-8").splitlines() if l.startswith("| ") and not l.startswith("| Дата")]
        if rows:
            print("Последние прогоны:")
            print("\n".join(rows[-5:]))


def cmd_stop(args):
    for o in chaos_objects():
        if args.all or (o["metadata"].get("labels") or {}).get(RUN_LABEL):
            kubectl("-n", APP_NS, "delete", o["_kind"], o["metadata"]["name"], "--ignore-not-found", "--wait=false", check=False)
            print(f"удалён {o['_kind']}/{o['metadata']['name']}")
    kubectl("-n", LOAD_NS, "delete", "job", LOAD_JOB, "--ignore-not-found", "--wait=false", check=False)
    print("нагрузка остановлена")


def cmd_run(args):
    prom = Prom()
    names = list(experiments()) if args.name == "all" else [args.name]
    failed = []
    for i, name in enumerate(names):
        if i:
            log("💤", f"пауза {fmt_dur(args.cooldown)} перед следующим экспериментом")
            time.sleep(args.cooldown)
        try:
            run_experiment(name, args, prom)
        except KeyboardInterrupt:
            log("✋", "остановлено вручную")
            raise SystemExit(130)
        except Exception as e:
            log("✗", f"{name}: {e}")
            failed.append(name)
    if len(names) > 1:
        log("🏁", f"серия закончена: {len(names) - len(failed)} из {len(names)} успешно"
                 + (f", упали: {', '.join(failed)}" if failed else "") + f". Сводка: {RESULTS / 'summary.md'}")
    if failed:
        raise SystemExit(1)


def cmd_report(args):
    exps = experiments()
    if args.name not in exps:
        raise SystemExit(f"нет эксперимента {args.name}")
    exp, special = exps[args.name], SPECIAL.get(args.name, {})

    def local(s):
        return dt.datetime.strptime(s, "%Y-%m-%d %H:%M:%S").replace(tzinfo=TZ).timestamp()

    t = {"load_start": local(args.load_start), "chaos_start": local(args.chaos_start),
         "chaos_end": local(args.chaos_end), "load_end": local(args.load_end), "extra": []}
    t["during_end"] = t["chaos_end"] if exp["duration"] else t["chaos_start"] + (special.get("observe") or 300)
    rdir = RESULTS / f"{dt.datetime.fromtimestamp(t['load_start'], TZ):%Y-%m-%d_%H%M}_{args.name}_manual"
    rdir.mkdir(parents=True, exist_ok=True)
    log.attach(rdir / "run.log")
    log("▶", f"отчёт по ручному прогону {args.name}")
    collect(args.name, exp, t, rdir, Prom(), [], special)


def main():
    p = argparse.ArgumentParser(prog="chaos", description="Хаос-эксперименты на стенде react-money")
    sub = p.add_subparsers(dest="cmd", required=True)
    sub.add_parser("list", help="список экспериментов").set_defaults(fn=cmd_list)
    sub.add_parser("status", help="что идёт сейчас").set_defaults(fn=cmd_status)
    st = sub.add_parser("stop", help="аварийно снять хаос дирижёра и нагрузку")
    st.add_argument("--all", action="store_true", help="снять вообще весь хаос в react-money")
    st.set_defaults(fn=cmd_stop)
    r = sub.add_parser("run", help="провести эксперимент (или all)")
    r.add_argument("name")
    r.add_argument("--rate", type=int, default=100, help="запросов в секунду (100)")
    r.add_argument("--baseline", type=int, default=180, help="секунд «нормы» до хаоса (180)")
    r.add_argument("--recovery", type=int, default=180, help="секунд наблюдения после хаоса (180)")
    r.add_argument("--observe", type=int, default=300, help="окно для мгновенных экспериментов (300)")
    r.add_argument("--cooldown", type=int, default=120, help="пауза между экспериментами в all (120)")
    r.set_defaults(fn=cmd_run)
    rep = sub.add_parser("report", help="отчёт по ручному прогону (время московское, YYYY-MM-DD HH:MM:SS)")
    rep.add_argument("name")
    for a in ("--load-start", "--chaos-start", "--chaos-end", "--load-end"):
        rep.add_argument(a, required=True)
    rep.set_defaults(fn=cmd_report)
    args = p.parse_args()
    try:
        args.fn(args)
    except RuntimeError as e:
        sys.exit(f"ошибка: {e}")


if __name__ == "__main__":
    main()
