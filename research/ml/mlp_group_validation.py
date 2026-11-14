#!/usr/bin/env python3
"""Compare MLP iteration caps selected on whole validation runs, never on test."""
import json
import time
import argparse
from pathlib import Path
import numpy as np
import pandas as pd
from sklearn.exceptions import ConvergenceWarning
from sklearn.impute import SimpleImputer
from sklearn.metrics import f1_score
from sklearn.neural_network import MLPClassifier
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
import warnings
from experiment_audited import ROOT, LABELS, aggregated, nested_subset

DATA=ROOT/'evidence'/'verified'
BASE=ROOT/'ml'/'verified_results'
OUT=ROOT/'ml'/'mlp_group_validation'
CAPS=(50,100,150)


def select(A,y,tr,va,seed,caps=CAPS):
    """Return fitted train-only candidate, chosen by macro-F1 on grouped validation."""
    best=None; evaluations=[]
    for cap in caps:
        pipe=make_pipeline(SimpleImputer(strategy='median',add_indicator=True,keep_empty_features=True),
            StandardScaler(),MLPClassifier(hidden_layer_sizes=(64,32),max_iter=cap,
            early_stopping=False,random_state=seed,tol=0,n_iter_no_change=1000))
        with warnings.catch_warnings():
            warnings.simplefilter('ignore',ConvergenceWarning)
            pipe.fit(A[tr],y[tr])
        score=f1_score(y[va],pipe.predict(A[va]),labels=[0,1,2],average='macro',zero_division=0)
        evaluations.append({'max_iter':cap,'actual_iterations':int(pipe[-1].n_iter_),
                            'validation_macro_f1':float(score)})
        if best is None or score>best[0]: best=(score,cap,pipe)
    return best[2],best[1],evaluations


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--data',type=Path,default=DATA)
    parser.add_argument('--base',type=Path,default=BASE)
    parser.add_argument('--out',type=Path,default=OUT)
    args=parser.parse_args()
    meta=pd.read_csv(args.data/'windows.csv'); raw=np.load(args.data/'sequences.npz')
    A=aggregated(raw['X']); y=pd.Categorical(meta['class'],categories=LABELS).codes
    splits=json.loads((args.base/'splits.json').read_text(encoding='utf8'))
    predictions=[]; metrics=[]
    for s in splits:
        split=s['split'];va=np.flatnonzero(meta.run_id.isin(s['valid']))
        te=np.flatnonzero(meta.run_id.isin(s['test']))
        assert not (set(s['train'])&set(s['valid']) or set(s['train'])&set(s['test']) or set(s['valid'])&set(s['test']))
        for fraction in (.5,.75,1.):
            selected=nested_subset(meta,s['train'],fraction,split)
            tr=np.flatnonzero(meta.run_id.isin(selected))
            for seed in range(3):
                start=time.perf_counter();model,cap,validation=select(A,y,tr,va,seed)
                train_s=time.perf_counter()-start;start=time.perf_counter();pred=model.predict(A[te])
                metrics.append({'split':split,'temporal':s['temporal'],'fraction':fraction,'seed':seed,
                    'selected_max_iter':cap,'validation_candidates':validation,
                    'macro_f1':f1_score(y[te],pred,labels=[0,1,2],average='macro',zero_division=0),
                    'selection_train_s':train_s,'inference_s':time.perf_counter()-start,
                    'train_runs':selected,'validation_runs':s['valid'],'test_runs':s['test']})
                for ix,p in zip(te,pred):
                    predictions.append({'split':split,'temporal':s['temporal'],'fraction':fraction,'seed':seed,
                        'window_id':meta.window_id.iloc[ix],'run_id':meta.run_id.iloc[ix],
                        'truth':LABELS[y[ix]],'prediction':LABELS[int(p)]})
                print(split,fraction,seed,cap,metrics[-1]['macro_f1'],flush=True)
        args.out.mkdir(parents=True,exist_ok=True)
        (args.out/'metrics.json').write_text(json.dumps(metrics,indent=2),encoding='utf8')
        pd.DataFrame(predictions).to_csv(args.out/'predictions.csv.gz',index=False)


if __name__=='__main__':main()
