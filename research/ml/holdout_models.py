#!/usr/bin/env python3
"""Compare all three models on unseen historical attack scenarios/families.

This is exploratory: historical per-sample timestamps/injection were not preserved.
Run splits are grouped; excluded scenarios never enter training or validation.
"""
import argparse
import json
import time
from pathlib import Path
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.impute import SimpleImputer
from sklearn.metrics import confusion_matrix
from sklearn.neural_network import MLPClassifier
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
from experiment_audited import DATA, LABELS, ROOT, aggregated, split_groups, transformer_predict

OUT=ROOT/'ml'/'holdout_results'
FAMILIES={'brute_family':['20-attack-bruteforce','23-attack-lowbrute'],
          'flood_family':['21-attack-flood','25-attack-lowflood']}


def main():
    ap=argparse.ArgumentParser()
    ap.add_argument('--splits',type=int,default=5)
    ap.add_argument('--seeds',type=int,default=3)
    ap.add_argument('--epochs',type=int,default=25)
    args=ap.parse_args()
    meta=pd.read_csv(DATA/'windows.csv'); raw=np.load(DATA/'sequences.npz')
    X=raw['X']; A=aggregated(X)
    y=pd.Categorical(meta['class'],categories=LABELS).codes
    scenarios=sorted(meta.loc[meta['class']=='attack','scenario'].unique())
    groups={s:[s] for s in scenarios}|FAMILIES
    OUT.mkdir(parents=True,exist_ok=True)
    (OUT/'config.json').write_text(json.dumps(vars(args)|{'held_out':groups,
      'caveat':'Historical source sample timestamps and injection status unavailable.'},indent=2),encoding='utf8')
    predictions=[]; metrics=[]; splits=[]
    for split in range(args.splits):
        train,valid,test=split_groups(meta,split)
        for holdout,scns in groups.items():
            isheld=meta.scenario.isin(scns).to_numpy()
            tr=np.flatnonzero(meta.run_id.isin(train).to_numpy() & ~isheld)
            va=np.flatnonzero(meta.run_id.isin(valid).to_numpy() & ~isheld)
            te=np.flatnonzero(meta.run_id.isin(test).to_numpy() & ((y!=2)|isheld))
            if not np.any(y[te]==2): continue
            splits.append({'split':split,'holdout':holdout,
              'train_runs':sorted(set(meta.run_id.iloc[tr])),
              'validation_runs':sorted(set(meta.run_id.iloc[va])),
              'test_runs':sorted(set(meta.run_id.iloc[te]))})
            for seed in range(args.seeds):
                for name in ('rf','mlp','transformer'):
                    start=time.perf_counter()
                    if name=='transformer':
                        pred,epochs,train_s,infer_s=transformer_predict(X,y,tr,va,te,seed,args.epochs)
                    else:
                        base=(RandomForestClassifier(n_estimators=150,class_weight='balanced',random_state=seed,n_jobs=-1)
                              if name=='rf' else MLPClassifier(hidden_layer_sizes=(64,32),max_iter=150,
                                                                 early_stopping=False,random_state=seed))
                        steps=[SimpleImputer(strategy='median',add_indicator=True,keep_empty_features=True)]
                        if name=='mlp':steps.append(StandardScaler())
                        model=make_pipeline(*steps,base);model.fit(A[tr],y[tr])
                        train_s=time.perf_counter()-start;started=time.perf_counter();pred=model.predict(A[te])
                        infer_s=time.perf_counter()-started;epochs=None
                    cm=confusion_matrix(y[te],pred,labels=[0,1,2])
                    metrics.append({'split':split,'holdout':holdout,'model':name,'seed':seed,
                      'confusion':cm.tolist(),'attack_recall':float(cm[2,2]/max(1,cm[2].sum())),
                      'fault_as_attack':float(cm[1,2]/max(1,cm[1].sum())),
                      'norm_as_attack':float(cm[0,2]/max(1,cm[0].sum())),
                      'train_seconds':train_s,'inference_seconds':infer_s,'epochs':epochs})
                    for ix,p in zip(te,pred):
                        predictions.append({'split':split,'holdout':holdout,'model':name,'seed':seed,
                          'window_id':meta.window_id.iloc[ix],'run_id':meta.run_id.iloc[ix],
                          'scenario':meta.scenario.iloc[ix], 'truth':LABELS[y[ix]],'prediction':LABELS[p]})
                    print(f'{split=} {holdout=} {seed=} {name=} recall={metrics[-1]["attack_recall"]:.3f}',flush=True)
            # Checkpoint after each held-out group; interrupted work remains inspectable.
            (OUT/'metrics.json').write_text(json.dumps(metrics,indent=2),encoding='utf8')
            (OUT/'splits.json').write_text(json.dumps(splits,indent=2),encoding='utf8')
            pd.DataFrame(predictions).to_csv(OUT/'predictions.csv.gz',index=False)


if __name__=='__main__': main()
