#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""M4 — обучение и сравнение детекторов норма/сбой/атака.

Модели: Random Forest, MLP (scikit-learn), Transformer (PyTorch, опционально).
Ключевые принципы:
  * сплит train/test ПО ПРОГОНАМ (run_id), а не по окнам — иначе утечка (R-12);
  * фиксированная тестовая выборка (одна для всех размеров/моделей) — сравнение честное;
  * размеры обучающей части 50 / 75 / 100% (нарезка по прогонам);
  * метрики: F1 по классам (macro/weighted), матрица ошибок 3x3, false-attack rate
    (доля окон «сбой», принятых за «атаку») и attack-recall; для RF — важность признаков.

Запуск:
  python train.py                       # все модели, размеры 50/75/100, 3 seed
  python train.py --models rf mlp       # без Transformer
  python train.py --seeds 5 --k-test 3  # больше seed / размер теста
"""
import argparse
import json
import sys
import time
from collections import defaultdict
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.neural_network import MLPClassifier
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import (classification_report, confusion_matrix, f1_score)

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

HERE = Path(__file__).resolve().parent
RESEARCH = HERE.parent
DATASET = RESEARCH / "dataset.csv"
WINDOWS = RESEARCH / "windows.csv"
RESULTS = HERE / "results"

CLASSES = ["norm", "fault", "attack"]
CID = {c: i for i, c in enumerate(CLASSES)}
META = ["window_start", "window_end", "run_id", "scenario", "class", "technique", "boundary"]


# ---------- данные и сплит ----------

def scenario_of(run_id):
    # run_id = "<ts>_<scenario>"
    return run_id.split("_", 1)[1] if "_" in run_id else run_id


def split_runs(run_ids, k_test):
    """Детерминированный сплит прогонов по сценариям: последние k_test каждого сценария — в тест.
    Возвращает (test_runs, train_pool) — оба множества run_id."""
    by_scn = defaultdict(list)
    for r in sorted(run_ids):
        by_scn[scenario_of(r)].append(r)
    test, pool = set(), []
    for scn, runs in by_scn.items():
        kt = min(k_test, max(1, len(runs) // 5))  # ~20% в тест, минимум 1
        test.update(runs[-kt:])
        pool.append((scn, runs[:-kt]))
    return test, pool


def train_runs_for_frac(train_pool, frac):
    """Берёт первые frac прогонов каждого сценария из пула (50/75/100%)."""
    chosen = set()
    for scn, runs in train_pool:
        n = max(1, round(len(runs) * frac))
        chosen.update(runs[:n])
    return chosen


def load_aggregates(drop_boundary_train=True):
    df = pd.read_csv(DATASET)
    feats = [c for c in df.columns if c not in META]
    df["y"] = df["class"].map(CID)
    return df, feats


def load_sequences(T=18):
    """windows.csv → {window_id: (seq[T,F], run_id, y, boundary)}."""
    df = pd.read_csv(WINDOWS)
    fcols = [c for c in df.columns if c not in
             ("window_id", "run_id", "step_idx", "class", "technique", "boundary")]
    out = {}
    for wid, g in df.groupby("window_id", sort=False):
        g = g.sort_values("step_idx")
        arr = g[fcols].to_numpy(dtype=np.float32)
        if len(arr) < T:  # left-pad повтором первой строки
            pad = np.repeat(arr[:1], T - len(arr), axis=0)
            arr = np.vstack([pad, arr])
        arr = arr[-T:]
        r0 = g.iloc[0]
        out[wid] = (arr, r0["run_id"], CID[r0["class"]], int(r0["boundary"]))
    return out, fcols


# ---------- метрики ----------

def evaluate(y_true, y_pred):
    cm = confusion_matrix(y_true, y_pred, labels=[0, 1, 2])
    rep = classification_report(y_true, y_pred, labels=[0, 1, 2],
                                target_names=CLASSES, output_dict=True, zero_division=0)
    fault_total = cm[1].sum()
    attack_total = cm[2].sum()
    # false-attack rate: доля «сбой», предсказанных «атака»
    far = cm[1, 2] / fault_total if fault_total else 0.0
    # attack-recall: доля атак, пойманных как атака
    arec = cm[2, 2] / attack_total if attack_total else 0.0
    # missed-attack: доля атак, принятых за сбой
    miss = cm[2, 1] / attack_total if attack_total else 0.0
    return {
        "macro_f1": f1_score(y_true, y_pred, average="macro", labels=[0, 1, 2], zero_division=0),
        "weighted_f1": f1_score(y_true, y_pred, average="weighted", labels=[0, 1, 2], zero_division=0),
        "f1_per_class": {c: rep[c]["f1-score"] for c in CLASSES},
        "false_attack_rate": far,
        "attack_recall": arec,
        "attack_as_fault": miss,
        "confusion": cm.tolist(),
    }


# ---------- модели ----------

def run_rf(Xtr, ytr, Xte, seed, feats):
    m = RandomForestClassifier(n_estimators=300, class_weight="balanced",
                               n_jobs=-1, random_state=seed)
    m.fit(Xtr, ytr)
    imp = sorted(zip(feats, m.feature_importances_), key=lambda t: -t[1])[:15]
    return m.predict(Xte), imp


def run_mlp(Xtr, ytr, Xte, seed):
    sc = StandardScaler().fit(Xtr)
    m = MLPClassifier(hidden_layer_sizes=(128, 64), max_iter=500,
                      early_stopping=True, random_state=seed)
    m.fit(sc.transform(Xtr), ytr)
    return m.predict(sc.transform(Xte))


def run_transformer(seqs, fcols, train_wids, test_wids, seed, epochs=25):
    import torch
    import torch.nn as nn
    torch.manual_seed(seed); np.random.seed(seed)
    dev = "cuda" if torch.cuda.is_available() else "cpu"

    def stack(wids):
        X = np.stack([seqs[w][0] for w in wids])          # [N,T,F]
        y = np.array([seqs[w][2] for w in wids])
        return X, y
    Xtr, ytr = stack(train_wids); Xte, yte = stack(test_wids)
    # пустые ячейки windows.csv → NaN: считаем статистику без NaN и зануляем остатки,
    # иначе NaN протекает и модель вырождается в один класс.
    mu = np.nanmean(Xtr, axis=(0, 1)); sd = np.nanstd(Xtr, axis=(0, 1)) + 1e-6
    Xtr = np.nan_to_num((Xtr - mu) / sd, nan=0.0)
    Xte = np.nan_to_num((Xte - mu) / sd, nan=0.0)
    F, T = Xtr.shape[2], Xtr.shape[1]

    class TE(nn.Module):
        def __init__(self):
            super().__init__()
            d = 64
            self.proj = nn.Linear(F, d)
            self.pos = nn.Parameter(torch.randn(1, T, d) * 0.02)
            enc = nn.TransformerEncoderLayer(d, 4, 128, batch_first=True, dropout=0.1)
            self.enc = nn.TransformerEncoder(enc, 2)
            self.head = nn.Linear(d, 3)

        def forward(self, x):
            h = self.proj(x) + self.pos
            h = self.enc(h).mean(1)
            return self.head(h)

    # class weights (attack — меньшинство)
    cnt = np.bincount(ytr, minlength=3).astype(np.float32)
    w = torch.tensor((cnt.sum() / (3 * (cnt + 1e-6))), dtype=torch.float32, device=dev)
    model = TE().to(dev)
    opt = torch.optim.Adam(model.parameters(), lr=1e-3, weight_decay=1e-4)
    lossf = nn.CrossEntropyLoss(weight=w)
    Xtr_t = torch.tensor(Xtr, device=dev); ytr_t = torch.tensor(ytr, device=dev)
    bs = 128
    for ep in range(epochs):
        model.train(); perm = torch.randperm(len(Xtr_t))
        for i in range(0, len(perm), bs):
            idx = perm[i:i + bs]
            opt.zero_grad()
            loss = lossf(model(Xtr_t[idx]), ytr_t[idx])
            loss.backward(); opt.step()
    model.eval()
    with torch.no_grad():
        pred = model(torch.tensor(Xte, device=dev)).argmax(1).cpu().numpy()
    return pred, yte


# ---------- прогон ----------

def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("--models", nargs="+", default=["rf", "mlp", "transformer"])
    ap.add_argument("--sizes", nargs="+", type=float, default=[0.5, 0.75, 1.0])
    ap.add_argument("--seeds", type=int, default=3)
    ap.add_argument("--k-test", type=int, default=3)
    ap.add_argument("--epochs", type=int, default=25)
    args = ap.parse_args(argv)

    df, feats = load_aggregates()
    all_runs = df["run_id"].unique().tolist()
    test_runs, train_pool = split_runs(all_runs, args.k_test)
    print(f"прогонов всего: {len(all_runs)} | в тесте: {len(test_runs)} | "
          f"пул train: {sum(len(r) for _, r in train_pool)}")

    # тестовые окна (без boundary) — фиксированы
    te = df[(df.run_id.isin(test_runs)) & (df.boundary == 0)]
    Xte_agg, yte = te[feats].to_numpy(), te["y"].to_numpy()
    test_wids = None
    seqs = fcols = None
    if "transformer" in args.models:
        print("гружу последовательности для Transformer…")
        seqs, fcols = load_sequences()

    results = defaultdict(list)   # (model,size) -> list of metric dicts
    rf_importance = None
    for size in args.sizes:
        tr_runs = train_runs_for_frac(train_pool, size)
        tr = df[(df.run_id.isin(tr_runs)) & (df.boundary == 0)]
        Xtr_agg, ytr = tr[feats].to_numpy(), tr["y"].to_numpy()
        print(f"\n=== размер {int(size*100)}% : train окон={len(tr)} (прогонов {len(tr_runs)}), "
              f"test окон={len(te)} ===")
        for seed in range(args.seeds):
            if "rf" in args.models:
                pred, imp = run_rf(Xtr_agg, ytr, Xte_agg, seed, feats)
                results[("rf", size)].append(evaluate(yte, pred))
                if size == 1.0 and seed == 0:
                    rf_importance = imp
            if "mlp" in args.models:
                pred = run_mlp(Xtr_agg, ytr, Xte_agg, seed)
                results[("mlp", size)].append(evaluate(yte, pred))
            if "transformer" in args.models:
                tr_wids = [w for w, v in seqs.items() if v[1] in tr_runs and v[3] == 0]
                te_wids = [w for w, v in seqs.items() if v[1] in test_runs and v[3] == 0]
                pred, yt = run_transformer(seqs, fcols, tr_wids, te_wids, seed, args.epochs)
                results[("transformer", size)].append(evaluate(yt, pred))
            print(f"  seed {seed}: " + " | ".join(
                f"{m}={np.mean([r['macro_f1'] for r in results[(m,size)][-1:]]):.3f}"
                for m in args.models if (m, size) in results))

    # --- сводка ---
    RESULTS.mkdir(exist_ok=True)
    ts = time.strftime("%Y%m%d-%H%M%S")
    outdir = RESULTS / ts; outdir.mkdir()
    summary = {}
    print("\n" + "=" * 78)
    print(f"{'модель':<12}{'размер':>7}{'macroF1':>12}{'false-attack':>14}{'attack-rec':>12}")
    print("-" * 78)
    for (model, size), runs in sorted(results.items()):
        mf = np.array([r["macro_f1"] for r in runs])
        fa = np.array([r["false_attack_rate"] for r in runs])
        ar = np.array([r["attack_recall"] for r in runs])
        summary[f"{model}@{int(size*100)}"] = {
            "macro_f1_mean": float(mf.mean()), "macro_f1_std": float(mf.std()),
            "false_attack_rate_mean": float(fa.mean()),
            "attack_recall_mean": float(ar.mean()),
            "confusion_last": runs[-1]["confusion"],
            "f1_per_class_last": runs[-1]["f1_per_class"],
        }
        print(f"{model:<12}{int(size*100):>6}%{mf.mean():>8.3f}±{mf.std():.3f}"
              f"{fa.mean():>14.3f}{ar.mean():>12.3f}")
    print("=" * 78)

    (outdir / "metrics.json").write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")
    if rf_importance:
        (outdir / "rf_feature_importance.json").write_text(
            json.dumps(rf_importance, ensure_ascii=False, indent=2), encoding="utf-8")
        print("\nТоп-10 признаков (RF):")
        for name, val in rf_importance[:10]:
            print(f"  {name:<24} {val:.4f}")
    print(f"\nрезультаты: {outdir}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
