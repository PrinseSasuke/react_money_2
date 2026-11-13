#!/usr/bin/env python3
"""Build a conservative, provisional 180 s dataset from archived sequences.

Sequences lack sample timestamps: assumptions are recorded and cannot be verified.
Predictions are at window_end. Recovery and pod-kill observations are excluded.
"""
import json
import argparse
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'evidence' / 'legacy'
DEST = ROOT / 'evidence' / 'prepared-strict'
META = ['window_id', 'run_id', 'step_idx', 'class', 'technique', 'boundary', 'sample_ts']


def main():
    global DEST
    parser = argparse.ArgumentParser()
    parser.add_argument('--lookback',type=int,default=60,choices=[0,60],help='additional PromQL rate lookback in seconds')
    parser.add_argument('--out',type=Path,default=DEST)
    args=parser.parse_args()
    DEST=args.out
    runs = {r['run_id']: r for r in (json.loads(x) for x in
            (SOURCE / 'journal.jsonl').read_text(encoding='utf-8').splitlines() if x)}
    windows = pd.read_csv(SOURCE / 'dataset.csv', keep_default_na=False)
    seq = pd.read_csv(SOURCE / 'windows.csv')
    features = [c for c in seq.columns if c not in META]
    groups = list(seq.groupby('window_id', sort=False))
    if len(groups) != len(windows):
        raise ValueError('Sequence/aggregate window count mismatch')
    records, sequences, excluded = [], [], {}
    for (_, row), (wid, group) in zip(windows.iterrows(), groups):
        run = runs[row.run_id]
        group = group.sort_values('step_idx')
        if (len(group) != 18 or group.run_id.nunique() != 1 or group.run_id.iloc[0] != row.run_id
                or group['class'].nunique() != 1 or group['class'].iloc[0] != row['class']
                or group.boundary.nunique() != 1 or int(group.boundary.iloc[0]) != int(row.boundary)):
            raise ValueError(f'Sequence alignment failed: {wid}')
        if list(group.step_idx) != list(range(18)):
            raise ValueError(f'Unexpected sequence steps: {wid}')
        end = float(row.window_end)
        start = float(row.window_start)
        cause = None
        # Margin absorbs rounded exported window timestamps and unknown phase of query grid.
        if end - 180 < run['baseline_start'] + args.lookback + 1:
            cause = 'history_or_rate_lookback_before_baseline'
        elif row.scenario == '11-fault-kill-backend':
            cause = 'podkill_duration_unverified'
        elif run['class'] != 'norm' and not (start >= run['start_ts'] and end <= run['end_ts']):
            cause = 'baseline_transition_or_unverified_recovery'
        elif run['class'] != 'norm' and row['class'] != run['class']:
            cause = 'label_inconsistent'
        elif row.boundary:
            cause = 'boundary'
        if cause:
            excluded[cause] = excluded.get(cause, 0) + 1
            continue
        arr = group[features].to_numpy(dtype=np.float64)
        if np.isinf(arr).any():
            raise ValueError(f'Infinite metric values: {wid}')
        records.append({'window_id': wid, 'run_id': row.run_id, 'scenario': row.scenario,
                        'class': row['class'], 'window_end': end})
        sequences.append(arr)
    DEST.mkdir(parents=True, exist_ok=True)
    np.savez_compressed(DEST / 'sequences.npz', X=np.asarray(sequences, dtype=np.float32),
                        features=np.asarray(features, dtype=str))
    pd.DataFrame(records).to_csv(DEST / 'windows.csv', index=False)
    report = {'source_windows': len(windows), 'included': len(records), 'excluded': excluded,
              'promql_lookback_guard_s': args.lookback,
              'by_class': pd.DataFrame(records)['class'].value_counts().to_dict(),
              'by_scenario': pd.DataFrame(records)['scenario'].value_counts().to_dict(),
              'limitations': ['Sample timestamps were not saved; sequence timing remains unverified.',
                'Missing values preserved as NaN; transform using training-only statistics.',
                'Effect timestamps represent orchestration, not confirmed injection.',
                'Sequences may include pre-event context; label describes the decision window.',
                'Pod-kill and recovery excluded; baseline is limited to normal-only runs.']}
    (DEST / 'preparation.json').write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding='utf-8')
    print(json.dumps(report, indent=2, ensure_ascii=False))


if __name__ == '__main__':
    main()
