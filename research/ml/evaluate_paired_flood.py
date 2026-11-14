#!/usr/bin/env python3
"""Apply historical models to identical-request flash/flood negative controls.

Labels encode assigned intent, not observable attacker intent or actual DoS.
Never train, tune, or select epochs using the new control runs.
"""
import json
import re
import time
from pathlib import Path
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.impute import SimpleImputer
from sklearn.pipeline import make_pipeline
from experiment_audited import DATA, LABELS, ROOT, aggregated, split_groups, transformer_predict
from mlp_group_validation import select

SOURCE=ROOT/'evidence'/'paired-flood'
OUT=ROOT/'ml'/'paired_flood_results'


def extract(data,names):
    if data.get('status')!='success' or data.get('assigned_condition') not in ('flash_crowd','simulated_flood'):
        raise ValueError('Unsuccessful or unlabelled run')
    if data.get('nominal_rate_rps')!=150 or data.get('profile')!='flat':
        raise ValueError('Unexpected workload')
    match=re.search(r'K6_SETUP_UNIX_MS=(\d+)',data.get('k6_log',''))
    if not match: raise ValueError('Missing k6 timestamp')
    start=int(match.group(1))/1000
    raw={k:{float(t):v for t,v in values.items()} for k,values in data['raw_series'].items()}
    grid=sorted(raw.get('rps_total',{})); rows=[]; seq=[]
    for i,ts in enumerate(grid):
        if not 235<=ts-start<=295 or i<17:continue
        times=grid[i-17:i+1]
        if times[0]<start+60 or any(abs(b-a-10)>.01 for a,b in zip(times,times[1:])):continue
        seq.append([[np.nan if raw.get(n,{}).get(t) is None else raw[n][t] for n in names] for t in times])
        rows.append({'window_id':data['run_id']+'#'+str(int(ts)), 'run_id':data['run_id'],
                     'condition':data['assigned_condition'], 'window_end':ts,
                     'observed_rps':raw['rps_total'][ts]})
    if not rows:raise ValueError('No complete in-run histories')
    return rows,seq


def main():
    history=pd.read_csv(DATA/'windows.csv'); historical=np.load(DATA/'sequences.npz')
    names=list(historical['features']); rows=[]; seq=[]; scripts=set()
    paths=sorted(SOURCE.glob('ids-control-*.json'))
    for path in paths:
        raw=json.loads(path.read_text(encoding='utf8'))
        scripts.add(raw['workload_script_sha256'])
        r,s=extract(raw,names); rows.extend(r); seq.extend(s)
    if len(paths)!=4 or len(scripts)!=1:raise ValueError('Expected four runs with identical workload hash')
    meta=pd.DataFrame(rows)
    if meta.groupby('condition').run_id.nunique().to_dict()!={'flash_crowd':2,'simulated_flood':2}:
        raise ValueError('Expected two independent runs per assignment')
    Xh=historical['X']; Xn=np.asarray(seq,dtype=np.float32)
    y=pd.Categorical(history['class'],categories=LABELS).codes
    X=np.concatenate([Xh,Xn]); labels=np.concatenate([y,np.zeros(len(Xn),dtype=int)])
    A=aggregated(X); te=np.arange(len(Xh),len(X)); predictions=[]; times=[]
    for split in range(5):
        train,valid,_=split_groups(history,split)
        tr=np.flatnonzero(history.run_id.isin(train));va=np.flatnonzero(history.run_id.isin(valid))
        for seed in range(3):
            for name in ('rf','mlp','transformer'):
                started=time.perf_counter()
                if name=='transformer':
                    pred,epochs,train_s,infer_s=transformer_predict(X,labels,tr,va,te,seed,25)
                    selection=None
                elif name=='mlp':
                    pipeline,epochs,selection=select(A,y,tr,va,seed)
                    train_s=time.perf_counter()-started; t=time.perf_counter()
                    pred=pipeline.predict(A[te]);infer_s=time.perf_counter()-t
                else:
                    model=RandomForestClassifier(n_estimators=150,class_weight='balanced',random_state=seed,n_jobs=-1)
                    steps=[SimpleImputer(strategy='median',add_indicator=True,keep_empty_features=True)]
                    pipeline=make_pipeline(*steps,model);pipeline.fit(A[tr],y[tr])
                    train_s=time.perf_counter()-started; t=time.perf_counter()
                    pred=pipeline.predict(A[te]);infer_s=time.perf_counter()-t;epochs=None;selection=None
                for row,p in zip(rows,pred):
                    predictions.append(dict(row,model=name,split=split,seed=seed,prediction=LABELS[int(p)]))
                times.append({'model':name,'split':split,'seed':seed,'train_s':train_s,
                              'inference_s':infer_s,'epochs':epochs,'train_runs':sorted(train),
                              'validation_runs':sorted(valid),'validation_candidates':selection})
                print(split,seed,name,flush=True)
    OUT.mkdir(parents=True,exist_ok=True)
    pd.DataFrame(predictions).to_csv(OUT/'predictions.csv.gz',index=False)
    meta.to_csv(OUT/'windows.csv',index=False)
    (OUT/'config.json').write_text(json.dumps({'script_hash':next(iter(scripts)),
        'training':'historical train only, grouped validation; no new control used for fitting',
        'splits':5,'seeds':3,'conditions':'assigned intent; identical requests; no actual DoS established',
        'times_and_splits':times},indent=2),encoding='utf8')
    print(pd.DataFrame(predictions).groupby(['condition','model','prediction']).size().to_string())


if __name__=='__main__':main()
