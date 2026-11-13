#!/usr/bin/env python3
"""Scenario/family holdout and RF ablations with grouped test partitions."""
import json
from pathlib import Path
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.impute import SimpleImputer
from sklearn.metrics import f1_score
from sklearn.pipeline import make_pipeline
from experiment_audited import DATA, OUT, aggregated, split_groups


def main():
    meta = pd.read_csv(DATA / 'windows.csv')
    raw = np.load(DATA / 'sequences.npz'); X = raw['X']; names = list(raw['features'])
    labels = ['norm', 'fault', 'attack']
    y = pd.Categorical(meta['class'], categories=labels).codes
    scenarios = sorted(meta.loc[meta['class'] == 'attack', 'scenario'].unique())
    families = {
        'brute_family': ['20-attack-bruteforce', '23-attack-lowbrute'],
        'flood_family': ['21-attack-flood', '25-attack-lowflood'],
    }
    groups = {s: [s] for s in scenarios} | families
    matrices = {}
    for ablation, drop in {'none': [], 'network': ['net_rx_bytes', 'net_tx_bytes'],
                            'database': ['pg_up', 'pg_tps', 'pg_active', 'pg_rollbacks']}.items():
        matrices[ablation] = aggregated(X[:, :, [i for i, n in enumerate(names) if n not in drop]])
    output = []
    for split in range(5):
        train, valid, test = split_groups(meta, split)
        tr0 = meta.run_id.isin(train).to_numpy()
        te0 = meta.run_id.isin(test).to_numpy()
        for group, held in groups.items():
            tr = tr0 & ~meta.scenario.isin(held).to_numpy()
            te = te0 & meta.scenario.isin(held).to_numpy() & (y == 2)
            if not te.any(): continue
            model = make_pipeline(SimpleImputer(strategy='median', add_indicator=True, keep_empty_features=True),
                RandomForestClassifier(n_estimators=150, class_weight='balanced', random_state=split, n_jobs=-1))
            A = matrices['none']
            model.fit(A[tr], y[tr]); pred = model.predict(A[te])
            for ix, p in zip(np.flatnonzero(te), pred):
                output.append({'kind': 'holdout', 'group': group, 'split': split,
                  'run_id': meta.run_id.iloc[ix], 'window_id': meta.window_id.iloc[ix],
                  'scenario': meta.scenario.iloc[ix], 'truth': int(y[ix]), 'prediction': int(p)})
        for ablation, A in matrices.items():
            model = make_pipeline(SimpleImputer(strategy='median', add_indicator=True, keep_empty_features=True),
                RandomForestClassifier(n_estimators=150, class_weight='balanced', random_state=split, n_jobs=-1))
            model.fit(A[tr0], y[tr0]); pred = model.predict(A[te0])
            for ix, p in zip(np.flatnonzero(te0), pred):
                output.append({'kind': 'ablation', 'group': ablation, 'split': split,
                  'run_id': meta.run_id.iloc[ix], 'window_id': meta.window_id.iloc[ix],
                  'scenario': meta.scenario.iloc[ix], 'truth': int(y[ix]), 'prediction': int(p)})
        print(f'generalization split {split} complete', flush=True)
    OUT.mkdir(parents=True, exist_ok=True)
    pd.DataFrame(output).to_csv(OUT / 'generalization_predictions.csv.gz', index=False)


if __name__ == '__main__':
    main()
