#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Диагностика M4: проверяем, «легко ли» и «не заучивают ли» модели.

1. Near-duplicate/утечка: расстояние тестовых окон до ближайших train-окон.
2. Leave-one-attack-out: обучаем без одного типа атаки, тестируем на нём (обобщение на НОВУЮ атаку).
3. Абляция сетевых признаков: убираем net_rx/tx_bytes — держится ли качество.
4. Слабая интенсивность: recall атак на самых слабых прогонах.

Запуск: python diagnose.py
"""
import json
import sys
from collections import defaultdict
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.preprocessing import StandardScaler
from sklearn.neighbors import NearestNeighbors
from sklearn.metrics import f1_score, confusion_matrix

import train as T   # переиспуем загрузку/сплит/метрики

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

HERE = Path(__file__).resolve().parent
RESEARCH = HERE.parent
CID = T.CID
CLASSES = T.CLASSES
ATTACKS = ["20-attack-bruteforce", "21-attack-flood", "22-attack-sqli",
           "23-attack-lowbrute", "24-attack-pathscan", "25-attack-lowflood"]

out = []
def log(s=""):
    print(s); out.append(s)


def rf(seed=0):
    return RandomForestClassifier(n_estimators=300, class_weight="balanced",
                                  n_jobs=-1, random_state=seed)


def main():
    df, feats = T.load_aggregates()
    all_runs = df["run_id"].unique().tolist()
    test_runs, pool = T.split_runs(all_runs, 3)
    train_runs = set().union(*[set(r) for _, r in pool])
    tr = df[(df.run_id.isin(train_runs)) & (df.boundary == 0)]
    te = df[(df.run_id.isin(test_runs)) & (df.boundary == 0)]
    Xtr, ytr = tr[feats].to_numpy(), tr["y"].to_numpy()
    Xte, yte = te[feats].to_numpy(), te["y"].to_numpy()

    log("# Диагностика M4 — «легко или заучивают?»\n")
    log(f"train окон={len(tr)}  test окон={len(te)}  признаков={len(feats)}\n")

    # ---- 1. near-duplicate / утечка ----
    log("## 1. Near-duplicate тест↔train (утечка?)\n")
    sc = StandardScaler().fit(Xtr)
    nn = NearestNeighbors(n_neighbors=1).fit(sc.transform(Xtr))
    d, _ = nn.kneighbors(sc.transform(Xte))
    d = d.ravel()
    log(f"L2-расстояние тест→ближайший train (стандартизованное, {len(feats)} призн.):")
    log(f"  min={d.min():.3f}  p1={np.percentile(d,1):.3f}  median={np.median(d):.3f}  max={d.max():.3f}")
    dup = int((d < 0.1).sum())
    log(f"  окон с расстоянием < 0.1 (почти дубли): {dup} из {len(d)} ({100*dup/len(d):.1f}%)")
    log("  → если дублей ~0 и median заметно > 0, утечки на уровне окон нет.\n")

    # ---- 2. leave-one-attack-out ----
    log("## 2. Leave-one-attack-out — обобщение на НЕвиданный тип атаки\n")
    log("Обучаем на норме+сбоях+2 типах атак, тестируем на 3-м (его модель не видела).")
    log("Смотрим, куда попадают окна невиданной атаки (recall как «атака»).\n")
    log("| Невиданная атака | окон | → norm | → fault | → attack | recall(attack) |")
    log("|---|---|---|---|---|---|")
    loao = {}
    for H in ATTACKS:
        tr_runs_H = [r for r in all_runs if T.scenario_of(r) != H]
        trH = df[(df.run_id.isin(tr_runs_H)) & (df.boundary == 0)]
        teH = df[(df.scenario == H) & (df["class"] == "attack") & (df.boundary == 0)]
        m = rf().fit(trH[feats].to_numpy(), trH["y"].to_numpy())
        pred = m.predict(teH[feats].to_numpy())
        c = np.bincount(pred, minlength=3)
        rec = c[2] / c.sum() if c.sum() else 0
        loao[H] = rec
        log(f"| {H} | {c.sum()} | {c[0]} | {c[1]} | {c[2]} | {rec:.3f} |")
    log("\n→ высокий recall = модель ловит «атакность» вообще; низкий = держится на сигнатуре типа.\n")

    # ---- 3. абляция сетевых признаков ----
    log("## 3. Абляция сетевых признаков (net_rx/tx_bytes)\n")
    net = [f for f in feats if f.startswith("net_")]
    feats_no = [f for f in feats if f not in net]
    def eval_feats(fs, tag):
        m = rf().fit(tr[fs].to_numpy(), ytr)
        pred = m.predict(te[fs].to_numpy())
        mf = f1_score(yte, pred, average="macro", labels=[0,1,2], zero_division=0)
        cm = confusion_matrix(yte, pred, labels=[0,1,2])
        af = f1_score(yte, pred, average=None, labels=[0,1,2], zero_division=0)[2]
        far = cm[1,2]/cm[1].sum() if cm[1].sum() else 0
        arec = cm[2,2]/cm[2].sum() if cm[2].sum() else 0
        return mf, af, far, arec
    log(f"Убрали {len(net)} сетевых признаков из {len(feats)}.\n")
    log("| Набор признаков | macro-F1 | attack-F1 | false-attack | attack-recall |")
    log("|---|---|---|---|---|")
    for fs, tag in [(feats, f"все ({len(feats)})"), (feats_no, f"без net ({len(feats_no)})")]:
        mf, af, far, arec = eval_feats(fs, tag)
        log(f"| {tag} | {mf:.3f} | {af:.3f} | {far:.3f} | {arec:.3f} |")
    log("\n→ если без net качество почти не падает — модель держится не только на «громком» трафике.\n")

    # ---- 4. слабая интенсивность ----
    log("## 4. Recall атак по интенсивности (слабые прогоны)\n")
    jrn = {r["run_id"]: r for r in
           (json.loads(l) for l in (RESEARCH/"journal.jsonl").read_text(encoding="utf-8").splitlines() if l.strip())}
    m = rf().fit(Xtr, ytr)   # стандартная модель
    def intensity(run_id):
        it = jrn.get(run_id, {}).get("intensity", {})
        return it.get("flood_rate") or it.get("duration_s") or it.get("rate")
    log("Для каждого атакующего прогона в тесте: интенсивность и доля окон, распознанных как атака.\n")
    log("| прогон (атака) | интенсивность | окон | recall(attack) |")
    log("|---|---|---|---|")
    rows = []
    for H in ATTACKS:
        for run_id in sorted(r for r in test_runs if T.scenario_of(r) == H):
            w = df[(df.run_id == run_id) & (df["class"] == "attack") & (df.boundary == 0)]
            if not len(w):
                continue
            pred = m.predict(w[feats].to_numpy())
            rec = (pred == 2).mean()
            rows.append((H, intensity(run_id), len(w), rec))
    for H, inten, n, rec in sorted(rows, key=lambda x: (x[0], x[1] if x[1] else 0)):
        log(f"| {H.split('-')[-1]} | {inten} | {n} | {rec:.3f} |")
    log("\n→ падение recall на низкой интенсивности = граница чувствительности детектора.\n")

    (HERE/"DIAGNOSTICS.md").write_text("\n".join(out), encoding="utf-8")
    print("\nDIAGNOSTICS.md сохранён")


if __name__ == "__main__":
    main()
