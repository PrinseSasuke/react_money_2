#!/usr/bin/env python3
"""Repeat held-out attack comparisons with grouped MLP iteration selection."""
import json
import time
import numpy as np
import pandas as pd
from sklearn.metrics import confusion_matrix
from experiment_audited import DATA, LABELS, ROOT, aggregated
from mlp_group_validation import select

OUT=ROOT/'ml'/'holdout_mlp_validation'
BASE=ROOT/'ml'/'holdout_results'


def main():
    meta=pd.read_csv(DATA/'windows.csv');X=np.load(DATA/'sequences.npz')['X'];A=aggregated(X)
    y=pd.Categorical(meta['class'],categories=LABELS).codes
    splits=json.loads((BASE/'splits.json').read_text())
    config=json.loads((BASE/'config.json').read_text()); records=[];predictions=[]
    for s in splits:
        held=set(config['held_out'][s['holdout']])
        tr=np.flatnonzero(meta.run_id.isin(s['train_runs']));va=np.flatnonzero(meta.run_id.isin(s['validation_runs']))
        te=np.flatnonzero(meta.run_id.isin(s['test_runs']) & ((y!=2)|meta.scenario.isin(held)))
        if set(meta.scenario.iloc[tr])&held or set(meta.scenario.iloc[va])&held:
            raise ValueError('Held-out attack leaked into training or validation')
        for seed in range(3):
            start=time.perf_counter();model,cap,candidates=select(A,y,tr,va,seed)
            train_s=time.perf_counter()-start;start=time.perf_counter();pred=model.predict(A[te])
            cm=confusion_matrix(y[te],pred,labels=[0,1,2])
            records.append({'split':s['split'],'holdout':s['holdout'],'seed':seed,'selected_max_iter':cap,
                'validation_candidates':candidates,'confusion':cm.tolist(),
                'attack_recall':float(cm[2,2]/max(1,cm[2].sum())),
                'selection_train_s':train_s,'inference_s':time.perf_counter()-start})
            for ix,p in zip(te,pred):
                predictions.append({'split':s['split'],'holdout':s['holdout'],'seed':seed,
                    'window_id':meta.window_id.iloc[ix],'run_id':meta.run_id.iloc[ix],
                    'truth':LABELS[y[ix]],'prediction':LABELS[int(p)]})
        OUT.mkdir(parents=True,exist_ok=True)
        (OUT/'metrics.json').write_text(json.dumps(records,indent=2),encoding='utf8')
        pd.DataFrame(predictions).to_csv(OUT/'predictions.csv.gz',index=False)
        print(s['split'],s['holdout'],flush=True)


if __name__=='__main__':main()
