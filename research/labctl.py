#!/usr/bin/env python3
"""labctl — оркестратор исследовательского трека research/ids-ml.

Изолированный от дипломной работы инструмент: генерация размеченного датасета
(норма / сбой / атака) на собственном k3s-стенде и сравнение ML-детекторов.
Всё живёт в research/ и ns redlab; файлы диплома и чужие namespace'ы не меняются.

    labctl init                     применить изоляцию стенда (ns redlab + NetworkPolicy)
    labctl doctor [--egress-test]   проверить изоляцию и готовность стенда
    labctl scenario list|run|status|stop     (этапы M1–M2)
    labctl dataset build            (этап M3)
    labctl model train              (этап M4)

Стиль и подход намеренно повторяют scripts/chaos_run.py (kubectl через subprocess,
лог с иконкой и временем, чистый stdlib). Код при этом самостоятельный — импортов
из scripts/ нет по правилу изоляции (RULES.md §1.3).
"""
import argparse
import datetime as dt
import json
import math
import random
import re
import subprocess
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

import yaml

# Устойчивый к кодировке консоли вывод (Windows cp1251 иначе падает на эмодзи/кириллице).
for _s in (sys.stdout, sys.stderr):
    try:
        _s.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

HERE = Path(__file__).resolve().parent
K8S = HERE / "k8s"
SCEN_DIR = HERE / "scenarios"
RESULTS = HERE / "results"
JOURNAL = HERE / "journal.jsonl"

# --- окружение стенда (совпадает с диплома, но только на чтение) ---
APP_NS = "react-money"     # приложение — цель атак, НЕ меняется
LOAD_NS = "loadtest"       # k6-нагрузка — источник «нормы»
MON_NS = "monitoring"      # Prometheus — читаем метрики
REDLAB_NS = "redlab"       # наш изолированный ns для атак и sink
RESEARCH_BRANCH = "research/ids-ml"
NETPOL = "redlab-egress-lockdown"

# --- оркестрация прогонов ---
LOAD_JOB = "k6-api-me"                 # имя Job'а нагрузки в ns loadtest
RUN_LABEL = "labctl-run"               # метка, по которой находим и чистим наши объекты
# Виды Chaos Mesh, которые может создать сценарий-«сбой» (для status/stop).
CHAOS_KINDS = ["networkchaos", "podchaos", "dnschaos", "timechaos",
               "stresschaos", "iochaos", "httpchaos"]
BASELINE_S = 180        # 3 мин «нормы» до сценария (§4.1)
RECOVERY_S = 120        # окно восстановления после сценария
COOLDOWN_S = 120        # пауза между сценариями в `run all`
KILL_OBSERVE_S = 300    # окно наблюдения для мгновенных действий (pod-kill)

try:
    from zoneinfo import ZoneInfo
    TZ = ZoneInfo("Europe/Moscow")
except Exception:
    TZ = dt.timezone(dt.timedelta(hours=3))


# ---------- лог ----------

def _t():
    return dt.datetime.now(TZ).strftime("%H:%M:%S")


def log(icon, msg):
    print(f"[{_t()}] {icon} {msg}", flush=True)


# ---------- доступ к кластеру ----------

def kubectl(*args, input=None, check=True, timeout=60):
    p = subprocess.run(["kubectl", *args], input=input, capture_output=True,
                       text=True, timeout=timeout)
    if check and p.returncode != 0:
        raise RuntimeError(f"kubectl {' '.join(args)}: {p.stderr.strip()}")
    return p.stdout


def kubectl_ok(*args, timeout=60):
    try:
        kubectl(*args, check=True, timeout=timeout)
        return True
    except Exception:
        return False


def git_branch():
    try:
        return subprocess.run(
            ["git", "rev-parse", "--abbrev-ref", "HEAD"],
            capture_output=True, text=True, cwd=HERE,
        ).stdout.strip()
    except Exception:
        return "?"


def _num(v):
    try:
        f = float(v)
    except (TypeError, ValueError):
        return None
    return None if math.isnan(f) or math.isinf(f) else f


class Prom:
    """Клиент Prometheus по образцу chaos_run.py: находит svc в ns monitoring."""

    def __init__(self):
        ip = kubectl("-n", MON_NS, "get", "svc", "prometheus",
                     "-o", "jsonpath={.spec.clusterIP}").strip()
        if not ip:
            raise RuntimeError("не нашёл clusterIP svc prometheus в ns monitoring")
        self.base = f"http://{ip}:9090/api/v1"

    def _get(self, path, params):
        url = f"{self.base}/{path}?{urllib.parse.urlencode(params)}"
        with urllib.request.urlopen(url, timeout=30) as r:
            return json.load(r)["data"]["result"]

    def up(self):
        url = f"{self.base}/query?{urllib.parse.urlencode({'query': 'vector(1)'})}"
        with urllib.request.urlopen(url, timeout=15) as r:
            return json.load(r)["status"] == "success"

    def instant(self, q):
        res = self._get("query", {"query": q})
        return _num(res[0]["value"][1]) if res else None

    def range(self, q, start, end, step=10):
        res = self._get("query_range", {"query": q, "start": f"{start:.0f}",
                                        "end": f"{end:.0f}", "step": step})
        return {float(ts): _num(v) for ts, v in res[0]["values"]} if res else {}


# ---------- время ----------

def now():
    return time.time()


def parse_ts(s):
    return dt.datetime.strptime(s.replace("Z", "+0000"), "%Y-%m-%dT%H:%M:%S%z").timestamp()


def parse_duration(s):
    """'5m', '300ms', '2m30s' → секунды (float). None, если не распознано."""
    if not s:
        return None
    total = 0.0
    for n, unit in re.findall(r"(\d+)(ms|s|m|h)", str(s)):
        total += int(n) * {"ms": 0.001, "s": 1, "m": 60, "h": 3600}[unit]
    return total or None


def sleep_until(ts):
    while True:
        left = ts - now()
        if left <= 0:
            return
        time.sleep(min(5, left))


# ---------- init: применить изоляцию ----------

def cmd_init(_args):
    log("🚀", "Применяю изоляцию стенда (ns redlab + NetworkPolicy)…")
    kubectl("apply", "-f", str(K8S / "redlab-namespace.yaml"))
    log("✅", f"namespace {REDLAB_NS} готов")
    kubectl("apply", "-f", str(K8S / "redlab-networkpolicy.yaml"))
    log("✅", f"NetworkPolicy {NETPOL} применена (egress наружу закрыт)")
    log("👉", "Проверь изоляцию:  labctl doctor --egress-test")
    return 0


# ---------- doctor: проверки изоляции и готовности ----------

def _check(ok, name, detail_ok="", detail_bad=""):
    if ok:
        log("✅", f"{name}" + (f" — {detail_ok}" if detail_ok else ""))
    else:
        log("❌", f"{name}" + (f" — {detail_bad}" if detail_bad else ""))
    return ok


def _egress_test():
    """Пробуем достучаться из redlab до внешнего адреса. Успех = изоляция сломана."""
    log("🧪", "Egress-тест: под в redlab пытается выйти в интернет (ожидаем БЛОКировку)…")
    name = "redlab-egress-test"
    kubectl("-n", REDLAB_NS, "delete", "pod", name, "--ignore-not-found", check=False)
    cmd = ("wget -T 5 -q -O- http://1.1.1.1 >/dev/null 2>&1 && echo OPEN || echo BLOCKED")
    try:
        out = kubectl(
            "-n", REDLAB_NS, "run", name, "--rm", "-i", "--restart=Never",
            "--image=busybox:1.36", "--command", "--", "sh", "-c", cmd,
            check=False, timeout=90,
        )
    finally:
        kubectl("-n", REDLAB_NS, "delete", "pod", name, "--ignore-not-found", check=False)
    blocked = "BLOCKED" in out and "OPEN" not in out
    return _check(
        blocked, "egress в интернет заблокирован",
        detail_ok="под не смог выйти наружу (это правильно)",
        detail_bad="под ВЫШЕЛ в интернет — политика не исполняется! Проверь CNI/NetworkPolicy",
    )


def cmd_doctor(args):
    log("🩺", "Проверка изоляции и готовности стенда research/ids-ml")
    results = []

    # 1. git-ветка
    br = git_branch()
    results.append(_check(
        br == RESEARCH_BRANCH, f"git-ветка = {RESEARCH_BRANCH}",
        detail_bad=f"сейчас '{br}' — работай в ветке {RESEARCH_BRANCH} (RULES.md §1.1)",
    ))

    # 2. доступ к кластеру
    if not _check(kubectl_ok("version", "--request-timeout=10s"),
                  "kubectl видит кластер",
                  detail_bad="нет доступа к кластеру (KUBECONFIG?)"):
        log("🛑", "Без доступа к кластеру остальные проверки пропущены.")
        return 1

    # 3. ns redlab + метка
    ns_ok = kubectl_ok("get", "ns", REDLAB_NS)
    results.append(_check(ns_ok, f"namespace {REDLAB_NS} существует",
                          detail_bad="запусти: labctl init"))

    # 4. NetworkPolicy
    np_ok = ns_ok and kubectl_ok("-n", REDLAB_NS, "get", "networkpolicy", NETPOL)
    results.append(_check(np_ok, f"NetworkPolicy {NETPOL} применена",
                          detail_bad="запусти: labctl init"))

    # 5. Prometheus
    prom_ok = False
    try:
        prom_ok = Prom().up()
    except Exception as e:
        log("⚠️", f"Prometheus: {e}")
    results.append(_check(prom_ok, "Prometheus доступен (ns monitoring)",
                          detail_bad="подними Prometheus перед сбором данных"))

    # 6. цель атак — приложение живо
    app_ok = kubectl_ok("-n", APP_NS, "get", "deploy")
    results.append(_check(app_ok, f"приложение {APP_NS} доступно (цель атак)",
                          detail_bad=f"ns {APP_NS} не отвечает"))

    # 7. опциональный реальный egress-тест
    if getattr(args, "egress_test", False):
        if np_ok:
            results.append(_egress_test())
        else:
            results.append(_check(False, "egress-тест",
                                  detail_bad="сначала примени NetworkPolicy (labctl init)"))

    ok = all(results)
    print()
    if ok:
        log("🟢", "Изоляция цела, стенд готов.")
        return 0
    log("🔴", "Есть проблемы — см. ❌ выше. Атаки запускать нельзя, пока не зелено.")
    return 1


# ---------- заглушки следующих этапов ----------

def _stub(stage, what):
    log("🚧", f"{what} — этап {stage}, ещё не реализовано.")
    log("ℹ️", "См. план в research/TZ.md §7.")
    return 0


# ---------- сценарии (M1) ----------

# Селектор backend для проверки, что трафик дошёл (совпадает с dashboards диплома).
BE = 'service=~"react-money-backend.*"'
RPS_Q = f"sum(rate(traefik_service_requests_total{{{BE}}}[30s])) or on() vector(0)"

# Мгновенные действия PodChaos без duration — длительность задаёт наблюдение labctl.
_INSTANT_PODCHAOS = {"pod-kill", "container-kill"}


def _header(text):
    return [line[1:].strip() for line in text.splitlines() if line.startswith("#")]


def _tag(head, key):
    for h in head:
        if h.lower().startswith(key.lower()):
            return h.split(":", 1)[1].strip() if ":" in h else ""
    return None


def load_scenarios():
    """Читает research/scenarios/*.yaml → {name: info}. Класс берётся из имени NN-<class>-*."""
    out = {}
    for f in sorted(SCEN_DIR.glob("*.yaml")):
        stem = f.stem
        parts = stem.split("-")
        cls = parts[1] if len(parts) > 1 else "?"
        text = f.read_text(encoding="utf-8")
        head = _header(text)
        docs = [d for d in yaml.safe_load_all(text) if d]
        info = {
            "name": stem, "file": f, "class": cls, "docs": docs,
            "title": head[0] if head else stem,
            "tool": _tag(head, "Инструмент") or ("k6" if cls == "norm" else "chaos-mesh"),
            "technique": None, "kind": None, "duration": None, "action": None,
        }
        att = _tag(head, "ATT&CK")
        if att:
            m = re.search(r"T\d{3,4}", att)
            info["technique"] = m.group(0) if m else att
        # основной объект-воздействие: Chaos CRD (сбой) или Job (атака),
        # остальные документы (ConfigMap/Secret) применяются ПЕРЕД Job.
        info["exec_kind"] = None
        info["exec_doc"] = None
        info["exec_ns"] = APP_NS
        info["setup_docs"] = []
        for d in docs:
            k = str(d.get("kind", "")).lower()
            if k in CHAOS_KINDS:
                info["exec_kind"] = "chaos"
                info["kind"] = k
                info["action"] = (d.get("spec") or {}).get("action")
                info["duration"] = parse_duration((d.get("spec") or {}).get("duration"))
                info["exec_doc"] = d
                info["exec_ns"] = (d.get("metadata") or {}).get("namespace", APP_NS)
            elif k == "job":
                info["exec_kind"] = "job"
                info["kind"] = "job"
                info["exec_doc"] = d
                info["exec_ns"] = (d.get("metadata") or {}).get("namespace", REDLAB_NS)
                info["duration"] = (d.get("spec") or {}).get("activeDeadlineSeconds")
            elif k in ("configmap", "secret"):
                info["setup_docs"].append(d)
        out[stem] = info
    return out


def _apply_load(seconds, rate, run_id):
    """Применяет фон нормы (k6) из 00-norm-baseline.yaml на seconds секунд."""
    src = SCEN_DIR / "00-norm-baseline.yaml"
    docs = [d for d in yaml.safe_load_all(src.read_text(encoding="utf-8")) if d]
    for d in docs:
        if d.get("kind") == "Job":
            d["metadata"].setdefault("labels", {})[RUN_LABEL] = run_id
            for env in d["spec"]["template"]["spec"]["containers"][0]["env"]:
                if env.get("name") == "RATE":
                    env["value"] = str(rate)
                if env.get("name") == "DURATION":
                    env["value"] = f"{int(seconds)}s"
    kubectl("-n", LOAD_NS, "delete", "job", LOAD_JOB, "--ignore-not-found", "--wait=true")
    kubectl("apply", "-f", "-", input=yaml.safe_dump_all(docs, allow_unicode=True))


def _wait_traffic(prom, rate, timeout=150):
    deadline = now() + timeout
    while now() < deadline:
        rps = prom.instant(RPS_Q)
        if rps and rps >= 0.8 * rate:
            return rps
        time.sleep(5)
    raise RuntimeError("трафик не дошёл до backend за 2.5 мин — проверь под k6 в ns loadtest "
                       "и secret loadtest/loadtest-token")


def _stop_load():
    kubectl("-n", LOAD_NS, "delete", "job", LOAD_JOB, "--ignore-not-found",
            "--wait=false", check=False)


def _create_chaos(doc, run_id):
    """Создаёт Chaos-объект с меткой прогона, возвращает его сгенерированное имя."""
    d = json.loads(json.dumps(doc))
    d["metadata"].setdefault("labels", {}).update({RUN_LABEL: run_id})
    name = kubectl("create", "-f", "-", "-o", "jsonpath={.metadata.name}",
                   input=yaml.safe_dump(d, allow_unicode=True)).strip()
    return name


def _chaos_recovered(kind, name, timeout):
    """Ждёт снятия Chaos-объекта (AllRecovered). Возвращает момент снятия."""
    deadline = now() + timeout
    while now() < deadline:
        try:
            obj = json.loads(kubectl("-n", APP_NS, "get", kind, name, "-o", "json"))
        except RuntimeError:
            return now()
        conds = {c["type"]: c["status"] for c in (obj.get("status") or {}).get("conditions") or []}
        if conds.get("AllRecovered") == "True":
            return now()
        time.sleep(5)
    log("⚠️", f"{name}: не дождался снятия за {int(timeout)}с, считаю end_ts от текущего момента")
    return now()


def _ensure_redlab_token():
    """Копирует secret нагрузки в redlab как attack-token (нужен sqlmap для авторизации)."""
    try:
        d = json.loads(kubectl("-n", LOAD_NS, "get", "secret", "loadtest-token", "-o", "json"))
    except RuntimeError:
        log("⚠️", "нет secret loadtest/loadtest-token — sqli пойдёт без токена (слабее)")
        return
    d["metadata"] = {"name": "attack-token", "namespace": REDLAB_NS}
    d.pop("status", None)
    kubectl("apply", "-f", "-", input=json.dumps(d))


def _create_job(doc, run_id):
    """Создаёт атакующий Job с меткой прогона в его ns (redlab). Возвращает имя."""
    d = json.loads(json.dumps(doc))
    d["metadata"].setdefault("labels", {})[RUN_LABEL] = run_id
    ns = d["metadata"].get("namespace", REDLAB_NS)
    name = d["metadata"]["name"]
    kubectl("-n", ns, "delete", "job", name, "--ignore-not-found", "--wait=true", check=False)
    kubectl("create", "-f", "-", input=yaml.safe_dump(d, allow_unicode=True))
    return name


def _wait_job_done(ns, name, timeout):
    """Ждёт завершения Job (succeeded/failed). Атаки крутятся в цикле и падают по
    activeDeadlineSeconds (DeadlineExceeded) — это и есть конец окна атаки."""
    deadline = now() + timeout
    while now() < deadline:
        try:
            job = json.loads(kubectl("-n", ns, "get", "job", name, "-o", "json"))
        except RuntimeError:
            return now()
        st = job.get("status") or {}
        if st.get("succeeded") or st.get("failed"):
            return now()
        time.sleep(5)
    log("⚠️", f"job/{name}: не завершился за {int(timeout)}с, считаю end_ts от текущего момента")
    return now()


def _journal_write(row):
    with open(JOURNAL, "a", encoding="utf-8") as f:
        f.write(json.dumps(row, ensure_ascii=False) + "\n")
    log("📝", f"journal.jsonl ← {row['run_id']}")


def _set_job_env(doc, name, value):
    for c in doc["spec"]["template"]["spec"]["containers"]:
        for e in c.get("env", []):
            if e.get("name") == name:
                e["value"] = str(value)


def _variant(info, rng):
    """Параметры одного прогона. rng=None → значения из манифеста (без рандома).
    rng задан → варьируем интенсивность/длительность для разнообразия датасета (R-6).
    Возвращает (exec_doc, effect_s, observe_s, load_rate, intensity)."""
    cls, kind, name = info["class"], info.get("kind"), info["name"]
    doc = json.loads(json.dumps(info["exec_doc"])) if info["exec_doc"] else None
    load_rate = 100
    observe_s = KILL_OBSERVE_S
    effect_s = (6 * 60) if cls == "norm" else (info.get("duration") or KILL_OBSERVE_S)
    intensity = {"rate": load_rate, "duration_s": effect_s, "action": info.get("action")}
    if rng is None:
        return doc, effect_s, observe_s, load_rate, intensity

    load_rate = rng.choice([80, 90, 100, 110, 120])
    if cls == "norm":
        effect_s = rng.choice([300, 360, 420, 480])
        intensity = {"rate": load_rate, "duration_s": effect_s}
    elif kind == "networkchaos":
        lat = rng.choice([100, 150, 200, 300, 400]); dur = rng.choice([180, 240, 300, 360])
        doc["spec"]["delay"]["latency"] = f"{lat}ms"; doc["spec"]["duration"] = f"{dur}s"
        effect_s = dur
        intensity = {"rate": load_rate, "latency_ms": lat, "duration_s": dur}
    elif kind == "stresschaos":
        workers = rng.choice([1, 2]); load = rng.choice([70, 85, 100])
        dur = rng.choice([180, 240, 300, 360])
        doc["spec"]["stressors"]["cpu"]["workers"] = workers
        doc["spec"]["stressors"]["cpu"]["load"] = load
        doc["spec"]["duration"] = f"{dur}s"; effect_s = dur
        intensity = {"rate": load_rate, "cpu_workers": workers, "cpu_load": load, "duration_s": dur}
    elif kind == "podchaos":
        observe_s = rng.choice([180, 240, 300]); effect_s = observe_s
        intensity = {"rate": load_rate, "observe_s": observe_s, "action": info.get("action")}
    elif kind == "job":
        if name.endswith("flood"):
            r = rng.choice([1000, 2000, 3000, 4000, 5000]); dur = rng.choice([90, 120, 150])
            _set_job_env(doc, "RATE", r); _set_job_env(doc, "DURATION", f"{dur}s")
            doc["spec"]["activeDeadlineSeconds"] = dur + 30; effect_s = dur + 30
            intensity = {"rate": load_rate, "flood_rate": r, "duration_s": dur}
        else:  # bruteforce, sqli — варьируем длительность воздействия
            dur = rng.choice([120, 150, 180, 200])
            doc["spec"]["activeDeadlineSeconds"] = dur; effect_s = dur
            intensity = {"rate": load_rate, "duration_s": dur}
    return doc, effect_s, observe_s, load_rate, intensity


def _run_one(prom, info, rng=None):
    """Один прогон: нагрузка → baseline → сценарий → recovery → запись метки (R-1)."""
    cls = info["class"]
    ts_id = dt.datetime.now(TZ).strftime("%Y-%m-%dT%H-%M-%S")
    run_id = f"{ts_id}_{info['name']}"
    log("▶️", f"[{cls}] {info['title']}")

    exec_doc, effect_s, observe_s, load_rate, intensity = _variant(info, rng)
    load_s = (effect_s + 30) if cls == "norm" else (BASELINE_S + effect_s + RECOVERY_S + 30)

    created = None  # (kind, ns, name) — что удалить в finally
    row = {
        "run_id": run_id, "scenario": info["name"], "class": cls,
        "technique": info["technique"], "tool": info["tool"],
        "intensity": intensity,
        "baseline_start": None, "start_ts": None, "end_ts": None, "recovery_end": None,
        "target": f"{APP_NS}/backend", "notes": "",
    }
    try:
        log("🚀", f"нагрузка нормы {load_s}с ({load_rate} rps)…")
        _apply_load(load_s, load_rate, run_id)
        _wait_traffic(prom, load_rate)

        if cls == "norm":
            # весь прогон — «норма»: baseline_start == start_ts
            row["baseline_start"] = row["start_ts"] = now()
            log("⏱️", f"чистая норма {effect_s}с…")
            sleep_until(row["start_ts"] + effect_s)
            row["end_ts"] = row["recovery_end"] = now()
            return row

        row["baseline_start"] = now()
        log("⏱️", f"baseline {BASELINE_S}с…")
        sleep_until(row["baseline_start"] + BASELINE_S)

        row["start_ts"] = now()
        if info["exec_kind"] == "chaos":
            name = _create_chaos(exec_doc, run_id)
            created = (info["kind"], info["exec_ns"], name)
            log("💥", f"сбой применён: {info['kind']}/{name}")
            if info.get("action") in _INSTANT_PODCHAOS:
                sleep_until(row["start_ts"] + observe_s)  # мгновенное действие — наблюдаем окно
            else:
                _chaos_recovered(info["kind"], name, effect_s + 60)
        elif info["exec_kind"] == "job":
            _ensure_redlab_token()
            for d in info["setup_docs"]:
                kubectl("apply", "-f", "-", input=yaml.safe_dump(d, allow_unicode=True))
            name = _create_job(exec_doc, run_id)
            created = ("job", info["exec_ns"], name)
            log("💥", f"атака запущена: job/{name} в ns {info['exec_ns']}")
            _wait_job_done(info["exec_ns"], name, (effect_s or 200) + 30)
        else:
            raise RuntimeError(f"неизвестный тип воздействия у сценария {info['name']}")
    finally:
        if row["end_ts"] is None:
            row["end_ts"] = now()                            # R-1: интервал не теряется даже при сбое
        if created:
            k, ns, nm = created
            kubectl("-n", ns, "delete", k, nm, "--ignore-not-found",
                    "--wait=false", check=False)

    log("🌱", f"recovery {RECOVERY_S}с…")
    sleep_until(row["end_ts"] + RECOVERY_S)
    row["recovery_end"] = now()
    return row


def _doctor_gate(args):
    """Перед прогоном требуем зелёный doctor (R-2)."""
    log("🩺", "проверяю изоляцию перед прогоном…")
    if cmd_doctor(argparse.Namespace(egress_test=False)) != 0:
        raise RuntimeError("doctor не зелёный — прогон запрещён (RULES/R-2). Почини ❌ выше.")


def scenario_list(scens):
    if not scens:
        log("ℹ️", f"нет сценариев в {SCEN_DIR}")
        return 0
    log("📋", f"Сценарии в {SCEN_DIR}:")
    for name, i in scens.items():
        dur = f"{int(i['duration'])}с" if i["duration"] else ("6мин" if i["class"] == "norm" else "—")
        tech = f" · {i['technique']}" if i["technique"] else ""
        print(f"  {name:<26} [{i['class']:^6}] {i['tool']:<12} {dur:>6}{tech}")
    return 0


def scenario_status():
    log("🔎", "Что сейчас запущено на стенде:")
    load = kubectl("-n", LOAD_NS, "get", "job", LOAD_JOB, "--ignore-not-found",
                   "-o", "jsonpath={.status.active}", check=False).strip()
    print(f"  нагрузка (k6):   {'активна' if load else 'нет'}")
    for kind in CHAOS_KINDS:
        out = kubectl("-n", APP_NS, "get", kind, "-l", RUN_LABEL,
                      "-o", "jsonpath={.items[*].metadata.name}", check=False).strip()
        if out:
            print(f"  {kind}: {out}")
    jobs = kubectl("-n", REDLAB_NS, "get", "jobs", "-o",
                   "jsonpath={.items[*].metadata.name}", check=False).strip()
    print(f"  атаки (redlab):  {jobs or 'нет'}")
    return 0


def scenario_stop():
    """Идемпотентная зачистка стенда до «только норма/ничего» (R-4)."""
    log("🧹", "останавливаю нагрузку, Chaos-объекты и атакующие Job'ы…")
    _stop_load()
    for kind in CHAOS_KINDS:
        kubectl("-n", APP_NS, "delete", kind, "-l", RUN_LABEL,
                "--ignore-not-found", "--wait=false", check=False)
    kubectl("-n", REDLAB_NS, "delete", "jobs", "--all", "--ignore-not-found",
            "--wait=false", check=False)
    log("✅", "стенд очищен.")
    return 0


def cmd_scenario(args):
    scens = load_scenarios()
    if args.action == "list":
        return scenario_list(scens)
    if args.action == "status":
        return scenario_status()
    if args.action == "stop":
        return scenario_stop()

    # run
    _doctor_gate(args)
    prom = Prom()
    if args.name == "all":
        base = list(scens)
    elif args.name in scens:
        base = [args.name]
    else:
        log("💥", f"нет сценария '{args.name}'. Доступные: {', '.join(scens) or '—'} (или all)")
        return 1

    repeat = getattr(args, "repeat", None) or 1
    seed = getattr(args, "seed", None)
    # rng задаётся при повторах или явном seed → интенсивность варьируется (R-6);
    # одиночный ручной прогон без --repeat/--seed идёт на значениях из манифеста.
    randomize = repeat > 1 or seed is not None
    tasks = []  # (scenario_name, rng)
    for p in range(repeat):
        for nm in base:
            rng = random.Random(f"{seed if seed is not None else 0}-{p}-{nm}") if randomize else None
            tasks.append((nm, rng))

    log("🎬", f"прогонов: {len(tasks)} ({len(base)} сценариев × {repeat}"
             f"{', рандомизация' if randomize else ''})")
    ok = True
    for i, (nm, rng) in enumerate(tasks):
        try:
            row = _run_one(prom, scens[nm], rng)
            _journal_write(row)
        except Exception as e:
            ok = False
            log("💥", f"{nm}: {e}")
        finally:
            scenario_stop()
        if i < len(tasks) - 1:
            log("😴", f"cooldown {COOLDOWN_S}с перед следующим прогоном…")
            sleep_until(now() + COOLDOWN_S)
    return 0 if ok else 1


# ---------- датасет (M3) ----------

DATASET_CSV = HERE / "dataset.csv"          # окна × агрегаты  → RF, MLP
WINDOWS_CSV = HERE / "windows.csv"          # длинный формат сырья → Transformer (T×F)
W_DEFAULT = 30        # длина окна, с
S_DEFAULT = 10        # шаг окна, с
STEP_DEFAULT = 10     # шаг выборки из Prometheus, с
SEQLEN_DEFAULT = 18   # длина последовательности отсчётов на окно (18×10с = 180с контекста)
BUFFER_DEFAULT = 30   # запас по краям прогона, с


def _agg_mean(v):
    return sum(v) / len(v) if v else None


def _agg_max(v):
    return max(v) if v else None


def _agg_min(v):
    return min(v) if v else None


def _agg_p95(v):
    if not v:
        return None
    s = sorted(v)
    return s[min(len(s) - 1, math.ceil(0.95 * (len(s) - 1)))]


def _agg_slope(pts):
    """Наклон МНК по точкам [(t, val)] с t в секундах от начала окна. None, если <2 точек."""
    xs = [t for t, _ in pts]
    ys = [y for _, y in pts]
    n = len(xs)
    if n < 2:
        return None
    mx, my = sum(xs) / n, sum(ys) / n
    den = sum((x - mx) ** 2 for x in xs)
    if den == 0:
        return None
    return sum((x - mx) * (y - my) for x, y in zip(xs, ys)) / den


AGGS = [("mean", _agg_mean), ("max", _agg_max), ("min", _agg_min), ("p95", _agg_p95)]


def _read_journal():
    if not JOURNAL.exists():
        raise RuntimeError(f"нет {JOURNAL} — сначала выполни scenario run (M1)")
    runs = []
    for line in JOURNAL.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line:
            runs.append(json.loads(line))
    if not runs:
        raise RuntimeError("journal.jsonl пуст")
    return runs


def cmd_dataset(args):
    if args.action != "build":
        return _stub("M3", f"dataset {args.action}")
    sys.path.insert(0, str(HERE))
    import series as S

    W = getattr(args, "window", None) or W_DEFAULT
    STEP = getattr(args, "sample_step", None) or STEP_DEFAULT
    STRIDE = getattr(args, "step", None) or S_DEFAULT
    SEQLEN = getattr(args, "seq_len", None) or SEQLEN_DEFAULT
    BUFFER = getattr(args, "buffer", None) or BUFFER_DEFAULT

    runs = _read_journal()
    prom = Prom()
    log("📦", f"сборка датасета: {len(runs)} прогонов, окно {W}с/шаг {STRIDE}с, "
             f"выборка {STEP}с, seq={SEQLEN}")

    feats = S.FEATURE_ORDER
    meta_cols = ["window_start", "window_end", "run_id", "scenario", "class",
                 "technique", "boundary"]
    agg_cols = [f"{f}_{a}" for f in feats for a, _ in AGGS] + [f"{f}_slope" for f in feats]

    ds_rows = []       # для dataset.csv
    seq_rows = []      # для windows.csv (длинный формат)
    per_class = {}
    win_uid = 0

    for run in runs:
        b0 = run["baseline_start"] or run["start_ts"]
        r1 = run["recovery_end"] or run["end_ts"]
        st, en = run["start_ts"], run["end_ts"]
        if not (b0 and r1 and st and en):
            log("⚠️", f"{run['run_id']}: неполные метки времени, пропускаю")
            continue
        # запрашиваем с запасом слева на длину последовательности (контекст первых окон)
        q_start = b0 - BUFFER - SEQLEN * STEP
        q_end = r1 + BUFFER
        data = {k: prom.range(q, q_start, q_end, step=STEP) for k, q in S.SERIES.items()}
        grid = sorted(data[feats[0]]) if data.get(feats[0]) else sorted(
            {t for d in data.values() for t in d})
        if not grid:
            log("⚠️", f"{run['run_id']}: Prometheus не вернул данных, пропускаю")
            continue

        ws = b0
        while ws + W <= r1 + 0.5:
            we = ws + W
            center = ws + W / 2.0
            in_effect = st <= center < en
            cls = run["class"] if in_effect else "norm"
            technique = run["technique"] if in_effect else ""
            straddles = (ws < st < we) or (ws < en < we)
            boundary = 1 if straddles else 0
            wid = f"{run['run_id']}#{win_uid}"

            row = {"window_start": f"{ws:.0f}", "window_end": f"{we:.0f}",
                   "run_id": run["run_id"], "scenario": run["scenario"],
                   "class": cls, "technique": technique, "boundary": boundary}
            for f in feats:
                pts = [(t - ws, v) for t, v in data[f].items() if ws <= t < we and v is not None]
                vals = [v for _, v in pts]
                for a, fn in AGGS:
                    v = fn(vals)
                    row[f"{f}_{a}"] = "" if v is None else round(v, 6)
                sl = _agg_slope(pts)
                row[f"{f}_slope"] = "" if sl is None else round(sl, 6)
            ds_rows.append(row)
            per_class[cls] = per_class.get(cls, 0) + 1

            # последовательность SEQLEN отсчётов, заканчивающихся на we (для Transformer)
            seq_ts = [t for t in grid if t <= we][-SEQLEN:]
            for i, t in enumerate(seq_ts):
                srow = {"window_id": wid, "run_id": run["run_id"], "step_idx": i,
                        "class": cls, "technique": technique, "boundary": boundary}
                for f in feats:
                    v = data[f].get(t)
                    srow[f] = "" if v is None else round(v, 6)
                seq_rows.append(srow)
            win_uid += 1
            ws += STRIDE

    if not ds_rows:
        log("💥", "не собрано ни одного окна — проверь метки времени в journal.jsonl")
        return 1

    import csv
    with open(DATASET_CSV, "w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=meta_cols + agg_cols)
        w.writeheader()
        w.writerows(ds_rows)
    with open(WINDOWS_CSV, "w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=["window_id", "run_id", "step_idx",
                                          "class", "technique", "boundary"] + feats)
        w.writeheader()
        w.writerows(seq_rows)

    log("✅", f"{DATASET_CSV.name}: {len(ds_rows)} окон, {len(agg_cols)} признаков")
    log("✅", f"{WINDOWS_CSV.name}: {len(seq_rows)} строк ({win_uid} окон × ≤{SEQLEN} отсчётов)")
    log("📊", "окон по классам: " + ", ".join(f"{k}={v}" for k, v in sorted(per_class.items())))
    return 0


def cmd_model(args):
    return _stub("M4", "model train")


# ---------- разбор аргументов ----------

def main(argv=None):
    p = argparse.ArgumentParser(prog="labctl", description=__doc__,
                                formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = p.add_subparsers(dest="cmd", required=True)

    sub.add_parser("init", help="применить изоляцию стенда")

    d = sub.add_parser("doctor", help="проверить изоляцию и готовность")
    d.add_argument("--egress-test", action="store_true",
                   help="реальный тест: под из redlab не должен выйти в интернет")

    s = sub.add_parser("scenario", help="сценарии (M1–M2)")
    s.add_argument("action", choices=["list", "run", "status", "stop"])
    s.add_argument("name", nargs="?")
    s.add_argument("--repeat", type=int, help="повторов каждого сценария с рандомизацией интенсивности")
    s.add_argument("--seed", type=int, help="seed рандомизации (детерминизм прогона)")

    ds = sub.add_parser("dataset", help="датасет (M3)")
    ds.add_argument("action", choices=["build"])
    ds.add_argument("--window", type=int, help=f"длина окна, с (по умолч. {W_DEFAULT})")
    ds.add_argument("--step", type=int, help=f"шаг окна, с (по умолч. {S_DEFAULT})")
    ds.add_argument("--sample-step", type=int, help=f"шаг выборки Prometheus, с (по умолч. {STEP_DEFAULT})")
    ds.add_argument("--seq-len", type=int, help=f"отсчётов на окно для Transformer (по умолч. {SEQLEN_DEFAULT})")
    ds.add_argument("--buffer", type=int, help=f"запас по краям прогона, с (по умолч. {BUFFER_DEFAULT})")

    m = sub.add_parser("model", help="модели (M4)")
    m.add_argument("action", choices=["train"])

    args = p.parse_args(argv)
    handlers = {
        "init": cmd_init, "doctor": cmd_doctor, "scenario": cmd_scenario,
        "dataset": cmd_dataset, "model": cmd_model,
    }
    try:
        return handlers[args.cmd](args)
    except KeyboardInterrupt:
        log("🛑", "Прервано пользователем.")
        return 130
    except Exception as e:
        log("💥", str(e))
        return 1


if __name__ == "__main__":
    sys.exit(main())
