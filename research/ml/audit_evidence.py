#!/usr/bin/env python3
"""Audit saved experiment without modifying the evidence files."""
import collections
import csv
import hashlib
import json
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
EVIDENCE = ROOT / 'evidence' / 'legacy'
META = {'window_start', 'window_end', 'run_id', 'scenario', 'class', 'technique', 'boundary'}
SEQ_META = {'window_id', 'run_id', 'step_idx', 'class', 'technique', 'boundary'}


def main():
    files = ['dataset.csv', 'windows.csv', 'journal.jsonl', 'run.log']
    hashes = {n: hashlib.sha256((EVIDENCE / n).read_bytes()).hexdigest() for n in files}
    runs = [json.loads(line) for line in (EVIDENCE / 'journal.jsonl').read_text(encoding='utf-8').splitlines() if line]
    by_run = {r['run_id']: r for r in runs}
    with (EVIDENCE / 'dataset.csv').open(encoding='utf-8', newline='') as f:
        rows = list(csv.DictReader(f))
    issues = collections.Counter()
    missing = collections.Counter()
    nonfinite = collections.Counter()
    zeros = collections.Counter()
    for row in rows:
        run = by_run[row['run_id']]
        start, end = float(row['window_start']), float(row['window_end'])
        center = (start + end) / 2
        expected = run['class'] if run['start_ts'] <= center < run['end_ts'] else 'norm'
        if row['class'] != expected:
            issues['label_mismatch'] += 1
        if end - 180 < run['baseline_start']:
            issues['180s_history_before_baseline'] += 1
        if end - 180 < run['baseline_start'] + 60:
            issues['180s_history_and_60s_rate_lookback_before_baseline'] += 1
        if run['scenario'] == '11-fault-kill-backend' and row['class'] == 'fault':
            issues['podkill_effect_windows_observation_not_confirmed'] += 1
        if run['class'] != 'norm' and start >= run['end_ts']:
            issues['recovery_windows_labelled_norm'] += 1
        for name, value in row.items():
            if name in META:
                continue
            if value == '': missing[name] += 1
            elif not math.isfinite(float(value)): nonfinite[name] += 1
            elif float(value) == 0: zeros[name] += 1
    seq_missing = collections.Counter()
    seq_n = collections.Counter()
    nseq = 0
    with (EVIDENCE / 'windows.csv').open(encoding='utf-8', newline='') as f:
        for row in csv.DictReader(f):
            nseq += 1
            seq_n[row['window_id']] += 1
            for name, value in row.items():
                if name not in SEQ_META and value == '': seq_missing[name] += 1
    report = {
        'sha256': hashes, 'run_count': len(runs), 'run_scenarios': dict(collections.Counter(r['scenario'] for r in runs)),
        'window_count': len(rows), 'window_classes': dict(collections.Counter(r['class'] for r in rows)),
        'issues': dict(issues), 'aggregate_missing': dict(missing), 'aggregate_nonfinite': dict(nonfinite),
        'aggregate_zero_counts': dict(zeros), 'sequence_rows': nseq, 'sequence_windows': len(seq_n),
        'sequence_lengths': dict(collections.Counter(seq_n.values())), 'sequence_missing': dict(seq_missing),
        'caveat': 'Sequence rows have no timestamp; within-run origin, exact causality and missingness cannot be established from these CSVs alone.',
    }
    output = ROOT / 'ml' / 'audit_evidence.json'
    output.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps({k: v for k, v in report.items() if k != 'aggregate_zero_counts'}, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
