#!/usr/bin/env python3
"""Describe matched-endpoint controls. Never interpret traffic labels as intent."""
import json
import re
from pathlib import Path
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from sklearn.ensemble import RandomForestClassifier
from sklearn.impute import SimpleImputer
from sklearn.pipeline import make_pipeline
from experiment_audited import aggregated, DATA, LABELS

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'evidence' / 'matched-control'
DEST = ROOT / 'ml' / 'audited_results'


def main():
    records=[]; fig,axes=plt.subplots(2,1,figsize=(8,6),sharex=True)
    historical = np.load(DATA / 'sequences.npz')
    names = list(historical['features'])
    meta_path = DATA / 'windows.csv'
    import pandas as pd
    hist_meta = pd.read_csv(meta_path)
    hist_y = pd.Categorical(hist_meta['class'], categories=LABELS).codes
    classifier = make_pipeline(SimpleImputer(strategy='median',add_indicator=True,keep_empty_features=True),
                  RandomForestClassifier(n_estimators=150,class_weight='balanced',random_state=0,n_jobs=-1))
    classifier.fit(aggregated(historical['X']),hist_y)
    for path in sorted(SOURCE.glob('ids-control-*.json')):
        data=json.loads(path.read_text(encoding='utf-8'))
        if data.get('status') != 'success':
            print('excluded failed run:',path.name); continue
        match=re.search(r'K6_SETUP_UNIX_MS=(\d+)',data.get('k6_log',''))
        if not match:
            print('excluded missing setup timestamp:',path.name); continue
        start=int(match.group(1))/1000
        summary={'run_id':data['run_id'], 'profile':data['profile'], 'setup_epoch':start,
                 'experiment_version':data.get('experiment_version','matched-ramp60s-v1'),
                 'time_interval_s':[235,295], 'job_status':data['status'], 'features':{}}
        # Construct 18-sample histories only from the timestamped current job.
        raw = {k:{float(t):v for t,v in vals.items()} for k,vals in data['raw_series'].items()}
        grid = sorted(raw.get('rps_total',{}))
        sequences=[]
        for idx,t in enumerate(grid):
            if not 235 <= t-start <= 295 or idx < 17: continue
            times=grid[idx-17:idx+1]
            if times[0] < start+60 or any(abs(b-a-10)>0.01 for a,b in zip(times,times[1:])): continue
            sequences.append([[np.nan if raw.get(n,{}).get(ts) is None else raw[n][ts]
                               for n in names] for ts in times])
        if sequences:
            predictions=classifier.predict(aggregated(np.asarray(sequences,dtype=float)))
            summary['historical_rf_predictions']={LABELS[i]:int((predictions==i).sum()) for i in range(3)}
            summary['prediction_caveat']='RF trained on all historical data; workload is a synthetic profile, not a confirmed attack.'
        for ax,key in zip(axes,['rps_total','pg_tps']):
            points=sorted((float(t)-start, float(v)) for t,v in data['raw_series'].get(key,{}).items()
                          if v is not None and 235 <= float(t)-start <= 295)
            if not points:
                print('warning: no points for',path.name,key); continue
            vals=np.array([v for _,v in points])
            summary['features'][key]={'samples':len(vals),'min':float(np.min(vals)),
                'median':float(np.median(vals)),'max':float(np.max(vals))}
            version=data.get('experiment_version','matched-ramp60s-v1').replace('matched-ramp','')
            ax.plot([t for t,_ in points], vals, label=f'{data["profile"]} {data["repeat"]} {version}', alpha=.8)
            ax.set_ylabel(key); ax.grid(alpha=.25)
        records.append(summary)
    DEST.mkdir(parents=True,exist_ok=True)
    (DEST/'matched_control_summary.json').write_text(json.dumps(records,indent=2,ensure_ascii=False),encoding='utf-8')
    if records:
        axes[0].legend(fontsize=8); axes[-1].set_xlabel('Секунды от setup k6')
        fig.suptitle('Контрольные профили: одинаковый endpoint и источник')
        fig.tight_layout(); fig.savefig(DEST/'matched_control.png',dpi=160)
    plt.close(fig)
    print(json.dumps(records,indent=2,ensure_ascii=False))


if __name__ == '__main__': main()
