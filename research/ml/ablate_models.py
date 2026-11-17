#!/usr/bin/env python3
"""Run grouped feature ablations for RF, MLP, and Transformer.

All models share samples, split assignments, history and seed. Validation is
group-disjoint and all learned preprocessing is fit only on training runs.
"""
import argparse
import json
import time
from pathlib import Path
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.impute import SimpleImputer
from sklearn.metrics import confusion_matrix, f1_score
from sklearn.pipeline import make_pipeline
from experiment_audited import LABELS, aggregated, transformer_predict
from mlp_group_validation import select

GROUPS={'none':[],
        'network_io':['net_rx_bytes','net_tx_bytes','open_conns'],
        'database':['pg_up','pg_tps','pg_active','pg_rollbacks'],
        'http_network':['rps_total','rps_4xx','rps_5xx','err_pct','lat_mean_s',
                        'lat_p95_s','req_p99_s','open_conns','rps_401_403',
                        'net_rx_bytes','net_tx_bytes']}


def main():
    ap=argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--data',type=Path,required=True)
    ap.add_argument('--base',type=Path,required=True)
    ap.add_argument('--out',type=Path,required=True)
    args=ap.parse_args()
    meta=pd.read_csv(args.data/'windows.csv');raw=np.load(args.data/'sequences.npz')
    X=raw['X'];names=list(raw['features']);y=pd.Categorical(meta['class'],categories=LABELS).codes
    if (y<0).any():raise ValueError('Unknown labels')
    missing=set(sum(GROUPS.values(),[]))-set(names)
    if missing:raise ValueError(f'Missing expected metric names: {sorted(missing)}')
    splits=[s for s in json.loads((args.base/'splits.json').read_text()) if not s['temporal']]
    if len(splits)!=5:raise ValueError('Expected five non-temporal grouped splits')
    variants={group:(X[:,:,[i for i,n in enumerate(names) if n not in drop]],
                    [n for n in names if n not in drop]) for group,drop in GROUPS.items()}
    matrices={g:aggregated(x) for g,(x,_) in variants.items()}
    args.out.mkdir(parents=True,exist_ok=True)
    config={'data':str(args.data),'base':str(args.base),'labels':LABELS,'groups':GROUPS,
            'features_retained':{g:n for g,(_,n) in variants.items()},'seeds':[0,1,2],
            'epochs_max':25,'scope':'Exploratory synthetic scenarios; split repetitions share runs.',
            'selection_metadata':'For MLP selected_epoch_or_limit is the selected iteration cap. '
              'For Transformer it is the number of completed training epochs, not the best epoch; '
              'the selected epoch and score are recorded separately in transformer_selection.',
            'warning':'Ablation removes named telemetry inputs, not all information correlated with them.'}
    (args.out/'config.json').write_text(json.dumps(config,indent=2),encoding='utf8')
    metrics=[];predictions=[]
    for s in splits:
        if set(s['train'])&set(s['valid']) or set(s['train'])&set(s['test']) or set(s['valid'])&set(s['test']):
            raise ValueError('Run leakage across split')
        tr=np.flatnonzero(meta.run_id.isin(s['train']));va=np.flatnonzero(meta.run_id.isin(s['valid']))
        te=np.flatnonzero(meta.run_id.isin(s['test']))
        for group,(seq,_) in variants.items():
            A=matrices[group]
            for seed in range(3):
                for model_name in ('rf','mlp','transformer'):
                    start=time.perf_counter();candidate_scores=None;transformer_selection=None
                    if model_name=='transformer':
                        pred,selected,train_s,infer_s,transformer_selection=transformer_predict(
                            seq,y,tr,va,te,seed,25,return_details=True)
                    elif model_name=='mlp':
                        model,selected,candidate_scores=select(A,y,tr,va,seed)
                        train_s=time.perf_counter()-start;t=time.perf_counter()
                        pred=model.predict(A[te]);infer_s=time.perf_counter()-t
                    else:
                        model=make_pipeline(SimpleImputer(strategy='median',add_indicator=True,keep_empty_features=True),
                          RandomForestClassifier(n_estimators=150,class_weight='balanced',random_state=seed,n_jobs=-1))
                        model.fit(A[tr],y[tr]);train_s=time.perf_counter()-start;t=time.perf_counter()
                        pred=model.predict(A[te]);infer_s=time.perf_counter()-t;selected=None
                    cm=confusion_matrix(y[te],pred,labels=[0,1,2])
                    metrics.append({'split':s['split'],'ablation':group,'seed':seed,'model':model_name,
                      'macro_f1':float(f1_score(y[te],pred,labels=[0,1,2],average='macro',zero_division=0)),
                      'confusion':cm.tolist(),'fault_as_attack':float(cm[1,2]/max(1,cm[1].sum())),
                      'norm_as_attack':float(cm[0,2]/max(1,cm[0].sum())),
                      'attack_as_fault':float(cm[2,1]/max(1,cm[2].sum())),
                      'selected_epoch_or_limit':selected,'validation_candidates':candidate_scores,
                      'transformer_selection':transformer_selection,
                      'train_seconds':train_s,'inference_seconds':infer_s})
                    for ix,p in zip(te,pred):
                        predictions.append({'split':s['split'],'ablation':group,'seed':seed,'model':model_name,
                          'window_id':meta.window_id.iloc[ix],'run_id':meta.run_id.iloc[ix],
                          'scenario':meta.scenario.iloc[ix],'truth':LABELS[y[ix]],'prediction':LABELS[int(p)]})
                    print(f"split={s['split']} ablation={group} seed={seed} model={model_name} "
                          f"macro_f1={metrics[-1]['macro_f1']:.3f}",flush=True)
            # Preserve completed variants after interruption; a partial run is never reported as complete.
            (args.out/'metrics.json').write_text(json.dumps(metrics,indent=2),encoding='utf8')
            pd.DataFrame(predictions).to_csv(args.out/'predictions.csv.gz',index=False)


if __name__=='__main__':main()
