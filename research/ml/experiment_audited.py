#!/usr/bin/env python3
"""Grouped repeated evaluation on common 180-second archived sequences.

Exploratory: original sample timestamps and successful injection are unverified.
All fitted preprocessing and thresholds use training runs only.
"""
import argparse
import json
import platform
import time
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.impute import SimpleImputer
from sklearn.metrics import confusion_matrix, f1_score, classification_report
from sklearn.neural_network import MLPClassifier
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.tree import DecisionTreeClassifier
import torch
from torch import nn

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / 'evidence' / 'prepared'
OUT = ROOT / 'ml' / 'audited_results'
LABELS = ['norm', 'fault', 'attack']


def aggregated(X):
    # Missing values are preserved until train-only imputation.
    with np.errstate(all='ignore'):
        mean = np.nanmean(X, axis=1)
        low = np.nanmin(X, axis=1)
        high = np.nanmax(X, axis=1)
        p95 = np.nanpercentile(X, 95, axis=1)
    # Least squares slope, ignoring missing observations.
    t = np.arange(X.shape[1], dtype=float)[None, :, None] * 10
    ok = np.isfinite(X)
    n = ok.sum(axis=1)
    tx = np.where(ok, t, 0).sum(axis=1)
    y = np.where(ok, X, 0)
    sy = y.sum(axis=1)
    t2 = np.where(ok, t*t, 0).sum(axis=1)
    ty = (y*t).sum(axis=1)
    denom = n*t2 - tx*tx
    slope = np.divide(n*ty-tx*sy, denom, out=np.full_like(denom, np.nan), where=denom != 0)
    missing = (~ok).mean(axis=1)
    return np.concatenate([mean, low, high, p95, slope, missing], axis=1)


def split_groups(meta, split, temporal=False):
    random = np.random.RandomState(2100 + split)
    train, valid, test = [], [], []
    for _, rows in meta.groupby('scenario'):
        ids = sorted(rows.run_id.unique())
        if not temporal:
            ids = list(random.permutation(ids))
        if len(ids) < 3:
            raise ValueError('At least three runs per scenario required')
        nt = max(1, int(round(len(ids)*.2)))
        nv = max(1, int(round(len(ids)*.2)))
        test.extend(ids[-nt:]); valid.extend(ids[-nt-nv:-nt]); train.extend(ids[:-nt-nv])
    return train, valid, test


def nested_subset(meta, train, fraction, split):
    selected = []
    for scenario in sorted(meta.scenario.unique()):
        ids = sorted(set(meta.loc[meta.scenario == scenario, 'run_id']) & set(train))
        # A deterministic scenario-specific permutation is shared across fractions.
        seed = 15000 + split * 100 + list(sorted(meta.scenario.unique())).index(scenario)
        ids = np.random.RandomState(seed).permutation(ids)
        selected.extend(ids[:max(1, int(np.floor(len(ids)*fraction)))])
    return list(selected)


class SequenceModel(nn.Module):
    def __init__(self, dimensions):
        super().__init__()
        self.project = nn.Linear(dimensions * 2, 32)
        self.position = nn.Parameter(torch.zeros(1, 18, 32))
        self.encoder = nn.TransformerEncoder(nn.TransformerEncoderLayer(
            32, 4, 64, dropout=.1, batch_first=True), 1)
        self.head = nn.Linear(32, 3)

    def forward(self, x):
        return self.head(self.encoder(self.project(x) + self.position).mean(dim=1))


def transformer_predict(X, y, tr, va, te, seed, max_epochs):
    t0 = time.perf_counter()
    torch.manual_seed(seed)
    torch.set_num_threads(2)
    # Statistics and fill values are derived only from training samples.
    with np.errstate(all='ignore'):
        mu = np.nanmean(X[tr], axis=(0, 1))
        sd = np.nanstd(X[tr], axis=(0, 1))
    mu = np.where(np.isfinite(mu), mu, 0)
    sd = np.where(np.isfinite(sd) & (sd > 1e-6), sd, 1)
    mask = np.isfinite(X)
    norm = np.where(mask, (X - mu) / sd, 0)
    seq = torch.tensor(np.concatenate([norm, (~mask).astype(float)], axis=2), dtype=torch.float32)
    target = torch.tensor(y, dtype=torch.long)
    model = SequenceModel(X.shape[2]); optimizer = torch.optim.Adam(model.parameters(), lr=.001)
    count = np.bincount(y[tr], minlength=3)
    weights = torch.tensor(count.sum() / np.maximum(count, 1), dtype=torch.float32)
    lossfn = nn.CrossEntropyLoss(weight=weights)
    best, best_state, stale = -1, None, 0
    for epoch in range(max_epochs):
        model.train()
        order = np.random.RandomState(seed * 1000 + epoch).permutation(tr)
        for start in range(0, len(order), 128):
            ix = order[start:start+128]
            optimizer.zero_grad(); loss = lossfn(model(seq[ix]), target[ix]); loss.backward(); optimizer.step()
        model.eval()
        with torch.no_grad():
            pred = model(seq[va]).argmax(1).numpy()
        score = f1_score(y[va], pred, labels=[0, 1, 2], average='macro', zero_division=0)
        if score > best + 1e-6:
            best, stale = score, 0
            best_state = {k: v.detach().clone() for k, v in model.state_dict().items()}
        else:
            stale += 1
        if stale >= 5:
            break
    model.load_state_dict(best_state); model.eval()
    train_seconds = time.perf_counter() - t0
    inference_start = time.perf_counter()
    with torch.no_grad():
        predictions = model(seq[te]).argmax(1).numpy()
    return predictions, epoch + 1, train_seconds, time.perf_counter() - inference_start


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--splits', type=int, default=5)
    parser.add_argument('--seeds', type=int, default=3)
    parser.add_argument('--epochs', type=int, default=25)
    args = parser.parse_args()
    OUT.mkdir(parents=True, exist_ok=True)
    meta = pd.read_csv(DATA / 'windows.csv')
    raw = np.load(DATA / 'sequences.npz')
    X, names = raw['X'], list(raw['features'])
    y = pd.Categorical(meta['class'], categories=LABELS).codes
    A = aggregated(X)
    # Baseline is a shallow tree over three interpretable metric families.
    base_features = [names.index(n) for n in ('rps_total', 'err_pct', 'pg_tps')]
    B = np.nanmean(X[:, :, base_features], axis=1)
    config = vars(args) | {'labels': LABELS, 'input_shape': list(X.shape),
             'python': platform.python_version(), 'torch': torch.__version__,
             'caveat': 'Exploratory; source sample timestamps and injection success unavailable.'}
    (OUT / 'config.json').write_text(json.dumps(config, indent=2), encoding='utf-8')
    outputs, metrics, splits_out = [], [], []
    for split in range(args.splits + 1):
        temporal = split == args.splits
        train, valid, test = split_groups(meta, split, temporal)
        splits_out.append({'split': split, 'temporal': temporal, 'train': train, 'valid': valid, 'test': test})
        va = np.flatnonzero(meta.run_id.isin(valid)); te = np.flatnonzero(meta.run_id.isin(test))
        for fraction in (.5, .75, 1.):
            selected = nested_subset(meta, train, fraction, split)
            tr = np.flatnonzero(meta.run_id.isin(selected))
            for seed in range(args.seeds):
                for name in ('rules', 'rf', 'mlp', 'transformer'):
                    t0 = time.perf_counter()
                    if name == 'transformer':
                        pred, epochs, train_seconds, inference_seconds = transformer_predict(X, y, tr, va, te, seed, args.epochs)
                    else:
                        inp = B if name == 'rules' else A
                        if name == 'rules': model = DecisionTreeClassifier(max_depth=2, min_samples_leaf=20, random_state=seed)
                        elif name == 'rf': model = RandomForestClassifier(n_estimators=150, class_weight='balanced', random_state=seed, n_jobs=-1)
                        else: model = MLPClassifier(hidden_layer_sizes=(64, 32), max_iter=150, early_stopping=False, random_state=seed)
                        steps = [SimpleImputer(strategy='median', add_indicator=True, keep_empty_features=True)]
                        if name == 'mlp': steps.append(StandardScaler())
                        model = make_pipeline(*steps, model)
                        model.fit(inp[tr], y[tr]); train_seconds = time.perf_counter() - t0
                        inference_start = time.perf_counter(); pred = model.predict(inp[te])
                        inference_seconds = time.perf_counter() - inference_start; epochs = None
                    elapsed = time.perf_counter() - t0
                    cm = confusion_matrix(y[te], pred, labels=[0,1,2])
                    rep = classification_report(y[te], pred, labels=[0,1,2], target_names=LABELS, output_dict=True, zero_division=0)
                    metrics.append({'split': split, 'temporal': temporal, 'fraction': fraction, 'seed': seed,
                      'model': name, 'macro_f1': f1_score(y[te], pred, labels=[0,1,2], average='macro', zero_division=0),
                      'confusion': cm.tolist(), 'report': rep, 'elapsed_s': elapsed, 'epochs': epochs,
                      'train_seconds': train_seconds, 'inference_seconds': inference_seconds,
                      'fault_as_attack': cm[1,2]/max(cm[1].sum(),1), 'norm_as_attack': cm[0,2]/max(cm[0].sum(),1),
                      'attack_as_fault': cm[2,1]/max(cm[2].sum(),1)})
                    for ix, p in zip(te, pred):
                        outputs.append({'split': split, 'temporal': temporal, 'fraction': fraction, 'seed': seed,
                          'model': name, 'window_id': meta.window_id.iloc[ix], 'run_id': meta.run_id.iloc[ix],
                          'scenario': meta.scenario.iloc[ix], 'truth': LABELS[y[ix]], 'prediction': LABELS[p]})
                    print(f'split={split} temporal={temporal} size={fraction} seed={seed} {name} macro_f1={metrics[-1]["macro_f1"]:.3f}', flush=True)
                    (OUT / 'metrics.json').write_text(json.dumps(metrics, indent=2), encoding='utf-8')
        pd.DataFrame(outputs).to_csv(OUT / 'predictions.csv.gz', index=False)
        (OUT / 'splits.json').write_text(json.dumps(splits_out, indent=2), encoding='utf-8')


if __name__ == '__main__':
    main()
