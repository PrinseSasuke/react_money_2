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
import subprocess
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

# Устойчивый к кодировке консоли вывод (Windows cp1251 иначе падает на эмодзи/кириллице).
for _s in (sys.stdout, sys.stderr):
    try:
        _s.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

HERE = Path(__file__).resolve().parent
K8S = HERE / "k8s"
RESULTS = HERE / "results"

# --- окружение стенда (совпадает с диплома, но только на чтение) ---
APP_NS = "react-money"     # приложение — цель атак, НЕ меняется
LOAD_NS = "loadtest"       # k6-нагрузка — источник «нормы»
MON_NS = "monitoring"      # Prometheus — читаем метрики
REDLAB_NS = "redlab"       # наш изолированный ns для атак и sink
RESEARCH_BRANCH = "research/ids-ml"
NETPOL = "redlab-egress-lockdown"

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

def kubectl(*args, check=True, timeout=60):
    p = subprocess.run(["kubectl", *args], capture_output=True, text=True, timeout=timeout)
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


class Prom:
    """Клиент Prometheus по образцу chaos_run.py: находит svc в ns monitoring."""

    def __init__(self):
        ip = kubectl("-n", MON_NS, "get", "svc", "prometheus",
                     "-o", "jsonpath={.spec.clusterIP}").strip()
        if not ip:
            raise RuntimeError("не нашёл clusterIP svc prometheus в ns monitoring")
        self.base = f"http://{ip}:9090/api/v1"

    def up(self):
        url = f"{self.base}/query?{urllib.parse.urlencode({'query': 'vector(1)'})}"
        with urllib.request.urlopen(url, timeout=15) as r:
            return json.load(r)["status"] == "success"


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


def cmd_scenario(args):
    return _stub("M1–M2", f"scenario {args.action}")


def cmd_dataset(args):
    return _stub("M3", "dataset build")


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

    ds = sub.add_parser("dataset", help="датасет (M3)")
    ds.add_argument("action", choices=["build"])

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
