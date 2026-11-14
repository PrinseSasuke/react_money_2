#!/usr/bin/env python3
"""Summarise repeated group splits and uncertainty at run level."""
import json
import argparse
from pathlib import Path
import numpy as np
import pandas as pd
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from sklearn.metrics import f1_score, confusion_matrix
from experiment_audited import OUT, DATA, nested_subset, LABELS


def main():
    global OUT, DATA
    parser=argparse.ArgumentParser()
    parser.add_argument('--data',type=Path,default=DATA)
    parser.add_argument('--out',type=Path,default=OUT)
    args=parser.parse_args(); DATA=args.data; OUT=args.out
    pred = pd.read_csv(OUT / 'predictions.csv.gz')
    meta = pd.read_csv(DATA / 'windows.csv')
    splits = json.loads((OUT / 'splits.json').read_text(encoding='utf-8'))
    config = json.loads((OUT / 'config.json').read_text(encoding='utf-8'))
    all_subsets = []
    for s in splits:
        for fraction in (.5, .75, 1.):
            all_subsets.append({'split': s['split'], 'fraction': fraction,
                                'train_runs': nested_subset(meta, s['train'], fraction, s['split'],
                                                            config.get('subset_mode','legacy'))})
    (OUT / 'train_subsets.json').write_text(json.dumps(all_subsets, indent=2), encoding='utf-8')
    rows = []
    # The split, not its highly correlated windows or model seeds, is the uncertainty unit.
    for (model, frac, temporal, split), g in pred.groupby(['model', 'fraction', 'temporal', 'split']):
        for seed, gg in g.groupby('seed'):
            rows.append({'model':model,'fraction':frac,'temporal':temporal,'split':split,'seed':seed,
                         'macro_f1':f1_score(gg.truth, gg.prediction, labels=LABELS, average='macro', zero_division=0)})
    scores = pd.DataFrame(rows)
    per_split = scores.groupby(['model','fraction','temporal','split'], as_index=False).macro_f1.mean()
    table = per_split.groupby(['model','fraction','temporal']).macro_f1.agg(['mean','std','count']).reset_index()
    table.to_csv(OUT / 'macro_f1_by_split.csv', index=False)
    fig, ax = plt.subplots(figsize=(6.7, 4.2))
    for model, group in table[~table.temporal].groupby('model'):
        group = group.sort_values('fraction')
        ax.errorbar(group.fraction*100, group['mean'], yerr=group['std'].fillna(0), marker='o', capsize=3, label=model)
    ax.set(xlabel='Объём обучающих прогонов, %', ylabel='Macro-F1', ylim=(0,1.04), xticks=[50,75,100])
    ax.grid(alpha=.25); ax.legend(); fig.tight_layout(); fig.savefig(OUT / 'learning_curves.png', dpi=160); plt.close(fig)
    pair_defs = {'flash_vs_flood':['01-norm-flashcrowd','21-attack-flood','25-attack-lowflood'],
                 'auth_vs_brute':['14-fault-authfail','20-attack-bruteforce','23-attack-lowbrute'],
                 'verified_401':['auth-misconfiguration','auth-guessing']}
    pair_rows = []
    for (split, model, scenario, truth), g in pred[(pred.fraction==1) & (~pred.temporal)].groupby(['split','model','scenario','truth']):
        for pair, scenarios in pair_defs.items():
            if scenario in scenarios:
                for guessed, count in g.prediction.value_counts().items():
                    pair_rows.append({'pair':pair,'split':split,'model':model,'scenario':scenario,
                                      'truth':truth,'prediction':guessed,'windows_across_seeds':int(count),
                                      'runs':g.run_id.nunique()})
    pd.DataFrame(pair_rows).to_csv(OUT / 'pair_errors.csv', index=False)
    journal_path = DATA.parent / 'legacy' / 'journal.jsonl'
    journal = {r['run_id']: r for r in (json.loads(line) for line in
        journal_path.read_text(encoding='utf-8').splitlines() if line)} if journal_path.exists() else {}
    verified_runs = {}
    for folder in ('auth-pair', 'matched-control'):
        for file in (DATA.parent / folder).glob('ids-control-*.json'):
            record=json.loads(file.read_text(encoding='utf-8'))
            verified_runs[record['run_id']]=record
    intensity_rows = []
    selected = pred[(pred.model == 'rf') & (pred.fraction == 1) & (~pred.temporal)]
    for (split, seed, rid), g in selected.groupby(['split', 'seed', 'run_id']):
        r = journal.get(rid)
        if r is not None:
            if r['class'] != 'attack': continue
            intensity = r.get('intensity') or {}
            rate = intensity.get('job_rate', intensity.get('flood_rate'))
            baseline, duration, scenario = intensity.get('rate'), intensity.get('duration_s'), r['scenario']
        else:
            r = verified_runs.get(rid)
            if r is None or g.truth.iloc[0] != 'attack': continue
            rate, baseline, duration, scenario = r.get('nominal_rate_rps'), None, r.get('duration_s'), g.scenario.iloc[0]
        intensity_rows.append({'split': split, 'seed': seed, 'run_id': rid, 'scenario':scenario,
          'attack_rate_rps': rate, 'baseline_rate_rps':baseline,
          'duration_s':duration, 'n_windows':len(g),
          'attack_recall':float((g.prediction == 'attack').mean())})
    pd.DataFrame(intensity_rows).to_csv(OUT / 'attack_intensity.csv', index=False)
    # Cluster bootstrap on one fixed held-out test, one seed: illustrative, not a population guarantee.
    g = pred[(pred.model=='rf') & (pred.fraction==1) & (pred.split==0) & (pred.seed==0)]
    rng = np.random.RandomState(2411); runids = g.run_id.unique(); boot = []
    for _ in range(1000):
        sampled = rng.choice(runids, len(runids), replace=True)
        sample = pd.concat([g[g.run_id==r] for r in sampled], ignore_index=True)
        boot.append(f1_score(sample.truth, sample.prediction, labels=LABELS, average='macro', zero_division=0))
    interval = np.percentile(boot,[2.5,97.5]).tolist()
    (OUT / 'bootstrap.json').write_text(json.dumps({'model':'rf','split':0,'seed':0,'unit':'run_id',
        'samples':1000,'macro_f1_percentile_95':interval,'caveat':'Conditional on the selected held-out runs.'},indent=2),encoding='utf-8')
    print(table.to_string(index=False)); print('rf grouped bootstrap interval', interval)


if __name__ == '__main__': main()
